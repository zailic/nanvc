import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';
import { NodeVaultTransport } from '../../../../src/v2/transport/node-transport.js';

import type { SinonSandbox } from 'sinon';
import type { VaultRequestOptions, VaultTransportResponse } from '../../../../src/v2/transport/types.js';
import { suite, test, beforeEachTest, afterEachTest } from '../../../mocha/decorators.js';

@suite('RawVaultClient unit test cases.')
export class RawVaultClientUnitTests {
    private sandbox!: SinonSandbox;

    @beforeEachTest()
    public beforeEach() {
        this.sandbox = createSandbox();
    }

    @afterEachTest()
    public afterEach() {
        this.sandbox.restore();
    }

    @test('should take the auth token from the environment by default')
    public async shouldTakeTheAuthTokenFromTheEnvironmentByDefaultTest() {
        this.sandbox.stub(process, 'env').value({
            NANVC_VAULT_AUTH_TOKEN: 'env-token',
        });
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient();

        await client.get('/sys/auth');

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'env-token');
    }

    @test('should allow overriding the token with setToken')
    public async shouldAllowOverridingTheTokenWithSettokenTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'initial-token' });

        client.setToken('updated-token');
        await client.get('/sys/auth');

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'updated-token');
    }

    @test('should omit the current token for generated unauthenticated operations')
    public async shouldOmitTheCurrentTokenForGeneratedUnauthenticatedOperationsTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.post('/auth/{approle_mount_path}/login', {
            body: {
                role_id: 'role-id',
                secret_id: 'secret-id',
            },
            params: {
                path: {
                    approle_mount_path: 'approle',
                },
            },
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, null);
    }

    @test('should allow explicit unauthenticated requests for unknown paths')
    public async shouldAllowExplicitUnauthenticatedRequestsForUnknownPathsTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.post('/custom/login', {
            authenticated: false,
            body: {
                username: 'user',
            },
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, null);
    }

    @test('should allow forcing authentication for generated unauthenticated operations')
    public async shouldAllowForcingAuthenticationForGeneratedUnauthenticatedOperationsTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.get('/sys/health', {
            authenticated: true,
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'client-token');
    }

    @test('should shape request options before delegating to the transport')
    public async shouldShapeRequestOptionsBeforeDelegatingToTheTransportTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.post('/sys/mounts/{path}', {
            body: { type: 'kv' },
            headers: { 'X-Test': '1' },
            params: {
                path: { path: '/kv/team a' },
                query: { detailed: true, limit: 10, optional: undefined },
            },
        });

        assert.equal(transportStub.calledOnce, true);
        assert.deepEqual(transportStub.firstCall.firstArg, {
            body: { type: 'kv' },
            headers: { 'X-Test': '1' },
            method: 'POST',
            path: 'sys/mounts/kv/team%20a',
            query: { detailed: true, limit: 10, optional: undefined },
            token: 'client-token',
        } satisfies VaultRequestOptions);
    }

    @test('should resolve malformed template-like paths without regex backtracking')
    public async shouldResolveMalformedTemplateLikePathsWithoutRegexBacktrackingTest() {
        const transportStub = this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient();
        const path = `/${'{{|'.repeat(1000)}tail`;

        await client.get(path, {
            params: {
                path: {
                    unused: 'value',
                },
            },
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.path, path.slice(1));
    }

    @test('should throw a validation error when a required path parameter is missing')
    public shouldThrowAValidationErrorWhenARequiredPathParameterIsMissingTest() {
        const client = new RawVaultClient();

        assert.throws(
            () => {
                void client.get('/sys/mounts/{path}', {
                    params: {
                        path: {},
                    },
                });
            },
            (error: unknown) => {
                assert.equal(error instanceof VaultClientError, true);
                assert.equal((error as VaultClientError).code, 'VALIDATION_ERROR');
                assert.equal((error as VaultClientError).message, 'Missing path parameter: path');
                return true;
            },
        );
    }

    @test('should route patch through request with the PATCH method')
    public async shouldRoutePatchThroughRequestWithThePatchMethodTest() {
        const client = new RawVaultClient();
        const requestStub = this.sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.patch('/sys/test');

        assert.equal(requestStub.calledOnceWithExactly('PATCH', '/sys/test', {}), true);
    }

    @test('should route delete through request with the DELETE method')
    public async shouldRouteDeleteThroughRequestWithTheDeleteMethodTest() {
        const client = new RawVaultClient();
        const requestStub = this.sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.delete('/sys/policy/test-policy');

        assert.equal(requestStub.calledOnceWithExactly('DELETE', '/sys/policy/test-policy', {}), true);
    }

    @test('should route head through request with the HEAD method')
    public async shouldRouteHeadThroughRequestWithTheHeadMethodTest() {
        const client = new RawVaultClient();
        const requestStub = this.sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.head('/sys/health');

        assert.equal(requestStub.calledOnceWithExactly('HEAD', '/sys/health', {}), true);
    }

    @test('should route list through request with the LIST method')
    public async shouldRouteListThroughRequestWithTheListMethodTest() {
        const client = new RawVaultClient();
        const requestStub = this.sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.list('/sys/policy');

        assert.equal(requestStub.calledOnceWithExactly('LIST', '/sys/policy', {}), true);
    }

    @test('should return ok tuples for successful responses')
    public async shouldReturnOkTuplesForSuccessfulResponsesTest() {
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse({ healthy: true }));
        const client = new RawVaultClient();

        const [data, error] = await client.get<{ healthy: boolean }>('/sys/health');

        assert.deepEqual(data, { healthy: true });
        assert.equal(error, null);
    }

    @test('should unwrap successful results')
    public async shouldUnwrapSuccessfulResultsTest() {
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse({ healthy: true }));
        const client = new RawVaultClient();

        const data = await client.get<{ healthy: boolean }>('/sys/health').unwrap();

        assert.deepEqual(data, { healthy: true });
    }

    @test('should convert non-ok responses into HTTP_ERROR results')
    public async shouldConvertNonOkResponsesIntoHttpErrorResultsTest() {
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves({
            body: { errors: ['backend says no'] },
            headers: {},
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });
        const client = new RawVaultClient();

        const [data, error] = await client.get('/sys/health');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.message, 'backend says no');
        assert.equal(error?.status, 403);
        assert.deepEqual(error?.responseBody, { errors: ['backend says no'] });
    }

    @test('should reject unwrap on failed results')
    public async shouldRejectUnwrapOnFailedResultsTest() {
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').resolves({
            body: { errors: ['backend says no'] },
            headers: {},
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });
        const client = new RawVaultClient();

        await assert.rejects(client.get('/sys/health').unwrap(), (error: unknown) => {
            assert.equal(error instanceof VaultClientError, true);
            assert.equal((error as VaultClientError).code, 'HTTP_ERROR');
            return true;
        });
    }

    @test('should preserve VaultClientError instances thrown by the transport')
    public async shouldPreserveVaultclienterrorInstancesThrownByTheTransportTest() {
        const transportError = new VaultClientError({
            code: 'TIMEOUT',
            message: 'Timed out',
        });
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').rejects(transportError);
        const client = new RawVaultClient();

        const [data, error] = await client.get('/sys/health');

        assert.equal(data, null);
        assert.equal(error, transportError);
    }

    @test('should wrap unknown transport failures in an UNKNOWN_ERROR result')
    public async shouldWrapUnknownTransportFailuresInAnUnknownErrorResultTest() {
        this.sandbox.stub(NodeVaultTransport.prototype, 'request').rejects(new Error('socket closed'));
        const client = new RawVaultClient();

        const [data, error] = await client.get('/sys/health');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'UNKNOWN_ERROR');
        assert.equal(error?.message, 'socket closed');
        assert.equal(error?.cause instanceof Error, true);
    }
}

function okResponse(body: unknown = undefined): VaultTransportResponse {
    return {
        body,
        headers: {},
        ok: true,
        status: 200,
        statusText: 'OK',
    };
}

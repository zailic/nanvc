import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { RawVaultClient } from '../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../src/v2/core/errors.js';
import { NodeVaultTransport } from '../../../src/v2/transport/node-transport.js';

import type { SinonSandbox } from 'sinon';
import type { VaultRequestOptions, VaultTransportResponse } from '../../../src/v2/transport/types.js';

describe('RawVaultClient unit test cases.', function () {
    let sandbox: SinonSandbox;

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should take the auth token from the environment by default', async function () {
        sandbox.stub(process, 'env').value({
            NANVC_VAULT_AUTH_TOKEN: 'env-token',
        });
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient();

        await client.get('/sys/auth');

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'env-token');
    });

    it('should allow overriding the token with setToken', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'initial-token' });

        client.setToken('updated-token');
        await client.get('/sys/auth');

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'updated-token');
    });

    it('should omit the current token for generated unauthenticated operations', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
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
    });

    it('should allow explicit unauthenticated requests for unknown paths', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.post('/custom/login', {
            authenticated: false,
            body: {
                username: 'user',
            },
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, null);
    });

    it('should allow forcing authentication for generated unauthenticated operations', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
        const client = new RawVaultClient({ authToken: 'client-token' });

        await client.get('/sys/health', {
            authenticated: true,
        });

        assert.equal(transportStub.calledOnce, true);
        assert.equal(transportStub.firstCall.firstArg.token, 'client-token');
    });

    it('should shape request options before delegating to the transport', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
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
    });

    it('should resolve malformed template-like paths without regex backtracking', async function () {
        const transportStub = sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse());
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
    });

    it('should throw a validation error when a required path parameter is missing', function () {
        const client = new RawVaultClient();

        assert.throws(() => {
            void client.get('/sys/mounts/{path}', {
                params: {
                    path: {},
                },
            });
        }, (error: unknown) => {
            assert.equal(error instanceof VaultClientError, true);
            assert.equal((error as VaultClientError).code, 'VALIDATION_ERROR');
            assert.equal((error as VaultClientError).message, 'Missing path parameter: path');
            return true;
        });
    });

    it('should route delete through request with the DELETE method', async function () {
        const client = new RawVaultClient();
        const requestStub = sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.delete('/sys/policy/test-policy');

        assert.equal(requestStub.calledOnceWithExactly('DELETE', '/sys/policy/test-policy', {}), true);
    });

    it('should route head through request with the HEAD method', async function () {
        const client = new RawVaultClient();
        const requestStub = sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.head('/sys/health');

        assert.equal(requestStub.calledOnceWithExactly('HEAD', '/sys/health', {}), true);
    });

    it('should route list through request with the LIST method', async function () {
        const client = new RawVaultClient();
        const requestStub = sandbox.stub(client, 'request').resolves([undefined, null]);

        await client.list('/sys/policy');

        assert.equal(requestStub.calledOnceWithExactly('LIST', '/sys/policy', {}), true);
    });

    it('should return ok tuples for successful responses', async function () {
        sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse({ healthy: true }));
        const client = new RawVaultClient();

        const [data, error] = await client.get<{ healthy: boolean }>('/sys/health');

        assert.deepEqual(data, { healthy: true });
        assert.equal(error, null);
    });

    it('should unwrap successful results', async function () {
        sandbox.stub(NodeVaultTransport.prototype, 'request').resolves(okResponse({ healthy: true }));
        const client = new RawVaultClient();

        const data = await client.get<{ healthy: boolean }>('/sys/health').unwrap();

        assert.deepEqual(data, { healthy: true });
    });

    it('should convert non-ok responses into HTTP_ERROR results', async function () {
        sandbox.stub(NodeVaultTransport.prototype, 'request').resolves({
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
    });

    it('should reject unwrap on failed results', async function () {
        sandbox.stub(NodeVaultTransport.prototype, 'request').resolves({
            body: { errors: ['backend says no'] },
            headers: {},
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });
        const client = new RawVaultClient();

        await assert.rejects(
            client.get('/sys/health').unwrap(),
            (error: unknown) => {
                assert.equal(error instanceof VaultClientError, true);
                assert.equal((error as VaultClientError).code, 'HTTP_ERROR');
                return true;
            },
        );
    });

    it('should preserve VaultClientError instances thrown by the transport', async function () {
        const transportError = new VaultClientError({
            code: 'TIMEOUT',
            message: 'Timed out',
        });
        sandbox.stub(NodeVaultTransport.prototype, 'request').rejects(transportError);
        const client = new RawVaultClient();

        const [data, error] = await client.get('/sys/health');

        assert.equal(data, null);
        assert.equal(error, transportError);
    });

    it('should wrap unknown transport failures in an UNKNOWN_ERROR result', async function () {
        sandbox.stub(NodeVaultTransport.prototype, 'request').rejects(new Error('socket closed'));
        const client = new RawVaultClient();

        const [data, error] = await client.get('/sys/health');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'UNKNOWN_ERROR');
        assert.equal(error?.message, 'socket closed');
        assert.equal(error?.cause instanceof Error, true);
    });
});

function okResponse(body: unknown = undefined): VaultTransportResponse {
    return {
        body,
        headers: {},
        ok: true,
        status: 200,
        statusText: 'OK',
    };
}

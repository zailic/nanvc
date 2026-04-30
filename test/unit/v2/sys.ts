import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { VaultSystemWrappingClient } from '../../../src/v2/client/sys-wrapping.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../src/v2/core/errors.js';
import { err, ok, toResult } from '../../../src/v2/core/result.js';

import type { SinonSandbox } from 'sinon';

describe('VaultSystemWrappingClient unit test cases.', function () {
    let sandbox: SinonSandbox;

    const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
        toResult(Promise.resolve(tuple));

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should look up wrapping properties for a given token', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                data: {
                    creation_path: 'sys/wrapping/wrap',
                    creation_time: '2024-01-01T00:00:00Z',
                    creation_ttl: 300,
                },
            })),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        const [data, error] = await client.lookup('s.abc123');

        assert.equal(error, null);
        assert.equal(data?.creation_path, 'sys/wrapping/wrap');
        assert.equal(data?.creation_ttl, 300);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/sys/wrapping/lookup');
        assert.deepEqual(postStub.firstCall.args[1], { body: { token: 's.abc123' } });
    });

    it('should surface lookup errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        const validationError = new VaultClientError({
            code: 'VALIDATION_ERROR',
            message: 'Vault wrapping lookup response did not include data',
            responseBody: {},
        });

        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').onFirstCall().returns(
            resultOf(err(clientError)),
        );
        postStub.onSecondCall().returns(
            resultOf(ok({})), // simulate invalid response without "data" property
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        await assert.rejects(
            client.lookup('s.abc123').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
        await assert.rejects(
            client.lookup('s.abc123').unwrap(),
            (error: unknown) => {
                assert.deepEqual(error, validationError);
                return true;
            }
        );
    });

    it('should wrap data with the given TTL', async function () {
        const wrapInfo = {
            token: 's.wrapped',
            accessor: 'accessor123',
            ttl: 300,
            creation_time: '2024-01-01T00:00:00Z',
            creation_path: 'sys/wrapping/wrap',
            wrapped_accessor: 'wrapped_accessor123',
        };
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({ wrap_info: wrapInfo })),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        const [data, error] = await client.wrap({ role_id: 'r1', secret_id: 's1' }, '300s');

        assert.equal(error, null);
        assert.deepEqual(data?.wrap_info, wrapInfo);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/sys/wrapping/wrap');
        assert.deepEqual(postStub.firstCall.args[1], {
            headers: { 'X-Vault-Wrap-TTL': '300s' },
            body: { role_id: 'r1', secret_id: 's1' },
        });
    });

    it('should surface wrap errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Bad Request',
            status: 400,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        await assert.rejects(
            client.wrap({ foo: 'bar' }, '60s').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should unwrap a response-wrapped token', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({ data: { role_id: 'r1', secret_id: 's1' } })),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        const [data, error] = await client.unwrap('s.wrapping_token');

        assert.equal(error, null);
        assert.deepEqual(data?.data, { role_id: 'r1', secret_id: 's1' });
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/sys/wrapping/unwrap');
        assert.deepEqual(postStub.firstCall.args[1], { body: { token: 's.wrapping_token' } });
    });

    it('should surface unwrap errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Not Found',
            status: 404,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        await assert.rejects(
            client.unwrap('s.wrapping_token').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should rewrap a response-wrapped token', async function () {
        const wrapInfo = {
            token: 's.new_wrapped',
            accessor: 'new_accessor',
            ttl: 300,
            creation_time: '2024-01-01T00:00:00Z',
            creation_path: 'sys/wrapping/wrap',
            wrapped_accessor: 'new_wrapped_accessor',
        };
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({ wrap_info: wrapInfo })),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        const [data, error] = await client.rewrap('s.old_wrapping_token');

        assert.equal(error, null);
        assert.deepEqual(data?.wrap_info, wrapInfo);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/sys/wrapping/rewrap');
        assert.deepEqual(postStub.firstCall.args[1], { body: { token: 's.old_wrapping_token' } });
    });

    it('should surface rewrap errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultSystemWrappingClient(new RawVaultClient());

        await assert.rejects(
            client.rewrap('s.old_wrapping_token').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });
});

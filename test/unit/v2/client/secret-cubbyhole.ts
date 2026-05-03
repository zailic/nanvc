import type { SinonSandbox } from 'sinon';
import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { suite, test, beforeEachTest, afterEachTest } from '../../../mocha/decorators.js';

import { VaultSecretCubbyholeClient } from '../../../../src/v2/client/secret-cubbyhole.js';
import { VaultClientError } from '../../../../src/main.js';
import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';

@suite('VaultSecretCubbyholeClient unit test cases.')
export class VaultSecretCubbyholeClientTests {
    private sandbox!: SinonSandbox;

    @beforeEachTest()
    beforeEach() {
        this.sandbox = createSandbox();
    }

    @afterEachTest()
    afterEach() {
        this.sandbox.restore();
    }

    @test('read should return a VALIDATION_ERROR for an empty path')
    public async readShouldReturnValidationErrorForEmptyPath() {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.read('');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    };

    @test('write should return a VALIDATION_ERROR for an empty path')
    public async writeShouldReturnValidationErrorForEmptyPath() {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.write('', { key: 'val' });

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    };

    @test('delete should return a VALIDATION_ERROR for an empty path')
    public async deleteShouldReturnValidationErrorForEmptyPath() {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.delete('');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    };

    @test('read should call raw.get with the correct path')
    public async readShouldCallRawGetWithCorrectPath() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = this.sandbox.stub(raw, 'get').returns({
            then: (resolve: (value: [{ data: { token: string } }, null]) => void) => {
                resolve([{ data: { token: 'abc' } }, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.get>);

        const [data, error] = await client.read<{ token: string }>('my/secret');

        assert.equal(error, null);
        assert.deepEqual(data, { token: 'abc' });
        assert.equal(stub.calledOnce, true);
        assert.equal(stub.firstCall.args[0], '/cubbyhole/{path}');
    };

    @test('write should call raw.post with the correct path and body')
    public async writeShouldCallRawPostWithCorrectPathAndBody() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = this.sandbox.stub(raw, 'post').returns({
            then: (resolve: (value: [undefined, null]) => void) => {
                resolve([undefined, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.post>);

        const [data, error] = await client.write('my/secret', { foo: 'bar' });

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(stub.calledOnce, true);
        assert.equal(stub.firstCall.args[0], '/cubbyhole/{path}');
    };

    @test('delete should call raw.delete with the correct path')
    public async deleteShouldCallRawDeleteWithCorrectPath() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = this.sandbox.stub(raw, 'delete').returns({
            then: (resolve: (value: [undefined, null]) => void) => {
                resolve([undefined, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.delete>);

        const [data, error] = await client.delete('my/secret');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(stub.calledOnce, true);
        assert.equal(stub.firstCall.args[0], '/cubbyhole/{path}');
    };

    @test('list should call raw.list with the correct path')
    public async listShouldCallRawListWithCorrectPath() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = this.sandbox.stub(raw, 'list').returns({
            then: (resolve: (value: [{ data: { keys: string[] } }, null]) => void) => {
                resolve([{ data: { keys: ['secret-a', 'secret-b'] } }, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.list>);

        const [keys, error] = await client.list('my');

        assert.equal(error, null);
        assert.deepEqual(keys, ['secret-a', 'secret-b']);
        assert.equal(stub.calledOnce, true);
        assert.equal(stub.firstCall.args[0], '/cubbyhole/{path}/');
    };

    @test('list with no path should call raw.list with empty path')
    public async listWithNoPathShouldCallRawListWithEmptyPath() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = this.sandbox.stub(raw, 'list').returns({
            then: (resolve: (value: [{ data: { keys: string[] } }, null]) => void) => {
                resolve([{ data: { keys: [] } }, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.list>);

        const [keys, error] = await client.list();

        assert.equal(error, null);
        assert.deepEqual(keys, []);
        assert.equal(stub.calledOnce, true);
        const callConfig = stub.firstCall.args[1] as { params?: { path?: { path?: string } } };
        assert.equal(callConfig?.params?.path?.path, '');
    };

    @test('read should propagate errors from raw.get')
    public async readShouldPropagateErrorsFromRawGet() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);
        const vaultError = new VaultClientError({ code: 'HTTP_ERROR', message: 'not found', status: 404 });

        this.sandbox.stub(raw, 'get').returns({
            then: (resolve: (value: [null, VaultClientError]) => void) => {
                resolve([null, vaultError]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.get>);

        const [data, error] = await client.read('my/secret');

        assert.equal(data, null);
        assert.equal(error, vaultError);
    };

    @test('write should propagate errors from raw.post')
    public async writeShouldPropagateErrorsFromRawPost() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);
        const vaultError = new VaultClientError({ code: 'HTTP_ERROR', message: 'server error', status: 500 });

        this.sandbox.stub(raw, 'post').returns({
            then: (resolve: (value: [null, VaultClientError]) => void) => {
                resolve([null, vaultError]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.post>);

        const [data, error] = await client.write('my/secret', { key: 'val' });

        assert.equal(data, null);
        assert.equal(error, vaultError);
    };

    @test('write should return a VALIDATION_ERROR for a non-object payload')
    public async writeShouldReturnValidationErrorForNonObjectPayload() {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.write('my/secret', [] as unknown as Record<string, unknown>);

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
    };

    @test('delete should propagate errors from raw.delete')
    public async deleteShouldPropagateErrorsFromRawDelete() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);
        const vaultError = new VaultClientError({ code: 'HTTP_ERROR', message: 'server error', status: 500 });

        this.sandbox.stub(raw, 'delete').returns({
            then: (resolve: (value: [null, VaultClientError]) => void) => {
                resolve([null, vaultError]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.delete>);

        const [data, error] = await client.delete('my/secret');

        assert.equal(data, null);
        assert.equal(error, vaultError);
    };

    @test('list should propagate errors from raw.list')
    public async listShouldPropagateErrorsFromRawList() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);
        const vaultError = new VaultClientError({ code: 'HTTP_ERROR', message: 'forbidden', status: 403 });

        this.sandbox.stub(raw, 'list').returns({
            then: (resolve: (value: [null, VaultClientError]) => void) => {
                resolve([null, vaultError]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.list>);

        const [keys, error] = await client.list('my');

        assert.equal(keys, null);
        assert.equal(error, vaultError);
    };

    @test('list should return empty array when keys is missing in response')
    public async listShouldReturnEmptyArrayWhenKeysIsMissingInResponse() {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        this.sandbox.stub(raw, 'list').returns({
            then: (resolve: (value: [{ data: Record<string, never> }, null]) => void) => {
                resolve([{ data: {} }, null]);
                return { then: () => {}, catch: () => {} };
            },
        } as unknown as ReturnType<typeof raw.list>);

        const [keys, error] = await client.list();

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    };
};

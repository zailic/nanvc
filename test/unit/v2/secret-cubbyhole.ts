import type { SinonSandbox } from 'sinon';
import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { VaultSecretCubbyholeClient } from '../../../src/v2/client/secret-cubbyhole.js';
import { VaultClientError } from '../../../src/main.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';

describe('VaultSecretCubbyholeClient unit test cases.', function () {
    let sandbox: SinonSandbox;

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('read should return a VALIDATION_ERROR for an empty path', async function () {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.read('');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    });

    it('write should return a VALIDATION_ERROR for an empty path', async function () {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.write('', { key: 'val' });

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    });

    it('delete should return a VALIDATION_ERROR for an empty path', async function () {
        const client = new VaultSecretCubbyholeClient(new RawVaultClient());

        const [data, error] = await client.delete('');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'Expected a cubbyhole secret path, got ""');
    });

    it('read should call raw.get with the correct path', async function () {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = sandbox.stub(raw, 'get').returns({
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
    });

    it('write should call raw.post with the correct path and body', async function () {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = sandbox.stub(raw, 'post').returns({
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
    });

    it('delete should call raw.delete with the correct path', async function () {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = sandbox.stub(raw, 'delete').returns({
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
    });

    it('list should call raw.list with the correct path', async function () {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = sandbox.stub(raw, 'list').returns({
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
    });

    it('list with no path should call raw.list with empty path', async function () {
        const raw = new RawVaultClient();
        const client = new VaultSecretCubbyholeClient(raw);

        const stub = sandbox.stub(raw, 'list').returns({
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
    });
});

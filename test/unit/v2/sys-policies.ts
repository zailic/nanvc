import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import {
    VaultSystemPoliciesAclClient,
    VaultSystemPoliciesEgpClient,
    VaultSystemPoliciesPasswordClient,
    VaultSystemPoliciesRgpClient,
    VaultSystemPoliciesRotationClient,
} from '../../../src/v2/client/sys-policies.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';
import { err, ok, toResult } from '../../../src/v2/core/result.js';
import { VaultClientError } from '../../../src/v2/core/errors.js';

import type { SinonSandbox } from 'sinon';

describe('VaultSystemPolicies v2 unit test cases.', function () {
    let sandbox: SinonSandbox;

    const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
        toResult(Promise.resolve(tuple));

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should list ACL policies', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: { keys: ['default', 'root'] } })));
        const client = new VaultSystemPoliciesAclClient(new RawVaultClient());

        const [data, error] = await client.list();

        assert.equal(error, null);
        assert.deepEqual(data, ['default', 'root']);
        assert.equal(listStub.calledOnce, true);
        assert.equal(listStub.firstCall.args[0], '/sys/policies/acl/');
        assert.deepEqual(listStub.firstCall.args[1], { params: { query: { list: 'true' } } });
    });

    it('should read, write and delete an ACL policy', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: { name: 'deploy', policy: 'path "secret/*" {}' } })));
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSystemPoliciesAclClient(new RawVaultClient());

        const [readData, readError] = await client.read('deploy');
        const [writeData, writeError] = await client.write('deploy', { policy: 'path "secret/*" {}' });
        const [deleteData, deleteError] = await client.delete('deploy');

        assert.equal(readError, null);
        assert.equal(readData?.data?.name, 'deploy');
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);
        assert.equal(getStub.calledOnce, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(deleteStub.calledOnce, true);
    });

    it('should surface ACL policy write errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSystemPoliciesAclClient(new RawVaultClient());

        await assert.rejects(client.write('deploy', { policy: 'path "secret/*" {}' }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });

    it('should return an empty ACL policy list when Vault omits keys', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({})));
        const client = new VaultSystemPoliciesAclClient(new RawVaultClient());

        const [data, error] = await client.list();

        assert.equal(error, null);
        assert.deepEqual(data, []);
    });

    it('should surface ACL policy list and delete errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        const client = new VaultSystemPoliciesAclClient(new RawVaultClient());

        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        await assert.rejects(client.list().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        await assert.rejects(client.delete('deploy').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });

    it('should list, read, write and delete EGP policies', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({ keys: ['breakglass'] })));
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({
            enforcement_level: 'soft-mandatory',
            name: 'breakglass',
            paths: ['*'],
            policy: 'rule main = { true }',
        })));
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSystemPoliciesEgpClient(new RawVaultClient());

        const [listData, listError] = await client.list();
        const [readData, readError] = await client.read('breakglass');
        const [writeData, writeError] = await client.write('breakglass', {
            enforcement_level: 'soft-mandatory',
            paths: ['*'],
            policy: 'rule main = { true }',
        });
        const [deleteData, deleteError] = await client.delete('breakglass');

        assert.equal(listError, null);
        assert.deepEqual(listData, ['breakglass']);
        assert.equal(readError, null);
        assert.deepEqual(readData?.paths, ['*']);
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);
        assert.equal(listStub.calledOnce, true);
        assert.equal(getStub.calledOnce, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(deleteStub.calledOnce, true);
    });

    it('should return empty lists when Vault omits EGP, password and RGP policy keys', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const raw = new RawVaultClient();

        const [egpData, egpError] = await new VaultSystemPoliciesEgpClient(raw).list();
        const [passwordData, passwordError] = await new VaultSystemPoliciesPasswordClient(raw).list();
        const [rgpData, rgpError] = await new VaultSystemPoliciesRgpClient(raw).list();

        assert.equal(egpError, null);
        assert.deepEqual(egpData, []);
        assert.equal(passwordError, null);
        assert.deepEqual(passwordData, []);
        assert.equal(rgpError, null);
        assert.deepEqual(rgpData, []);
        assert.equal(listStub.calledThrice, true);
    });

    it('should surface EGP policy list, write and delete errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        const raw = new RawVaultClient();
        const client = new VaultSystemPoliciesEgpClient(raw);

        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        await assert.rejects(client.list().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        await assert.rejects(client.write('breakglass', {
            enforcement_level: 'soft-mandatory',
            paths: ['*'],
            policy: 'rule main = { true }',
        }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        await assert.rejects(client.delete('breakglass').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });

    it('should list, read, write, generate and delete password policies', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({ keys: ['app-policy'] })));
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get');
        getStub.onFirstCall().returns(resultOf(ok({ entropy_source: 'charset', policy: 'length = 20' })));
        getStub.onSecondCall().returns(resultOf(ok({ password: 'generated-password' })));
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSystemPoliciesPasswordClient(new RawVaultClient());

        const [listData, listError] = await client.list();
        const [readData, readError] = await client.read('app-policy');
        const [writeData, writeError] = await client.write('app-policy', { policy: 'length = 20' });
        const [generateData, generateError] = await client.generate('app-policy');
        const [deleteData, deleteError] = await client.delete('app-policy');

        assert.equal(listError, null);
        assert.deepEqual(listData, ['app-policy']);
        assert.equal(readError, null);
        assert.equal(readData?.policy, 'length = 20');
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);
        assert.equal(generateError, null);
        assert.equal(generateData?.password, 'generated-password');
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);
        assert.equal(listStub.calledOnce, true);
        assert.equal(getStub.calledTwice, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(deleteStub.calledOnce, true);
    });

    it('should surface password policy list, write, delete and generate errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        const raw = new RawVaultClient();
        const client = new VaultSystemPoliciesPasswordClient(raw);

        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        await assert.rejects(client.list().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        await assert.rejects(client.write('app-policy', { policy: 'length = 20' }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        await assert.rejects(client.delete('app-policy').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        await assert.rejects(client.generate('app-policy').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });

    it('should list, read, write and delete RGP policies', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({ keys: ['webapp'] })));
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({
            enforcement_level: 'soft-mandatory',
            name: 'webapp',
            policy: 'rule main = { true }',
        })));
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSystemPoliciesRgpClient(new RawVaultClient());

        const [listData, listError] = await client.list();
        const [readData, readError] = await client.read('webapp');
        const [writeData, writeError] = await client.write('webapp', {
            enforcement_level: 'soft-mandatory',
            policy: 'rule main = { true }',
        });
        const [deleteData, deleteError] = await client.delete('webapp');

        assert.equal(listError, null);
        assert.deepEqual(listData, ['webapp']);
        assert.equal(readError, null);
        assert.equal(readData?.name, 'webapp');
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);
        assert.equal(listStub.calledOnce, true);
        assert.equal(getStub.calledOnce, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(deleteStub.calledOnce, true);
    });

    it('should surface RGP policy list, write and delete errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        const raw = new RawVaultClient();
        const client = new VaultSystemPoliciesRgpClient(raw);

        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        await assert.rejects(client.list().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        await assert.rejects(client.write('webapp', {
            enforcement_level: 'soft-mandatory',
            policy: 'rule main = { true }',
        }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        await assert.rejects(client.delete('webapp').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });

    it('should read, write and delete rotation policies', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ policy: '{"max_retries":3}' })));
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSystemPoliciesRotationClient(new RawVaultClient());

        const [readData, readError] = await client.read('retry');
        const [writeData, writeError] = await client.write('retry', { policy: '{"max_retries":3}' });
        const [deleteData, deleteError] = await client.delete('retry');

        assert.equal(readError, null);
        assert.equal(readData?.policy, '{"max_retries":3}');
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);
        assert.equal(getStub.calledOnce, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(deleteStub.calledOnce, true);
    });

    it('should surface rotation policy write and delete errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        const raw = new RawVaultClient();
        const client = new VaultSystemPoliciesRotationClient(raw);

        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        await assert.rejects(client.write('retry', { policy: '{"max_retries":3}' }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });

        sandbox.restore();
        sandbox = createSandbox();
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        await assert.rejects(client.delete('retry').unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    });
});

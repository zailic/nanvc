import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { VaultAuthClient } from '../../../src/v2/client/auth.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../src/v2/transport/errors.js';
import { err, ok, toResult } from '../../../src/v2/core/result.js';

import type { VaultAppRoleLoginRequest } from '../../../src/v2/client/auth.js';
import type { SinonSandbox } from 'sinon';

describe('VaultAuthClient unit test cases.', function () {
    let sandbox: SinonSandbox;

    const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
        toResult(Promise.resolve(tuple));

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should enable an auth method when it is not already enabled', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(new VaultClientError({
                code: 'HTTP_ERROR',
                message: 'Not Found',
                status: 404,
            }))),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.enableAuthMethod('/team/auth/approle', {
            description: 'Team AppRole backend',
            type: 'approle',
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(getStub.calledOnce, true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/sys/auth/{path}');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                description: 'Team AppRole backend',
                type: 'approle',
            },
            params: {
                path: {
                    path: '/team/auth/approle',
                },
            },
        });
    });

    it('should surface errors from Vault when enabling an auth method', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.enableAuthMethod('team/auth/approle', {
                type: 'approle',
            }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });


    it('should skip enabling an auth method when it already exists', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                accessor: 'auth_approle_123',
                type: 'approle',
            })),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.enableAuthMethod('team/auth/approle', {
            type: 'approle',
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.called, false);
    });

    it('should disable an auth method through the sys auth path', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.disableAuthMethod('/team/auth/approle');

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(deleteStub.calledOnce, true);
        assert.equal(deleteStub.firstCall.args[0], '/sys/auth/{path}');
        assert.deepEqual(deleteStub.firstCall.args[1], {
            params: {
                path: {
                    path: '/team/auth/approle',
                },
            },
        });
    });

    it('should surface disable errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.disableAuthMethod('team/auth/approle').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should register an AppRole on the default approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.registerAppRole('jenkins', {
            token_max_ttl: '30m',
            token_policies: ['jenkins'],
            token_ttl: '20m',
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/auth/{approle_mount_path}/role/{role_name}');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                token_max_ttl: '30m',
                token_policies: ['jenkins'],
                token_ttl: '20m',
            },
            params: {
                path: {
                    approle_mount_path: 'approle',
                    role_name: 'jenkins',
                },
            },
        });
    });

    it('should register an AppRole on a custom approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.registerAppRole('/team/approle', '/jenkins', {
            bind_secret_id: true,
            token_policies: ['jenkins'],
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                bind_secret_id: true,
                token_policies: ['jenkins'],
            },
            params: {
                path: {
                    approle_mount_path: '/team/approle',
                    role_name: '/jenkins',
                },
            },
        });
    });

    it('should surface AppRole registration errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'missing auth backend',
            status: 404,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.registerAppRole('jenkins', { token_policies: ['jenkins'] }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should read an AppRole role id from the default approle mount', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                data: {
                    role_id: 'role-id-value',
                },
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const roleId = await client.getAppRoleRoleId('jenkins').unwrap();

        assert.deepEqual(roleId, {
            role_id: 'role-id-value',
        });
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/auth/{approle_mount_path}/role/{role_name}/role-id');
        assert.deepEqual(getStub.firstCall.args[1], {
            params: {
                path: {
                    approle_mount_path: 'approle',
                    role_name: 'jenkins',
                },
            },
        });
    });

    it('should defensively return an AppRole role id response when no Vault data envelope exists', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                role_id: 'role-id-value',
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const roleId = await client.getAppRoleRoleId('jenkins').unwrap();

        assert.deepEqual(roleId, {
            role_id: 'role-id-value',
        });
    });

    it('should surface errors from Vault when reading an AppRole role id', async function () {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.getAppRoleRoleId('jenkins').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should register an AppRole role id on a custom approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.registerAppRoleRoleId('/team/approle', '/jenkins', {
            role_id: 'custom-role-id',
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/auth/{approle_mount_path}/role/{role_name}/role-id');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                role_id: 'custom-role-id',
            },
            params: {
                path: {
                    approle_mount_path: '/team/approle',
                    role_name: '/jenkins',
                },
            },
        });
    });

    it('should surface errors from Vault when registering an AppRole role id', async function () {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.registerAppRoleRoleId('/team/approle', '/jenkins', { role_id: 'custom-role-id' }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should generate an AppRole secret id from the default approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                data: {
                    secret_id: 'secret-id-value',
                    secret_id_accessor: 'secret-id-accessor',
                },
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const secretId = await client.generateAppRoleSecretId('jenkins').unwrap();

        assert.deepEqual(secretId, {
            secret_id: 'secret-id-value',
            secret_id_accessor: 'secret-id-accessor',
        });
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/auth/{approle_mount_path}/role/{role_name}/secret-id');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {},
            params: {
                path: {
                    approle_mount_path: 'approle',
                    role_name: 'jenkins',
                },
            },
        });
    });

    it('should generate an AppRole secret id with options on a custom approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                data: {
                    secret_id: 'secret-id-value',
                    secret_id_accessor: 'secret-id-accessor',
                },
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const secretId = await client.generateAppRoleSecretId('team/approle', 'jenkins', {
            metadata: '{"env":"test"}',
            ttl: '30m',
        }).unwrap();

        assert.deepEqual(secretId, {
            secret_id: 'secret-id-value',
            secret_id_accessor: 'secret-id-accessor',
        });
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                metadata: '{"env":"test"}',
                ttl: '30m',
            },
            params: {
                path: {
                    approle_mount_path: 'team/approle',
                    role_name: 'jenkins',
                },
            },
        });
    });

    it('should surface network errors when generating an AppRole secret id', async function () {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());
        
        await assert.rejects(
            client.generateAppRoleSecretId('jenkins', { ttl: '30m' }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should login with AppRole on the default approle mount and set the raw token', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                auth: {
                    client_token: 'app-token',
                    policies: ['default'],
                },
            })),
        );
        const setTokenSpy = sandbox.spy(RawVaultClient.prototype, 'setToken');
        const client = new VaultAuthClient(new RawVaultClient());

        const login = await client.loginWithAppRole({
            role_id: 'role-id-value',
            secret_id: 'secret-id-value',
        }).unwrap();

        assert.deepEqual(login, {
            auth: {
                client_token: 'app-token',
                policies: ['default'],
            },
        });
        assert.equal(setTokenSpy.calledOnceWithExactly('app-token'), true);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/auth/{approle_mount_path}/login');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                role_id: 'role-id-value',
                secret_id: 'secret-id-value',
            },
            params: {
                path: {
                    approle_mount_path: 'approle',
                },
            },
        });
    });

    it('should login with AppRole on a custom approle mount', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                auth: {
                    client_token: 'app-token',
                },
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [login, error] = await client.loginWithAppRole('/team/approle', {
            role_id: 'role-id-value',
            secret_id: 'secret-id-value',
        });

        assert.equal(error, null);
        assert.equal(login.auth?.client_token, 'app-token');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                role_id: 'role-id-value',
                secret_id: 'secret-id-value',
            },
            params: {
                path: {
                    approle_mount_path: '/team/approle',
                },
            },
        });
    });

    it('should surface AppRole login errors from Vault', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'invalid credentials',
            status: 400,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.loginWithAppRole({
                role_id: 'role-id-value',
                secret_id: 'secret-id-value',
            }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should read auth method configuration from the sys auth path', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                accessor: 'auth_approle_123',
                description: 'Team AppRole backend',
                type: 'approle',
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const config = await client.getAuthMethodConfig('/team/auth/approle').unwrap();

        assert.deepEqual(config, {
            accessor: 'auth_approle_123',
            description: 'Team AppRole backend',
            type: 'approle',
        });
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/sys/auth/{path}');
        assert.deepEqual(getStub.firstCall.args[1], {
            params: {
                path: {
                    path: '/team/auth/approle',
                },
            },
        });
    });

    it('should report auth methods as disabled when Vault returns 404', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(new VaultClientError({
                code: 'HTTP_ERROR',
                message: 'Not Found',
                status: 404,
            }))),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const enabled = await client.isAuthMethodEnabled('team/auth/approle').unwrap();

        assert.equal(enabled, false);
    });

    it('should propagate non-404 errors while checking auth method status', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        await assert.rejects(
            client.isAuthMethodEnabled('team/auth/approle').unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });
    
    it('should surface validation errors when payload is not specified for loginWithAppRole', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.loginWithAppRole('team/approle', undefined as unknown as VaultAppRoleLoginRequest);

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'VaultAuthClient.loginWithAppRole requires a payload object');
        assert.equal(postStub.called, false);
        await assert.rejects(
            client.loginWithAppRole('team/approle', undefined as unknown as VaultAppRoleLoginRequest).unwrap(),
            (err: unknown) => {
                assert.equal(err instanceof VaultClientError, true);
                assert.equal((err as VaultClientError).code, 'VALIDATION_ERROR');
                assert.equal((err as VaultClientError).message, 'VaultAuthClient.loginWithAppRole requires a payload object');
                return true;
            },
        );
    });

});

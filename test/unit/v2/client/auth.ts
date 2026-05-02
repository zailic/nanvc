import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import {suite, test, beforeEachTest, afterEachTest} from '../../../mocha/decorators.js';
import { resultOf } from '../../../helpers/types.js';

import { VaultAuthClient } from '../../../../src/v2/client/auth.js';
import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';
import { err, ok } from '../../../../src/v2/core/result.js';

import type { VaultAppRoleLoginRequest } from '../../../../src/v2/client/auth.js';
import type { SinonSandbox } from 'sinon';

@suite('VaultAuthClient unit test cases.')
export class VaultAuthClientUnitTests {

    private sandbox!: SinonSandbox;

    @beforeEachTest()
    public beforeEach() {
        this.sandbox = createSandbox();
    }

    @afterEachTest()
    public afterEach() {
        this.sandbox.restore();
    }

    @test('should enable an auth method when it is not already enabled')
    public async shouldEnableAuthMethodWhenNotEnabledTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(new VaultClientError({
                code: 'HTTP_ERROR',
                message: 'Not Found',
                status: 404,
            }))),
        );
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should surface errors from Vault when enabling an auth method')
    public async shouldSurfaceErrorsFromVaultWhenEnablingAuthMethodTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should skip enabling an auth method when it already exists')
    public async shouldSkipEnablingAuthMethodWhenAlreadyExistsTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                accessor: 'auth_approle_123',
                type: 'approle',
            })),
        );
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const [data, error] = await client.enableAuthMethod('team/auth/approle', {
            type: 'approle',
        });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.called, false);
    };

    @test('should disable an auth method through the sys auth path')
    public async shouldDisableAuthMethodThroughSysAuthPathTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(
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
    };

    @test('should surface disable errors from Vault')
    public async shouldSurfaceDisableErrorsFromVaultTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(
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
    };

    @test('should register an AppRole on the default approle mount')
    public async shouldRegisterAppRoleOnDefaultAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should register an AppRole on a custom approle mount')
    public async shouldRegisterAppRoleOnCustomAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should surface AppRole registration errors from Vault')
    public async shouldSurfaceAppRoleRegistrationErrorsFromVaultTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'missing auth backend',
            status: 404,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should read an AppRole role id from the default approle mount')
    public async shouldReadAppRoleRoleIdFromDefaultAppRoleMountTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
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
    };

    @test('should defensively return an AppRole role id response when no Vault data envelope exists')
    public async shouldDefensivelyReturnAppRoleRoleIdResponseWhenNoVaultDataEnvelopeExistsTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                role_id: 'role-id-value',
            })),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const roleId = await client.getAppRoleRoleId('jenkins').unwrap();

        assert.deepEqual(roleId, {
            role_id: 'role-id-value',
        });
    };

    @test('should surface errors from Vault when reading an AppRole role id')
    public async shouldSurfaceErrorsFromVaultWhenReadingAppRoleRoleIdTest() {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
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
    };

    @test('should register an AppRole role id on a custom approle mount')
    public async shouldRegisterAppRoleRoleIdOnCustomAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should surface errors from Vault when registering an AppRole role id')
    public async shouldSurfaceErrorsFromVaultWhenRegisteringAppRoleRoleIdTest() {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should generate an AppRole secret id from the default approle mount')
    public async shouldGenerateAppRoleSecretIdFromDefaultAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should generate an AppRole secret id with options on a custom approle mount')
    public async shouldGenerateAppRoleSecretIdWithOptionsOnCustomAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should surface network errors when generating an AppRole secret id')
    public async shouldSurfaceNetworkErrorsWhenGeneratingAppRoleSecretIdTest() {
        const clientError = new VaultClientError({
            cause: new Error('Network Error'),
            code: 'NETWORK_ERROR',
            message: 'Simulated network error',
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should login with AppRole on the default approle mount and set the raw token')
    public async shouldLoginWithAppRoleOnDefaultAppRoleMountAndSetRawTokenTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                auth: {
                    client_token: 'app-token',
                    policies: ['default'],
                },
            })),
        );
        const setTokenSpy = this.sandbox.spy(RawVaultClient.prototype, 'setToken');
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
    };

    @test('should login with AppRole on a custom approle mount')
    public async shouldLoginWithAppRoleOnCustomAppRoleMountTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should surface AppRole login errors from Vault')
    public async shouldSurfaceAppRoleLoginErrorsFromVaultTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'invalid credentials',
            status: 400,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

    @test('should read auth method configuration from the sys auth path')
    public async shouldReadAuthMethodConfigurationFromSysAuthPathTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
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
    };

    @test('should report auth methods as disabled when Vault returns 404')
    public async shouldReportAuthMethodsAsDisabledWhenVaultReturns404Test() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(new VaultClientError({
                code: 'HTTP_ERROR',
                message: 'Not Found',
                status: 404,
            }))),
        );
        const client = new VaultAuthClient(new RawVaultClient());

        const enabled = await client.isAuthMethodEnabled('team/auth/approle').unwrap();

        assert.equal(enabled, false);
    };

    @test('should propagate non-404 errors while checking auth method status')
    public async shouldPropagateNon404ErrorsWhileCheckingAuthMethodStatusTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            status: 403,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
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
    };
    
    @test('should surface validation errors when payload is not specified for loginWithAppRole')
    public async shouldSurfaceValidationErrorsWhenPayloadIsNotSpecifiedForLoginWithAppRoleTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
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
    };

};

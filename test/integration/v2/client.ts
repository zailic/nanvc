import assert from 'node:assert/strict';

import { VaultClientError, VaultClientV2 } from '../../../src/v2/index.js';

type SecretData = {
    foo: string;
};

type VaultInitMaterial = {
    keys: string[];
    root_token: string;
};

let rootToken: string;
let unsealKey: string;

const asString = (value: unknown): string => value as string;

describe('VaultClientV2 integration test cases.', function () {
    let client: VaultClientV2;

    beforeEach(async function () {
        client = new VaultClientV2({
            clusterAddress: 'http://vault.local:8200',
            authToken: rootToken ?? null,
        });

        await ensureInitializedAndUnsealed(client);
    });

    it('vault initialisation process should fail if it is already initialized', async function () {
        const [data, error] = await client.sys.init({ secret_shares: 1, secret_threshold: 1 });

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 400);
    });

    it('should get initialization status', async function () {
        const [isInitialized, error] = await client.sys.isInitialized();

        assert.equal(error, null);
        assert.equal(isInitialized, true);
    });

    it('should get seal status', async function () {
        const [status, error] = await client.sys.sealStatus();

        assert.equal(error, null);
        assert.equal(status.sealed, false);
        assert.equal(status.t, 1);
        assert.equal(status.n, 1);
    });

    it('should get health status through the sys status shorthand', async function () {
        const [status, error] = await client.sys.status();

        assert.equal(error, null);
        assert.equal(status.initialized, true);
        assert.equal(status.sealed, false);
    });

    it('should report ready through the sys health shorthand when vault is unsealed', async function () {
        const [ready, error] = await client.sys.isReady();

        assert.equal(error, null);
        assert.equal(ready, true);
    });

    it('should report not ready through the sys health shorthand when vault is sealed', async function () {
        const [sealData, sealError] = await client.raw.put('/sys/seal');

        assert.equal(sealData, undefined);
        assert.equal(sealError, null);

        try {
            const [ready, error] = await client.sys.isReady();

            assert.equal(error, null);
            assert.equal(ready, false);
        } finally {
            const [, unsealError] = await client.sys.unseal({ key: unsealKey });

            assert.equal(unsealError, null);
        }
    });

    it('should unseal vault', async function () {
        const [status, error] = await client.sys.unseal({ key: unsealKey });

        assert.equal(error, null);
        assert.equal(status.sealed, false);
    });

    it('should mount and unmount a secrets engine', async function () {
        const mountPath = 'test-temp-v2';

        await ensureMountRemoved(client, mountPath);

        const [mountData, mountError] = await client.sys.mount.enable(mountPath, { type: 'kv' });
        const [unmountData, unmountError] = await client.sys.mount.disable(mountPath);

        assert.equal(mountData, undefined);
        assert.equal(mountError, null);
        assert.equal(unmountData, undefined);
        assert.equal(unmountError, null);
    });

    it('should enable, read and detect an auth method', async function () {
        const authPath = 'approle-v2-test';

        await ensureAuthMethodRemoved(client, authPath);

        try {
            const [enableData, enableError] = await client.auth.enableAuthMethod(`/${authPath}`, {
                description: 'Integration AppRole auth mount',
                type: 'approle',
            });
            const [config, configError] = await client.auth.getAuthMethodConfig(authPath);
            const [enabledAfter, enabledAfterError] = await client.auth.isAuthMethodEnabled(authPath);
            const [secondEnableData, secondEnableError] = await client.auth.enableAuthMethod(authPath, {
                description: 'Integration AppRole auth mount',
                type: 'approle',
            });
            const [registerData, registerError] = await client.auth.registerAppRole(authPath, 'integration-role', {
                token_max_ttl: '30m',
                token_policies: ['default'],
                token_ttl: '20m',
            });
            const [registerRoleIdData, registerRoleIdError] = await client.auth.registerAppRoleRoleId(
                authPath,
                'integration-role',
                { role_id: 'integration-role-id' },
            );
            const [roleId, roleIdError] = await client.auth.getAppRoleRoleId(authPath, 'integration-role');
            const [secretId, secretIdError] = await client.auth.generateAppRoleSecretId(authPath, 'integration-role', {
                metadata: '{"suite":"integration-v2"}',
                ttl: '20m',
            });
            const [login, loginError] = await client.auth.loginWithAppRole(authPath, {
                role_id: roleId?.role_id,
                secret_id: secretId?.secret_id,
            });
            client.setToken(rootToken);
            const [roleConfig, roleConfigError] = await client.raw.get<{ data?: { token_policies?: string[]; token_ttl?: number } }>(
                `/auth/${authPath}/role/integration-role`,
            );

            assert.equal(enableData, undefined);
            assert.equal(enableError, null);
            assert.equal(configError, null);
            assert.equal(config.type, 'approle');
            assert.equal(config.description, 'Integration AppRole auth mount');
            assert.equal(Boolean(config.accessor), true);
            assert.equal(enabledAfterError, null);
            assert.equal(enabledAfter, true);
            assert.equal(secondEnableData, undefined);
            assert.equal(secondEnableError, null);
            assert.equal(registerData, undefined);
            assert.equal(registerError, null);
            assert.equal(registerRoleIdData, undefined);
            assert.equal(registerRoleIdError, null);
            assert.equal(roleIdError, null);
            assert.equal(roleId.role_id, 'integration-role-id');
            assert.equal(secretIdError, null);
            assert.equal(typeof secretId?.secret_id, 'string');
            assert.equal(asString(secretId?.secret_id).length > 0, true);
            assert.equal(typeof secretId?.secret_id_accessor, 'string');
            assert.equal(asString(secretId?.secret_id_accessor).length > 0, true);
            assert.equal(loginError, null);
            assert.equal(typeof login.auth?.client_token, 'string');
            assert.equal(asString(login.auth?.client_token).length > 0, true);
            assert.equal(roleConfigError, null);
            assert.deepEqual(roleConfig.data?.token_policies, ['default']);
            assert.equal(roleConfig.data?.token_ttl, 1200);

            const [disableData, disableError] = await client.auth.disableAuthMethod(`/${authPath}`);
            const disabledError = await client.auth.getAuthMethodConfig(authPath).intoErr();

            assert.equal(disableData, undefined);
            assert.equal(disableError, null);
            assert.equal(disabledError?.code, 'HTTP_ERROR');
            assert.equal(disabledError?.status, 400);
        } finally {
            await ensureAuthMethodRemoved(client, authPath);
        }
    });

    it('should write, read and list secrets on the default secret mount', async function () {
        const secretMount = 'secret';
        const secretPath = 'integration-v2/my-secret';

        await ensureSecretMountAvailable(client);

        const [writeData, writeError] = await client.secret.kv.v1.write(secretMount, secretPath, { foo: 'bar-v2' });
        const [secret, readError] = await client.secret.kv.v1.read<SecretData>(secretMount, secretPath);
        const [keys, listError] = await client.secret.kv.v1.list(secretMount, 'integration-v2');

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.equal(readError, null);
        assert.deepEqual(secret, { foo: 'bar-v2' });
        assert.equal(listError, null);
        assert.equal(Array.isArray(keys), true);
    });

    it('should write, read, list and delete secrets on a kv v2 mount', async function () {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/my-secret';

        await ensureKvV2MountAvailable(client, mountPath);

        const [writeData, writeError] = await client.secret.kv.v2.write(mountPath, secretPath, { foo: 'bar-kv2' });
        const [secret, readError] = await client.secret.kv.v2.read<SecretData>(mountPath, secretPath);
        const [keys, listError] = await client.secret.kv.v2.list(mountPath, 'integration-v2');
        const [deleteData, deleteError] = await client.secret.kv.v2.delete(mountPath, secretPath);
        const [deletedSecret, deletedReadError] = await client.secret.kv.v2.read<SecretData>(mountPath, secretPath);

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.equal(readError, null);
        assert.deepEqual(secret.data, { foo: 'bar-kv2' });
        assert.equal(secret.metadata.destroyed, false);
        assert.equal(secret.metadata.version, 1);
        assert.equal(listError, null);
        assert.equal(Array.isArray(keys), true);
        assert.equal(keys.includes('my-secret'), true);
        assert.equal(deleteData, undefined);
        assert.equal(deleteError, null);
        assert.equal(deletedReadError, null);
        assert.deepEqual(deletedSecret.data, {});
        assert.equal(deletedSecret.metadata.version, 1);
    });
});

async function ensureInitializedAndUnsealed(client: VaultClientV2): Promise<void> {
    rootToken ||= process.env.NANVC_VAULT_AUTH_TOKEN ?? '';
    unsealKey ||= process.env.NANVC_VAULT_UNSEAL_KEY ?? '';

    const [isInitialized, initCheckError] = await client.sys.isInitialized();
    if (initCheckError) {
        throw initCheckError;
    }

    if (!isInitialized) {
        const [initData, initError] = await client.sys.init({
            secret_shares: 1,
            secret_threshold: 1,
        });
        if (initError) {
            throw initError;
        }

        validateInitData(initData);
        rootToken = initData.root_token;
        unsealKey = initData.keys[0];
        client.setToken(rootToken);
    }

    if (!rootToken || !unsealKey) {
        throw new Error('Vault initialization did not provide root credentials');
    }

    client.setToken(rootToken);

    const [status, statusError] = await client.sys.sealStatus();
    if (statusError) {
        throw statusError;
    }

    if (status.sealed) {
        const [, unsealError] = await client.sys.unseal({ key: unsealKey });
        if (unsealError) {
            throw unsealError;
        }
    }
}

async function ensureSecretMountAvailable(client: VaultClientV2): Promise<void> {
    const [, error] = await client.sys.mount.enable('secret', { type: 'kv' });
    if (error && !isMountAlreadyExistsError(error)) {
        throw error;
    }
}

async function ensureKvV2MountAvailable(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.enable(path, {
        type: 'kv',
        options: {
            version: '2',
        },
    });
    if (error && !isMountAlreadyExistsError(error)) {
        throw error;
    }
}

async function ensureMountRemoved(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.disable(path);
    if (error && !isMountNotFoundError(error)) {
        throw error;
    }
}

async function ensureAuthMethodRemoved(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.auth.disableAuthMethod(path);
    if (error && !isAuthMethodNotFoundError(error)) {
        throw error;
    }
}

function validateInitData(initData: VaultInitMaterial): void {
    assert.equal(Array.isArray(initData.keys), true);
    assert.equal(initData.keys.length > 0, true);
    assert.equal(Boolean(initData.root_token), true);
}

function isMountAlreadyExistsError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 400
        && error.message.toLowerCase().includes('path is already in use');
}

function isMountNotFoundError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 404
        && error.message.toLowerCase().includes('no matching mount');
}

function isAuthMethodNotFoundError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 404
        && error.message.toLowerCase().includes('no auth engine at');
}

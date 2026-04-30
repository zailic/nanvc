import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
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

    it('should list, write, read and delete ACL policies through sys.policies.acl', async function () {
        const policyName = 'integration-policy-v2';
        const policyBody = 'path "secret/*" { capabilities = ["read"] }';

        await client.sys.policies.acl.delete(policyName).unwrapOr(undefined);

        try {
            const [beforeList, beforeListError] = await client.sys.policies.acl.list();
            const [writeData, writeError] = await client.sys.policies.acl.write(policyName, {
                policy: policyBody,
            });
            const [readData, readError] = await client.sys.policies.acl.read(policyName);
            const [afterList, afterListError] = await client.sys.policies.acl.list();

            assert.equal(beforeListError, null);
            assert.equal(Array.isArray(beforeList), true);
            assert.equal(writeError, null);
            assert.equal(writeData, undefined);
            assert.equal(readError, null);
            assert.equal(readData.data?.name, policyName);
            assert.equal(readData.data?.policy, policyBody);
            assert.equal(afterListError, null);
            assert.equal(afterList.includes(policyName), true);
        } finally {
            const [deleteData, deleteError] = await client.sys.policies.acl.delete(policyName);
            const [finalList, finalListError] = await client.sys.policies.acl.list();

            assert.equal(deleteError, null);
            assert.equal(deleteData, undefined);
            assert.equal(finalListError, null);
            assert.equal(finalList.includes(policyName), false);
        }
    });

    it('should wrap, lookup, rewrap and unwrap a secret payload', async function () {
        const payload = { role_id: 'test-role', secret_id: 'test-secret' };
        const ttl = '300s';

        const [wrapResult, wrapError] = await client.sys.wrapping.wrap(payload, ttl);

        assert.equal(wrapError, null);
        assert.equal(typeof wrapResult.wrap_info?.token, 'string');
        assert.equal(asString(wrapResult.wrap_info?.token).length > 0, true);
        assert.equal(typeof wrapResult.wrap_info?.creation_path, 'string');

        const wrappingToken = asString(wrapResult.wrap_info?.token);

        const [lookupResult, lookupError] = await client.sys.wrapping.lookup(wrappingToken);

        assert.equal(lookupError, null);
        assert.equal(typeof lookupResult.creation_path, 'string');
        assert.equal(lookupResult.creation_path?.includes('wrapping/wrap'), true);
        assert.equal(typeof lookupResult.creation_time, 'string');
        assert.equal(typeof lookupResult.creation_ttl, 'number');
        assert.equal(lookupResult.creation_ttl, 300);

        const [rewrapResult, rewrapError] = await client.sys.wrapping.rewrap(wrappingToken);

        assert.equal(rewrapError, null);
        assert.equal(typeof rewrapResult.wrap_info?.token, 'string');
        assert.equal(asString(rewrapResult.wrap_info?.token).length > 0, true);
        assert.notEqual(rewrapResult.wrap_info?.token, wrappingToken);

        const newWrappingToken = asString(rewrapResult.wrap_info?.token);

        const [unwrapResult, unwrapError] = await client.sys.wrapping.unwrap(newWrappingToken);

        assert.equal(unwrapError, null);
        assert.deepEqual(unwrapResult.data, payload);
    });

    it('should return an error when looking up an invalid wrapping token', async function () {
        const [result, error] = await client.sys.wrapping.lookup('invalid-token');

        assert.equal(result, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
    });

    it('should return an error when unwrapping an already-consumed token', async function () {
        const payload = { key: 'value' };

        const [wrapResult, wrapError] = await client.sys.wrapping.wrap(payload, '300s');

        assert.equal(wrapError, null);

        const wrappingToken = asString(wrapResult.wrap_info?.token);

        await client.sys.wrapping.unwrap(wrappingToken);

        const [result, error] = await client.sys.wrapping.unwrap(wrappingToken);

        assert.equal(result, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 400);
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

        await ensureMountRemoved(client, mountPath);
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

    it('should patch, deleteVersions, undeleteVersions, destroyVersions and deleteMetadata on kv v2', async function () {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/versioned-secret';

        await ensureMountRemoved(client, mountPath);
        await ensureKvV2MountAvailable(client, mountPath);

        // Write v1
        const [writeV1, writeV1Error] = await client.secret.kv.v2.write(mountPath, secretPath, { foo: 'v1', bar: 'original' });
        assert.equal(writeV1Error, null);
        void writeV1;

        // Patch to produce v2 (merge-patch)
        const [patchData, patchError] = await client.secret.kv.v2.patch(mountPath, secretPath, { foo: 'v2-patched' });
        assert.equal(patchError, null);
        void patchData;

        // Read v2 (latest)
        const [v2Secret, v2ReadError] = await client.secret.kv.v2.read<{ foo: string; bar: string }>(mountPath, secretPath);
        assert.equal(v2ReadError, null);
        assert.equal(v2Secret.data.foo, 'v2-patched');
        assert.equal(v2Secret.metadata.version, 2);

        // Soft-delete v1
        const [deleteVersionsData, deleteVersionsError] = await client.secret.kv.v2.deleteVersions(mountPath, secretPath, [1]);
        assert.equal(deleteVersionsError, null);
        void deleteVersionsData;

        // Read v1 - should surface deleted metadata
        const [v1Deleted, v1DeletedError] = await client.secret.kv.v2.read<{ foo: string }>(mountPath, secretPath, { version: 1 });
        assert.equal(v1DeletedError, null);
        assert.equal(typeof v1Deleted.metadata.deletion_time, 'string');

        // Undelete v1
        const [undeleteData, undeleteError] = await client.secret.kv.v2.undeleteVersions(mountPath, secretPath, [1]);
        assert.equal(undeleteError, null);
        void undeleteData;

        // Read v1 again - should be accessible now
        const [v1Restored, v1RestoredError] = await client.secret.kv.v2.read<{ foo: string }>(mountPath, secretPath, { version: 1 });
        assert.equal(v1RestoredError, null);
        assert.equal(v1Restored.data.foo, 'v1');

        // Destroy v1 permanently
        const [destroyData, destroyError] = await client.secret.kv.v2.destroyVersions(mountPath, secretPath, [1]);
        assert.equal(destroyError, null);
        void destroyData;

        // Read v1 metadata to confirm destroyed=true
        const [metaAfterDestroy, metaAfterDestroyError] = await client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(metaAfterDestroyError, null);
        const versionsAfterDestroy = metaAfterDestroy.versions as Record<string, { destroyed: boolean }>;
        assert.equal(versionsAfterDestroy['1']?.destroyed, true);

        // Delete all metadata for this secret
        const [deleteMetaData, deleteMetaError] = await client.secret.kv.v2.deleteMetadata(mountPath, secretPath);
        assert.equal(deleteMetaError, null);
        void deleteMetaData;

        // Confirm the secret metadata is gone (deleteMetadata removes all versions and metadata)
        const [, deletedMetaError] = await client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(deletedMetaError?.status, 404);
    });

    it('should read and write kv v2 metadata for a secret', async function () {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/metadata-secret';

        await ensureMountRemoved(client, mountPath);
        await ensureKvV2MountAvailable(client, mountPath);

        const [, writeError] = await client.secret.kv.v2.write(mountPath, secretPath, { key: 'val' });
        assert.equal(writeError, null);

        // Write metadata
        const [writeMeta, writeMetaError] = await client.secret.kv.v2.writeMetadata(mountPath, secretPath, {
            max_versions: 5,
            custom_metadata: { owner: 'test-suite' },
        });
        assert.equal(writeMetaError, null);
        void writeMeta;

        // Read metadata back
        const [meta, metaError] = await client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(metaError, null);
        assert.equal(meta.max_versions, 5);
        assert.deepEqual((meta.custom_metadata as Record<string, string>)['owner'], 'test-suite');

        // Patch metadata
        const [patchMeta, patchMetaError] = await client.secret.kv.v2.patchMetadata(mountPath, secretPath, {
            max_versions: 10,
        });
        assert.equal(patchMetaError, null);
        void patchMeta;

        const [metaAfterPatch, metaAfterPatchError] = await client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(metaAfterPatchError, null);
        assert.equal(metaAfterPatch.max_versions, 10);
    });

    it('should read and write the kv v2 engine configuration', async function () {
        const mountPath = 'secret-v2-config-test';

        await ensureMountRemoved(client, mountPath);
        await ensureKvV2MountAvailable(client, mountPath);

        // Write config
        const [writeConfig, writeConfigError] = await client.secret.kv.v2.writeConfig(mountPath, {
            max_versions: 7,
            cas_required: false,
        });
        assert.equal(writeConfigError, null);
        void writeConfig;

        // Read config back
        const [config, configError] = await client.secret.kv.v2.readConfig(mountPath);
        assert.equal(configError, null);
        assert.equal(config.max_versions, 7);
        assert.equal(config.cas_required, false);

        await ensureMountRemoved(client, mountPath);
    });

    it('should read kv v2 subkeys for a secret', async function () {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/subkeys-secret';

        await ensureMountRemoved(client, mountPath);
        await ensureKvV2MountAvailable(client, mountPath);

        const [, writeError] = await client.secret.kv.v2.write(mountPath, secretPath, {
            foo: 'bar',
            nested: { a: 1, b: 2 },
        });
        assert.equal(writeError, null);

        const [subkeys, subkeysError] = await client.secret.kv.v2.readSubkeys(mountPath, secretPath);
        assert.equal(subkeysError, null);
        assert.equal(typeof subkeys.subkeys, 'object');
        const sk = subkeys.subkeys as Record<string, unknown>;
        assert.equal('foo' in sk, true);
        assert.equal('nested' in sk, true);
    });

    it('should write, read, list and delete a secret in the cubbyhole', async function () {
        const secretPath = 'integration-v2/cubbyhole-secret';
        const payload = { token: 'cubbyhole-test-value', nested: { key: 'val' } };

        // Clean up before test
        await client.secret.cubbyhole.delete(secretPath).unwrapOr(undefined);

        // Write
        const [writeData, writeError] = await client.secret.cubbyhole.write(secretPath, payload);
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);

        // Read
        const [readData, readError] = await client.secret.cubbyhole.read<typeof payload>(secretPath);
        assert.equal(readError, null);
        assert.deepEqual(readData, payload);

        // List at parent prefix
        const [listData, listError] = await client.secret.cubbyhole.list('integration-v2');
        assert.equal(listError, null);
        assert.equal(Array.isArray(listData), true);
        assert.equal(listData.includes('cubbyhole-secret'), true);

        // Delete
        const [deleteData, deleteError] = await client.secret.cubbyhole.delete(secretPath);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);

        // Read after delete should return an error
        const [deletedData, deletedError] = await client.secret.cubbyhole.read(secretPath);
        assert.equal(deletedData, null);
        assert.equal(deletedError instanceof VaultClientError, true);
        assert.equal(deletedError?.code, 'HTTP_ERROR');
        assert.equal(deletedError?.status, 404);
    });

    it('should return an error when reading a non-existent cubbyhole secret', async function () {
        const [data, error] = await client.secret.cubbyhole.read('integration-v2/does-not-exist');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 404);
    });

    it('cubbyhole should be isolated per token', async function () {
        // Create a child token and write to cubbyhole with root, then verify isolation
        const secretPath = 'isolation-test/secret';
        const rootPayload = { owner: 'root' };

        await client.secret.cubbyhole.delete(secretPath).unwrapOr(undefined);

        const [, writeError] = await client.secret.cubbyhole.write(secretPath, rootPayload);
        assert.equal(writeError, null);

        // Create a child token
        const [tokenData, tokenError] = await client.raw.post<{ auth?: { client_token?: string } }>(
            '/auth/token/create',
            { body: { ttl: '5m', policies: ['default'] } },
        );
        assert.equal(tokenError, null);
        const childToken = tokenData?.auth?.client_token;
        assert.equal(typeof childToken, 'string');

        // Use the child token to attempt reading root's cubbyhole path — should 404
        const childClient = new VaultClientV2({
            clusterAddress: 'http://vault.local:8200',
            authToken: childToken,
        });
        const [childData, childError] = await childClient.secret.cubbyhole.read(secretPath);
        assert.equal(childData, null);
        assert.equal(childError instanceof VaultClientError, true);
        assert.equal(childError?.status, 404);

        // Clean up
        await client.secret.cubbyhole.delete(secretPath).unwrapOr(undefined);
    });
});

async function ensureInitializedAndUnsealed(client: VaultClientV2): Promise<void> {
    loadEnvFile();

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
        updateEnvFile(initData);
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

function loadEnvFile(): void {
    let content: string;
    try {
        content = readFileSync(ENV_PATH, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
        }

        throw error;
    }

    for (const line of content.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        process.env[trimmedLine.slice(0, separatorIndex)] = trimmedLine.slice(separatorIndex + 1);
    }
}

function updateEnvFile(initData: VaultInitMaterial): void {
    const newVars = [
        `NANVC_VAULT_AUTH_TOKEN=${initData.root_token}`,
        `NANVC_VAULT_UNSEAL_KEY=${initData.keys[0]}`,
    ];

    let content: string;
    try {
        content = readFileSync(ENV_PATH, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        content = '';
    }

    const updatedContent = content
        .split('\n')
        .filter((line) => !line.startsWith('NANVC_VAULT_AUTH_TOKEN=') && !line.startsWith('NANVC_VAULT_UNSEAL_KEY='))
        .filter((line) => line.trim() !== '')
        .concat(newVars)
        .join('\n');

    writeFileSync(ENV_PATH, `${updatedContent}\n`, 'utf8');
    process.env.NANVC_VAULT_AUTH_TOKEN = initData.root_token;
    process.env.NANVC_VAULT_UNSEAL_KEY = initData.keys[0];
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

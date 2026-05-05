import type { VaultClientV2 } from '../../../../src/v2/index.js';
import assert from 'node:assert/strict';
import { suite, test, beforeAll } from '../../../mocha/decorators.js';
import {
    isAuthMethodNotFoundError,
    createTestVaultClient,
    getTestRootToken,
    getTestUnsealKey,
    isMountNotFoundError,
} from '../../../helpers/vault.js';
import { VaultClientError } from '../../../../src/v2/index.js';

type SecretData = {
    foo: string;
};

const asString = (value: unknown): string => value as string;

@suite('VaultClientV2 integration test cases.')
export class VaultClientV2IntegrationTests {
    private client!: VaultClientV2;

    @beforeAll()
    public async beforeAll() {
        this.client = await createTestVaultClient();
    }

    @test('vault initialisation process should fail if it is already initialized')
    public async vaultInitialisationProcessShouldFailIfItIsAlreadyInitializedTest() {
        const [data, error] = await this.client.sys.init({ secret_shares: 1, secret_threshold: 1 });

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 400);
    }

    @test('should get initialization status')
    public async shouldGetInitializationStatusTest() {
        const [isInitialized, error] = await this.client.sys.isInitialized();

        assert.equal(error, null);
        assert.equal(isInitialized, true);
    }

    @test('should get seal status')
    public async shouldGetSealStatusTest() {
        const [status, error] = await this.client.sys.sealStatus();

        assert.equal(error, null);
        assert.equal(status.sealed, false);
        assert.equal(status.t, 1);
        assert.equal(status.n, 1);
    }

    @test('should get health status through the sys status shorthand')
    public async shouldGetHealthStatusThroughTheSysStatusShorthandTest() {
        const [status, error] = await this.client.sys.status();

        assert.equal(error, null);
        assert.equal(status.initialized, true);
        assert.equal(status.sealed, false);
    }

    @test('should report ready through the sys health shorthand when vault is unsealed')
    public async shouldReportReadyThroughTheSysHealthShorthandWhenVaultIsUnsealedTest() {
        const [ready, error] = await this.client.sys.isReady();

        assert.equal(error, null);
        assert.equal(ready, true);
    }

    @test('should report not ready through the sys health shorthand when vault is sealed')
    public async shouldReportNotReadyThroughTheSysHealthShorthandWhenVaultIsSealedTest() {
        const [sealData, sealError] = await this.client.raw.put('/sys/seal');

        assert.equal(sealData, undefined);
        assert.equal(sealError, null);

        try {
            const [ready, error] = await this.client.sys.isReady();

            assert.equal(error, null);
            assert.equal(ready, false);
        } finally {
            const unsealKey = getTestUnsealKey();
            const [, unsealError] = await this.client.sys.unseal({ key: unsealKey });

            assert.equal(unsealError, null);
        }
    }

    @test('should unseal vault')
    public async shouldUnsealVaultTest() {
        const unsealKey = getTestUnsealKey();
        const [status, error] = await this.client.sys.unseal({ key: unsealKey });

        assert.equal(error, null);
        assert.equal(status.sealed, false);
    }

    @test('should mount and unmount a secrets engine')
    public async shouldMountAndUnmountASecretsEngineTest() {
        const mountPath = 'test-temp-v2';

        await ensureMountRemoved(this.client, mountPath);

        const [mountData, mountError] = await this.client.sys.mount.enable(mountPath, { type: 'kv' });
        const [unmountData, unmountError] = await this.client.sys.mount.disable(mountPath);

        assert.equal(mountData, undefined);
        assert.equal(mountError, null);
        assert.equal(unmountData, undefined);
        assert.equal(unmountError, null);
    }

    @test('should list, write, read and delete ACL policies through sys.policies.acl')
    public async shouldListWriteReadAndDeleteAclPoliciesThroughSysPoliciesAclTest() {
        const policyName = 'integration-policy-v2';
        const policyBody = 'path "secret/*" { capabilities = ["read"] }';

        await this.client.sys.policies.acl.delete(policyName).unwrapOr(undefined);

        try {
            const [beforeList, beforeListError] = await this.client.sys.policies.acl.list();
            const [writeData, writeError] = await this.client.sys.policies.acl.write(policyName, {
                policy: policyBody,
            });
            const [readData, readError] = await this.client.sys.policies.acl.read(policyName);
            const [afterList, afterListError] = await this.client.sys.policies.acl.list();

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
            const [deleteData, deleteError] = await this.client.sys.policies.acl.delete(policyName);
            const [finalList, finalListError] = await this.client.sys.policies.acl.list();

            assert.equal(deleteError, null);
            assert.equal(deleteData, undefined);
            assert.equal(finalListError, null);
            assert.equal(finalList.includes(policyName), false);
        }
    }

    @test('should wrap, lookup, rewrap and unwrap a secret payload')
    public async shouldWrapLookupRewrapAndUnwrapASecretPayloadTest() {
        const payload = { role_id: 'test-role', secret_id: 'test-secret' };
        const ttl = '300s';

        const [wrapResult, wrapError] = await this.client.sys.wrapping.wrap(payload, ttl);

        assert.equal(wrapError, null);
        assert.equal(typeof wrapResult.wrap_info?.token, 'string');
        assert.equal(asString(wrapResult.wrap_info?.token).length > 0, true);
        assert.equal(typeof wrapResult.wrap_info?.creation_path, 'string');

        const wrappingToken = asString(wrapResult.wrap_info?.token);

        const [lookupResult, lookupError] = await this.client.sys.wrapping.lookup(wrappingToken);

        assert.equal(lookupError, null);
        assert.equal(typeof lookupResult.creation_path, 'string');
        assert.equal(lookupResult.creation_path?.includes('wrapping/wrap'), true);
        assert.equal(typeof lookupResult.creation_time, 'string');
        assert.equal(typeof lookupResult.creation_ttl, 'number');
        assert.equal(lookupResult.creation_ttl, 300);

        const [rewrapResult, rewrapError] = await this.client.sys.wrapping.rewrap(wrappingToken);

        assert.equal(rewrapError, null);
        assert.equal(typeof rewrapResult.wrap_info?.token, 'string');
        assert.equal(asString(rewrapResult.wrap_info?.token).length > 0, true);
        assert.notEqual(rewrapResult.wrap_info?.token, wrappingToken);

        const newWrappingToken = asString(rewrapResult.wrap_info?.token);

        const [unwrapResult, unwrapError] = await this.client.sys.wrapping.unwrap(newWrappingToken);

        assert.equal(unwrapError, null);
        assert.deepEqual(unwrapResult.data, payload);
    }

    @test('should return an error when looking up an invalid wrapping token')
    public async shouldReturnAnErrorWhenLookingUpAnInvalidWrappingTokenTest() {
        const [result, error] = await this.client.sys.wrapping.lookup('invalid-token');

        assert.equal(result, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
    }

    @test('should return an error when unwrapping an already-consumed token')
    public async shouldReturnAnErrorWhenUnwrappingAnAlreadyConsumedTokenTest() {
        const payload = { key: 'value' };

        const [wrapResult, wrapError] = await this.client.sys.wrapping.wrap(payload, '300s');

        assert.equal(wrapError, null);

        const wrappingToken = asString(wrapResult.wrap_info?.token);

        await this.client.sys.wrapping.unwrap(wrappingToken);

        const [result, error] = await this.client.sys.wrapping.unwrap(wrappingToken);

        assert.equal(result, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 400);
    }

    @test('should enable, read and detect an auth method')
    public async shouldEnableReadAndDetectAnAuthMethodTest() {
        const authPath = 'approle-v2-test';

        await ensureAuthMethodRemoved(this.client, authPath);

        try {
            const [enableData, enableError] = await this.client.auth.enableAuthMethod(`/${authPath}`, {
                description: 'Integration AppRole auth mount',
                type: 'approle',
            });
            const [config, configError] = await this.client.auth.getAuthMethodConfig(authPath);
            const [enabledAfter, enabledAfterError] = await this.client.auth.isAuthMethodEnabled(authPath);
            const [secondEnableData, secondEnableError] = await this.client.auth.enableAuthMethod(authPath, {
                description: 'Integration AppRole auth mount',
                type: 'approle',
            });
            const [registerData, registerError] = await this.client.auth.registerAppRole(authPath, 'integration-role', {
                token_max_ttl: '30m',
                token_policies: ['default'],
                token_ttl: '20m',
            });
            const [registerRoleIdData, registerRoleIdError] = await this.client.auth.registerAppRoleRoleId(
                authPath,
                'integration-role',
                { role_id: 'integration-role-id' },
            );
            const [roleId, roleIdError] = await this.client.auth.getAppRoleRoleId(authPath, 'integration-role');
            const [secretId, secretIdError] = await this.client.auth.generateAppRoleSecretId(
                authPath,
                'integration-role',
                {
                    metadata: '{"suite":"integration-v2"}',
                    ttl: '20m',
                },
            );
            const [login, loginError] = await this.client.auth.loginWithAppRole(authPath, {
                role_id: roleId?.role_id,
                secret_id: secretId?.secret_id,
            });

            this.client.setToken(getTestRootToken());

            const [roleConfig, roleConfigError] = await this.client.raw.get<{
                data?: { token_policies?: string[]; token_ttl?: number };
            }>(`/auth/${authPath}/role/integration-role`);

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

            const [disableData, disableError] = await this.client.auth.disableAuthMethod(`/${authPath}`);
            const disabledError = await this.client.auth.getAuthMethodConfig(authPath).intoErr();

            assert.equal(disableData, undefined);
            assert.equal(disableError, null);
            assert.equal(disabledError?.code, 'HTTP_ERROR');
            assert.equal(disabledError?.status, 400);
        } finally {
            await ensureAuthMethodRemoved(this.client, authPath);
        }
    }

    @test('should write, read, list and delete secrets on a kv v2 mount')
    public async shouldWriteReadListAndDeleteSecretsOnAKvV2MountTest() {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/my-secret';

        await ensureMountRemoved(this.client, mountPath);
        await ensureKvV2MountAvailable(this.client, mountPath);

        const [writeData, writeError] = await this.client.secret.kv.v2.write(mountPath, secretPath, { foo: 'bar-kv2' });
        const [secret, readError] = await this.client.secret.kv.v2.read<SecretData>(mountPath, secretPath);
        const [keys, listError] = await this.client.secret.kv.v2.list(mountPath, 'integration-v2');
        const [deleteData, deleteError] = await this.client.secret.kv.v2.delete(mountPath, secretPath);
        const [deletedSecret, deletedReadError] = await this.client.secret.kv.v2.read<SecretData>(
            mountPath,
            secretPath,
        );

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
    }

    @test('should patch, deleteVersions, undeleteVersions, destroyVersions and deleteMetadata on kv v2')
    public async shouldPatchDeleteversionsUndeleteversionsDestroyversionsAndDeletemetadataOnKvV2Test() {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/versioned-secret';

        await ensureMountRemoved(this.client, mountPath);
        await ensureKvV2MountAvailable(this.client, mountPath);

        // Write v1
        const [writeV1, writeV1Error] = await this.client.secret.kv.v2.write(mountPath, secretPath, {
            foo: 'v1',
            bar: 'original',
        });
        assert.equal(writeV1Error, null);
        void writeV1;

        // Patch to produce v2 (merge-patch)
        const [patchData, patchError] = await this.client.secret.kv.v2.patch(mountPath, secretPath, {
            foo: 'v2-patched',
        });
        assert.equal(patchError, null);
        void patchData;

        // Read v2 (latest)
        const [v2Secret, v2ReadError] = await this.client.secret.kv.v2.read<{ foo: string; bar: string }>(
            mountPath,
            secretPath,
        );
        assert.equal(v2ReadError, null);
        assert.equal(v2Secret.data.foo, 'v2-patched');
        assert.equal(v2Secret.metadata.version, 2);

        // Soft-delete v1
        const [deleteVersionsData, deleteVersionsError] = await this.client.secret.kv.v2.deleteVersions(
            mountPath,
            secretPath,
            [1],
        );
        assert.equal(deleteVersionsError, null);
        void deleteVersionsData;

        // Read v1 - should surface deleted metadata
        const [v1Deleted, v1DeletedError] = await this.client.secret.kv.v2.read<{ foo: string }>(
            mountPath,
            secretPath,
            { version: 1 },
        );
        assert.equal(v1DeletedError, null);
        assert.equal(typeof v1Deleted.metadata.deletion_time, 'string');

        // Undelete v1
        const [undeleteData, undeleteError] = await this.client.secret.kv.v2.undeleteVersions(
            mountPath,
            secretPath,
            [1],
        );
        assert.equal(undeleteError, null);
        void undeleteData;

        // Read v1 again - should be accessible now
        const [v1Restored, v1RestoredError] = await this.client.secret.kv.v2.read<{ foo: string }>(
            mountPath,
            secretPath,
            { version: 1 },
        );
        assert.equal(v1RestoredError, null);
        assert.equal(v1Restored.data.foo, 'v1');

        // Destroy v1 permanently
        const [destroyData, destroyError] = await this.client.secret.kv.v2.destroyVersions(mountPath, secretPath, [1]);
        assert.equal(destroyError, null);
        void destroyData;

        // Read v1 metadata to confirm destroyed=true
        const [metaAfterDestroy, metaAfterDestroyError] = await this.client.secret.kv.v2.readMetadata(
            mountPath,
            secretPath,
        );
        assert.equal(metaAfterDestroyError, null);
        const versionsAfterDestroy = metaAfterDestroy.versions as Record<string, { destroyed: boolean }>;
        assert.equal(versionsAfterDestroy['1']?.destroyed, true);

        // Delete all metadata for this secret
        const [deleteMetaData, deleteMetaError] = await this.client.secret.kv.v2.deleteMetadata(mountPath, secretPath);
        assert.equal(deleteMetaError, null);
        void deleteMetaData;

        // Confirm the secret metadata is gone (deleteMetadata removes all versions and metadata)
        const [, deletedMetaError] = await this.client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(deletedMetaError?.status, 404);
    }

    @test('should read and write kv v2 metadata for a secret')
    public async shouldReadAndWriteKvV2MetadataForASecretTest() {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/metadata-secret';

        await ensureMountRemoved(this.client, mountPath);
        await ensureKvV2MountAvailable(this.client, mountPath);

        const [, writeError] = await this.client.secret.kv.v2.write(mountPath, secretPath, { key: 'val' });
        assert.equal(writeError, null);

        // Write metadata
        const [writeMeta, writeMetaError] = await this.client.secret.kv.v2.writeMetadata(mountPath, secretPath, {
            max_versions: 5,
            custom_metadata: { owner: 'test-suite' },
        });
        assert.equal(writeMetaError, null);
        void writeMeta;

        // Read metadata back
        const [meta, metaError] = await this.client.secret.kv.v2.readMetadata(mountPath, secretPath);
        assert.equal(metaError, null);
        assert.equal(meta.max_versions, 5);
        assert.deepEqual((meta.custom_metadata as Record<string, string>)['owner'], 'test-suite');

        // Patch metadata
        const [patchMeta, patchMetaError] = await this.client.secret.kv.v2.patchMetadata(mountPath, secretPath, {
            max_versions: 10,
        });
        assert.equal(patchMetaError, null);
        void patchMeta;

        const [metaAfterPatch, metaAfterPatchError] = await this.client.secret.kv.v2.readMetadata(
            mountPath,
            secretPath,
        );
        assert.equal(metaAfterPatchError, null);
        assert.equal(metaAfterPatch.max_versions, 10);
    }

    @test('should read and write the kv v2 engine configuration')
    public async shouldReadAndWriteTheKvV2EngineConfigurationTest() {
        const mountPath = 'secret-v2-config-test';

        await ensureMountRemoved(this.client, mountPath);
        await ensureKvV2MountAvailable(this.client, mountPath);

        // Write config
        const [writeConfig, writeConfigError] = await this.client.secret.kv.v2.writeConfig(mountPath, {
            max_versions: 7,
            cas_required: false,
        });
        assert.equal(writeConfigError, null);
        void writeConfig;

        // Read config back
        const [config, configError] = await this.client.secret.kv.v2.readConfig(mountPath);
        assert.equal(configError, null);
        assert.equal(config.max_versions, 7);
        assert.equal(config.cas_required, false);

        await ensureMountRemoved(this.client, mountPath);
    }

    @test('should read kv v2 subkeys for a secret')
    public async shouldReadKvV2SubkeysForASecretTest() {
        const mountPath = 'secret-v2-test';
        const secretPath = 'integration-v2/subkeys-secret';

        await ensureMountRemoved(this.client, mountPath);
        await ensureKvV2MountAvailable(this.client, mountPath);

        const [, writeError] = await this.client.secret.kv.v2.write(mountPath, secretPath, {
            foo: 'bar',
            nested: { a: 1, b: 2 },
        });
        assert.equal(writeError, null);

        const [subkeys, subkeysError] = await this.client.secret.kv.v2.readSubkeys(mountPath, secretPath);
        assert.equal(subkeysError, null);
        assert.equal(typeof subkeys.subkeys, 'object');
        const sk = subkeys.subkeys as Record<string, unknown>;
        assert.equal('foo' in sk, true);
        assert.equal('nested' in sk, true);
    }
}

async function ensureKvV2MountAvailable(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.enable(path, {
        type: 'kv',
        options: {
            version: '2',
        },
    });
    if (error && !error.isMountAlreadyExistsError()) {
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

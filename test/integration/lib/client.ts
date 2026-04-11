import assert from 'node:assert/strict';
import { VaultClient } from './../../../src/lib/client.js';
import { VaultResponse } from '../../../src/lib/commands/spec.js';
import type { VaultRemountPayloadRequest } from '../../../src/lib/commands/sys-remount.js';
import type { VaultAuthPayloadRequest } from '../../../src/lib/commands/sys-auth.js';


const asObject = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
const asStringArray = (value: unknown): string[] => value as string[];
const asString = (value: unknown): string => value as string;
const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const assertNotEmpty = (value: string | unknown[]): void => assert.notEqual(value.length, 0);
const assertInstanceOf = <T extends abstract new (...args: never[]) => unknown>(
    value: unknown,
    ctor: T,
): void => assert.ok(value instanceof ctor);
const assertOneOf = <T>(value: T, expected: readonly T[]): void => assert.ok(expected.includes(value));

let rootToken: string;
let unsealKey: string;

describe('VaultClient integration test cases.', function () {

    let client: VaultClient;

    beforeEach(async function () {
        const args: [string?, string?] = ['http://vault.local:8200'];
        if (rootToken) {
            args.push(rootToken);
        }
        client = new VaultClient(...args);

        const initStatus = await client.isInitialized();
        const initStatusData = asObject(initStatus.apiResponse);

        if (initStatusData.initialized !== true) {
            const initResponse = await client.init({ secret_shares: 1, secret_threshold: 1 });
            const initData = asObject(initResponse.apiResponse);

            assert.equal(initResponse.succeeded, true);
            assert.equal(asStringArray(initData.keys).length, 1);
            assert.equal(asStringArray(initData.keys_base64).length, 1);
            assertNotEmpty(asString(initData.root_token));
            assert.equal(initResponse.errorMessage, undefined);

            rootToken = asString(initData.root_token);
            unsealKey = asStringArray(initData.keys)[0];
            client.token = rootToken;
        }

        const statusResponse = await client.status();
        const statusData = asObject(statusResponse.apiResponse);

        if (statusData.sealed === true && unsealKey) {
            const unsealResponse = await client.unseal({
                key: unsealKey,
            });

            assert.equal(unsealResponse.succeeded, true);
        }
    });

    it('vault initialisation process should fail if is already initialized', async function () {
        // Given
        const payload = { secret_shares: 1, secret_threshold: 1 };

        // When
        const vaultResponse = await client.init(payload);

        // Then
        assert.equal(vaultResponse.succeeded, false);
        assert.equal(vaultResponse.httpStatusCode, 400);
    });

    it('should get initialization status', async function () {
        // Given

        // When
        const expectedResult = await client.isInitialized();

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(asObject(expectedResult.apiResponse).initialized, true);
    });

    it('should fail tv4 validation', async function () {
        // Given

        // When
        // @ts-expect-error testing invalid payload that should fail tv4 validation
        const expectedResult = await client.unseal({ key: 123 });

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, false);
        assert.equal(expectedResult.httpStatusCode, undefined);
    });

    it('should unseal vault', async function () {
        // Given

        // When
        const expectedResult = await client.unseal({
            key: unsealKey,
        });

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
    });

    it('should seal vault', async function () {
        // Given

        // When
        const expectedResult = await client.seal();

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(expectedResult.httpStatusCode, 204);
        await client.unseal({
            key: unsealKey,
        });
    });

    it('should write a secret', async function () {
        // Given
        const path = '/secret/integration-tests/my-secret',
            secret = { foo: 'bar' };
        // When
        // ensures the secret path is mounted
        await client.mount('secret', { type: 'kv' });
        const expectedResult = await client.write(path, secret);

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
    });

    it('should update a secret', async function () {
        // Given
        const path = '/secret/integration-tests/my-secret',
            secret = { foo: 'bar-updated' };

        // When
        const expectedResult = await client.update(path, secret);

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
    });

    it('should read a secret', async function () {
        // Given
        const path = '/secret/integration-tests/my-secret';
        // When
        const expectedResult = await client.read(path);
        const responseData = asObject(asObject(expectedResult.apiResponse).data);

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(asString(responseData.foo), 'bar-updated');
    });

    it('should delete a secret', async function () {
        // Given
        const path = '/secret/integration-tests/my-secret';

        // When
        const expectedResult = await client.delete(path);

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        const checkDeleteResult = await client.read(path);
        assert.equal(checkDeleteResult.succeeded, false);
        assert.equal(checkDeleteResult.httpStatusCode, 404);
    });

    it('should get status', async function () {
        // Given

        // When
        const expectedResult = await client.status();

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);

        assert.equal(asObject(expectedResult.apiResponse).t, 1);
        assert.equal(asObject(expectedResult.apiResponse).n, 1);
    });

    it('should retrieve audit stats', async function () {
        // Given

        // When
        const expectedResult = await client.audits();

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(expectedResult.httpStatusCode, 200);
    });

    it('should enable audit', async function () {
        // Given
        const payload = {
            type: 'file',
            options: {
                path: '/var/log/vault/audit-log.json',
            },
        };

        // When
        const expectedResult = await client.enableAudit('/test-audit', payload);

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(expectedResult.httpStatusCode, 204);
    });

    it('should retrieve audit hash', async function () {
        // Given

        // When
        const vaultResponse = await client.auditHash('/test-audit', { input: 'foo' });

        // Then
        assertInstanceOf(vaultResponse, VaultResponse);
        assert.equal(vaultResponse.succeeded, true);
        assertNotEmpty(asString(asObject(vaultResponse.apiResponse).hash));
    });

    it('should disable audit', async function () {
        // Given

        // When
        const expectedResult = await client.disableAudit('/test-audit');

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(expectedResult.httpStatusCode, 204);
    });

    it('should retrieve policy list', async function () {
        // Given

        // When
        const expectedResult = await client.policies();

        // Then
        assertInstanceOf(expectedResult, VaultResponse);
        assert.equal(expectedResult.succeeded, true);
        assert.equal(expectedResult.httpStatusCode, 200);
        assert.ok(Array.isArray(asObject(expectedResult.apiResponse).keys));
        assertNotEmpty(asString(asObject(expectedResult.apiResponse).keys));
    });

    it('should add and remove a policy', async function () {
        // Given
        const policyName = 'integration-policy';
        const payload = {
            policy: 'path "secret/*" { capabilities = ["create", "read", "update", "delete", "list"] }',
        };

        // When
        const addPolicyResult = await client.addPolicy(policyName, payload);
        const policiesAfterAddResult = await client.policies();
        const removePolicyResult = await client.removePolicy(policyName);
        const policiesAfterRemoveResult = await client.policies();
        const policiesAfterAdd = asStringArray(asObject(policiesAfterAddResult.apiResponse).keys);
        const policiesAfterRemove = asStringArray(asObject(policiesAfterRemoveResult.apiResponse).keys);

        // Then
        assert.equal(addPolicyResult.httpStatusCode, 204);
        assert.equal(policiesAfterAddResult.httpStatusCode, 200);
        assert.equal(policiesAfterAdd.includes(policyName), true);
        assert.equal(removePolicyResult.httpStatusCode, 204);
        assert.equal(policiesAfterRemoveResult.httpStatusCode, 200);
        assert.equal(policiesAfterRemove.includes(policyName), false);
    });

    it('should validate dynamic credentials flow', async function () {
        // Given
        const payload = {
            type: 'database',
            plugin_name: 'postgresql-database-plugin',
        };
        const pgSetupPayload = {
            plugin_name: 'postgresql-database-plugin',
            connection_url: 'postgresql://nanvc:integration@db:5432/postgres?sslmode=disable',
            allowed_roles: 'readonly',
        };
        const readonlyRolePayload = {
            db_name: 'postgresql',
            creation_statements: `
                CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
                GRANT SELECT ON ALL TABLES IN SCHEMA public TO "{{name}}";
            `,
        };

        // Then
        const mountResult = await client.mount('database', payload);
        const writePgConnSetupResult = await client.write('database/config/postgresql', pgSetupPayload);
        const writePgReadonlyRoleResult = await client.write('database/roles/readonly', readonlyRolePayload);
        const credsReadonlyResult = await client.read('database/creds/readonly');
        const mountsResult = await client.mounts();
        const unmountResult = await client.unmount('database');
        const mountsAfterDbUnmountResult = await client.mounts();
        const credsData = asObject(asObject(credsReadonlyResult.apiResponse).data);
        const mountsData = asObject(asObject(mountsResult.apiResponse).data);
        const mountsAfterUnmountData = asObject(asObject(mountsAfterDbUnmountResult.apiResponse).data);

        // When
        assert.equal(mountResult.httpStatusCode, 204);
        assert.equal(writePgConnSetupResult.httpStatusCode, 200);
        assert.equal(writePgReadonlyRoleResult.httpStatusCode, 204);
        assertNotEmpty(asString(credsData.username));
        assertNotEmpty(asString(credsData.password));
        assert.equal(mountsResult.httpStatusCode, 200);
        assert.equal(hasOwn(mountsData, 'database/'), true);
        assert.equal(hasOwn(mountsData, 'secret/'), true);
        assert.equal(hasOwn(mountsData, 'sys/'), true);
        assert.equal(unmountResult.httpStatusCode, 204);
        assert.equal(hasOwn(mountsAfterUnmountData, 'database/'), false);

    });

    it('should validate remount command', async function () {
        // Given
        const payload: VaultRemountPayloadRequest = {
            from: 'secret',
            to: 'secret-new',
        };

        // Then
        const remountResult = await client.remount(payload);
        const mountsResult = await client.mounts();
        const mountsData = asObject(asObject(mountsResult.apiResponse).data);

        // When
        assertOneOf(remountResult.httpStatusCode, [200, 204]);
        assert.equal(mountsResult.httpStatusCode, 200);
        assert.equal(hasOwn(mountsData, 'secret/'), false);
        assert.equal(hasOwn(mountsData, 'secret-new/'), true);
    });

    it('Should validate auth flow', async function () {
        // Given
        const userpassAuthPayload: VaultAuthPayloadRequest = {
            type: 'userpass',
            description: 'user and password based credentials',
        };
        const createUserPayload = {
            password: 's3cr3t',
            policies: 'admin,default',
        };

        // Then
        const enableAuthResult = await client.enableAuth('userpass', userpassAuthPayload);
        const authResult = await client.auths();
        const createUserResult = await client.write('/auth/userpass/users/integration', createUserPayload);
        const listUsersResult = await client.list('/auth/userpass/users');
        const disableAuthResult = await client.disableAuth('userpass');
        const authResultAfterDisablingUserpass = await client.auths();
        const authData = asObject(asObject(authResult.apiResponse).data);
        const listUsersData = asObject(asObject(listUsersResult.apiResponse).data);
        const authDataAfterDisable = asObject(asObject(authResultAfterDisablingUserpass.apiResponse).data);

        // When
        assert.equal(authResult.httpStatusCode, 200);
        assert.equal(enableAuthResult.httpStatusCode, 204);
        assert.equal(createUserResult.httpStatusCode, 204);
        assert.equal(hasOwn(authData, 'userpass/'), true);
        assertOneOf('integration', asStringArray(listUsersData.keys));
        assert.equal(disableAuthResult.httpStatusCode, 204);
        assert.equal(authResultAfterDisablingUserpass.httpStatusCode, 200);
        assert.equal(hasOwn(authDataAfterDisable, 'userpass/'), false);

    });
});

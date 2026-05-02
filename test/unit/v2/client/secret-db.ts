import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { VaultSecretDbClient } from '../../../../src/v2/client/secret-db.js';
import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';
import { err, ok, toResult } from '../../../../src/v2/core/result.js';

import type { SinonSandbox } from 'sinon';

describe('VaultSecretDbClient unit test cases.', function () {
    let sandbox: SinonSandbox;

    const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
        toResult(Promise.resolve(tuple));

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    // ── configureConnection ───────────────────────────────────────────────────

    it('configureConnection should call POST with the correct path and body', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.configureConnection('database', 'my-db', {
            plugin_name: 'postgresql-database-plugin',
            allowed_roles: ['my-role'],
        });

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/config/{name}');
        assert.deepEqual(postStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-db',
        });
        assert.deepEqual(postStub.firstCall.args[1]?.body, {
            plugin_name: 'postgresql-database-plugin',
            allowed_roles: ['my-role'],
        });
    });

    it('configureConnection should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.configureConnection('database', 'my-db', {});

        assert.equal(data, null);
        assert.equal(error, clientError);
    });

    // ── readConnection ────────────────────────────────────────────────────────

    it('readConnection should return the data field from the Vault response', async function () {
        const connectionData = {
            name: 'my-db',
            plugin_name: 'postgresql-database-plugin',
            allowed_roles: ['my-role'],
        };
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: connectionData })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'my-db');

        assert.equal(error, null);
        assert.deepEqual(data, connectionData);
    });

    it('readConnection should return empty object when data field is absent', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({})),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'my-db');

        assert.equal(error, null);
        assert.deepEqual(data, {});
    });

    it('readConnection should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'missing');

        assert.equal(data, null);
        assert.equal(error, clientError);
    });

    // ── deleteConnection ──────────────────────────────────────────────────────

    it('deleteConnection should call DELETE with the correct path params', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.deleteConnection('database', 'my-db');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(deleteStub.calledOnce, true);
        assert.equal(deleteStub.firstCall.args[0], '/{database_mount_path}/config/{name}');
        assert.deepEqual(deleteStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-db',
        });
    });

    it('deleteConnection should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteConnection('database', 'missing');

        assert.equal(error, clientError);
    });

    // ── listConnections ───────────────────────────────────────────────────────

    it('listConnections should return keys from data envelope', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({ data: { keys: ['conn-a', 'conn-b'] } })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['conn-a', 'conn-b']);
    });

    it('listConnections should fall back to top-level keys when data envelope is absent', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({ keys: ['conn-a'] })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['conn-a']);
    });

    it('listConnections should return an empty array when there are no connections', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({})),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listConnections should return an empty array when Vault returns 404 (no connections)', async function () {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listConnections should surface non-404 Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listConnections('database');

        assert.equal(error, clientError);
    });

    // ── resetConnection ───────────────────────────────────────────────────────

    it('resetConnection should call POST reset endpoint', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.resetConnection('database', 'my-db');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/reset/{name}');
    });

    it('resetConnection should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Internal Server Error', status: 500 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.resetConnection('database', 'my-db');

        assert.equal(error, clientError);
    });

    // ── rotateRootCredentials ─────────────────────────────────────────────────

    it('rotateRootCredentials should call POST rotate-root endpoint', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.rotateRootCredentials('database', 'my-db');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/rotate-root/{name}');
    });

    it('rotateRootCredentials should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.rotateRootCredentials('database', 'my-db');

        assert.equal(error, clientError);
    });

    // ── writeRole ─────────────────────────────────────────────────────────────

    it('writeRole should call POST with the correct path and body', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());
        const roleOptions = {
            db_name: 'my-db',
            creation_statements: ['CREATE ROLE "{{name}}"'],
            default_ttl: 3600,
        };

        const [data, error] = await client.writeRole('database', 'my-role', roleOptions);

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/roles/{name}');
        assert.deepEqual(postStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-role',
        });
        assert.deepEqual(postStub.firstCall.args[1]?.body, roleOptions);
    });

    it('writeRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Bad Request', status: 400 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.writeRole('database', 'my-role', {});

        assert.equal(error, clientError);
    });

    // ── readRole ──────────────────────────────────────────────────────────────

    it('readRole should return the data field from the Vault response', async function () {
        const roleData = {
            db_name: 'my-db',
            creation_statements: ['CREATE ROLE "{{name}}"'],
            default_ttl: 3600,
            max_ttl: 86400,
        };
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: roleData })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readRole('database', 'my-role');

        assert.equal(error, null);
        assert.deepEqual(data, roleData);
    });

    it('readRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readRole('database', 'missing-role');

        assert.equal(error, clientError);
    });

    // ── deleteRole ────────────────────────────────────────────────────────────

    it('deleteRole should call DELETE with the correct path', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteRole('database', 'my-role');

        assert.equal(error, null);
        assert.equal(deleteStub.firstCall.args[0], '/{database_mount_path}/roles/{name}');
    });

    it('deleteRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteRole('database', 'missing-role');

        assert.equal(error, clientError);
    });

    // ── listRoles ─────────────────────────────────────────────────────────────

    it('listRoles should return keys from data envelope', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({ data: { keys: ['role-a', 'role-b'] } })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['role-a', 'role-b']);
    });

    it('listRoles should return an empty array when there are no roles', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listRoles should return an empty array when Vault returns 404 (no roles)', async function () {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listRoles should surface non-404 Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listRoles('database');

        assert.equal(error, clientError);
    });

    // ── generateCredentials ───────────────────────────────────────────────────

    it('generateCredentials should return the full Vault credentials response', async function () {
        const credsResponse = {
            request_id: 'abc-123',
            lease_id: 'database/creds/my-role/xyz',
            renewable: true,
            lease_duration: 3600,
            data: {
                username: 'v-root-my-role-abc',
                password: 's3cr3t',
            },
        };
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok(credsResponse)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.generateCredentials('database', 'my-role');

        assert.equal(error, null);
        assert.equal(data?.lease_id, 'database/creds/my-role/xyz');
        assert.equal(data?.renewable, true);
        assert.equal(data?.lease_duration, 3600);
        assert.equal(data?.data?.username, 'v-root-my-role-abc');
        assert.equal(data?.data?.password, 's3cr3t');
    });

    it('generateCredentials should call GET with the correct path params', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: { username: 'u', password: 'p' } })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        await client.generateCredentials('database', 'my-role');

        assert.equal(getStub.firstCall.args[0], '/{database_mount_path}/creds/{name}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-role',
        });
    });

    it('generateCredentials should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.generateCredentials('database', 'my-role');

        assert.equal(error, clientError);
    });

    // ── writeStaticRole ───────────────────────────────────────────────────────

    it('writeStaticRole should call POST with the correct path and body', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());
        const options = {
            db_name: 'my-db',
            username: 'existing_user',
            rotation_period: 86400,
        };

        const [data, error] = await client.writeStaticRole('database', 'my-static-role', options);

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/static-roles/{name}');
        assert.deepEqual(postStub.firstCall.args[1]?.body, options);
    });

    it('writeStaticRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Bad Request', status: 400 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.writeStaticRole('database', 'my-static-role', {});

        assert.equal(error, clientError);
    });

    // ── readStaticRole ────────────────────────────────────────────────────────

    it('readStaticRole should return the data field from the Vault response', async function () {
        const staticRoleData = {
            db_name: 'my-db',
            username: 'existing_user',
            rotation_period: 86400,
        };
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: staticRoleData })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readStaticRole('database', 'my-static-role');

        assert.equal(error, null);
        assert.deepEqual(data, staticRoleData);
    });

    it('readStaticRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readStaticRole('database', 'missing-role');

        assert.equal(error, clientError);
    });

    // ── deleteStaticRole ──────────────────────────────────────────────────────

    it('deleteStaticRole should call DELETE with the correct path', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteStaticRole('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(deleteStub.firstCall.args[0], '/{database_mount_path}/static-roles/{name}');
    });

    it('deleteStaticRole should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteStaticRole('database', 'missing-role');

        assert.equal(error, clientError);
    });

    // ── listStaticRoles ───────────────────────────────────────────────────────

    it('listStaticRoles should return keys from data envelope', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({ data: { keys: ['static-a', 'static-b'] } })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['static-a', 'static-b']);
    });

    it('listStaticRoles should return an empty array when there are no static roles', async function () {
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listStaticRoles should return an empty array when Vault returns 404 (no static roles)', async function () {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    });

    it('listStaticRoles should surface non-404 Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listStaticRoles('database');

        assert.equal(error, clientError);
    });

    // ── readStaticCredentials ─────────────────────────────────────────────────

    it('readStaticCredentials should return the full Vault static credentials response', async function () {
        const staticCredsResponse = {
            request_id: 'xyz-456',
            lease_id: '',
            renewable: false,
            lease_duration: 0,
            data: {
                last_vault_rotation: '2024-01-01T00:00:00Z',
                password: 'current-pw',
                rotation_period: 86400,
                ttl: 86399,
                username: 'existing_user',
            },
        };
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok(staticCredsResponse)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readStaticCredentials('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(data?.data?.username, 'existing_user');
        assert.equal(data?.data?.password, 'current-pw');
        assert.equal(data?.data?.ttl, 86399);
        assert.equal(data?.data?.rotation_period, 86400);
    });

    it('readStaticCredentials should call GET with the correct path params', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: { username: 'u', password: 'p' } })),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        await client.readStaticCredentials('database', 'my-static-role');

        assert.equal(getStub.firstCall.args[0], '/{database_mount_path}/static-creds/{name}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-static-role',
        });
    });

    it('readStaticCredentials should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readStaticCredentials('database', 'missing-role');

        assert.equal(error, clientError);
    });

    // ── rotateStaticCredentials ───────────────────────────────────────────────

    it('rotateStaticCredentials should call POST rotate-role endpoint', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.rotateStaticCredentials('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/rotate-role/{name}');
        assert.deepEqual(postStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-static-role',
        });
    });

    it('rotateStaticCredentials should surface Vault errors', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.rotateStaticCredentials('database', 'my-static-role');

        assert.equal(error, clientError);
    });

    // ── unwrap convenience ────────────────────────────────────────────────────

    it('should unwrap a successful result without throwing', async function () {
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultSecretDbClient(new RawVaultClient());

        await assert.doesNotReject(
            client.configureConnection('database', 'my-db', {}).unwrap(),
        );
    });

    it('should reject unwrap with the underlying client error', async function () {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        await assert.rejects(
            client.configureConnection('database', 'my-db', {}).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });
});

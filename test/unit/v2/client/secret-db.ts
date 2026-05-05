import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { suite, test, beforeEachTest, afterEachTest } from '../../../mocha/decorators.js';

import { VaultSecretDbClient } from '../../../../src/v2/client/secret-db.js';
import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';
import { err, ok, toResult } from '../../../../src/v2/core/result.js';

import type { SinonSandbox } from 'sinon';

const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
    toResult(Promise.resolve(tuple));

@suite('VaultSecretDbClient unit test cases.')
export class VaultSecretDbClientUnitTests {
    private sandbox!: SinonSandbox;

    @beforeEachTest()
    public beforeEach() {
        this.sandbox = createSandbox();
    }

    @afterEachTest()
    public afterEach() {
        this.sandbox.restore();
    }

    // ── configureConnection ───────────────────────────────────────────────────

    @test('configureConnection should call POST with the correct path and body')
    public async configureconnectionShouldCallPostWithTheCorrectPathAndBodyTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
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
    }

    @test('configureConnection should surface Vault errors')
    public async configureconnectionShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.configureConnection('database', 'my-db', {});

        assert.equal(data, null);
        assert.equal(error, clientError);
    }

    // ── readConnection ────────────────────────────────────────────────────────

    @test('readConnection should return the data field from the Vault response')
    public async readconnectionShouldReturnTheDataFieldFromTheVaultResponseTest() {
        const connectionData = {
            name: 'my-db',
            plugin_name: 'postgresql-database-plugin',
            allowed_roles: ['my-role'],
        };
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: connectionData })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'my-db');

        assert.equal(error, null);
        assert.deepEqual(data, connectionData);
    }

    @test('readConnection should return empty object when data field is absent')
    public async readconnectionShouldReturnEmptyObjectWhenDataFieldIsAbsentTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'my-db');

        assert.equal(error, null);
        assert.deepEqual(data, {});
    }

    @test('readConnection should surface Vault errors')
    public async readconnectionShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readConnection('database', 'missing');

        assert.equal(data, null);
        assert.equal(error, clientError);
    }

    // ── deleteConnection ──────────────────────────────────────────────────────

    @test('deleteConnection should call DELETE with the correct path params')
    public async deleteconnectionShouldCallDeleteWithTheCorrectPathParamsTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
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
    }

    @test('deleteConnection should surface Vault errors')
    public async deleteconnectionShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteConnection('database', 'missing');

        assert.equal(error, clientError);
    }

    // ── listConnections ───────────────────────────────────────────────────────

    @test('listConnections should return keys from data envelope')
    public async listconnectionsShouldReturnKeysFromDataEnvelopeTest() {
        this.sandbox
            .stub(RawVaultClient.prototype, 'list')
            .returns(resultOf(ok({ data: { keys: ['conn-a', 'conn-b'] } })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['conn-a', 'conn-b']);
    }

    @test('listConnections should fall back to top-level keys when data envelope is absent')
    public async listconnectionsShouldFallBackToTopLevelKeysWhenDataEnvelopeIsAbsentTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({ keys: ['conn-a'] })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['conn-a']);
    }

    @test('listConnections should return an empty array when there are no connections')
    public async listconnectionsShouldReturnAnEmptyArrayWhenThereAreNoConnectionsTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listConnections should return an empty array when Vault returns 404 (no connections)')
    public async listconnectionsShouldReturnAnEmptyArrayWhenVaultReturns404NoConnectionsTest() {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listConnections('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listConnections should surface non-404 Vault errors')
    public async listconnectionsShouldSurfaceNon404VaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listConnections('database');

        assert.equal(error, clientError);
    }

    // ── resetConnection ───────────────────────────────────────────────────────

    @test('resetConnection should call POST reset endpoint')
    public async resetconnectionShouldCallPostResetEndpointTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.resetConnection('database', 'my-db');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/reset/{name}');
    }

    @test('resetConnection should surface Vault errors')
    public async resetconnectionShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Internal Server Error', status: 500 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.resetConnection('database', 'my-db');

        assert.equal(error, clientError);
    }

    // ── rotateRootCredentials ─────────────────────────────────────────────────

    @test('rotateRootCredentials should call POST rotate-root endpoint')
    public async rotaterootcredentialsShouldCallPostRotateRootEndpointTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.rotateRootCredentials('database', 'my-db');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/rotate-root/{name}');
    }

    @test('rotateRootCredentials should surface Vault errors')
    public async rotaterootcredentialsShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.rotateRootCredentials('database', 'my-db');

        assert.equal(error, clientError);
    }

    // ── writeRole ─────────────────────────────────────────────────────────────

    @test('writeRole should call POST with the correct path and body')
    public async writeroleShouldCallPostWithTheCorrectPathAndBodyTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
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
    }

    @test('writeRole should surface Vault errors')
    public async writeroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Bad Request', status: 400 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.writeRole('database', 'my-role', {});

        assert.equal(error, clientError);
    }

    // ── readRole ──────────────────────────────────────────────────────────────

    @test('readRole should return the data field from the Vault response')
    public async readroleShouldReturnTheDataFieldFromTheVaultResponseTest() {
        const roleData = {
            db_name: 'my-db',
            creation_statements: ['CREATE ROLE "{{name}}"'],
            default_ttl: 3600,
            max_ttl: 86400,
        };
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: roleData })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readRole('database', 'my-role');

        assert.equal(error, null);
        assert.deepEqual(data, roleData);
    }

    @test('readRole should surface Vault errors')
    public async readroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readRole('database', 'missing-role');

        assert.equal(error, clientError);
    }

    // ── deleteRole ────────────────────────────────────────────────────────────

    @test('deleteRole should call DELETE with the correct path')
    public async deleteroleShouldCallDeleteWithTheCorrectPathTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteRole('database', 'my-role');

        assert.equal(error, null);
        assert.equal(deleteStub.firstCall.args[0], '/{database_mount_path}/roles/{name}');
    }

    @test('deleteRole should surface Vault errors')
    public async deleteroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteRole('database', 'missing-role');

        assert.equal(error, clientError);
    }

    // ── listRoles ─────────────────────────────────────────────────────────────

    @test('listRoles should return keys from data envelope')
    public async listrolesShouldReturnKeysFromDataEnvelopeTest() {
        this.sandbox
            .stub(RawVaultClient.prototype, 'list')
            .returns(resultOf(ok({ data: { keys: ['role-a', 'role-b'] } })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['role-a', 'role-b']);
    }

    @test('listRoles should return an empty array when there are no roles')
    public async listrolesShouldReturnAnEmptyArrayWhenThereAreNoRolesTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listRoles should return an empty array when Vault returns 404 (no roles)')
    public async listrolesShouldReturnAnEmptyArrayWhenVaultReturns404NoRolesTest() {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listRoles should surface non-404 Vault errors')
    public async listrolesShouldSurfaceNon404VaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listRoles('database');

        assert.equal(error, clientError);
    }

    // ── generateCredentials ───────────────────────────────────────────────────

    @test('generateCredentials should return the full Vault credentials response')
    public async generatecredentialsShouldReturnTheFullVaultCredentialsResponseTest() {
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
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok(credsResponse)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.generateCredentials('database', 'my-role');

        assert.equal(error, null);
        assert.equal(data?.lease_id, 'database/creds/my-role/xyz');
        assert.equal(data?.renewable, true);
        assert.equal(data?.lease_duration, 3600);
        assert.equal(data?.data?.username, 'v-root-my-role-abc');
        assert.equal(data?.data?.password, 's3cr3t');
    }

    @test('generateCredentials should call GET with the correct path params')
    public async generatecredentialsShouldCallGetWithTheCorrectPathParamsTest() {
        const getStub = this.sandbox
            .stub(RawVaultClient.prototype, 'get')
            .returns(resultOf(ok({ data: { username: 'u', password: 'p' } })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        await client.generateCredentials('database', 'my-role');

        assert.equal(getStub.firstCall.args[0], '/{database_mount_path}/creds/{name}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-role',
        });
    }

    @test('generateCredentials should surface Vault errors')
    public async generatecredentialsShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.generateCredentials('database', 'my-role');

        assert.equal(error, clientError);
    }

    // ── writeStaticRole ───────────────────────────────────────────────────────

    @test('writeStaticRole should call POST with the correct path and body')
    public async writestaticroleShouldCallPostWithTheCorrectPathAndBodyTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
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
    }

    @test('writeStaticRole should surface Vault errors')
    public async writestaticroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Bad Request', status: 400 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.writeStaticRole('database', 'my-static-role', {});

        assert.equal(error, clientError);
    }

    // ── readStaticRole ────────────────────────────────────────────────────────

    @test('readStaticRole should return the data field from the Vault response')
    public async readstaticroleShouldReturnTheDataFieldFromTheVaultResponseTest() {
        const staticRoleData = {
            db_name: 'my-db',
            username: 'existing_user',
            rotation_period: 86400,
        };
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: staticRoleData })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readStaticRole('database', 'my-static-role');

        assert.equal(error, null);
        assert.deepEqual(data, staticRoleData);
    }

    @test('readStaticRole should surface Vault errors')
    public async readstaticroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readStaticRole('database', 'missing-role');

        assert.equal(error, clientError);
    }

    // ── deleteStaticRole ──────────────────────────────────────────────────────

    @test('deleteStaticRole should call DELETE with the correct path')
    public async deletestaticroleShouldCallDeleteWithTheCorrectPathTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteStaticRole('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(deleteStub.firstCall.args[0], '/{database_mount_path}/static-roles/{name}');
    }

    @test('deleteStaticRole should surface Vault errors')
    public async deletestaticroleShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.deleteStaticRole('database', 'missing-role');

        assert.equal(error, clientError);
    }

    // ── listStaticRoles ───────────────────────────────────────────────────────

    @test('listStaticRoles should return keys from data envelope')
    public async liststaticrolesShouldReturnKeysFromDataEnvelopeTest() {
        this.sandbox
            .stub(RawVaultClient.prototype, 'list')
            .returns(resultOf(ok({ data: { keys: ['static-a', 'static-b'] } })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, ['static-a', 'static-b']);
    }

    @test('listStaticRoles should return an empty array when there are no static roles')
    public async liststaticrolesShouldReturnAnEmptyArrayWhenThereAreNoStaticRolesTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(ok({})));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listStaticRoles should return an empty array when Vault returns 404 (no static roles)')
    public async liststaticrolesShouldReturnAnEmptyArrayWhenVaultReturns404NoStaticRolesTest() {
        const notFoundError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(notFoundError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [keys, error] = await client.listStaticRoles('database');

        assert.equal(error, null);
        assert.deepEqual(keys, []);
    }

    @test('listStaticRoles should surface non-404 Vault errors')
    public async liststaticrolesShouldSurfaceNon404VaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.listStaticRoles('database');

        assert.equal(error, clientError);
    }

    // ── readStaticCredentials ─────────────────────────────────────────────────

    @test('readStaticCredentials should return the full Vault static credentials response')
    public async readstaticcredentialsShouldReturnTheFullVaultStaticCredentialsResponseTest() {
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
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok(staticCredsResponse)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.readStaticCredentials('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(data?.data?.username, 'existing_user');
        assert.equal(data?.data?.password, 'current-pw');
        assert.equal(data?.data?.ttl, 86399);
        assert.equal(data?.data?.rotation_period, 86400);
    }

    @test('readStaticCredentials should call GET with the correct path params')
    public async readstaticcredentialsShouldCallGetWithTheCorrectPathParamsTest() {
        const getStub = this.sandbox
            .stub(RawVaultClient.prototype, 'get')
            .returns(resultOf(ok({ data: { username: 'u', password: 'p' } })));
        const client = new VaultSecretDbClient(new RawVaultClient());

        await client.readStaticCredentials('database', 'my-static-role');

        assert.equal(getStub.firstCall.args[0], '/{database_mount_path}/static-creds/{name}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-static-role',
        });
    }

    @test('readStaticCredentials should surface Vault errors')
    public async readstaticcredentialsShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.readStaticCredentials('database', 'missing-role');

        assert.equal(error, clientError);
    }

    // ── rotateStaticCredentials ───────────────────────────────────────────────

    @test('rotateStaticCredentials should call POST rotate-role endpoint')
    public async rotatestaticcredentialsShouldCallPostRotateRoleEndpointTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [data, error] = await client.rotateStaticCredentials('database', 'my-static-role');

        assert.equal(error, null);
        assert.equal(data, undefined);
        assert.equal(postStub.firstCall.args[0], '/{database_mount_path}/rotate-role/{name}');
        assert.deepEqual(postStub.firstCall.args[1]?.params?.path, {
            database_mount_path: 'database',
            name: 'my-static-role',
        });
    }

    @test('rotateStaticCredentials should surface Vault errors')
    public async rotatestaticcredentialsShouldSurfaceVaultErrorsTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Not Found', status: 404 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        const [, error] = await client.rotateStaticCredentials('database', 'my-static-role');

        assert.equal(error, clientError);
    }

    // ── unwrap convenience ────────────────────────────────────────────────────

    @test('should unwrap a successful result without throwing')
    public async shouldUnwrapASuccessfulResultWithoutThrowingTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        await assert.doesNotReject(client.configureConnection('database', 'my-db', {}).unwrap());
    }

    @test('should reject unwrap with the underlying client error')
    public async shouldRejectUnwrapWithTheUnderlyingClientErrorTest() {
        const clientError = new VaultClientError({ code: 'HTTP_ERROR', message: 'Forbidden', status: 403 });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultSecretDbClient(new RawVaultClient());

        await assert.rejects(client.configureConnection('database', 'my-db', {}).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    }
}

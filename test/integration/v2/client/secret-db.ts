import type { VaultClientV2 } from '../../../../src/v2/index.js';
import assert from 'node:assert/strict';
import { suite, test, beforeAll, afterAll } from '../../../mocha/decorators.js';
import { createTestVaultClient, ensureDbMountAvailable, ensureMountRemoved } from '../../../helpers/vault.js';
import { VaultClientError } from '../../../../src/v2/index.js';

// PostgreSQL container exposed in docker-compose.yml
const PG_HOST = 'postgresql.server';
const PG_USER = 'nanvc';
const PG_PASSWORD = 'integration';
const PG_DB = 'nanvc';
const PG_CONNECTION_URL = `postgresql://{{username}}:{{password}}@${PG_HOST}:5432/${PG_DB}?sslmode=disable`;

// SQL statements for dynamic role creation / revocation
const DYNAMIC_CREATION_STATEMENTS = [
    `CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';`,
    `GRANT CONNECT ON DATABASE ${PG_DB} TO "{{name}}";`,
];
// DROP OWNED BY removes all privileges granted to the role before dropping it,
// which avoids the SQLSTATE 2BP01 "dependent_objects_still_exist" error that
// would occur when Vault tries to revoke the lease.
const DYNAMIC_REVOCATION_STATEMENTS = [`DROP OWNED BY "{{name}}" CASCADE;`, `DROP ROLE IF EXISTS "{{name}}";`];

@suite('VaultClientV2 database secrets engine integration tests')
export class VaultSecretDbClientIntegrationTests {
    private client!: VaultClientV2;

    @beforeAll()
    public async beforeAll() {
        this.client = await createTestVaultClient();
    }

    @afterAll()
    public async afterAll() {
        // todo: cleanup
    }

    // ── Connection configuration ────────────────────────────────────────────

    @test('should return 404 when reading a non-existent connection')
    public async shouldReturn404WhenReadingANonExistentConnectionTest() {
        const mount = 'db-read-missing-test';
        await ensureMountRemoved(this.client, mount);
        await ensureDbMountAvailable(this.client, mount);

        try {
            const [data, error] = await this.client.secret.db.readConnection(mount, 'does-not-exist');

            assert.equal(data, null);
            assert.equal(error instanceof VaultClientError, true);
            assert.equal(error?.code, 'HTTP_ERROR');
            assert.equal(error?.status, 404);
        } finally {
            await ensureMountRemoved(this.client, mount);
        }
    }

    @test('should configure a PostgreSQL connection, read it, list it, reset it, then delete it')
    public async shouldConfigureAPostgresqlConnectionReadItListItResetItThenDeleteItTest() {
        const mount = 'db-conn-test';
        const connName = 'pg-conn';

        await ensureMountRemoved(this.client, mount);
        await ensureDbMountAvailable(this.client, mount);

        try {
            // Configure connection
            const [, configureError] = await this.client.secret.db.configureConnection(mount, connName, {
                plugin_name: 'postgresql-database-plugin',
                connection_url: PG_CONNECTION_URL,
                username: PG_USER,
                password: PG_PASSWORD,
                allowed_roles: ['*'],
                verify_connection: true,
            });
            assert.equal(configureError, null);

            // List connections
            const [keys, listError] = await this.client.secret.db.listConnections(mount);
            assert.equal(listError, null);
            assert.equal(Array.isArray(keys), true);
            assert.equal(keys.includes(connName), true);

            // Read connection
            const [conn, readError] = await this.client.secret.db.readConnection(mount, connName);
            assert.equal(readError, null);
            assert.equal(conn.plugin_name, 'postgresql-database-plugin');
            assert.deepEqual(conn.allowed_roles, ['*']);

            // Reset connection (closes open connections; should succeed without error)
            const [, resetError] = await this.client.secret.db.resetConnection(mount, connName);
            assert.equal(resetError, null);

            // Delete connection
            const [, deleteError] = await this.client.secret.db.deleteConnection(mount, connName);
            assert.equal(deleteError, null);

            // Confirm gone
            const [, deletedReadError] = await this.client.secret.db.readConnection(mount, connName);
            assert.equal(deletedReadError?.status, 404);

            // List again — should be empty
            const [keysAfterDelete, listAfterDeleteError] = await this.client.secret.db.listConnections(mount);
            assert.equal(listAfterDeleteError, null);
            assert.equal(keysAfterDelete.length, 0);
        } finally {
            await ensureMountRemoved(this.client, mount);
        }
    }

    // ── Dynamic role lifecycle ──────────────────────────────────────────────

    @test('should return 404 when generating credentials for a non-existent role')
    public async shouldReturn404WhenGeneratingCredentialsForANonExistentRoleTest() {
        const mount = 'db-creds-missing-test';
        const connName = 'pg-conn';

        await ensureMountRemoved(this.client, mount);
        await ensureDbMountAvailable(this.client, mount);

        try {
            await this.client.secret.db.configureConnection(mount, connName, {
                plugin_name: 'postgresql-database-plugin',
                connection_url: PG_CONNECTION_URL,
                username: PG_USER,
                password: PG_PASSWORD,
                allowed_roles: ['*'],
                verify_connection: true,
            });

            const [data, error] = await this.client.secret.db.generateCredentials(mount, 'does-not-exist');

            assert.equal(data, null);
            assert.equal(error instanceof VaultClientError, true);
            assert.equal(error?.code, 'HTTP_ERROR');
            // Vault returns 400 (not 404) when the role name is not found
            assert.equal(error?.status, 400);
        } finally {
            await ensureMountRemoved(this.client, mount);
        }
    }

    @test('should write, list, read, and delete a dynamic role')
    public async shouldWriteListReadAndDeleteADynamicRoleTest() {
        const mount = 'db-role-test';
        const connName = 'pg-conn';
        const roleName = 'read-role';

        await ensureMountRemoved(this.client, mount);
        await ensureDbMountAvailable(this.client, mount);

        try {
            // Configure connection
            await this.client.secret.db.configureConnection(mount, connName, {
                plugin_name: 'postgresql-database-plugin',
                connection_url: PG_CONNECTION_URL,
                username: PG_USER,
                password: PG_PASSWORD,
                allowed_roles: ['*'],
                verify_connection: true,
            });

            // Write role
            const [, writeError] = await this.client.secret.db.writeRole(mount, roleName, {
                db_name: connName,
                creation_statements: DYNAMIC_CREATION_STATEMENTS,
                revocation_statements: DYNAMIC_REVOCATION_STATEMENTS,
                default_ttl: 3600,
                max_ttl: 86400,
            });
            assert.equal(writeError, null);

            // List roles
            const [roleKeys, listError] = await this.client.secret.db.listRoles(mount);
            assert.equal(listError, null);
            assert.equal(Array.isArray(roleKeys), true);
            assert.equal(roleKeys.includes(roleName), true);

            // Read role
            const [role, readError] = await this.client.secret.db.readRole(mount, roleName);
            assert.equal(readError, null);
            assert.equal(role.db_name, connName);
            assert.equal(role.default_ttl, 3600);
            assert.equal(role.max_ttl, 86400);
            assert.deepEqual(role.creation_statements, DYNAMIC_CREATION_STATEMENTS);

            // Delete role
            const [, deleteError] = await this.client.secret.db.deleteRole(mount, roleName);
            assert.equal(deleteError, null);

            // List roles — should be empty
            const [keysAfterDelete, listAfterDeleteError] = await this.client.secret.db.listRoles(mount);
            assert.equal(listAfterDeleteError, null);
            assert.equal(keysAfterDelete.length, 0);
        } finally {
            await ensureMountRemoved(this.client, mount);
        }
    }

    @test('should generate dynamic credentials')
    public async shouldGenerateDynamicCredentialsTest() {
        const mount = 'db-gencreds-test';
        const connName = 'pg-conn';
        const roleName = 'creds-role';

        await ensureMountRemoved(this.client, mount);
        await ensureDbMountAvailable(this.client, mount);

        try {
            await this.client.secret.db.configureConnection(mount, connName, {
                plugin_name: 'postgresql-database-plugin',
                connection_url: PG_CONNECTION_URL,
                username: PG_USER,
                password: PG_PASSWORD,
                allowed_roles: ['*'],
                verify_connection: true,
            });

            await this.client.secret.db.writeRole(mount, roleName, {
                db_name: connName,
                creation_statements: DYNAMIC_CREATION_STATEMENTS,
                revocation_statements: DYNAMIC_REVOCATION_STATEMENTS,
                default_ttl: 3600,
                max_ttl: 86400,
            });

            const [creds, credsError] = await this.client.secret.db.generateCredentials(mount, roleName);

            assert.equal(credsError, null);
            assert.equal(typeof creds.data?.username, 'string');
            assert.equal((creds.data?.username ?? '').length > 0, true);
            assert.equal(typeof creds.data?.password, 'string');
            assert.equal((creds.data?.password ?? '').length > 0, true);
            assert.equal(typeof creds.lease_id, 'string');
            assert.equal((creds.lease_id ?? '').length > 0, true);
            assert.equal(creds.renewable, true);
            assert.equal(typeof creds.lease_duration, 'number');
            assert.equal((creds.lease_duration ?? 0) > 0, true);
        } finally {
            await ensureMountRemoved(this.client, mount);
        }
    }

    // ── Static role note ────────────────────────────────────────────────────
    // Static role integration tests (writeStaticRole, readStaticRole,
    // listStaticRoles, readStaticCredentials, rotateStaticCredentials) are
    // intentionally omitted here. Vault's static roles manage an EXISTING
    // database user (Vault only rotates its password; it does not create it).
    // The docker-compose environment does not pre-provision a separate
    // database user for static role management, and rotating the `nanvc`
    // superuser password would break the dynamic role connection configuration.
    // These methods are covered by unit tests.
}

// ── Helpers (shared setup, duplicated from client.ts to keep each file independent) ──

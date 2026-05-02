import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { isMountAlreadyExistsError, printSuccessBanner, toExampleAuthError } from '../common/personas/helpers.js';
import { createTestVaultClient } from '../../test/helpers/vault.js';

const VAULT_CLUSTER_ADDRESS = process.env.NANVC_VAULT_CLUSTER_ADDRESS ?? 'http://127.0.0.1:8200';

// Database secrets engine mount and resource names.
const DB_MOUNT = 'database';
const DB_CONNECTION = 'postgres-webapp';
const DB_ROLE = 'readonly';

async function main(): Promise<void> {

    // ── Step 1: Prepare Vault ─────────────────────────────────────────────────
    // createTestVaultClient initializes and unseals Vault if needed, and returns
    // a VaultClientV2 with the root token already set. Credentials are persisted
    // to a temp env file so subsequent runs skip re-initialization.
    const rootVault = await createTestVaultClient({ clusterAddress: VAULT_CLUSTER_ADDRESS });

    const admin = AdminPersona.v2({ client: rootVault });
    await admin.withWorkflow(async ({ vault }) => {

        // ── Step 2: Admin — enable the database secrets engine ────────────────
        // The database secrets engine is not mounted by default. Enabling it
        // at 'database' is the same as running `vault secrets enable database`.
        // The typed sys.mount.enable method covers this step.
        const [, mountError] = await vault.sys.mount.enable(DB_MOUNT, { type: 'database' });
        if (mountError && !isMountAlreadyExistsError(mountError)) {
            throw toExampleAuthError(mountError);
        }

        // ── Step 3: Admin — configure the database connection ─────────────────
        // vault.secret.db.configureConnection sets up a named PostgreSQL
        // connection. Vault stores the management credentials (nanvc /
        // integration) encrypted and uses them to create and revoke dynamic
        // roles. The {{username}} and {{password}} placeholders are filled in
        // by Vault at request time.
        //
        // The PostgreSQL service is reachable at db:5432 within the Docker
        // Compose network. The host machine does not need direct DB access.
        await vault.secret.db.configureConnection(DB_MOUNT, DB_CONNECTION, {
            plugin_name: 'postgresql-database-plugin',
            connection_url: 'postgresql://{{username}}:{{password}}@db:5432/nanvc?sslmode=disable',
            allowed_roles: [DB_ROLE],
            username: 'nanvc',
            password: 'integration',
        }).unwrap();

        // ── Step 4: Admin — create a dynamic-credentials role ─────────────────
        // A database role maps a Vault role name to the SQL statements Vault
        // runs when generating credentials. Each credential set gets a unique
        // username derived from the role name plus a timestamp, and a random
        // password. Credentials are automatically revoked when the lease expires.
        await vault.secret.db.writeRole(DB_MOUNT, DB_ROLE, {
            db_name: DB_CONNECTION,
            creation_statements: [
                "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' NOINHERIT;",
                "GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";",
            ],
            revocation_statements: [
                "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM \"{{name}}\";",
                "DROP ROLE IF EXISTS \"{{name}}\";",
            ],
            default_ttl: '1h',
            max_ttl: '24h',
        }).unwrap();

        // ── Step 5: Admin — write a least-privilege policy ────────────────────
        // Any identity that needs to generate database credentials must hold a
        // token with this policy. The policy is minimal: read-only on the single
        // creds path for the 'readonly' role.
        const dbPolicy = [
            `# Allow reading dynamic credentials for the '${DB_ROLE}' database role.`,
            `path "${DB_MOUNT}/creds/${DB_ROLE}" {`,
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.createPolicy('db-readonly', dbPolicy);

        // ── Step 6: Generate dynamic database credentials ─────────────────────
        // vault.secret.db.generateCredentials causes Vault to connect to the
        // database, execute the creation_statements with a generated name and
        // password, and return the result. Each call produces a unique,
        // time-limited credential pair backed by a Vault lease.
        const creds = await vault.secret.db.generateCredentials(DB_MOUNT, DB_ROLE).unwrap();

        assert.ok(
            typeof creds.data?.username === 'string' && creds.data.username.length > 0,
            'Generated username must be a non-empty string',
        );
        assert.ok(
            typeof creds.data?.password === 'string' && creds.data.password.length > 0,
            'Generated password must be a non-empty string',
        );
        assert.ok(
            typeof creds.lease_id === 'string' && creds.lease_id.length > 0,
            'Vault must return a lease_id for generated credentials',
        );
        assert.ok(
            (creds.lease_duration ?? 0) > 0,
            'Vault must return a positive lease_duration',
        );

        console.log(`  Dynamic username : ${creds.data?.username}`);
        console.log(`  Lease ID         : ${creds.lease_id}`);
        console.log(`  Lease duration   : ${creds.lease_duration}s`);
    });

    printSuccessBanner('Database secrets engine workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

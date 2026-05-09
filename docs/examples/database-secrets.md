---
layout: page
title: "Database secrets engine with VaultClientV2"
description: "This example demonstrates Vault's database secrets engine against the local PostgreSQL service from docker-compose.yml. It configures Vault database roles, generates dynamic PostgreSQL credentials for three different app personas, and then uses those credentials against the database."
---

{% capture example_guide %}
This example demonstrates Vault's database secrets engine against the local
PostgreSQL service from `docker-compose.yml`. It configures Vault database roles,
generates dynamic PostgreSQL credentials for three different app personas, and
then uses those credentials against the database.

Inspired by the [HashiCorp Vault database secrets tutorial](https://developer.hashicorp.com/vault/tutorials/db-credentials/database-secrets).
The commands and code are adapted to the `nanvc` v2 APIs and this repository's
local Docker Compose services.

## What the workflow demonstrates

- Enable the database secrets engine at the `database` mount.
- Configure a named PostgreSQL connection called `postgres-example` with the
  built-in `postgresql-database-plugin`.
- Allow Vault to manage three PostgreSQL roles:
  `schema_admin_role`, `readwrite_role`, and `readonly_role`.
- Define Vault database roles that create short-lived PostgreSQL users and grant
  each generated user one of those database roles.
- Create one AppRole and policy per database capability:
  `db-admin-schema-role`, `db-readwrite-role`, and `db-readonly-role`.
- Generate dynamic database credentials through
  `vault.secret.db.generateCredentials`.
- Use the generated admin credentials to create and truncate `example.users`.
- Use the generated read-write credentials to insert three rows.
- Use the generated read-only credentials to list those rows and assert the
  result.
- Assert that every dynamic credential response includes a username, password,
  lease ID, and positive lease duration.

## Typed API

All database secrets engine calls use the typed `vault.secret.db` v2 client:

- `vault.secret.db.configureConnection` sets up the named PostgreSQL plugin
  connection.
- `vault.secret.db.writeRole` defines dynamic-credential roles.
- `vault.secret.db.generateCredentials` requests leased username/password pairs.

The example enables the database mount with `vault.sys.mount.enable`. Policy and
AppRole setup use the shared `AdminPersona.v2()` helpers.

This example uses the shared decorator-based runner and personas described in
`examples/README.md`.

The database workflow has four phases:

1. The admin configures Vault database roles and AppRoles.
2. The admin app receives dynamic credentials and creates `example.users`.
3. The read-write app receives dynamic credentials and inserts rows.
4. The read-only app receives dynamic credentials and reads rows.

## Local services required

This example needs two Docker Compose services:

| Service | Role                                                     |
| ------- | -------------------------------------------------------- |
| `vault` | HashiCorp Vault server (HTTP, host port 8200)            |
| `db`    | PostgreSQL server (host port 35432, container port 5432) |

Vault connects to PostgreSQL from inside the Docker Compose network using
`db:5432`. The Node example connects from the host using `localhost:35432`.

From the repository root, start both services:

```bash
docker compose up -d vault db
```

For a fresh Vault and database state:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d vault db
```

## Run

Install dependencies from the repository root:

```bash
npm install
```

Then run the example:

```bash
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/database-secrets/main.ts
```

The helper defaults to `http://vault.local:8200`. Use the environment variable
above when `vault.local` is not mapped on your machine.

## Environment

For an existing Vault server, set:

```bash
export NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200
export TEST_NANVC_VAULT_AUTH_TOKEN=<root-or-admin-token>
export TEST_NANVC_VAULT_UNSEAL_KEY=<unseal-key>
```

If the local Vault server is initialized by any example or integration helper,
the helper writes a shared cache file under your OS temp directory with:

- `TEST_NANVC_VAULT_AUTH_TOKEN`
- `TEST_NANVC_VAULT_UNSEAL_KEY`

Shell-exported `TEST_NANVC_*` variables take precedence over cached values. If
Vault reports `invalid token`, the cached credentials probably belong to another
Vault instance or an older Docker volume. Export valid `TEST_NANVC_*` values, or
reset local Vault with the fresh-state commands above.

## PostgreSQL management credentials

The local `db` Docker Compose service uses:

| Variable            | Value         |
| ------------------- | ------------- |
| `POSTGRES_DB`       | `nanvc`       |
| `POSTGRES_USER`     | `nanvc`       |
| `POSTGRES_PASSWORD` | `integration` |

`test/util/db/init.sh` also creates the Vault management user:

| User    | Password      | Purpose                                                   |
| ------- | ------------- | --------------------------------------------------------- |
| `vault` | `integration` | Used by Vault to create and revoke dynamic database users |

These credentials are only for the local example environment.

## Cleanup and reset

Generated database credentials expire automatically when their Vault lease
expires. The example configures `default_ttl` to 1 hour and `max_ttl` to 24
hours for each database role.

To reset the full local environment:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d vault db
```

This recreates Vault and PostgreSQL state, so the next example run starts from a
fresh environment.
{% endcapture %}

{% capture example_source %}
{% highlight ts %}
import assert from 'node:assert';
import { Pool, type PoolClient } from 'pg';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { isMountAlreadyExistsError, toExampleAuthError } from '../common/personas/helpers.js';
import type { AppRoleCredentials } from '../common/personas/types.js';
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';
import { VaultClientV2 } from '../../src/main.js';

type AppRoleCredentialsSet = {
    adminAppRoleCredentials: AppRoleCredentials;
    readOnlyAppRoleCredentials: AppRoleCredentials;
    readWriteAppRoleCredentials: AppRoleCredentials;
};

type DatabaseCredentials = {
    password: string;
    username: string;
};

type DatabaseSession = {
    client: PoolClient;
    close(): Promise<void>;
};

type UserRow = {
    email: string;
    id: number;
    username: string;
};

const DB_MOUNT = 'database';
const DB_CONNECTION = 'postgres-example';
const DB_ROLE_RO = 'readonly_role';
const DB_ROLE_RW = 'readwrite_role';
const DB_ROLE_ADMIN = 'schema_admin_role';
const DB_SCHEMA = 'example';
const DB_TABLE = 'users';

@example('Database secrets engine example')
class DatabaseSecretsExample {
    private credentials!: AppRoleCredentialsSet;

    public constructor(private readonly rootVault: VaultClientV2) {}

    @workflow('admin', 'Configure Vault database roles and AppRoles')
    @runAs({ persona: 'admin' })
    public async configureVault(admin: AdminPersona<'v2'>): Promise<void> {
        const [, mountError] = await this.rootVault.sys.mount.enable(DB_MOUNT, { type: 'database' });
        if (mountError && !isMountAlreadyExistsError(mountError)) {
            throw toExampleAuthError(mountError);
        }

        await this.rootVault.secret.db
            .configureConnection(DB_MOUNT, DB_CONNECTION, {
                plugin_name: 'postgresql-database-plugin',
                connection_url: 'postgresql://{{username}}:{{password}}@db:5432/nanvc?sslmode=disable',
                allowed_roles: [DB_ROLE_RO, DB_ROLE_RW, DB_ROLE_ADMIN],
                username: 'vault',
                password: 'integration',
            })
            .unwrap();

        await this.writeDatabaseRole(DB_ROLE_RO);
        await this.writeDatabaseRole(DB_ROLE_RW);
        await this.writeDatabaseRole(DB_ROLE_ADMIN);

        await this.registerDatabaseAppRole(admin, 'db-readonly-role', DB_ROLE_RO);
        await this.registerDatabaseAppRole(admin, 'db-readwrite-role', DB_ROLE_RW);
        await this.registerDatabaseAppRole(admin, 'db-admin-schema-role', DB_ROLE_ADMIN);

        this.credentials = {
            adminAppRoleCredentials: await admin.createAppRoleCredentials('db-admin-schema-role'),
            readOnlyAppRoleCredentials: await admin.createAppRoleCredentials('db-readonly-role'),
            readWriteAppRoleCredentials: await admin.createAppRoleCredentials('db-readwrite-role'),
        };
    }

    @workflow('admin app', 'Create users table')
    @runAs({ persona: 'app' })
    public async adminCreatesUsersTable(persona: AppPersona<'v2'>): Promise<void> {
        const adminCredentials = await this.receiveDatabaseCredentials(
            persona,
            this.credentials.adminAppRoleCredentials,
            DB_ROLE_ADMIN,
        );
        const database = await this.openDatabase(adminCredentials);

        try {
            await database.client.query('BEGIN');
            try {
                await database.client.query('SET LOCAL ROLE example_owner');
                await database.client.query(`
                    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.${DB_TABLE} (
                        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        username TEXT NOT NULL,
                        email TEXT NOT NULL
                    )
                `);
                await database.client.query(`TRUNCATE TABLE ${DB_SCHEMA}.${DB_TABLE} RESTART IDENTITY`);
                await database.client.query('COMMIT');
            } catch (error) {
                await database.client.query('ROLLBACK');
                throw error;
            }
        } finally {
            await database.close();
        }

        console.log('  Admin app created example.users as example_owner');
    }

    @workflow('readwrite app', 'Insert user records')
    @runAs({ persona: 'app' })
    public async readwriteInsertsUsers(persona: AppPersona<'v2'>): Promise<void> {
        const readWriteCredentials = await this.receiveDatabaseCredentials(
            persona,
            this.credentials.readWriteAppRoleCredentials,
            DB_ROLE_RW,
        );
        const database = await this.openDatabase(readWriteCredentials);

        try {
            await database.client.query(
                `
                    INSERT INTO ${DB_SCHEMA}.${DB_TABLE} (username, email)
                    VALUES
                        ($1, $2),
                        ($3, $4),
                        ($5, $6)
                `,
                ['ada', 'ada@example.test', 'grace', 'grace@example.test', 'linus', 'linus@example.test'],
            );
        } finally {
            await database.close();
        }

        console.log('  Readwrite app inserted 3 users');
    }

    @workflow('readonly app', 'List user records')
    @runAs({ persona: 'app' })
    public async readonlyListsUsers(persona: AppPersona<'v2'>): Promise<void> {
        const readOnlyCredentials = await this.receiveDatabaseCredentials(
            persona,
            this.credentials.readOnlyAppRoleCredentials,
            DB_ROLE_RO,
        );
        const database = await this.openDatabase(readOnlyCredentials);

        let rows: UserRow[];
        try {
            const result = await database.client.query<UserRow>(`
                SELECT id, username, email
                FROM ${DB_SCHEMA}.${DB_TABLE}
                ORDER BY id
            `);
            rows = result.rows;
        } finally {
            await database.close();
        }

        assert.deepStrictEqual(rows, [
            { id: 1, username: 'ada', email: 'ada@example.test' },
            { id: 2, username: 'grace', email: 'grace@example.test' },
            { id: 3, username: 'linus', email: 'linus@example.test' },
        ]);

        console.log(`  Readonly app listed ${rows.length} users`);
    }

    private async writeDatabaseRole(roleName: string): Promise<void> {
        await this.rootVault.secret.db
            .writeRole(DB_MOUNT, roleName, {
                db_name: DB_CONNECTION,
                creation_statements: [
                    "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
                    `GRANT "${roleName}" TO "{{name}}";`,
                    `ALTER ROLE "{{name}}" SET search_path = '${DB_SCHEMA}';`,
                ],
                revocation_statements: [
                    `REVOKE "${roleName}" FROM "{{name}}";`,
                    'DROP OWNED BY "{{name}}";',
                    'DROP ROLE IF EXISTS "{{name}}";',
                ],
                default_ttl: 3600,
                max_ttl: 86400,
            })
            .unwrap();
    }

    private async registerDatabaseAppRole(
        admin: AdminPersona<'v2'>,
        roleName: string,
        databaseRoleName: string,
    ): Promise<void> {
        await admin.createPolicy(
            roleName,
            [
                `# Allow receiving dynamic credentials for the '${databaseRoleName}' database role.`,
                `path "${DB_MOUNT}/creds/${databaseRoleName}" {`,
                '  capabilities = ["read"]',
                '}',
            ].join('\n'),
        );

        await admin.registerAppRole(roleName, {
            token_policies: [roleName],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });
    }

    private async receiveDatabaseCredentials(
        app: AppPersona<'v2'>,
        appRoleCredentials: AppRoleCredentials,
        databaseRoleName: string,
    ): Promise<DatabaseCredentials> {
        await app.loginWithAppRole(appRoleCredentials);

        const dbCreds = await app.vault.secret.db.generateCredentials(DB_MOUNT, databaseRoleName).unwrap();
        const username = dbCreds.data?.username;
        const password = dbCreds.data?.password;

        assert.ok(typeof username === 'string' && username.length > 0, 'Generated username must be a non-empty string');
        assert.ok(typeof password === 'string' && password.length > 0, 'Generated password must be a non-empty string');
        assert.ok(typeof dbCreds.lease_id === 'string' && dbCreds.lease_id.length > 0, 'Vault must return a lease_id');
        assert.ok((dbCreds.lease_duration ?? 0) > 0, 'Vault must return a positive lease_duration');

        return { username, password };
    }

    private async openDatabase(credentials: DatabaseCredentials): Promise<DatabaseSession> {
        const pool = new Pool({
            database: 'nanvc',
            host: 'localhost',
            password: credentials.password,
            port: 35432,
            user: credentials.username,
        });

        const client = await pool.connect();
        return {
            client,
            async close(): Promise<void> {
                client.release();
                await pool.end();
            },
        };
    }
}

runExample(DatabaseSecretsExample).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
{% endhighlight %}
{% endcapture %}

{% capture example_extra %}
{% highlight sql %}
-- ============================================================
-- 1. Bootstrap roles
-- Run this part as postgres / superuser / admin with CREATEROLE
-- ============================================================

CREATE ROLE example_owner NOLOGIN;
CREATE ROLE schema_admin_role NOLOGIN;
CREATE ROLE readonly_role NOLOGIN;
CREATE ROLE readwrite_role NOLOGIN;
CREATE ROLE vault LOGIN PASSWORD 'integration';
GRANT example_owner TO vault;
GRANT example_owner TO schema_admin_role;
GRANT CREATE ON DATABASE "$POSTGRES_DB" TO example_owner;

-- ============================================================
-- 2. Create and assign schema ownership
-- Run as database owner / superuser
-- ============================================================
SET ROLE example_owner;

CREATE SCHEMA IF NOT EXISTS example AUTHORIZATION example_owner;

-- ============================================================
-- 3. Schema permissions
-- Run as example_owner, or as superuser
-- ============================================================

GRANT USAGE, CREATE ON SCHEMA example TO schema_admin_role;
GRANT USAGE ON SCHEMA example TO readonly_role;
GRANT USAGE ON SCHEMA example TO readwrite_role;


-- ============================================================
-- 4. Existing object permissions
-- Run after schema/tables already exist, if any
-- ============================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA example TO schema_admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA example TO schema_admin_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA example TO schema_admin_role;

GRANT SELECT ON ALL TABLES IN SCHEMA example TO readonly_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA example TO readonly_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA example TO readwrite_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA example TO readwrite_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA example TO readonly_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA example TO readwrite_role;


-- ============================================================
-- 5. Future object permissions
-- Important: defaults are for objects created by example_owner
-- ============================================================

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON TABLES TO schema_admin_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON SEQUENCES TO schema_admin_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON FUNCTIONS TO schema_admin_role;


ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT ON TABLES TO readonly_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT ON SEQUENCES TO readonly_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT EXECUTE ON FUNCTIONS TO readonly_role;


ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO readwrite_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO readwrite_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT EXECUTE ON FUNCTIONS TO readwrite_role;

RESET ROLE;

-- ============================================================
-- 6. Optional: default search_path
-- ============================================================

ALTER ROLE vault SET search_path TO example;
ALTER ROLE readonly_role SET search_path TO example;
ALTER ROLE readwrite_role SET search_path TO example;
ALTER ROLE schema_admin_role SET search_path TO example;

-- ============================================================
-- 7. Grant roles to vault
-- ============================================================

ALTER ROLE vault CREATEROLE;

GRANT readonly_role TO vault WITH ADMIN OPTION;
GRANT readwrite_role TO vault WITH ADMIN OPTION;
GRANT schema_admin_role TO vault WITH ADMIN OPTION;
{% endhighlight %}
{% endcapture %}

{% include doc-tabs.html
  id="example-database-secrets"
  aria_label="Example content"
  label_one="Guide"
  label_two="Source"
  panel_one=example_guide
  panel_two=example_source
  markdown_one=true
  label_three="SQL setup"
  panel_three=example_extra
%}

## Source Files

- README source: `examples/database-secrets/README.md`
- Runnable source: `examples/database-secrets/main.ts`
- SQL setup source: `test/util/db/init.sh`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

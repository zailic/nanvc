---
layout: page
title: "Database secrets engine with VaultClientV2"
description: "This example demonstrates Vault's database secrets engine against a local PostgreSQL instance. It shows how to enable the engine, configure a database connection, define a role with scoped SQL statements, and generate short-lived dynamic credentials — all through the nanvc v2 client."
---

{% capture example_guide %}
This example demonstrates Vault's database secrets engine against a local
PostgreSQL instance. It shows how to enable the engine, configure a database
connection, define a role with scoped SQL statements, and generate short-lived
dynamic credentials — all through the `nanvc` v2 client.

Inspired by the [HashiCorp Vault database secrets tutorial](https://developer.hashicorp.com/vault/tutorials/db-credentials/database-secrets).
Prose and commands are adapted to the `nanvc` client APIs and the local Docker
Compose services in this repository.

## What the workflow demonstrates

- Enable the database secrets engine at the `database` mount.
- Configure a named PostgreSQL connection using the built-in
  `postgresql-database-plugin`. Vault stores the management credentials
  encrypted and uses them to create and revoke dynamic roles.
- Define a Vault database role (`readonly`) backed by SQL
  `CREATE ROLE` / `GRANT SELECT` statements. Vault executes these statements
  when generating credentials, producing a unique username and password for
  each request.
- Write a least-privilege Vault policy that allows reading credentials only
  for the `readonly` role.
- Generate dynamic credentials via `GET /database/creds/readonly` and assert
  that the returned username, password, lease ID, and lease duration are
  present.

### Typed API vs. escape hatch

The `database` secrets engine endpoints are not yet covered by the typed v2
shortcut methods in `nanvc`. This example uses `vault.raw` — the
`RawVaultClient` escape hatch — for all database-specific calls. `vault.raw`
accepts any Vault HTTP path and is the recommended approach for endpoints
outside the typed surface, as demonstrated in this example.

The `sys.mount.enable` call that enables the engine _is_ a typed v2 method and
is used directly through the `VaultClientV2` typed API.

If typed database methods are added in the future (by running the
`port-v2-openapi-endpoints` agent), the `vault.raw` calls in this example
could be replaced with typed equivalents.

## Local services required

This example needs two Docker Compose services:

| Service   | Role |
|-----------|------|
| `vault`   | HashiCorp Vault server (HTTP, port 8200) |
| `db`      | PostgreSQL server (port 5432, internal Docker network only) |

Vault connects to PostgreSQL over the Docker Compose internal network using the
hostname `db:5432`. The host machine does not need direct PostgreSQL access.

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
npx tsx examples/database-secrets/main.ts
```

The default client configuration points at `http://127.0.0.1:8200`, which
matches the `vault` service port mapping.

## Environment

The example reads and writes a shared `examples/.env` file to persist Vault
init and unseal material across example runs. If the local Vault server is
fresh, the example initializes it, unseals it, and writes:

- `NANVC_VAULT_UNSEAL_KEY`
- `NANVC_VAULT_AUTH_TOKEN`

For an existing Vault server, set:

```bash
export NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200
export NANVC_VAULT_AUTH_TOKEN=<operator-or-admin-token>
```

Shell-exported variables take precedence over values in `examples/.env`.

To reuse the shared env file in a new shell:

```bash
set -a
. examples/.env
set +a
```

The shared `examples/.env` file is local runtime material and should not be
committed.

## Cleanup and reset

Generated database credentials expire automatically when their Vault lease
expires (default TTL: 1 hour). The dynamic PostgreSQL roles created by Vault
are revoked either at lease expiry or by a Vault operator running
`vault lease revoke <lease_id>`.

To reset the full local environment:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d vault db
```

This restarts Vault in uninitialized state and recreates the PostgreSQL
database, so the next example run will re-initialize everything from scratch.

## PostgreSQL management credentials

The local `db` Docker Compose service uses:

| Variable            | Value         |
|---------------------|---------------|
| `POSTGRES_USER`     | `nanvc`       |
| `POSTGRES_PASSWORD` | `integration` |
| Database name       | `nanvc`       |

These are used only by Vault internally to create and revoke dynamic database
roles. They are safe for local development and should never be used outside
this local example environment.
{% endcapture %}

{% capture example_source %}
{% highlight ts %}
import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { getExamplesEnvPath, isMountAlreadyExistsError, printSuccessBanner, toExampleAuthError } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';

const ENV_PATH = getExamplesEnvPath(import.meta.url);

// Database secrets engine mount and resource names.
const DB_MOUNT = 'database';
const DB_CONNECTION = 'postgres-webapp';
const DB_ROLE = 'readonly';

// Response shape for GET /database/creds/<role>.
// The database secrets engine has no typed v2 shortcut methods yet, so all
// database API calls go through vault.raw (the escape-hatch RawVaultClient).
type DbCredsResponse = {
    lease_id: string;
    renewable: boolean;
    lease_duration: number;
    data: {
        username: string;
        password: string;
    };
};

async function main(): Promise<void> {

    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed.
    const operator = OperatorPersona.v2({ envPath: ENV_PATH });
    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
    });

    const admin = AdminPersona.v2();
    await admin.withWorkflow(async ({ vault }) => {

        // ── Step 2: Admin — enable the database secrets engine ────────────────
        // The database secrets engine is not mounted by default. Enabling it
        // at 'database' is the same as running `vault secrets enable database`.
        // The typed sys.mount.enable method covers this step.
        const [, mountError] = await vault.sys.mount.enable(DB_MOUNT, { type: 'database' });
        if (mountError && !isMountAlreadyExistsError(mountError)) {
            throw toExampleAuthError(mountError, ENV_PATH);
        }

        // ── Step 3: Admin — configure the database connection ─────────────────
        // vault.raw is the RawVaultClient escape hatch. It accepts any Vault
        // HTTP path and is the right tool here because the database secrets
        // engine has no typed v2 shortcut methods in nanvc yet.
        //
        // This call configures a named PostgreSQL connection. Vault stores the
        // management credentials (nanvc / integration) encrypted and uses them
        // to create and revoke dynamic roles. The {{username}} and {{password}}
        // placeholders are filled in by Vault at request time.
        //
        // The PostgreSQL service is reachable at db:5432 within the Docker
        // Compose network. The host machine does not need direct DB access.
        await vault.raw.post<void>(`/${DB_MOUNT}/config/${DB_CONNECTION}`, {
            body: {
                plugin_name: 'postgresql-database-plugin',
                connection_url: 'postgresql://{{username}}:{{password}}@db:5432/nanvc?sslmode=disable',
                allowed_roles: [DB_ROLE],
                username: 'nanvc',
                password: 'integration',
            },
        }).unwrap();

        // ── Step 4: Admin — create a dynamic-credentials role ─────────────────
        // A database role maps a Vault role name to the SQL statements Vault
        // runs when generating credentials. Each credential set gets a unique
        // username derived from the role name plus a timestamp, and a random
        // password. Credentials are automatically revoked when the lease expires.
        await vault.raw.post<void>(`/${DB_MOUNT}/roles/${DB_ROLE}`, {
            body: {
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
            },
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
        // Reading from database/creds/<role> causes Vault to connect to the
        // database, execute the creation_statements with a generated name and
        // password, and return the result. Each read produces a unique,
        // time-limited credential pair backed by a Vault lease.
        const creds = await vault.raw.get<DbCredsResponse>(`/${DB_MOUNT}/creds/${DB_ROLE}`).unwrap();

        assert.ok(
            typeof creds.data.username === 'string' && creds.data.username.length > 0,
            'Generated username must be a non-empty string',
        );
        assert.ok(
            typeof creds.data.password === 'string' && creds.data.password.length > 0,
            'Generated password must be a non-empty string',
        );
        assert.ok(
            typeof creds.lease_id === 'string' && creds.lease_id.length > 0,
            'Vault must return a lease_id for generated credentials',
        );
        assert.ok(
            creds.lease_duration > 0,
            'Vault must return a positive lease_duration',
        );

        console.log(`  Dynamic username : ${creds.data.username}`);
        console.log(`  Lease ID         : ${creds.lease_id}`);
        console.log(`  Lease duration   : ${creds.lease_duration}s`);
    });

    printSuccessBanner('Database secrets engine workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
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
%}

## Source Files

- README source: `examples/database-secrets/README.md`
- Runnable source: `examples/database-secrets/main.ts`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

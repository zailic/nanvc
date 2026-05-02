# Database secrets engine with `VaultClientV2`

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
- Generate dynamic credentials via `vault.secret.db.generateCredentials` and
  assert that the returned username, password, lease ID, and lease duration are
  present.

### Typed API

All database secrets engine calls use the typed `vault.secret.db` client
introduced in `nanvc` v2:

- `vault.secret.db.configureConnection` — set up the named PostgreSQL plugin
  connection.
- `vault.secret.db.writeRole` — define the `readonly` dynamic-credentials role.
- `vault.secret.db.generateCredentials` — request a short-lived username/password
  pair backed by a Vault lease.

The `sys.mount.enable` call that enables the engine uses the typed
`vault.sys.mount.enable` helper.

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

The example reads `NANVC_VAULT_CLUSTER_ADDRESS` for the Vault address (defaults
to `http://127.0.0.1:8200`) and delegates initialization and unseal to the
shared `createTestVaultClient` helper from `test/helpers/vault.ts`.

For an existing Vault server, set:

```bash
export NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200
export TEST_NANVC_VAULT_AUTH_TOKEN=<root-or-admin-token>
export TEST_NANVC_VAULT_UNSEAL_KEY=<unseal-key>
```

If the local Vault is not yet initialized, the shared helper initializes and
unseals it automatically and writes a shared cache file under your OS temp
directory with:

- `TEST_NANVC_VAULT_AUTH_TOKEN`
- `TEST_NANVC_VAULT_UNSEAL_KEY`

Those cached values let tests and examples reuse the same initialized local
Vault instance. Shell-exported `TEST_NANVC_*` variables take precedence over the
cached values. If Vault reports `invalid token`, the cached credentials probably
belong to another Vault instance or an older Docker volume. Export valid
`TEST_NANVC_*` values, or reset local Vault with the fresh-state commands above.

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

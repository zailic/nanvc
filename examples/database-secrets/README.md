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

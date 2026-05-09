# Database secrets engine with `VaultClientV2`

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

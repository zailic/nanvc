# AppRole example with `VaultClient`

This example mirrors the AppRole authentication flow with the original v1
client. It intentionally uses KV v1 at the `secret` mount so the code can show
the legacy client's native `write` and `read` calls.

## What the workflow demonstrates

- Prepare Vault by enabling a KV v1 mount at `secret`.
- Write an application secret at `/secret/mysql/webapp`.
- Enable the `approle` auth method.
- Create a read-only `jenkins` policy for that one secret path.
- Register an AppRole with short-lived tokens.
- Generate `role_id` and `secret_id` credentials.
- Log in as an app with those AppRole credentials.
- Read the secret with the app token and assert the returned data.

This example uses the shared decorator-based runner and personas described in
`examples/README.md`.

Some AppRole operations use `apiRequest()` with a custom `POST 200` command spec
inside the v1 personas because the original client does not expose dedicated
AppRole helpers.

## Local Vault

From the repository root, start only the plain Vault service:

```bash
docker compose up -d vault
```

One Vault instance is enough. You do not need `vault_tls` or `vault_mtls` unless
you are specifically testing TLS.

For a fresh Vault state:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d vault
```

## Run

Install dependencies from the repository root:

```bash
npm install
```

Then run the example:

```bash
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/app-role-v1/main.ts
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

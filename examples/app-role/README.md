# AppRole example with `VaultClientV2`

This example demonstrates an AppRole flow with the v2 client:

- prepare a local Vault server if needed
- mount a KV v2 secrets engine at `secret`
- write a database secret
- enable AppRole auth
- create a read-only policy and role
- log in as an app with `role_id` and `secret_id`
- read the secret with the app token

The example reuses the local Vault setup helper from `test/helpers/vault.ts`.
That helper initializes and unseals the local Vault instance when needed, caches
the root credentials, and returns a ready root `VaultClientV2`. The operator and
admin personas receive that shared root client so they work against the same
Vault instance.

The workflow is still organized around three reusable personas from
`examples/common/personas`:

- `OperatorPersona.v2()` performs operator-level setup for this example, namely
  ensuring the KV mount exists.
- `AdminPersona.v2()` configures AppRole, writes the policy, registers the role,
  and returns `role_id` / `secret_id`.
- `AppPersona.v2()` starts with an unauthenticated client, logs in with AppRole,
  and reads the application secret.

Each persona exposes `withWorkflow(async ({ vault }) => { ... })`, so the
example-specific logic stays in this file while repeated setup lives in common
helpers.

`OperatorPersona` is intentionally thin here because Vault initialization now
lives in the shared test helper. It remains useful as an example extension point
for workflows that need extra operator-only setup before admin/app actions run.

## Local Vault

From the repository root, start only the plain Vault service:

```bash
docker compose up -d vault
```

One Vault instance is enough for this example. You do not need to start the
`vault_tls` or `vault_mtls` services unless you are specifically testing TLS.

If you want a fresh Vault state:

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
npx tsx examples/app-role/main.ts
```

The default client configuration points at `http://127.0.0.1:8200`, which
matches the `vault` service port mapping.

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

Those cached values let tests and examples reuse the same initialized local
Vault instance. Shell-exported `TEST_NANVC_*` variables take precedence over the
cached values. If Vault reports `invalid token`, the cached credentials probably
belong to another Vault instance or an older Docker volume. Export valid
`TEST_NANVC_*` values, or reset local Vault with the fresh-state commands above.

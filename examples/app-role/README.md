# AppRole example with `VaultClientV2`

This example demonstrates an AppRole flow with the v2 client:

- prepare a local Vault server if needed
- mount a KV v2 secrets engine at `secret`
- write a database secret
- enable AppRole auth
- create a read-only policy and role
- log in as an app with `role_id` and `secret_id`
- read the secret with the app token

The example is organized around three reusable personas from
`examples/common/personas`:

- `OperatorPersona.v2()` handles Vault readiness, initialization/unseal, `.env`
  material, and KV mount setup.
- `AdminPersona.v2()` configures AppRole, writes the policy, registers the role,
  and returns `role_id` / `secret_id`.
- `AppPersona.v2()` starts with an unauthenticated client, logs in with AppRole,
  and reads the application secret.

Each persona exposes `withWorkflow(async ({ vault }) => { ... })`, so the
example-specific logic stays in this file while repeated setup lives in the
common helpers.

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
export NANVC_VAULT_AUTH_TOKEN=<operator-or-admin-token>
```

If the local Vault server is initialized by this example, it writes
`examples/app-role/.env` with:

- `NANVC_VAULT_UNSEAL_KEY`
- `NANVC_VAULT_AUTH_TOKEN`

The operator persona also reads this file on later runs before creating its
client, so a previously initialized local Vault can be reused by the example.
To reuse those values manually in a new shell:

```bash
set -a
. examples/app-role/.env
set +a
```

The `.env` file is local runtime material and should not be committed.

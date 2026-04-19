# AppRole example with `VaultClient`

This example mirrors the AppRole workflow using the original v1 client.

It intentionally uses KV v1 for the secret path so the example can show the v1
client's native `write` and `read` ergonomics:

- prepare a local Vault server if needed
- mount a KV v1 secrets engine at `credentials`
- write a database secret
- enable AppRole auth
- create a read-only policy and role
- log in as an app with `role_id` and `secret_id`
- read the secret with the app token

Some AppRole calls use `apiRequest()` with a custom `POST 200` command spec
because the original client does not expose dedicated AppRole helpers.

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
npx tsx examples/app-role-v1/main.ts
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
`examples/app-role-v1/.env` with:

- `NANVC_VAULT_UNSEAL_KEY`
- `NANVC_VAULT_AUTH_TOKEN`

To reuse those values in a new shell:

```bash
set -a
. examples/app-role-v1/.env
set +a
```

The `.env` file is local runtime material and should not be committed.

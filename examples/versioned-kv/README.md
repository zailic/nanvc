# Versioned KV example with `VaultClientV2`

This example walks through the core features of the [KV v2 secrets engine](https://developer.hashicorp.com/vault/tutorials/secrets-management/versioned-kv)
using the typed `nanvc` v2 client.

## What the workflow demonstrates

- Create a clean KV v2 mount at `secret-versioned` so the run is repeatable.
- Read the engine config with `readConfig`.
- Write versions 1 and 2 of `customer/acme`.
- Patch the secret to create version 3 without replacing untouched fields.
- Add custom metadata labels to the secret path.
- Read a specific historical version.
- Inspect the full version history with `readMetadata`.
- Configure engine-wide and per-path `max_versions`.
- Write additional versions and assert that the oldest version advances.
- Soft-delete versions 5 and 6.
- Undelete version 5.
- Permanently destroy version 6.
- Configure `delete_version_after` for an automatically scheduled deletion.
- Configure `cas_required` and demonstrate successful and stale CAS writes.
- Delete all versions and metadata for `customer/acme`.

This example uses the shared decorator-based runner and personas described in
`examples/README.md`.

## Vault steps

The single admin workflow performs the following operations against
`secret-versioned`:

1. Disable the mount if it already exists, ignoring `404`.
2. Enable KV v2 at `secret-versioned`.
3. `readConfig` to confirm the engine is readable.
4. `write` twice to `customer/acme`, creating versions 1 and 2.
5. `patch` `contact_email`, creating version 3 while preserving
   `customer_name`.
6. `patchMetadata` to add `Membership` and `Region` labels.
7. `read` with `{ version: 1 }` to retrieve historical data.
8. `readMetadata` to inspect `current_version` and the version map.
9. `writeConfig` and `writeMetadata` to set `max_versions` to 4.
10. Write versions 4 through 7 and assert rollover behavior.
11. `deleteVersions([5, 6])` to soft-delete data.
12. `undeleteVersions([5])` to restore one soft-deleted version.
13. `destroyVersions([6])` to permanently erase version 6.
14. Set `delete_version_after: '24h'` on `customer/timed`.
15. Write to `customer/timed` and assert that `deletion_time` is scheduled.
16. Set `cas_required: true` on `customer/partner`.
17. Write with `cas: 0`, then write with `cas: 1`.
18. Attempt a stale `cas: 1` write and assert HTTP `400`.
19. `deleteMetadata` for `customer/acme` and assert metadata is gone.

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
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/versioned-kv/main.ts
```

The helper defaults to `http://vault.local:8200`. Use the environment variable
above when `vault.local` is not mapped on your machine. The mount
`secret-versioned` is removed and re-created on every run, so this example is
idempotent.

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

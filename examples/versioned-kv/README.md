# Versioned KV example with `VaultClientV2`

This example walks through the core features of the [KV v2 secrets engine](https://developer.hashicorp.com/vault/tutorials/secrets-management/versioned-kv) using the nanvc v2 client.

## What this example demonstrates

- Mount and configure a KV v2 engine (`secret-versioned`)
- Write a secret and observe automatic version numbering
- **Patch** a secret to partially update fields (JSON Merge Patch)
- Add **custom metadata** to a secret path
- Read a **specific historical version**
- Inspect the full **version history** via `readMetadata`
- Limit **max versions** kept per path (engine-wide and per-key)
- **Soft-delete** versions and **undelete** them
- **Permanently destroy** a version (`destroyVersions`)
- Configure **automatic deletion** after a TTL (`delete_version_after`)
- Use **Check-and-Set** to prevent unintentional overwrites
- Delete all versions and metadata for a path (`deleteMetadata`)

## Vault steps

The example uses `OperatorPersona.v2()` to prepare Vault, then uses
`AdminPersona.v2()` to perform the following steps against the
`secret-versioned` KV v2 mount:

1. Disable the mount if it already exists (so the example is repeatable), then enable KV v2 at `secret-versioned`.
2. `readConfig` — confirm the engine is readable.
3. `write` × 2 to `customer/acme` — version 1 and 2.
4. `patch` — creates version 3 by merging only `contact_email`.
5. `patchMetadata` — adds `Membership` and `Region` custom labels.
6. `read` with `{ version: 1 }` — proves older versions are still accessible.
7. `readMetadata` — inspects `current_version` and the version map.
8. `writeConfig` — caps the engine at 4 versions per secret.
9. `writeMetadata` — caps `customer/acme` at 4 versions per key.
10. Write 4 more versions to trigger rollover of the oldest entries.
11. `deleteVersions([5, 6])` — soft-delete; data stays but is marked.
12. `undeleteVersions([5])` — restore the soft-deleted version.
13. `destroyVersions([6])` — permanently erase version 6.
14. `writeMetadata` with `delete_version_after: '24h'` on `customer/timed`.
15. Write a secret to the timed path; verify `deletion_time` is scheduled.
16. `writeMetadata` with `cas_required: true` on `customer/partner`.
17. `write` with `cas: 0` (key does not exist yet) — succeeds.
18. `write` with `cas: 1` (matches current version) — succeeds.
19. `write` with stale `cas: 1` (current version is 2) — returns HTTP 400.
20. `deleteMetadata` — purges all versions and metadata for `customer/acme`.

## Local Vault

From the repository root, start the plain Vault service:

```bash
docker compose up -d vault
```

One Vault instance is enough. You do not need `vault_tls` or `vault_mtls` for this example.

For a completely fresh Vault state:

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
npx tsx examples/versioned-kv/main.ts
```

The client defaults to `http://127.0.0.1:8200`, which matches the `vault` service port mapping. The mount `secret-versioned` is torn down and re-created on every run so the example is idempotent.

## Environment

For an existing Vault server, set:

```bash
export NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200
export NANVC_VAULT_AUTH_TOKEN=<operator-or-admin-token>
```

If the local Vault is not yet initialized, the example initializes and unseals
it automatically and writes the shared `examples/.env` file with:

- `NANVC_VAULT_UNSEAL_KEY`
- `NANVC_VAULT_AUTH_TOKEN`

On subsequent runs the operator persona reads this file before creating its
client, so the same initialized local Vault can be reused across all examples.
To use those values manually:

```bash
set -a
. examples/.env
set +a
```

The shared `examples/.env` file is local runtime material and should not be
committed.

Shell-exported environment variables take precedence over values in
`examples/.env`. If Vault reports `invalid token`, the shared env file probably
belongs to another Vault instance or an older Docker volume. Export a valid
`NANVC_VAULT_AUTH_TOKEN`, or delete `examples/.env` and reset local Vault with
the fresh-state commands above.

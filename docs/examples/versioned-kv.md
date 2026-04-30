---
layout: page
title: "Versioned KV example with VaultClientV2"
description: "This example walks through the core features of the KV v2 secrets engine using the nanvc v2 client."
---

{% capture example_guide %}
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
{% endcapture %}

{% capture example_source %}
{% highlight ts %}
import assert from 'node:assert';

import { VaultClientError } from '../../src/main.js';
import { AdminPersona } from '../common/personas/admin.js';
import { getExamplesEnvPath, printSuccessBanner, toExampleAuthError } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';

const MOUNT = 'secret-versioned';
const SECRET_PATH = 'customer/acme';
const ENV_PATH = getExamplesEnvPath(import.meta.url);

async function main(): Promise<void> {
    const operator = OperatorPersona.v2({ envPath: ENV_PATH });
    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
    });

    const admin = AdminPersona.v2();
    await admin.withWorkflow(async ({ vault }) => {
        // Start with a clean mount so the example is repeatable.
        const disableError = await vault.sys.mount.disable(MOUNT).intoErr();
        if (disableError && disableError.status !== 404) {
            throw toExampleAuthError(disableError, ENV_PATH);
        }
        await vault.sys.mount.enable(MOUNT, {
            type: 'kv',
            options: {
                version: '2',
            },
        }).unwrap();

        // ── Step 1: Check the engine version ──────────────────────────────────
        // writeConfig initialises the engine; readConfig confirms max_versions=0 (default = 10).
        const engineConfig = await vault.secret.kv.v2.readConfig(MOUNT).unwrap();
        assert.ok(engineConfig.max_versions !== undefined, 'Engine config must be readable');

        // ── Step 2: Write secrets ─────────────────────────────────────────────
        // First write creates version 1.
        await vault.secret.kv.v2.write(MOUNT, SECRET_PATH, {
            customer_name: 'ACME Inc.',
            contact_email: 'john.smith@acme.com',
        }).unwrap();

        // Writing to the same path again performs a full replace and creates version 2.
        await vault.secret.kv.v2.write(MOUNT, SECRET_PATH, {
            customer_name: 'ACME Inc.',
            contact_email: 'jsmith@acme.com',
        }).unwrap();

        const v2 = await vault.secret.kv.v2.read<{ customer_name: string; contact_email: string }>(
            MOUNT, SECRET_PATH,
        ).unwrap();
        assert.strictEqual(v2.metadata.version, 2, 'Expected version 2 after second write');
        assert.strictEqual(v2.data.contact_email, 'jsmith@acme.com');

        // ── Step 3: Patch (partial update) ────────────────────────────────────
        // patch merges only the supplied fields; untouched fields are preserved.
        // This is equivalent to `vault kv patch` and creates version 3.
        await vault.secret.kv.v2.patch(MOUNT, SECRET_PATH, {
            contact_email: 'admin@acme.com',
        }).unwrap();

        const v3 = await vault.secret.kv.v2.read<{ customer_name: string; contact_email: string }>(
            MOUNT, SECRET_PATH,
        ).unwrap();
        assert.strictEqual(v3.metadata.version, 3, 'Expected version 3 after patch');
        assert.strictEqual(v3.data.contact_email, 'admin@acme.com');
        assert.strictEqual(v3.data.customer_name, 'ACME Inc.', 'Patch must preserve untouched fields');

        // ── Step 4: Add custom metadata ───────────────────────────────────────
        // patchMetadata stores arbitrary string-to-string labels alongside the
        // secret path without touching the versioned secret data.
        await vault.secret.kv.v2.patchMetadata(MOUNT, SECRET_PATH, {
            custom_metadata: {
                Membership: 'Platinum',
                Region: 'US West',
            },
        }).unwrap();

        const withMeta = await vault.secret.kv.v2.read<{ customer_name: string }>(
            MOUNT, SECRET_PATH,
        ).unwrap();
        const customMeta = withMeta.metadata.custom_metadata as Record<string, string> | null | undefined;
        assert.strictEqual(customMeta?.['Membership'], 'Platinum');
        assert.strictEqual(customMeta?.['Region'], 'US West');

        // ── Step 5: Read a specific version ───────────────────────────────────
        // Older versions remain accessible even after newer writes.
        const v1 = await vault.secret.kv.v2.read<{ customer_name: string; contact_email: string }>(
            MOUNT, SECRET_PATH, { version: 1 },
        ).unwrap();
        assert.strictEqual(v1.metadata.version, 1);
        assert.strictEqual(v1.data.contact_email, 'john.smith@acme.com', 'v1 must have the original email');

        // ── Step 6: Read full version history ─────────────────────────────────
        // readMetadata returns the full metadata record including all version entries.
        const meta = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH).unwrap();
        assert.strictEqual(meta.current_version, 3, 'current_version must be 3');
        const versionMap = meta.versions as Record<string, { destroyed: boolean; deletion_time: string }>;
        assert.ok(versionMap['1'], 'Version 1 must exist in metadata');
        assert.ok(versionMap['2'], 'Version 2 must exist in metadata');
        assert.ok(versionMap['3'], 'Version 3 must exist in metadata');

        // ── Step 7: Specify the number of versions to keep ────────────────────
        // Set the engine-wide default: keep at most 4 versions per secret.
        await vault.secret.kv.v2.writeConfig(MOUNT, { max_versions: 4 }).unwrap();
        const updatedConfig = await vault.secret.kv.v2.readConfig(MOUNT).unwrap();
        assert.strictEqual(updatedConfig.max_versions, 4, 'Engine max_versions must be 4');

        // A per-path override takes precedence over the engine-level setting.
        await vault.secret.kv.v2.writeMetadata(MOUNT, SECRET_PATH, { max_versions: 4 }).unwrap();

        // Write 4 more versions so that version 3 becomes the new oldest surviving version
        // (versions 1–3 existed before the limit was set, but Vault enforces the limit
        // from the next write onward, pruning the oldest once the cap is exceeded).
        for (let i = 4; i <= 7; i++) {
            await vault.secret.kv.v2.write(MOUNT, SECRET_PATH, {
                customer_name: 'ACME Inc.',
                contact_email: `v${i}@acme.com`,
            }).unwrap();
        }

        const metaAfterRollover = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH).unwrap();
        assert.strictEqual(metaAfterRollover.current_version, 7, 'current_version must be 7 after rollover');
        assert.ok(
            (metaAfterRollover.oldest_version ?? 0) >= 4,
            'oldest_version must advance past the cap once max_versions is exceeded',
        );

        // ── Step 8: Soft-delete and undelete versions ─────────────────────────
        // deleteVersions marks versions with a deletion_time but does not destroy data.
        await vault.secret.kv.v2.deleteVersions(MOUNT, SECRET_PATH, [5, 6]).unwrap();

        const metaAfterSoftDelete = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH).unwrap();
        const v5 = (metaAfterSoftDelete.versions as Record<string, { destroyed: boolean; deletion_time: string }>)['5'];
        assert.ok(v5.deletion_time, 'v5 must have a deletion_time after soft-delete');
        assert.strictEqual(v5.destroyed, false, 'v5 must not be destroyed (soft-delete only)');

        // undeleteVersions restores a soft-deleted version.
        await vault.secret.kv.v2.undeleteVersions(MOUNT, SECRET_PATH, [5]).unwrap();

        const metaAfterUndelete = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH).unwrap();
        const v5Restored = (metaAfterUndelete.versions as Record<string, { deletion_time: string }>)['5'];
        assert.strictEqual(v5Restored.deletion_time, '', 'v5 deletion_time must be empty after undelete');

        // ── Step 9: Permanently destroy a version ─────────────────────────────
        // destroyVersions permanently removes version data (destroyed=true, unrecoverable).
        await vault.secret.kv.v2.destroyVersions(MOUNT, SECRET_PATH, [6]).unwrap();

        const metaAfterDestroy = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH).unwrap();
        const v6 = (metaAfterDestroy.versions as Record<string, { destroyed: boolean }>)['6'];
        assert.strictEqual(v6.destroyed, true, 'v6 must be permanently destroyed');

        // ── Step 10: Configure automatic data deletion ────────────────────────
        // Writing metadata with delete_version_after makes Vault automatically
        // set a deletion_time on every new version at this path.
        const timedPath = 'customer/timed';
        await vault.secret.kv.v2.writeMetadata(MOUNT, timedPath, {
            delete_version_after: '24h',
        }).unwrap();

        await vault.secret.kv.v2.write(MOUNT, timedPath, { message: 'ephemeral secret' }).unwrap();

        const timedMeta = await vault.secret.kv.v2.readMetadata(MOUNT, timedPath).unwrap();
        const timedV1 = (timedMeta.versions as Record<string, { deletion_time: string }>)['1'];
        // Vault pre-populates deletion_time with the scheduled auto-deletion timestamp.
        assert.ok(timedV1.deletion_time, 'Auto-deletion path must have deletion_time set on new versions');

        // ── Step 11: Check-and-Set operations ─────────────────────────────────
        // CAS prevents unintentional overwrites by requiring the current version number.
        const casPath = 'customer/partner';
        await vault.secret.kv.v2.writeMetadata(MOUNT, casPath, { cas_required: true }).unwrap();

        // First write: cas=0 means "only succeed if the key does not yet exist".
        await vault.secret.kv.v2.write(MOUNT, casPath, {
            name: 'Example Co.',
            partner_id: '123456789',
        }, { cas: 0 }).unwrap();

        // Second write: cas=1 matches the current version so the write succeeds.
        await vault.secret.kv.v2.write(MOUNT, casPath, {
            name: 'Example Co.',
            partner_id: 'ABCDEFGHIJKLMN',
        }, { cas: 1 }).unwrap();

        // Stale CAS: current version is 2 but we pass cas=1 — Vault rejects with 400.
        const casError = await vault.secret.kv.v2.write(MOUNT, casPath, {
            name: 'Example Co.',
        }, { cas: 1 }).unwrapErr();
        assert.ok(casError instanceof VaultClientError, 'Stale CAS must produce a VaultClientError');
        assert.strictEqual(casError.status, 400, 'Stale CAS must return HTTP 400');

        // ── Step 12: Delete all versions and metadata ──────────────────────────
        // deleteMetadata permanently removes all versions and the metadata record.
        await vault.secret.kv.v2.deleteMetadata(MOUNT, SECRET_PATH).unwrap();

        const [, notFoundError] = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH);
        assert.strictEqual(notFoundError?.status, 404, 'Metadata must be gone after deleteMetadata');

        printSuccessBanner('Versioned KV tutorial workflow complete');
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
{% endhighlight %}
{% endcapture %}

{% include doc-tabs.html
  id="example-versioned-kv"
  aria_label="Example content"
  label_one="Guide"
  label_two="Source"
  panel_one=example_guide
  panel_two=example_source
  markdown_one=true
%}

## Source Files

- README source: `examples/versioned-kv/README.md`
- Runnable source: `examples/versioned-kv/main.ts`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

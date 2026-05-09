---
layout: page
title: "Versioned KV example with VaultClientV2"
description: "This example walks through the core features of the KV v2 secrets engine using the typed nanvc v2 client."
---

{% capture example_guide %}
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
{% endcapture %}

{% capture example_source %}
{% highlight ts %}
import assert from 'node:assert';

import type { AdminPersona } from '../common/personas/admin.js';
import { VaultClientError } from '../../src/main.js';
import { toExampleAuthError } from '../common/personas/helpers.js';
import { example, workflow, runAs, runExample } from '../common/workflow/decorators.js';

const MOUNT = 'secret-versioned';
const SECRET_PATH = 'customer/acme';

@example('Versioned KV example')
class VersionedKVExample {
    @workflow('admin', 'Demonstrate KV v2 features')
    @runAs({ persona: 'admin' })
    public async demonstrateKVFeatures(admin: AdminPersona<'v2'>): Promise<void> {
        const vault = admin.vault;

        // Start with a clean mount so the example is repeatable.
        const disableError = await vault.sys.mount.disable(MOUNT).intoErr();
        if (disableError && disableError.status !== 404) {
            throw toExampleAuthError(disableError);
        }
        await vault.sys.mount
            .enable(MOUNT, {
                type: 'kv',
                options: {
                    version: '2',
                },
            })
            .unwrap();

        // ── Step 1: Check the engine version ──────────────────────────────────
        // readConfig confirms that the KV v2 engine configuration is readable.
        const engineConfig = await vault.secret.kv.v2.readConfig(MOUNT).unwrap();
        assert.ok(engineConfig.max_versions !== undefined, 'Engine config must be readable');

        // ── Step 2: Write secrets ─────────────────────────────────────────────
        // First write creates version 1.
        await vault.secret.kv.v2
            .write(MOUNT, SECRET_PATH, {
                customer_name: 'ACME Inc.',
                contact_email: 'john.smith@acme.com',
            })
            .unwrap();

        // Writing to the same path again performs a full replace and creates version 2.
        await vault.secret.kv.v2
            .write(MOUNT, SECRET_PATH, {
                customer_name: 'ACME Inc.',
                contact_email: 'jsmith@acme.com',
            })
            .unwrap();

        const v2 = await vault.secret.kv.v2
            .read<{ customer_name: string; contact_email: string }>(MOUNT, SECRET_PATH)
            .unwrap();
        assert.strictEqual(v2.metadata.version, 2, 'Expected version 2 after second write');
        assert.strictEqual(v2.data.contact_email, 'jsmith@acme.com');

        // ── Step 3: Patch (partial update) ────────────────────────────────────
        // patch merges only the supplied fields; untouched fields are preserved.
        // This is equivalent to `vault kv patch` and creates version 3.
        await vault.secret.kv.v2
            .patch(MOUNT, SECRET_PATH, {
                contact_email: 'admin@acme.com',
            })
            .unwrap();

        const v3 = await vault.secret.kv.v2
            .read<{ customer_name: string; contact_email: string }>(MOUNT, SECRET_PATH)
            .unwrap();
        assert.strictEqual(v3.metadata.version, 3, 'Expected version 3 after patch');
        assert.strictEqual(v3.data.contact_email, 'admin@acme.com');
        assert.strictEqual(v3.data.customer_name, 'ACME Inc.', 'Patch must preserve untouched fields');

        // ── Step 4: Add custom metadata ───────────────────────────────────────
        // patchMetadata stores arbitrary string-to-string labels alongside the
        // secret path without touching the versioned secret data.
        await vault.secret.kv.v2
            .patchMetadata(MOUNT, SECRET_PATH, {
                custom_metadata: {
                    Membership: 'Platinum',
                    Region: 'US West',
                },
            })
            .unwrap();

        const withMeta = await vault.secret.kv.v2.read<{ customer_name: string }>(MOUNT, SECRET_PATH).unwrap();
        const customMeta = withMeta.metadata.custom_metadata as Record<string, string> | null | undefined;
        assert.strictEqual(customMeta?.['Membership'], 'Platinum');
        assert.strictEqual(customMeta?.['Region'], 'US West');

        // ── Step 5: Read a specific version ───────────────────────────────────
        // Older versions remain accessible even after newer writes.
        const v1 = await vault.secret.kv.v2
            .read<{ customer_name: string; contact_email: string }>(MOUNT, SECRET_PATH, { version: 1 })
            .unwrap();
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
            await vault.secret.kv.v2
                .write(MOUNT, SECRET_PATH, {
                    customer_name: 'ACME Inc.',
                    contact_email: `v${i}@acme.com`,
                })
                .unwrap();
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
        await vault.secret.kv.v2
            .writeMetadata(MOUNT, timedPath, {
                delete_version_after: '24h',
            })
            .unwrap();

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
        await vault.secret.kv.v2
            .write(
                MOUNT,
                casPath,
                {
                    name: 'Example Co.',
                    partner_id: '123456789',
                },
                { cas: 0 },
            )
            .unwrap();

        // Second write: cas=1 matches the current version so the write succeeds.
        await vault.secret.kv.v2
            .write(
                MOUNT,
                casPath,
                {
                    name: 'Example Co.',
                    partner_id: 'ABCDEFGHIJKLMN',
                },
                { cas: 1 },
            )
            .unwrap();

        // Stale CAS: current version is 2 but we pass cas=1 — Vault rejects with 400.
        const casError = await vault.secret.kv.v2
            .write(
                MOUNT,
                casPath,
                {
                    name: 'Example Co.',
                },
                { cas: 1 },
            )
            .unwrapErr();
        assert.ok(casError instanceof VaultClientError, 'Stale CAS must produce a VaultClientError');
        assert.strictEqual(casError.status, 400, 'Stale CAS must return HTTP 400');

        // ── Step 12: Delete all versions and metadata ──────────────────────────
        // deleteMetadata permanently removes all versions and the metadata record.
        await vault.secret.kv.v2.deleteMetadata(MOUNT, SECRET_PATH).unwrap();

        const [, notFoundError] = await vault.secret.kv.v2.readMetadata(MOUNT, SECRET_PATH);
        assert.strictEqual(notFoundError?.status, 404, 'Metadata must be gone after deleteMetadata');
    }
}

runExample(VersionedKVExample).catch((error) => {
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

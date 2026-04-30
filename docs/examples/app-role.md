---
layout: page
title: "AppRole example with VaultClientV2"
description: "This example demonstrates an AppRole flow with the v2 client:"
---

{% capture example_guide %}
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

- `OperatorPersona.v2()` handles Vault readiness, initialization/unseal, shared
  `examples/.env` material, and KV mount setup.
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

If the local Vault server is initialized by any example, it writes the shared
`examples/.env` file with:

- `NANVC_VAULT_UNSEAL_KEY`
- `NANVC_VAULT_AUTH_TOKEN`

The operator persona reads this file on later runs before creating its client,
so the same initialized local Vault can be reused across all examples. To reuse
those values manually in a new shell:

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

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { getExamplesEnvPath, printSuccessBanner } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';
import { VaultClientError } from '../../src/main.js';

const ENV_PATH = getExamplesEnvPath(import.meta.url);
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};
const assertInstanceOf = <T extends abstract new (...args: never[]) => unknown>(
    value: unknown,
    ctor: T,
): void => assert.ok(value instanceof ctor);

async function main(): Promise<void> {

    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed, then mount KV v2 at 'secret'.
    const operator = OperatorPersona.v2({ envPath: ENV_PATH });
    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('secret');
    });

    const admin = AdminPersona.v2();
    const credentials = await admin.withWorkflow(async ({ vault }) => {
        // ── Step 2: Admin — write the application secret ───────────────────────
        // Store a database credential set that the app will read later.
        // The secret is written before AppRole auth is configured so that the
        // app persona can prove it can read (and cannot delete) it.
        await vault.secret.kv.v2.write('secret', 'mysql/webapp', { ...secretData }).unwrap();

        // ── Step 3: Admin — enable AppRole auth method ─────────────────────────
        // AppRole is a machine-oriented auth method that issues tokens in exchange
        // for a role_id (public) and a secret_id (private, one-time-use).
        await admin.enableAppRoleAuth();

        // ── Step 4: Admin — write a least-privilege policy ────────────────────
        // The policy grants read-only access to the single secret path.
        // The app token will only be able to call 'read' on that path.
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            "path \"secret/data/mysql/webapp\" {",
            "  capabilities = [\"read\"]",
            "}",
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);

        // ── Step 5: Admin — register the AppRole and bind the policy ──────────
        // The role defines token TTLs and attaches the 'jenkins' policy so that
        // any token issued via this role inherits only its permissions.
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        // ── Step 6: Admin — generate role_id and secret_id ────────────────────
        // role_id is a stable identifier (like a username).
        // secret_id is a one-time credential (like a password).
        // Together they are exchanged for a scoped Vault token.
        return admin.createAppRoleCredentials('jenkins');
    });

    const app = AppPersona.v2();
    await app.withWorkflow(async ({ vault }) => {
        // ── Step 7: App — log in with AppRole credentials ─────────────────────
        // Exchange role_id + secret_id for a short-lived Vault token that carries
        // only the 'jenkins' policy. Subsequent calls use this token automatically.
        await app.loginWithAppRole(credentials);

        // ── Step 8: App — read the secret ─────────────────────────────────────
        // The 'jenkins' policy allows read; this call should succeed.
        const secretResponse = await vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();

        // ── Step 9: App — attempt a forbidden operation ───────────────────────
        // The policy does not grant 'delete'. Vault returns 403 Forbidden,
        // which nanvc surfaces as a VaultClientError with status 403.
        // This demonstrates that the AppRole token is truly least-privilege.
        const deleteError: unknown = await vault.secret.kv.v2.delete('secret', 'mysql/webapp').unwrapErr();
        assertInstanceOf(deleteError, VaultClientError);
        assert.strictEqual(
            (deleteError as VaultClientError).status,
            403,
            'Expected a 403 Forbidden error when trying to delete the secret with insufficient permissions',
        );
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });

    printSuccessBanner('AppRole v2 workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
{% endhighlight %}
{% endcapture %}

{% include doc-tabs.html
  id="example-app-role"
  aria_label="Example content"
  label_one="Guide"
  label_two="Source"
  panel_one=example_guide
  panel_two=example_source
  markdown_one=true
%}

## Source Files

- README source: `examples/app-role/README.md`
- Runnable source: `examples/app-role/main.ts`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

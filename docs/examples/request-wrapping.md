---
layout: page
title: "Request wrapping example with VaultClientV2"
description: "This example demonstrates an AppRole flow where the admin wraps the generated role_id and secret_id, then the app unwraps them before logging in:"
---

{% capture example_guide %}
This example demonstrates an AppRole flow where the admin wraps the generated
`role_id` and `secret_id`, then the app unwraps them before logging in:

- prepare a local Vault server if needed
- mount a KV v2 secrets engine at `secret`
- write a database secret
- enable AppRole auth
- create a read-only policy and role
- wrap the AppRole credentials with a short-lived wrapping token
- unwrap the credentials as the app
- log in as an app and read the secret with the app token

The example is organized around three reusable personas from
`examples/common/personas`:

- `OperatorPersona.v2()` handles Vault readiness, initialization/unseal, shared
  `examples/.env` material, and KV mount setup.
- `AdminPersona.v2()` configures AppRole, writes the policy, registers the role,
  creates the AppRole credentials, and wraps them.
- `AppPersona.v2()` starts with an unauthenticated client, unwraps the
  credentials, logs in with AppRole, and reads the application secret.

Each persona exposes `withWorkflow(async ({ vault }) => { ... })`, so the
example-specific request wrapping flow stays in this file while repeated setup
lives in the common helpers.

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
npx tsx examples/request-wrapping/main.ts
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


const ENV_PATH = getExamplesEnvPath(import.meta.url);
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

async function main(): Promise<void> {
    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed, then mount KV v2 at 'secret'.
    const operator = OperatorPersona.v2({ envPath: ENV_PATH });

    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('secret');
    });

    const admin = AdminPersona.v2();
    const wrappingToken = await admin.withWorkflow(async ({ vault }) => {
        // ── Step 2: Admin — write the application secret ───────────────────────
        // Store a database credential set that the app will read later using
        // the scoped token obtained through the wrapped AppRole login.
        await vault.secret.kv.v2.write('secret', 'mysql/webapp', secretData).unwrap();

        // ── Step 3: Admin — enable AppRole auth method ─────────────────────────
        // AppRole is a machine-oriented auth method that issues tokens in exchange
        // for a role_id (public) and a secret_id (private, one-time-use).
        await admin.enableAppRoleAuth();

        // ── Step 4: Admin — write a least-privilege policy ────────────────────
        // The policy grants read-only access to the single secret path.
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            "path \"secret/data/mysql/webapp\" {",
            "  capabilities = [\"read\"]",
            "}",
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);

        // ── Step 5: Admin — register the AppRole and bind the policy ──────────
        // The role defines token TTLs and attaches the 'jenkins' policy.
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        // ── Step 6: Admin — generate AppRole credentials ──────────────────────
        // Produce the role_id and secret_id that will be wrapped in the next step.
        const credentials = await admin.createAppRoleCredentials('jenkins');

        // ── Step 7: Admin — wrap credentials in a single-use token ────────────
        // Vault stores the credentials inside a cubbyhole and returns a
        // wrapping token with a short TTL (60 s). Only one successful unwrap
        // is allowed; any further attempt returns an error, preventing replay.
        // The admin hands only this wrapping token to the app — not the raw
        // role_id / secret_id.
        const wrappedResponse = await vault.sys.wrapping.wrap({
            role_id: credentials.roleId,
            secret_id: credentials.secretId,
        }, '60s').unwrap();
        const wrappingToken = wrappedResponse.wrap_info?.token;
        if (!wrappingToken) {
            throw new Error('Failed to create wrapping token');
        }

        return wrappingToken;
    });

    const app = AppPersona.v2();
    await app.withWorkflow(async ({ vault }) => {
        // ── Step 8: App — unwrap the wrapping token ───────────────────────────
        // The app calls sys.wrapping.unwrap with the single-use token it received
        // from the admin. Vault validates the token, returns the wrapped payload
        // (role_id + secret_id), and destroys the cubbyhole — one use only.
        const unwrapResponse = await vault.sys.wrapping.unwrap(wrappingToken).unwrap();
        const roleId = unwrapResponse.data?.role_id as string | undefined;
        const secretId = unwrapResponse.data?.secret_id as string | undefined;

        if (!roleId || !secretId) {
            throw new Error('Failed to unwrap wrapping token and retrieve credentials');
        }

        // ── Step 9: App — log in with the unwrapped credentials ───────────────
        // Exchange role_id + secret_id for a short-lived token scoped to the
        // 'jenkins' policy. The wrapping token is now consumed and cannot be reused.
        await app.loginWithAppRole({ roleId, secretId });

        // ── Step 10: App — read the secret and verify data ────────────────────
        // The scoped token has read permission on the secret path; the retrieved
        // data must match what the admin stored in Step 2.
        const secretResponse = await vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });

    printSuccessBanner('Request wrapping workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
{% endhighlight %}
{% endcapture %}

{% include doc-tabs.html
  id="example-request-wrapping"
  aria_label="Example content"
  label_one="Guide"
  label_two="Source"
  panel_one=example_guide
  panel_two=example_source
  markdown_one=true
%}

## Source Files

- README source: `examples/request-wrapping/README.md`
- Runnable source: `examples/request-wrapping/main.ts`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

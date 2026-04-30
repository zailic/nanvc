---
layout: page
title: "AppRole example with VaultClient"
description: "This example mirrors the AppRole workflow using the original v1 client."
---

{% capture example_guide %}
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

The example is organized around three reusable personas from
`examples/common/personas`:

- `OperatorPersona.v1()` handles Vault readiness, initialization/unseal, shared
  `examples/.env` material, and KV mount setup.
- `AdminPersona.v1()` configures AppRole, writes the policy, registers the role,
  and returns `role_id` / `secret_id`.
- `AppPersona.v1()` starts with an unauthenticated client, logs in with AppRole,
  and reads the application secret.

Each persona exposes `withWorkflow(async ({ vault }) => { ... })`, so the
example-specific logic stays in this file while repeated setup lives in the
common helpers.

Inside the v1 personas, some AppRole calls use `apiRequest()` with a custom
`POST 200` command spec because the original client does not expose dedicated
AppRole helpers.

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
import { expectSuccess, getExamplesEnvPath, printSuccessBanner } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';
import type { VaultResponseData } from '../common/personas/types.js';

const ENV_PATH = getExamplesEnvPath(import.meta.url);
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};
async function main(): Promise<void> {
    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed, then mount KV v1 at 'credentials'.
    // This example uses the original VaultClient (v1 API) throughout.
    const operator = OperatorPersona.v1({ envPath: ENV_PATH });

    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('credentials');
    });

    const admin = AdminPersona.v1();
    const credentials = await admin.withWorkflow(async ({ vault }) => {
        // ── Step 2: Admin — write the application secret ───────────────────────
        // Store a database credential set that the app will read later.
        // KV v1 stores data at the path directly with no versioning.
        await expectSuccess(
            vault.write('/credentials/mysql/webapp', secretData),
            'Vault KV v1 write failed',
        );

        // ── Step 3: Admin — enable AppRole auth method ─────────────────────────
        // AppRole is a machine-oriented auth method that issues tokens in exchange
        // for a role_id (public) and a secret_id (private, one-time-use).
        await admin.enableAppRoleAuth();

        // ── Step 4: Admin — write a least-privilege policy ────────────────────
        // The policy grants read-only access to the single secret path.
        // The app token will only be able to call 'read' on that path.
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'credentials/mysql/webapp'",
            "path \"credentials/mysql/webapp\" {",
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

    const app = AppPersona.v1();
    await app.withWorkflow(async ({ vault }) => {
        // ── Step 7: App — log in with AppRole credentials ─────────────────────
        // Exchange role_id + secret_id for a short-lived Vault token that carries
        // only the 'jenkins' policy. Subsequent calls use this token automatically.
        await app.loginWithAppRole(credentials);

        // ── Step 8: App — read the secret and verify data ─────────────────────
        // The 'jenkins' policy allows read; the KV v1 response wraps the data
        // inside an `apiResponse.data` envelope from the legacy client.
        const secretResponse = await expectSuccess(
            vault.read('/credentials/mysql/webapp'),
            'Vault KV v1 read failed',
        );
        const secret = secretResponse.apiResponse as VaultResponseData<{
            db_name: string;
            username: string;
            password: string;
        }> | undefined;

        assert.deepStrictEqual(
            secret?.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });

    printSuccessBanner('AppRole v1 workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
{% endhighlight %}
{% endcapture %}

{% include doc-tabs.html
  id="example-app-role-v1"
  aria_label="Example content"
  label_one="Guide"
  label_two="Source"
  panel_one=example_guide
  panel_two=example_source
  markdown_one=true
%}

## Source Files

- README source: `examples/app-role-v1/README.md`
- Runnable source: `examples/app-role-v1/main.ts`

> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.

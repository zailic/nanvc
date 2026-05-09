---
layout: page
title: "AppRole example with VaultClientV2"
description: "This example demonstrates a complete AppRole login flow with the typed v2 client."
---

{% capture example_guide %}
This example demonstrates a complete AppRole login flow with the typed v2
client.

## What the workflow demonstrates

- Prepare Vault by enabling a KV v2 mount at `secret`.
- Write an application secret at `secret/mysql/webapp`.
- Enable the `approle` auth method.
- Create a read-only `jenkins` policy for that one secret path.
- Register an AppRole with short-lived tokens.
- Generate `role_id` and `secret_id` credentials.
- Log in as an app with those AppRole credentials.
- Read the secret with the app token.
- Prove the policy is least-privilege by asserting that delete returns HTTP
  `403`.

This example uses the shared decorator-based runner and personas described in
`examples/README.md`.

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
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/app-role/main.ts
```

The helper defaults to `http://vault.local:8200`. Use the environment variable
above when `vault.local` is not mapped on your machine.

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
import type { AppPersona } from '../common/personas/app.js';
import type { OperatorPersona } from '../common/personas/operator.js';
import { VaultClientError } from '../../src/main.js';
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';
import type { AppRoleCredentials } from '../common/personas/types.js';
import { assertInstanceOf } from '../common/assert.js';

const CREDENTIALS = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

@example('AppRole authentication example')
class AppRoleExample {
    private credentials!: AppRoleCredentials;

    @workflow('operator', 'Prerequisites: prepare Vault with an AppRole and a secret')
    @runAs({ persona: 'operator' })
    public async prepareVault(operator: OperatorPersona<'v2'>): Promise<void> {
        await operator.ensureKvMountAvailable('secret');
    }

    @workflow('admin', 'Configure AppRole and create credentials')
    @runAs({ persona: 'admin' })
    public async adminWorkflow(admin: AdminPersona<'v2'>): Promise<void> {
        await admin.vault.secret.kv.v2.write('secret', 'mysql/webapp', { ...CREDENTIALS }).unwrap();
        await admin.vault.auth.enableAuthMethod('approle', { type: 'approle' }).unwrap();
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            'path "secret/data/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.vault.sys.policies.acl.write('jenkins', { policy: jenkinsPolicy }).unwrap();
        await admin.vault.auth
            .registerAppRole('jenkins', {
                token_policies: ['jenkins'],
                token_ttl: '20m',
                token_max_ttl: '30m',
            })
            .unwrap();

        this.credentials = await admin.createAppRoleCredentials('jenkins');
    }

    @workflow('app', 'Log in with AppRole credentials and check policy permissions')
    @runAs({ persona: 'app' })
    public async appWorkflow(app: AppPersona<'v2'>): Promise<void> {
        await app.vault.auth
            .loginWithAppRole({
                role_id: this.credentials.roleId,
                secret_id: this.credentials.secretId,
            })
            .unwrap();
        const secretResponse = await app.vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        const deleteError: unknown = await app.vault.secret.kv.v2.delete('secret', 'mysql/webapp').unwrapErr();
        assertInstanceOf(deleteError, VaultClientError);
        assert.strictEqual(
            (deleteError as VaultClientError).status,
            403,
            'Expected a 403 Forbidden error when trying to delete the secret with insufficient permissions',
        );
        assert.deepStrictEqual(
            secretResponse.data,
            CREDENTIALS,
            'Retrieved secret data does not match the expected value',
        );
    }
}

runExample(AppRoleExample).catch((error) => {
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

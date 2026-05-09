---
layout: page
title: "Request wrapping example with VaultClientV2"
description: "This example demonstrates an AppRole flow where the admin wraps the generated role_id and secret_id, then the app unwraps them before logging in."
---

{% capture example_guide %}
This example demonstrates an AppRole flow where the admin wraps the generated
`role_id` and `secret_id`, then the app unwraps them before logging in.

## What the workflow demonstrates

- Prepare Vault by enabling a KV v2 mount at `secret`.
- Write an application secret at `secret/mysql/webapp`.
- Enable the `approle` auth method.
- Create a read-only `jenkins` policy for that one secret path.
- Register an AppRole with short-lived tokens.
- Generate `role_id` and `secret_id` credentials.
- Wrap those credentials with `vault.sys.wrapping.wrap` and a `60s` TTL.
- Clear the app token before unwrapping to model an unauthenticated receiver.
- Unwrap the credentials with `vault.sys.wrapping.unwrap`.
- Log in as the app and read the protected secret.

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
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/request-wrapping/main.ts
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
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';

const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

@example('Request wrapping example')
class RequestWrappingExample {
    private wrappingToken!: string;

    @workflow('operator', 'Prerequisites: prepare Vault with a secret')
    @runAs({ persona: 'operator' })
    public async prepareVault(operator: OperatorPersona<'v2'>): Promise<void> {
        await operator.ensureKvMountAvailable('secret');
    }

    @workflow('admin', 'Configure AppRole and create wrapped credentials')
    @runAs({ persona: 'admin' })
    public async adminWorkflow(admin: AdminPersona<'v2'>): Promise<void> {
        await admin.vault.secret.kv.v2.write('secret', 'mysql/webapp', secretData).unwrap();
        await admin.enableAppRoleAuth();
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            'path "secret/data/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });
        const credentials = await admin.createAppRoleCredentials('jenkins');
        const wrappedResponse = await admin.vault.sys.wrapping
            .wrap(
                {
                    role_id: credentials.roleId,
                    secret_id: credentials.secretId,
                },
                '60s',
            )
            .unwrap();
        const wrappingToken = wrappedResponse.wrap_info?.token;
        if (!wrappingToken) {
            throw new Error('Failed to create wrapping token');
        }
        this.wrappingToken = wrappingToken;
    }

    @workflow('app', 'Unwrap credentials and access secret')
    @runAs({ persona: 'app' })
    public async appWorkflow(app: AppPersona<'v2'>): Promise<void> {
        app.vault.setToken(null);
        const unwrapResponse = await app.vault.sys.wrapping.unwrap(this.wrappingToken).unwrap();
        const roleId = unwrapResponse.data?.role_id as string | undefined;
        const secretId = unwrapResponse.data?.secret_id as string | undefined;
        if (!roleId || !secretId) {
            throw new Error('Failed to unwrap wrapping token and retrieve credentials');
        }
        await app.loginWithAppRole({ roleId, secretId });
        const secretResponse = await app.vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            'Retrieved secret data does not match the expected value',
        );
    }
}

runExample(RequestWrappingExample).catch((error) => {
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

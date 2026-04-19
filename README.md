# nanvc

[![build status](https://github.com/zailic/nanvc/actions/workflows/main.yaml/badge.svg)](https://github.com/zailic/nanvc/actions/workflows/main.yaml)
[![code coverage](https://codecov.io/gh/zailic/nanvc/branch/master/graph/badge.svg?token=DWUB3ADSQG)](https://codecov.io/gh/zailic/nanvc)

`nanvc` is a small TypeScript client for the HashiCorp Vault HTTP API.

Full documentation is available at [zailic.github.io/nanvc](https://zailic.github.io/nanvc/).

New development is focused on `VaultClientV2`, the typed client built on top of `RawVaultClient`.
The original `VaultClient` remains available for compatibility, but it is expected to be deprecated and removed in a future major release.

## Requirements

- Node.js `>= 20`
- npm

## Install

```bash
npm install nanvc
```

## Usage

### TypeScript / ESM

```ts
import { VaultClientV2 } from 'nanvc';

const vault = new VaultClientV2({
    clusterAddress: 'http://127.0.0.1:8200',
    authToken: process.env.VAULT_TOKEN ?? null,
});

async function main(): Promise<void> {
    await vault.write('secret/my-app/my-secret', {
        foo: 'my-password',
    }).unwrap();

    const secret = await vault.read<{ foo: string }>('secret/my-app/my-secret').unwrap();
    console.log(secret.foo);
}

main().catch(console.error);
```

### Original Client

`VaultClient` is the original API shape based on command specs and `VaultResponse`.

The `VaultClient` constructor accepts three optional arguments:

1. Vault cluster address
2. Vault auth token
3. Vault API version

If omitted, the client uses:

- `NANVC_VAULT_CLUSTER_ADDRESS`
- `NANVC_VAULT_AUTH_TOKEN`
- `NANVC_VAULT_API_VERSION`

and falls back to:

- cluster address: `http://127.0.0.1:8200`
- auth token: `null`
- API version: `v1`

```ts
import VaultClient from 'nanvc';

const vault = new VaultClient('http://127.0.0.1:8200', process.env.VAULT_TOKEN ?? null);

async function main(): Promise<void> {
    const writeResponse = await vault.write('/secret/my-app/my-secret', {
        foo: 'my-password',
    });

    if (!writeResponse.succeeded) {
        throw new Error(writeResponse.errorMessage ?? 'Vault write failed');
    }

    const readResponse = await vault.read('/secret/my-app/my-secret');

    if (!readResponse.succeeded || !readResponse.apiResponse) {
        throw new Error(readResponse.errorMessage ?? 'Vault read failed');
    }

    const secret = readResponse.apiResponse as { data?: { foo?: string } };
    console.log(secret.data?.foo);
}

main().catch(console.error);
```

### CommonJS

Starting with version 1.2.0, `nanvc` is published as an ESM-only package. CommonJS consumers need to use dynamic `import()` to load the module.

```js
async function main() {
    const { default: VaultClient, VaultClientV2 } = await import('nanvc');

    const vault = new VaultClient('http://127.0.0.1:8200', process.env.VAULT_TOKEN ?? null);
    const secretResponse = await vault.read('/secret/my-app/my-secret');

    if (!secretResponse.succeeded) {
        throw new Error(secretResponse.errorMessage ?? 'Vault read failed');
    }

    console.log('v1 secret:', secretResponse.apiResponse);

    const vaultV2 = new VaultClientV2({
        clusterAddress: 'http://127.0.0.1:8200',
        authToken: process.env.VAULT_TOKEN ?? null,
    });

    const secret = await vaultV2.read('secret/my-app/my-secret').unwrap();
    console.log('v2 secret:', secret);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
```


### V2 Result Helpers

`VaultClientV2` and `RawVaultClient` return a promise-like `Result<T>`.
This model is intentionally inspired by Rust's `Result`, adapted for TypeScript and promise-based APIs.

You can await it as a tuple:

```ts
const [secret, error] = await vaultV2.read<{ foo: string }>('secret/my-app/my-secret');

if (error) {
    console.error(error.message);
} else {
    console.log(secret.foo);
}
```

Or use helper methods:

```ts
const secret = await vaultV2.secret.kv.v1.read<{ foo: string }>('secret', 'my-app/my-secret').unwrap();
const fallbackSecret = await vaultV2.secret.kv.v1.read<{ foo: string }>('secret', 'my-app/my-secret').unwrapOr({ foo: 'fallback' });
const error = await vaultV2.secret.kv.v1.read('secret', 'my-app/my-secret').intoErr();
```

Available helpers:

- `.unwrap()` returns the success value or throws the error
- `.unwrapOr(defaultValue)` returns a fallback value on error
- `.unwrapOrElse(fn)` computes a fallback from the error
- `.unwrapErr()` returns the error or throws if the result was successful
- `.intoErr()` returns the error or `null`

### V2 KV Shortcuts

`VaultClientV2` exposes Vault CLI-style KV shortcuts: `read`, `write`, `delete`, and `list`.
They default to KV v1 and support KV v2 with `{ engineVersion: 2 }`.

```ts
await vault.write('secret/apps/demo', { foo: 'bar' }).unwrap();
const kv1Secret = await vault.read<{ foo: string }>('secret/apps/demo').unwrap();

await vault.write('secret-v2', 'apps/demo', { foo: 'bar' }, { engineVersion: 2 }).unwrap();
const kv2Secret = await vault.read<{ foo: string }>('secret-v2', 'apps/demo', {
    engineVersion: 2,
}).unwrap();

console.log(kv1Secret.foo);
console.log(kv2Secret.data.foo);
```

### Optional mTLS

TLS client authentication is optional and disabled by default. Existing constructor calls keep working as-is.

For HTTPS Vault clusters that only need a custom CA, you can pass just `ca`:

```ts
import VaultClient from 'nanvc';

const vault = new VaultClient({
    clusterAddress: 'https://vault.local:8200',
    authToken: process.env.VAULT_TOKEN ?? null,
    tls: {
        ca: process.env.VAULT_CA_PEM,
        rejectUnauthorized: true,
    },
});
```

For HTTPS Vault clusters that require mTLS, use the object-based constructor:

```ts
import VaultClient from 'nanvc';

const vault = new VaultClient({
    clusterAddress: 'https://vault.local:8200',
    authToken: process.env.VAULT_TOKEN ?? null,
    apiVersion: 'v1',
    tls: {
        ca: process.env.VAULT_CA_PEM,
        cert: process.env.VAULT_CLIENT_CERT_PEM,
        key: process.env.VAULT_CLIENT_KEY_PEM,
        passphrase: process.env.VAULT_CLIENT_KEY_PASSPHRASE,
        rejectUnauthorized: true,
    },
});
```

The `tls` block supports:

- `ca`
- `cert`
- `key`
- `passphrase`
- `rejectUnauthorized`

## API

For the typed v2 client, see the [VaultClientV2 API reference](https://zailic.github.io/nanvc/api-v2/).

Original `VaultClient` methods:

- `read(path)`
- `write(path, payload)`
- `update(path, payload)`
- `delete(path)`
- `list(path)`
- `audits()`
- `auditHash(path, payload)`
- `auths()`
- `enableAudit(path, payload)`
- `disableAudit(path)`
- `enableAuth(path, payload)`
- `disableAuth(path)`
- `isInitialized()`
- `init(payload)`
- `mount(path, payload)`
- `mounts()`
- `policies()`
- `addPolicy(name, payload)`
- `removePolicy(name)`
- `remount(payload)`
- `seal()`
- `status()`
- `unmount(path)`
- `unseal(payload)`

Every call resolves to a `VaultResponse` with:

- `succeeded`
- `httpStatusCode`
- `apiResponse`
- `errorMessage`

## Development

For the v2 OpenAPI type generator inputs and module layout, see [openapi/README.md](openapi/README.md).

```bash
npm install
npm run generate:v2:openapi
npm run generate:v2:docs
npm run typecheck
npm run lint
npm test
npm run build
```

### Test commands

```bash
npm run test:unit
npm run test:integration
npm run test:integration:legacy
npm run test:integration:v2
npm run test:integration:all
npm run test:all
npm run coverage
```

### Integration tests

Integration tests expect local Vault-related services from `docker-compose.yml`:

```bash
npm run test:integration:prepare
docker compose up -d
npm run test:integration
```

To run both integration suites reliably against fresh Vault state, use:

```bash
npm run test:integration:all
```

That command regenerates local TLS fixtures, recreates the Docker stack, runs the legacy integration suite, recreates the stack again, and then runs the v2 suite.

The coverage task follows the same reset boundary. It runs unit tests, resets the
Docker stack for the legacy integration suite, resets it again for the v2 suite,
and only then generates the final nyc report.

The prepared fixtures start three Vault listeners for integration coverage:

- plain HTTP on `http://vault.local:8200`
- HTTPS with a custom CA on `https://127.0.0.1:8201`
- HTTPS with required client certificates on `https://127.0.0.1:8202`

## Project layout

```text
src/
  lib/
    client.ts
    commands/
  v2/
    client/
    core/
    transport/
docs/
examples/
test/
```

The `src/lib/commands` layer defines the command specs and payload types used by `VaultClient`.
The `src/v2` layer contains the typed client, raw transport client, result helpers, and generated Vault OpenAPI types.

## Status

This library covers a focused subset of the Vault API, mainly:

- secret CRUD operations
- initialization and seal management
- mounts/remounts
- auth backends
- audits
- policies

It does not aim to expose the full Vault API surface yet.

`secret.kv.v2` currently covers the common read, write, list, and soft-delete workflow. It is not a complete implementation of every KV v2 operation from the Vault OpenAPI specification; use `RawVaultClient` for unsupported KV v2 endpoints.

## License

MIT

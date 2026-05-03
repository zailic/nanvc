# nanvc

[![build status](https://github.com/zailic/nanvc/actions/workflows/main.yaml/badge.svg)](https://github.com/zailic/nanvc/actions/workflows/main.yaml)
[![code coverage](https://codecov.io/gh/zailic/nanvc/branch/master/graph/badge.svg?token=DWUB3ADSQG)](https://codecov.io/gh/zailic/nanvc)
![npm](https://img.shields.io/npm/v/nanvc)
![downloads](https://img.shields.io/npm/dm/nanvc)

`nanvc` is a lightweight TypeScript client for the HashiCorp Vault HTTP API.
It is built for Node.js applications that need typed Vault access without a large framework around secrets, auth, or infrastructure automation.

Use it for typed KV v1/KV v2 secret workflows, AppRole authentication, response wrapping, system policy helpers, database secrets, optional request logging, and raw Vault API calls when you need an escape hatch.

Full documentation: [zailic.github.io/nanvc](https://zailic.github.io/nanvc/)

## Why nanvc

- **Typed Vault client for TypeScript**: exported request and response types for the v2 client surface.
- **KV shortcuts that feel like the Vault CLI**: `read`, `write`, `delete`, and `list` support KV v1 by default and KV v2 with `{ engineVersion: 2 }`.
- **Focused high-level APIs**: helpers for AppRole, KV v1, KV v2, system policies, response wrapping, and database secrets.
- **Raw API escape hatch**: `RawVaultClient` lets you call unsupported Vault endpoints without leaving the same client setup.
- **Result-based error handling**: use tuple-style results or `.unwrap()`, `.unwrapOr()`, and related helpers.
- **Production-friendly basics**: ESM, Node.js `>=20`, optional TLS/mTLS, and opt-in request lifecycle logs.

## Install

```bash
npm install nanvc
```

```ts
import { VaultClientV2 } from 'nanvc';
const vault = new VaultClientV2();
await vault.write('secret/apps/demo', { password: 's3cr3t' }).unwrap();
const secret = await vault.read<{ password: string }>('secret/apps/demo').unwrap();
```

## Common Workflows

### KV v2

```ts
await vault.write(
    'secret-v2',
    'apps/demo',
    { apiKey: 'dev-key' },
    { engineVersion: 2 },
).unwrap();

const value = await vault.read<{ apiKey: string }>(
    'secret-v2',
    'apps/demo',
    { engineVersion: 2 },
).unwrap();

```

For the full versioned KV workflow, including patch, metadata, history, soft-delete, undelete, destroy, automatic deletion, and CAS examples, see the [versioned KV guide](https://zailic.github.io/nanvc/examples/versioned-kv/).

### AppRole

```ts
const login = await vault.auth.loginWithAppRole({
    role_id: process.env.VAULT_ROLE_ID,
    secret_id: process.env.VAULT_SECRET_ID,
}).unwrap();

```
See the runnable [VaultClientV2 AppRole example](https://zailic.github.io/nanvc/examples/app-role/).

### Response Wrapping

```ts
const wrapped = await vault.sys.wrapping.wrap(
    { role_id: '...', secret_id: '...' },
    '5m',
).unwrap();

const unwrapped = await vault.sys.wrapping.unwrap(wrapped.wrap_info.token).unwrap();
```

See the [request wrapping example](https://zailic.github.io/nanvc/examples/request-wrapping/).

### Database Secrets

```ts
await vault.secret.db.configureConnection('database', 'postgres', {
    plugin_name: 'postgresql-database-plugin',
    connection_url: 'postgresql://{{username}}:{{password}}@localhost/postgres',
    allowed_roles: ['readonly'],
}).unwrap();

const creds = await vault.secret.db.generateCredentials('database', 'readonly').unwrap();
```

## Error Handling

`VaultClientV2` and `RawVaultClient` return a promise-like `Result<T>`.
You can use tuple-style handling:

```ts
const [secret, error] = await vault.read<{ password: string }>('secret/apps/demo');

if (error) {
    console.error(error.message);
} else {
    console.log(secret.password);
}
```

Or use helpers:

```ts
const secret = await vault.read<{ password: string }>('secret/apps/demo').unwrap();
const fallback = await vault.read('secret/missing').unwrapOr({ password: 'fallback' });
```

Read more in the [error handling guide](https://zailic.github.io/nanvc/error-handling/).

## Raw Vault API

When a high-level helper does not cover an endpoint yet, call Vault directly:

```ts
const info = await vault.raw.get('/sys/host-info').unwrap();
```

See the [VaultClientV2 API reference](https://zailic.github.io/nanvc/api-v2/) for the full typed surface.

## Logging

Logging is disabled by default. Enable request lifecycle logs with:

```bash
NANVC_LOG_LEVEL=debug node app.js
```

Supported levels are `error`, `warn`, `info`, and `debug`.
Logs include method, URL, status, and duration, but never tokens or request/response bodies.

## Client Versions

New development is focused on `VaultClientV2`, the typed client built on `RawVaultClient`.
The original `VaultClient` remains available for compatibility and for optional mTLS support.

Original client documentation:

- [VaultClient v1 API](https://zailic.github.io/nanvc/api-v1/)
- [Original AppRole example](https://zailic.github.io/nanvc/examples/app-role-v1/)

CommonJS consumers can load this ESM-only package with dynamic `import()`:

```js
const { VaultClientV2 } = await import('nanvc');
```

## Links

- [Documentation](https://zailic.github.io/nanvc/)
- [Getting started](https://zailic.github.io/nanvc/getting-started/)
- [Examples](https://zailic.github.io/nanvc/examples/)
- [Changelog](https://github.com/zailic/nanvc/blob/master/CHANGELOG.md)
- [Issues](https://github.com/zailic/nanvc/issues)

## Requirements

- Node.js `>=20`
- ESM project or dynamic `import()` from CommonJS

## License

MIT

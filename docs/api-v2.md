---
layout: page
title: API v2
---

The v2 API introduces a more typed model built on a lower-level raw transport client.

Here, `API v2` means the newer `nanvc` client surface, not a Vault API version label.

```ts
import { RawVaultClient, VaultClientV2 } from 'nanvc';
```

## Result Model

V2 methods return a promise-like `Result<T>` object.
The model is intentionally inspired by Rust's `Result`, adapted for TypeScript
and promise-based APIs.

You can use it in two ways:

- destructure it as a tuple
- use helper methods like `.unwrap()` to convert it into the style you want

The underlying tuple shape is:

```ts
type ResultTuple<T, E = VaultClientError> = [T, null] | [null, E];

interface Result<T, E = VaultClientError> extends Promise<ResultTuple<T, E>> {
  unwrap(): Promise<T>;
  unwrapOr(defaultValue: T): Promise<T>;
  unwrapOrElse(fn: (error: E) => T): Promise<T>;
  unwrapErr(): Promise<E>;
  intoErr(): Promise<E | null>;
}
```

Tuple style:

```ts
const [secret, error] = await vault.read<{ foo: string }>('secret/my-app/my-secret');
if (error) {
  throw error;
}

console.log(secret.foo);
```

Unwrap style:

```ts
const secret = await vault.read<{ foo: string }>('secret/my-app/my-secret').unwrap();

console.log(secret.foo);
```

Other helpers:

```ts
const secret = await vault.secret.kv.v1.read<{ foo: string }>('secret', 'my-app/my-secret').unwrapOr({
  foo: 'fallback',
});

const secret2 = await vault.secret.kv.v1.read<{ foo: string }>('secret', 'my-app/my-secret').unwrapOrElse((error) => {
  console.warn(error.message);
  return { foo: 'fallback' };
});

const error = await vault.secret.kv.v1.read('secret', 'my-app/my-secret').intoErr();
```

`unwrapErr()` is available for tests or flows where failure is the expected outcome:

```ts
const error = await vault.secret.kv.v1.read('secret', 'missing').unwrapErr();

console.log(error.code);
console.log(error.message);
```

## `VaultClientV2`

`VaultClientV2` is a higher-level wrapper for common operations.

### Constructor

```ts
const vault = new VaultClientV2({
  clusterAddress: 'http://vault.local:8200',
  apiVersion: 'v1',
  authToken: process.env.NANVC_VAULT_AUTH_TOKEN ?? null,
});
```

### KV shortcuts

`VaultClientV2` exposes Vault CLI-style KV shortcuts for common secret operations:

- `read`
- `write`
- `delete`
- `list`

Shortcuts default to KV v1:

```ts
await vault.write('secret/apps/demo', {
  foo: 'bar',
}).unwrap();

const secret = await vault.read<{ foo: string }>('secret/apps/demo').unwrap();
const keys = await vault.list('secret/apps').unwrap();
await vault.delete('secret/apps/demo').unwrap();
```

Use `{ engineVersion: 2 }` for KV v2 mounts:

```ts
await vault.write('secret-v2', 'apps/demo', {
  foo: 'bar',
}, {
  engineVersion: 2,
  cas: 1,
}).unwrap();

const secret = await vault.read<{ foo: string }>('secret-v2', 'apps/demo', {
  engineVersion: 2,
  version: 3,
}).unwrap();
const keys = await vault.list('secret-v2', 'apps', { engineVersion: 2 }).unwrap();
await vault.delete('secret-v2', 'apps/demo', { engineVersion: 2 }).unwrap();

console.log(secret.data.foo);
```

### Client Structure

<!-- nanvc:client-structure:start -->

#### Generated Shorthand Reference

This section is generated from `@nanvc-doc` blocks in `src/v2/client/**/*.ts`.

##### Auth / AppRole

<details id="authgenerateapprolesecretid" markdown="1">
<summary><code>auth.generateAppRoleSecretId</code></summary>

Generate a SecretID for an AppRole role.

Signatures:

- `auth.generateAppRoleSecretId(roleName, payload?)`
- `auth.generateAppRoleSecretId(mount, roleName, payload?)`

Example:

```ts
const { secret_id } = await vault.auth.generateAppRoleSecretId('jenkins').unwrap();
```

</details>

<details id="authgetapproleroleid" markdown="1">
<summary><code>auth.getAppRoleRoleId</code></summary>

Read the RoleID assigned to an AppRole role.

Signatures:

- `auth.getAppRoleRoleId(roleName)`
- `auth.getAppRoleRoleId(mount, roleName)`

Example:

```ts
const { role_id } = await vault.auth.getAppRoleRoleId('jenkins').unwrap();
```

</details>

<details id="authloginwithapprole" markdown="1">
<summary><code>auth.loginWithAppRole</code></summary>

Authenticate with AppRole credentials and set the returned client token on the client.

Signatures:

- `auth.loginWithAppRole(payload)`
- `auth.loginWithAppRole(mount, payload)`

Example:

```ts
const login = await vault.auth.loginWithAppRole({
    role_id: roleId,
    secret_id: secretId,
}).unwrap();
```

</details>

<details id="authregisterapprole" markdown="1">
<summary><code>auth.registerAppRole</code></summary>

Register or update an AppRole role on an AppRole auth backend.

Signatures:

- `auth.registerAppRole(roleName, payload)`
- `auth.registerAppRole(mount, roleName, payload)`

Example:

```ts
await vault.auth.registerAppRole('jenkins', {
    token_policies: ['jenkins'],
    token_ttl: '20m',
    token_max_ttl: '30m',
}).unwrap();
```

</details>

<details id="authregisterapproleroleid" markdown="1">
<summary><code>auth.registerAppRoleRoleId</code></summary>

Register a custom RoleID for an AppRole role.

Signatures:

- `auth.registerAppRoleRoleId(roleName, payload)`
- `auth.registerAppRoleRoleId(mount, roleName, payload)`

Example:

```ts
await vault.auth.registerAppRoleRoleId('jenkins', {
    role_id: 'jenkins-role-id',
}).unwrap();
```

</details>

##### Auth

<details id="authdisableauthmethod" markdown="1">
<summary><code>auth.disableAuthMethod</code></summary>

Disable an auth method mounted at the given path.

Signatures:

- `auth.disableAuthMethod(path)`

Example:

```ts
await vault.auth.disableAuthMethod('approle').unwrap();
```

</details>

<details id="authenableauthmethod" markdown="1">
<summary><code>auth.enableAuthMethod</code></summary>

Enable an auth method if it is not already enabled.

Signatures:

- `auth.enableAuthMethod(path, payload)`

Example:

```ts
await vault.auth.enableAuthMethod('approle', {
    type: 'approle',
}).unwrap();
```

</details>

<details id="authgetauthmethodconfig" markdown="1">
<summary><code>auth.getAuthMethodConfig</code></summary>

Read configuration for an enabled auth method.

Signatures:

- `auth.getAuthMethodConfig(path)`

Example:

```ts
const config = await vault.auth.getAuthMethodConfig('approle').unwrap();
```

</details>

<details id="authisauthmethodenabled" markdown="1">
<summary><code>auth.isAuthMethodEnabled</code></summary>

Check whether an auth method exists at the given path.

Signatures:

- `auth.isAuthMethodEnabled(path)`

Example:

```ts
const enabled = await vault.auth.isAuthMethodEnabled('approle').unwrap();
```

</details>

##### Secrets / KV v1

<details id="secretkvv1delete" markdown="1">
<summary><code>secret.kv.v1.delete</code></summary>

Delete a KV v1 secret.

Signatures:

- `secret.kv.v1.delete(path)`
- `secret.kv.v1.delete(mount, path)`

Example:

```ts
await vault.secret.kv.v1.delete('secret', 'apps/demo').unwrap();
```

</details>

<details id="secretkvv1list" markdown="1">
<summary><code>secret.kv.v1.list</code></summary>

List keys at a KV v1 path.

Signatures:

- `secret.kv.v1.list(path)`
- `secret.kv.v1.list(mount, path?)`

Example:

```ts
const keys = await vault.secret.kv.v1.list('secret', 'apps').unwrap();
```

</details>

<details id="secretkvv1read" markdown="1">
<summary><code>secret.kv.v1.read</code></summary>

Read a KV v1 secret and return its nested data object.

Signatures:

- `secret.kv.v1.read<T>(path)`
- `secret.kv.v1.read<T>(mount, path)`

Example:

```ts
const secret = await vault.secret.kv.v1.read<{ foo: string }>('secret', 'apps/demo').unwrap();
```

</details>

<details id="secretkvv1write" markdown="1">
<summary><code>secret.kv.v1.write</code></summary>

Write a KV v1 secret.

Signatures:

- `secret.kv.v1.write(path, payload)`
- `secret.kv.v1.write(mount, path, payload)`

Example:

```ts
await vault.secret.kv.v1.write('secret', 'apps/demo', {
    foo: 'bar',
}).unwrap();
```

</details>

##### Secrets / KV v2

<details id="secretkvv2delete" markdown="1">
<summary><code>secret.kv.v2.delete</code></summary>

Soft-delete the latest version of a KV v2 secret.

Signatures:

- `secret.kv.v2.delete(mount, path)`

Example:

```ts
await vault.secret.kv.v2.delete('secret-v2', 'apps/demo').unwrap();
```

</details>

<details id="secretkvv2list" markdown="1">
<summary><code>secret.kv.v2.list</code></summary>

List keys from KV v2 metadata.

Signatures:

- `secret.kv.v2.list(mount, path?)`

Example:

```ts
const keys = await vault.secret.kv.v2.list('secret-v2', 'apps').unwrap();
```

</details>

<details id="secretkvv2read" markdown="1">
<summary><code>secret.kv.v2.read</code></summary>

Read a KV v2 secret with data and version metadata.

Signatures:

- `secret.kv.v2.read<T>(mount, path, options?)`

Example:

```ts
const secret = await vault.secret.kv.v2.read<{ foo: string }>('secret-v2', 'apps/demo').unwrap();
```

</details>

<details id="secretkvv2write" markdown="1">
<summary><code>secret.kv.v2.write</code></summary>

Write a KV v2 secret, optionally using check-and-set.

Signatures:

- `secret.kv.v2.write(mount, path, payload, options?)`

Example:

```ts
await vault.secret.kv.v2.write('secret-v2', 'apps/demo', {
    foo: 'bar',
}, {
    cas: 1,
}).unwrap();
```

</details>

##### System / Mounts

<details id="sysmountdisable" markdown="1">
<summary><code>sys.mount.disable</code></summary>

Disable the secrets engine mounted at the given path.

Signatures:

- `sys.mount.disable(path)`

Example:

```ts
await vault.sys.mount.disable('secret').unwrap();
```

</details>

<details id="sysmountenable" markdown="1">
<summary><code>sys.mount.enable</code></summary>

Enable a secrets engine at the given mount path.

Signatures:

- `sys.mount.enable(path, payload)`

Example:

```ts
await vault.sys.mount.enable('secret', {
    type: 'kv',
}).unwrap();
```

</details>

##### System / Operator

<details id="sysinit" markdown="1">
<summary><code>sys.init</code></summary>

Initialize Vault and set the returned root token on the client.

Signatures:

- `sys.init(payload)`

</details>

<details id="sysunseal" markdown="1">
<summary><code>sys.unseal</code></summary>

Submit an unseal key to unseal Vault.

Signatures:

- `sys.unseal(payload)`

</details>

##### System

<details id="sysisinitialized" markdown="1">
<summary><code>sys.isInitialized</code></summary>

Check whether the Vault server has been initialized.

Signatures:

- `sys.isInitialized()`

Example:

```ts
const initialized = await vault.sys.isInitialized().unwrap();
```

</details>

<details id="sysisready" markdown="1">
<summary><code>sys.isReady</code></summary>

Check whether Vault is reachable and ready.

Signatures:

- `sys.isReady()`

Example:

```ts
const ready = await vault.sys.isReady().unwrap();
```

</details>

<details id="syssealstatus" markdown="1">
<summary><code>sys.sealStatus</code></summary>

Read Vault seal status.

Signatures:

- `sys.sealStatus()`

Example:

```ts
const status = await vault.sys.sealStatus().unwrap();
```

</details>

<details id="sysstatus" markdown="1">
<summary><code>sys.status</code></summary>

Read Vault health status.

Signatures:

- `sys.status()`

Example:

```ts
const status = await vault.sys.status().unwrap();
```

</details>

<!-- nanvc:client-structure:end -->

### Behavior Notes

- `secret.kv.v1.read()` currently returns the nested `data` object from Vault's secret read response.
- `sys.mount.enable()` normalizes leading slashes in mount paths.
- `secret.kv.v1.list()` supports both full paths and split `mount` / `path` arguments.
- `secret.kv.v2` is the dedicated helper for KV secrets engine version 2 route and payload semantics.
- `secret.kv.v2` intentionally covers the common read, write, list, and soft-delete workflow today; it is not a complete implementation of every KV v2 operation from the Vault OpenAPI specification. Use `RawVaultClient` for unsupported KV v2 endpoints.

### KV v1 Example

```ts
await vault.secret.kv.v1.write('secret', 'apps/demo', {
  foo: 'bar',
}).unwrap();

const secret = await vault.secret.kv.v1.read<{ foo: string }>('secret', 'apps/demo').unwrap();
const keys = await vault.secret.kv.v1.list('secret', 'apps').unwrap();

console.log(secret.foo);
console.log(keys);
```

### KV v2 Example

```ts
await vault.sys.mount.enable('secret-v2', {
  type: 'kv',
  options: {
    version: '2',
  },
}).unwrap();

await vault.secret.kv.v2.write('secret-v2', 'apps/demo', {
  foo: 'bar',
}, {
  cas: 1,
}).unwrap();

const secret = await vault.secret.kv.v2.read<{ foo: string }>('secret-v2', 'apps/demo').unwrap();
const keys = await vault.secret.kv.v2.list('secret-v2', 'apps').unwrap();

console.log(secret.data.foo);
console.log(secret.metadata.version);
console.log(keys);
```

## `RawVaultClient`

Use `RawVaultClient` when you want lower-level control over HTTP method, path templating, headers, query parameters, and request bodies.

### Methods

- `request(method, path, config)`
- `get(path, config)`
- `list(path, config)`
- `post(path, config)`
- `put(path, config)`
- `delete(path, config)`

### Typed overloads

For supported generated OpenAPI paths, methods have typed overloads that infer:

- the allowed path
- request body shape
- query/path params
- success response type

For unknown or custom paths, the raw client falls back to a generic overload that accepts any string path.

### Example

```ts
const raw = new RawVaultClient({
  clusterAddress: 'http://vault.local:8200',
  authToken: process.env.NANVC_VAULT_AUTH_TOKEN ?? null,
});

const data = await raw.get('/sys/seal-status').unwrap();

console.log(data.sealed);
```

### Path templating

`RawVaultClient` resolves template placeholders using `params.path`.

Example:

```ts
await raw.post('/sys/mounts/{path}', {
  body: { type: 'kv' },
  params: {
    path: {
      path: 'secret',
    },
  },
});
```

If a required path parameter is missing, the client throws a `VaultClientError` with code `VALIDATION_ERROR`.

## Error Type

V2 uses a structured `VaultClientError` with fields such as:

- `code`
- `message`
- `status`
- `responseBody`
- `details`
- `cause`

See [Error Handling]({{'/error-handling/' | relative_url}}) for more detail.

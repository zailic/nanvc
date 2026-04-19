---
layout: page
title: API v1
---

The original `VaultClient` is exported as the package default and also as a named export.

Here, `API v1` means the original `nanvc` client surface, not a Vault API version label.

```ts
import VaultClient from 'nanvc';
```

## Constructor

The constructor supports both positional arguments and an object form.

### Positional

```ts
const vault = new VaultClient(clusterAddress, authToken, apiVersion);
```

### Object form

```ts
const vault = new VaultClient({
  clusterAddress: 'https://vault.local:8200',
  authToken: 'token',
  apiVersion: 'v1',
  tls: {
    ca: '...',
    cert: '...',
    key: '...',
    rejectUnauthorized: true,
  },
});
```

## Properties

- `clusterAddress`
- `apiVersion`
- `token`

`token` can be updated after initialization:

```ts
vault.token = appToken;
```

## Response Model

Every method resolves to a `VaultResponse` object with:

- `succeeded`
- `httpStatusCode`
- `apiResponse`
- `errorMessage`

Typical pattern:

```ts
const response = await vault.read('/secret/my-app/my-secret');

if (!response.succeeded) {
  throw new Error(response.errorMessage ?? 'Vault request failed');
}

console.log(response.apiResponse);
```

## Implemented Methods

### Secret operations

- `read(path)`
- `write(path, payload)`
- `update(path, payload)`
- `delete(path)`
- `list(path)`

### Initialization and seal management

- `isInitialized()`
- `init(payload)`
- `seal()`
- `status()`
- `unseal(payload)`

### Mounts

- `mount(path, payload)`
- `mounts()`
- `unmount(path)`
- `remount(payload)`

### Audits

- `audits()`
- `auditHash(path, payload)`
- `enableAudit(path, payload)`
- `disableAudit(path)`

### Auth backends

- `auths()`
- `enableAuth(path, payload)`
- `disableAuth(path)`

### Policies

- `policies()`
- `addPolicy(name, payload)`
- `removePolicy(name)`

## Notes

- Request payload validation is performed with `tv4` where a command spec includes a request schema.
- Transport failures and validation failures are surfaced through `errorMessage`.
- This client is stable and broad within the currently implemented subset of Vault endpoints.

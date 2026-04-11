# nanvc

[![build status](https://github.com/zailic/nanvc/actions/workflows/main.yaml/badge.svg)](https://github.com/zailic/nanvc/actions/workflows/main.yaml)
[![code coverage](https://codecov.io/gh/zailic/nanvc/branch/master/graph/badge.svg?token=DWUB3ADSQG)](https://codecov.io/gh/zailic/nanvc)

`nanvc` is a small TypeScript client for the HashiCorp Vault HTTP API.

## Requirements

- Node.js `>= 20`
- npm

## Install

```bash
npm install nanvc
```

## Usage

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

### CommonJS

```js
const VaultClient = require('nanvc');

const vault = new VaultClient('http://vault.local:8200');
```

### TypeScript / ESM

```ts
import VaultClient from 'nanvc';

const vault = new VaultClient('http://vault.local:8200');

async function main(): Promise<void> {
    const initResponse = await vault.init({
        secret_shares: 1,
        secret_threshold: 1,
    });

    if (!initResponse.succeeded || !initResponse.apiResponse) {
        throw new Error(initResponse.errorMessage ?? 'Vault init failed');
    }

    const initData = initResponse.apiResponse as {
        keys: string[];
        root_token: string;
    };

    vault.token = initData.root_token;

    await vault.unseal({
        key: initData.keys[0],
    });

    await vault.write('/secret/my-app/my-secret', {
        foo: 'my-password',
    });

    const secretResponse = await vault.read('/secret/my-app/my-secret');
    console.log(secretResponse.apiResponse);
}

main().catch(console.error);
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

Implemented client methods:

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

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

### Test commands

```bash
npm run test:unit
npm run test:integration
npm run test:all
```

The test flow compiles test files into `.test-dist` before running Mocha.

### Integration tests

Integration tests expect local Vault-related services from `docker-compose.yml`:

```bash
npm run test:integration:prepare
docker compose up -d
npm run test:integration
```

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
test/
```

The `src/lib/commands` layer defines the command specs and payload types used by `VaultClient`.

## Status

This library covers a focused subset of the Vault API, mainly:

- secret CRUD operations
- initialization and seal management
- mounts
- audits
- auth backends
- policies
- remount

It does not aim to expose the full Vault API surface yet.

## License

MIT

---
layout: page
title: Examples
description: Runnable Vault workflows that demonstrate practical nanvc usage.
---

These examples are generated from `examples/*/README.md` and are designed to run against the local Vault service from the repository root.

## Available Examples

### [AppRole example with VaultClient](./app-role-v1/)

This example mirrors the AppRole workflow using the original v1 client.

```bash
npx tsx examples/app-role-v1/main.ts
```

### [AppRole example with VaultClientV2](./app-role/)

This example demonstrates an AppRole flow with the v2 client:

```bash
npx tsx examples/app-role/main.ts
```

### [Request wrapping example with VaultClientV2](./request-wrapping/)

This example demonstrates an AppRole flow where the admin wraps the generated role_id and secret_id, then the app unwraps them before logging in:

```bash
npx tsx examples/request-wrapping/main.ts
```

### [Versioned KV example with VaultClientV2](./versioned-kv/)

This example walks through the core features of the KV v2 secrets engine using the nanvc v2 client.

```bash
npx tsx examples/versioned-kv/main.ts
```

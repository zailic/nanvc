---
layout: page
title: Examples
description: Runnable Vault workflows that demonstrate practical nanvc usage.
---

These examples are generated from `examples/*/README.md` and are designed to run against the local Vault service from the repository root.

## Available Examples

### [AppRole example with VaultClient](./app-role-v1/)

This example mirrors the AppRole authentication flow with the original v1 client. It intentionally uses KV v1 at the secret mount so the code can show the legacy client's native write and read calls.

```bash
npx tsx examples/app-role-v1/main.ts
```

### [AppRole example with VaultClientV2](./app-role/)

This example demonstrates a complete AppRole login flow with the typed v2 client.

```bash
npx tsx examples/app-role/main.ts
```

### [Database secrets engine with VaultClientV2](./database-secrets/)

This example demonstrates Vault's database secrets engine against the local PostgreSQL service from docker-compose.yml. It configures Vault database roles, generates dynamic PostgreSQL credentials for three different app personas, and then uses those credentials against the database.

```bash
npx tsx examples/database-secrets/main.ts
```

### [Request wrapping example with VaultClientV2](./request-wrapping/)

This example demonstrates an AppRole flow where the admin wraps the generated role_id and secret_id, then the app unwraps them before logging in.

```bash
npx tsx examples/request-wrapping/main.ts
```

### [Versioned KV example with VaultClientV2](./versioned-kv/)

This example walks through the core features of the KV v2 secrets engine using the typed nanvc v2 client.

```bash
npx tsx examples/versioned-kv/main.ts
```

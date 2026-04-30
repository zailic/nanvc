---
layout: home
title: Home
---

# nanvc

`nanvc` is a small TypeScript client for the HashiCorp Vault HTTP API.

This documentation is organized around the two client styles currently exposed by the package:

- `VaultClient`: the original command-spec based client
- `VaultClientV2`: the newer typed client built on top of `RawVaultClient`

`API v1` and `API v2` in this documentation refer to the two `nanvc` client generations, not to Vault's HTTP API version.
Vault API versioning is configured separately through options like `apiVersion: 'v1'`.

## What This Documentation Covers

Use this site if you want to:

- install and configure `nanvc`
- choose between the v1 and v2 APIs
- understand how responses and errors are represented
- run the test suite locally
- contribute code or documentation

## Quick Links

- [Getting Started](./getting-started/)
- [Examples](./examples/)
- [API Reference: VaultClient](./api-v1/)
- [API Reference: VaultClientV2 and RawVaultClient](./api-v2/)
- [Error Handling](./error-handling/)
- [Contributing](./contributing/)

## Current Scope

The library intentionally covers a focused subset of the Vault API, mainly:

- secret CRUD operations
- initialization and seal management
- mounts/remounts
- auth backends
- policies
- audits

It does not aim to expose the full Vault API surface yet.

`secret.kv.v2` covers the common KV v2 read/write/list/delete workflow, but it is not a complete implementation of every KV v2 operation from the Vault OpenAPI specification. Use `RawVaultClient` for unsupported KV v2 endpoints.

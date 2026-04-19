---
layout: page
title: Contributing
---

Thank you for contributing to `nanvc`.

## Local Setup

```bash
npm install
npm run generate:v2:openapi
npm run generate:v2:docs
npm run typecheck
npm run lint
npm test
```

## Build

```bash
npm run build
```

## Test Commands

### Unit tests

```bash
npm run test:unit
```

### Integration tests

```bash
npm run test:integration:prepare
docker compose up -d
npm run test:integration
```

### Run legacy and v2 integration suites safely

```bash
npm run test:integration:all
```

That command:

- regenerates local TLS fixtures
- recreates the Docker stack
- runs the legacy integration suite
- recreates the Docker stack again
- runs the v2 integration suite

### Coverage

```bash
npm run coverage
```

Coverage uses the same reset boundary as the full integration suite. It keeps
nyc's raw coverage data across separate test commands, resets Docker before the
legacy integration suite, resets Docker again before the v2 suite, and writes
the final report after all suites finish.

## Project Structure

```text
src/
  lib/
    client.ts
    commands/
  v2/
    client/
    core/
    generated/
    transport/
openapi/
  targets/
  patches/
  vault-api-openapi.json
scripts/
  generate-v2-openapi-types.mjs
  generate-v2-docs.mjs
test/
  unit/
  integration/
```

## V2 OpenAPI Type Generation

The v2 raw client uses generated TypeScript types from a curated subset of the Vault OpenAPI snapshot.

The generator inputs live in `openapi/`:

- `openapi/vault-api-openapi.json` is the upstream Vault OpenAPI snapshot.
- `openapi/targets/*.js` declares which paths and schemas are emitted.
- `openapi/patches/*.js` contains local schema or response patches for gaps in the upstream snapshot.

When adding support for a new generated path:

1. Add the path and schemas to the relevant `openapi/targets/*.js` domain module.
2. Add a patch in `openapi/patches/*.js` only when the upstream response/schema is incomplete.
3. Run `npm run generate:v2:openapi`.
4. Commit the generated `src/v2/generated/vault-openapi.ts` changes.

See `openapi/README.md` for the full target and patch format.

## V2 API Documentation Generation

The v2 client structure section in `docs/api-v2.md` is generated from `@nanvc-doc` blocks in `src/v2/client/**/*.ts`.

When adding or changing a public shorthand method, add or update its doc block near the implementation:

```ts
/**
 * @nanvc-doc
 * id: auth.loginWithAppRole
 * category: Auth / AppRole
 * summary: Authenticate with AppRole credentials and set the returned client token on the client.
 * signatures:
 *   - auth.loginWithAppRole(payload)
 *   - auth.loginWithAppRole(mount, payload)
 * example: |
 *   const login = await vault.auth.loginWithAppRole({
 *       role_id: roleId,
 *       secret_id: secretId,
 *   }).unwrap();
 * @end-nanvc-doc
 */
```

Then run:

```bash
npm run generate:v2:docs
```

The generator updates only the marked section between:

```md
<!-- nanvc:client-structure:start -->
<!-- nanvc:client-structure:end -->
```

Do not manually edit generated content between those markers.

## Contribution Guidelines

When contributing code:

- preserve the public API unless the change is intentional and documented
- add or update unit tests for behavior changes
- add integration tests when transport behavior or Vault interactions change
- add or update `@nanvc-doc` blocks for public v2 shorthand methods
- run `npm run generate:v2:openapi` when OpenAPI targets or patches change
- run `npm run generate:v2:docs` when v2 shorthand docs change
- avoid broad refactors in the same change as a functional fix
- keep docs in sync with exported behavior

## Documentation Guidelines

Please update docs when you:

- add a new public method
- add or change a v2 shorthand method
- change constructor options
- change the result or error model
- add a new testing workflow
- deprecate an old usage pattern

For v2 shorthand methods, prefer updating the `@nanvc-doc` block and regenerating docs instead of editing the generated `Client Structure` section directly.

## Release-Oriented Checklist

Before opening a PR, it is helpful to confirm:

- `npm run generate:v2:openapi` if OpenAPI inputs changed
- `npm run generate:v2:docs` if v2 client docs changed
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- the relevant integration test command for your change

## Areas That Need Particular Care

- path normalization and path template handling
- differences between the original client and the v2 client
- TLS and mTLS behavior
- keeping generated OpenAPI-derived typings aligned with the handwritten wrapper logic
- keeping `@nanvc-doc` blocks aligned with public v2 shorthand behavior
- unauthenticated Vault operations marked by `x-vault-unauthenticated` in the OpenAPI snapshot

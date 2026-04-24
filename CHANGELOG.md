# Changelog

All notable changes to this project will be documented in this file.
The format is inspired by Keep a Changelog, with the current work tracked under `Unreleased` until you decide the next version number.

## Unreleased

### Added

- Added optional request lifecycle logging configured with `NANVC_LOG_LEVEL`.
- Added `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` to document contribution expectations and community standards.
- Added README links to the changelog and maintained AppRole examples.
- Added a docs favicon and npm icon link in the documentation footer.
- Added a generated documentation changelog page sourced from the root `CHANGELOG.md`.
- Added focused v2 unit coverage for `Result` helpers, Node transport request shaping, auth edge cases, system helpers, and KV v1/v2 error handling.

### Changed

- Trimmed development and project layout details from the README in favor of the dedicated contributing guide.
- Updated the package homepage to the GitHub Pages documentation site.
- Updated the GitHub Pages workflow to generate the docs changelog before building.
- Changed v2 AppRole login, KV v1 helpers, and high-level KV shortcut validation to return `VaultClientError` results instead of throwing synchronous exceptions.

## 2.0.0 - 2026-04-20

### Added

- Added the v2 client surface built around `VaultClientV2`, `RawVaultClient`, structured `VaultClientError`, and Rust-inspired promise-like `Result<T>` helpers.
- Added typed v2 support for common Vault workflows, including:
  - system health, readiness, mount, init, and unseal helpers
  - auth method and AppRole helpers
  - KV v1 helpers
  - common KV v2 helpers for read, write, list, and soft-delete
- Added Vault CLI-style KV shortcuts on `VaultClientV2`: `read`, `write`, `delete`, and `list`, defaulting to KV v1 with explicit `{ engineVersion: 2 }` support for KV v2.
- Added `RawVaultClient` typed overloads generated from selected Vault OpenAPI paths, plus the OpenAPI target and generation scripts.
- Added dedicated v2 unit and integration test coverage.
- Added GitHub Pages documentation under `docs/`, including Getting Started, API v1/v2 references, error handling, and contributing guidance.
- Added AppRole examples for both client generations:
  - `examples/app-role` for `VaultClientV2`
  - `examples/app-role-v1` for the original `VaultClient`
- Added README files for each AppRole example with local Docker Compose setup and run instructions.
- Added a GitHub Pages workflow for publishing the documentation site.

### Changed

- Updated package metadata and README positioning around a focused TypeScript Vault client, with `VaultClientV2` documented as the forward-looking client.
- Renamed v2 constructor options to align with the original client: `clusterAddress` and `authToken`.
- Refocused documentation examples on application workflows with an existing token instead of promoting Vault initialization and unseal flows as first-contact examples.
- Moved operator-oriented v2 system methods such as init and unseal into a separate generated docs category.
- Documented that `secret.kv.v2` intentionally covers the common KV v2 workflow and is not a complete implementation of every KV v2 OpenAPI operation.
- Expanded documentation footer, navigation, and project links for users arriving from GitHub or npm.
- Updated `.npmignore` for the current docs, examples, OpenAPI, and tooling layout.
- Updated CI and publish workflows so integration and coverage scripts own their own Docker setup/reset lifecycle.
- Updated coverage collection so unit, legacy integration, and v2 integration suites run as separate nyc-wrapped commands while preserving raw coverage data until the final report.
- Updated integration coverage to reset Docker-backed Vault state between the legacy and v2 integration suites.

### Removed

- Removed the old `src/example.ts` example in favor of maintained examples under `examples/`.

## 1.2.0 - 2026-04-12

### Added

- Added a dedicated command barrel in [src/lib/commands/index.ts](src/lib/commands/index.ts) so `VaultClient` can consume a single export surface.
- Added modern project configs for build and test workflows:
  - [tsconfig.build.json](tsconfig.build.json)
  - [test/tsconfig.json](test/tsconfig.json)
  - [.mocharc.json](.mocharc.json)
  - [eslint.config.mjs](eslint.config.mjs)
- Added package `exports` and `files` metadata in [package.json](package.json).
- Added optional HTTPS TLS client configuration to [src/lib/client.ts](src/lib/client.ts), including support for custom CA-only setups and full mTLS with `ca`, `cert`, `key`, `passphrase`, and `rejectUnauthorized`.
- Added exported `VaultClientOptions` and `VaultClientTlsOptions` types from [src/main.ts](src/main.ts).
- Added TLS integration fixtures and tests covering custom-CA HTTPS and required-client-cert mTLS Vault listeners.

### Changed

- Refactored the internal command definition layer from `metadata` to `commands`.
- Renamed command definition types:
  - `VaultCommandMetadata` -> `VaultCommandSpec`
  - `VaultCommandValidationSchema` -> `VaultCommandSchema`
- Renamed command definition values to `*Spec` naming, for example:
  - `VaultReadSecretCommandMetadata` -> `readSecretSpec`
  - `VaultUnsealCommandMetadata` -> `unsealSpec`
- Modernized [src/lib/client.ts](src/lib/client.ts):
  - replaced constructor-time prototype mutation with explicit typed instance methods
  - tightened request and error handling types
  - normalized URL joining and placeholder resolution
  - restored explicit `addPolicy` and `removePolicy` client methods
  - added an object-based constructor path for optional TLS transport configuration while keeping the legacy positional constructor working
  - switched request transport handling to Node HTTP/HTTPS so custom TLS settings can be applied only when needed
- Modernized shared response and command typing in [src/lib/commands/spec.ts](src/lib/commands/spec.ts).
- Updated TypeScript configuration to modern Node settings:
  - `module` and `moduleResolution` now use `Node16`
  - stricter compiler settings are enabled for library code
  - test code uses a more permissive config where needed
- Updated the toolchain in [package.json](package.json):
  - Node engine raised to `>=20`
  - TypeScript upgraded to `^6.0.0`
  - ESLint moved to flat config
  - Mocha/test scripts updated for the compiled test flow
- Refreshed [README.md](README.md) to match the current API, tooling, and project structure.
- Extended [README.md](README.md) with HTTPS custom CA and optional mTLS examples for `VaultClient`.
- Extended [README.md](README.md) with the TLS integration test setup and fixture endpoints.
- Updated [docker-compose.yml](docker-compose.yml) by removing the obsolete top-level Compose version declaration.
- Synced [.npmignore](.npmignore) with the current project layout and tooling files.

### Fixed

- Fixed unit tests so `npm test` and `npm run test:unit` pass again under the modernized TypeScript and Node setup.
- Fixed IDE TypeScript project warnings for test files by adding [test/tsconfig.json](test/tsconfig.json) and setting an explicit `rootDir`.
- Fixed test compilation issues caused by stricter `unknown` response typing in integration tests.
- Fixed deprecated TypeScript config usage by replacing the old `node`/`node10` resolver behavior with `Node16`.
- Fixed package-publish ignore rules so current local tooling and repo-only files are excluded consistently with the new build layout.
- Fixed the changelog config references to match the actual test TypeScript setup in the repo.

### Removed

- Removed the legacy `.eslintrc.js` configuration in favor of flat config.
- Removed the old `src/lib/metadata` tree after migrating its contents to `src/lib/commands`.
- Removed the old intermediate command registry file [src/lib/constants.ts](src/lib/constants.ts) in favor of the commands barrel.

### Notes

- Integration tests now compile and start correctly, but still require local Docker-backed Vault/Postgres services to pass end to end.
- If you cut a release from this work, the next step would be to replace `Unreleased` with the actual version number and release date.

# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, with the current work tracked under `Unreleased` until you decide the next version number.

## [Unreleased] - 2026-04-11

### Added

- Added a dedicated command barrel in [src/lib/commands/index.ts](/Users/ionut/Projects/zailic/nanvc/src/lib/commands/index.ts) so `VaultClient` can consume a single export surface.
- Added modern project configs for build and test workflows:
  - [tsconfig.build.json](/Users/ionut/Projects/zailic/nanvc/tsconfig.build.json)
  - [test/tsconfig.json](/Users/ionut/Projects/zailic/nanvc/test/tsconfig.json)
  - [.mocharc.json](/Users/ionut/Projects/zailic/nanvc/.mocharc.json)
  - [eslint.config.mjs](/Users/ionut/Projects/zailic/nanvc/eslint.config.mjs)
- Added a compiled test flow that emits to `.test-dist` before running Mocha.
- Added package `exports` and `files` metadata in [package.json](/Users/ionut/Projects/zailic/nanvc/package.json).
- Added optional HTTPS TLS client configuration to [src/lib/client.ts](/Users/ionut/Projects/zailic/nanvc/src/lib/client.ts), including support for custom CA-only setups and full mTLS with `ca`, `cert`, `key`, `passphrase`, and `rejectUnauthorized`.
- Added exported `VaultClientOptions` and `VaultClientTlsOptions` types from [src/main.ts](/Users/ionut/Projects/zailic/nanvc/src/main.ts).
- Added TLS integration fixtures and tests covering custom-CA HTTPS and required-client-cert mTLS Vault listeners.

### Changed

- Refactored the internal command definition layer from `metadata` to `commands`.
- Renamed command definition types:
  - `VaultCommandMetadata` -> `VaultCommandSpec`
  - `VaultCommandValidationSchema` -> `VaultCommandSchema`
- Renamed command definition values to `*Spec` naming, for example:
  - `VaultReadSecretCommandMetadata` -> `readSecretSpec`
  - `VaultUnsealCommandMetadata` -> `unsealSpec`
- Modernized [src/lib/client.ts](/Users/ionut/Projects/zailic/nanvc/src/lib/client.ts):
  - replaced constructor-time prototype mutation with explicit typed instance methods
  - tightened request and error handling types
  - normalized URL joining and placeholder resolution
  - restored explicit `addPolicy` and `removePolicy` client methods
  - added an object-based constructor path for optional TLS transport configuration while keeping the legacy positional constructor working
  - switched request transport handling to Node HTTP/HTTPS so custom TLS settings can be applied only when needed
- Modernized shared response and command typing in [src/lib/commands/spec.ts](/Users/ionut/Projects/zailic/nanvc/src/lib/commands/spec.ts).
- Updated TypeScript configuration to modern Node settings:
  - `module` and `moduleResolution` now use `Node16`
  - stricter compiler settings are enabled for library code
  - test code uses a more permissive config where needed
- Updated the toolchain in [package.json](/Users/ionut/Projects/zailic/nanvc/package.json):
  - Node engine raised to `>=20`
  - TypeScript upgraded to `^6.0.0`
  - ESLint moved to flat config
  - Mocha/test scripts updated for the compiled test flow
- Refreshed [README.md](/Users/ionut/Projects/zailic/nanvc/README.md) to match the current API, tooling, and project structure.
- Extended [README.md](/Users/ionut/Projects/zailic/nanvc/README.md) with HTTPS custom CA and optional mTLS examples for `VaultClient`.
- Extended [README.md](/Users/ionut/Projects/zailic/nanvc/README.md) with the TLS integration test setup and fixture endpoints.
- Updated [docker-compose.yml](/Users/ionut/Projects/zailic/nanvc/docker-compose.yml) by removing the obsolete top-level Compose version declaration.
- Synced [.npmignore](/Users/ionut/Projects/zailic/nanvc/.npmignore) with the current project layout and tooling files.

### Fixed

- Fixed unit tests so `npm test` and `npm run test:unit` pass again under the modernized TypeScript and Node setup.
- Fixed IDE TypeScript project warnings for test files by adding [test/tsconfig.json](/Users/ionut/Projects/zailic/nanvc/test/tsconfig.json) and setting an explicit `rootDir`.
- Fixed test compilation issues caused by stricter `unknown` response typing in integration tests.
- Fixed deprecated TypeScript config usage by replacing the old `node`/`node10` resolver behavior with `Node16`.
- Fixed package-publish ignore rules so current local tooling and repo-only files are excluded consistently with the new build layout.
- Fixed the changelog config references to match the actual test TypeScript setup in the repo.

### Removed

- Removed the legacy `.eslintrc.js` configuration in favor of flat config.
- Removed the old `src/lib/metadata` tree after migrating its contents to `src/lib/commands`.
- Removed the old intermediate command registry file [src/lib/constants.ts](/Users/ionut/Projects/zailic/nanvc/src/lib/constants.ts) in favor of the commands barrel.

### Notes

- Integration tests now compile and start correctly, but still require local Docker-backed Vault/Postgres services to pass end to end.
- If you cut a release from this work, the next step would be to replace `Unreleased` with the actual version number and release date.

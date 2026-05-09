# Examples

This directory contains runnable Vault workflows that demonstrate practical
`nanvc` usage. Each example keeps its domain-specific guide in its own
`README.md`, while the shared execution model lives here.

## Example mini-framework

The examples are orchestrated by a small decorator-based framework in
`examples/common/workflow/decorators.ts`. An example is a class whose methods
are registered as ordered steps:

- `@example(name)` gives the example a display name for runner output.
- `@workflow(personaName, name)` registers a method as a workflow step.
- `@runAs({ persona, version })` tells the runner which persona and client
  version to use for that workflow.
- `runExample(ExampleClass)` initializes Vault, creates the example instance,
  executes setup/workflow/cleanup steps, resets root tokens between persona
  runs, and prints the success banner.

The runner creates a shared context with a root `VaultClientV2`. When a v1
workflow is requested with `@runAs({ version: 'v1' })`, it also creates a legacy
`VaultClient` backed by the same initialized Vault instance.

## Personas

Personas live in `examples/common/personas` and keep repeated Vault setup out of
each example:

- `OperatorPersona` handles infrastructure-style setup such as ensuring a KV
  mount exists.
- `AdminPersona` configures Vault features such as policies, AppRoles, and
  AppRole credentials.
- `AppPersona` starts from an unauthenticated client and models application
  behavior such as logging in and reading secrets.

Each persona has a v2 factory and, where needed, a v1 factory:

```ts
OperatorPersona.v2();
AdminPersona.v2();
AppPersona.v2();

OperatorPersona.v1();
AdminPersona.v1();
AppPersona.v1();
```

## Vault initialization

`runExample()` uses `test/helpers/vault.ts` to prepare the local Vault server.
The helper:

- reads the Vault address from `TEST_NANVC_VAULT_CLUSTER_ADDRESS`,
  `NANVC_VAULT_CLUSTER_ADDRESS`, or the default `http://vault.local:8200`
- initializes Vault when needed
- unseals Vault when needed
- caches the root token and unseal key under your OS temp directory
- restores the root token after each persona workflow

When `vault.local` is not mapped on your machine, run examples with:

```bash
NANVC_VAULT_CLUSTER_ADDRESS=http://127.0.0.1:8200 npx tsx examples/<name>/main.ts
```

## Available examples

- `app-role` demonstrates AppRole authentication with `VaultClientV2`.
- `app-role-v1` demonstrates the same flow with the original `VaultClient`.
- `request-wrapping` demonstrates wrapped AppRole credential delivery.
- `database-secrets` demonstrates dynamic PostgreSQL credentials.
- `versioned-kv` demonstrates the KV v2 versioning API.

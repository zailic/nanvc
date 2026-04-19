---
layout: page
title: Error Handling
---

The package currently exposes two error handling styles, one for each client generation.

## `VaultClient` Errors

The original client does not throw typed client errors for normal failed requests. Instead, methods resolve to a `VaultResponse`.

Check:

- `succeeded`
- `httpStatusCode`
- `errorMessage`

Example:

```ts
const response = await vault.mount('secret', { type: 'kv' });

if (!response.succeeded) {
  console.error(response.httpStatusCode);
  console.error(response.errorMessage);
}
```

### Sources of failure

For `VaultClient`, failures can come from:

- request validation failures from `tv4`
- HTTP responses outside the expected success codes
- transport-level request errors
- response parsing fallbacks

These are collapsed into `errorMessage` rather than a structured error object.

## `VaultClientV2` and `RawVaultClient` Errors

The v2 API uses `VaultClientError`.

Its `Result<T>` shape and helper names are intentionally inspired by Rust's
`Result` type. This is a TypeScript-friendly adaptation, not a full Rust-style
type system: you can await the value as a tuple, or use helpers such as
`.unwrap()`, `.unwrapOr()`, `.unwrapOrElse()`, `.unwrapErr()`, and `.intoErr()`.

### Error shape

`VaultClientError` includes:

- `code`
- `message`
- `status`
- `responseBody`
- `details`
- `cause`

### Error codes

The current known codes are:

- `HTTP_ERROR`
- `NETWORK_ERROR`
- `TIMEOUT`
- `VALIDATION_ERROR`
- `SERIALIZATION_ERROR`
- `UNKNOWN_ERROR`

### Tuple style

V2 returns errors in the second tuple slot:

```ts
const [data, error] = await vault.read('/secret/my-app/my-secret');

if (error) {
  console.error(error.code);
  console.error(error.message);
  console.error(error.status);
  return;
}

console.log(data);
```

### Built-in Result Helpers

V2 `Result` objects also include helper methods.

`.unwrap()` returns the success value directly and throws the underlying `VaultClientError` on failure:

```ts
const secret = await vault.read('/secret/my-app/my-secret').unwrap();

console.log(secret);
```

`.unwrapOr(defaultValue)` returns a fallback on failure:

```ts
const secret = await vault.read('/secret/my-app/my-secret').unwrapOr({
  foo: 'fallback',
});
```

`.unwrapOrElse(fn)` computes a fallback from the error:

```ts
const secret = await vault.read('/secret/my-app/my-secret').unwrapOrElse((error) => {
  console.warn(error.code);
  return { foo: 'fallback' };
});
```

`.unwrapErr()` returns the error when failure is expected and throws if the result was successful:

```ts
const error = await vault.read('/secret/my-app/missing').unwrapErr();

console.log(error.status);
```

`.intoErr()` returns the error without throwing, or `null` on success:

```ts
const error = await vault.read('/secret/my-app/my-secret').intoErr();

if (error) {
  console.error(error.message);
}
```

### Suggested handling

Treat error codes differently depending on intent:

- `HTTP_ERROR`: inspect `status` and `responseBody`
- `NETWORK_ERROR`: retry or surface connectivity guidance
- `TIMEOUT`: retry with backoff or increase timeout
- `VALIDATION_ERROR`: fix client-side path or payload construction
- `UNKNOWN_ERROR`: log the full error and preserve `cause`

### Recommended application pattern

Use tuple destructuring when:

- you want to handle success and failure explicitly in the same branch
- you want to inspect the error without throwing

Use `.unwrap()` when:

- you prefer exception-style control flow
- the surrounding function already uses `try` / `catch`
- you want more concise example code

Use `.unwrapOr()` or `.unwrapOrElse()` when:

- you want a fallback value instead of branching
- the caller can continue with a default

Use `.unwrapErr()` or `.intoErr()` when:

- the error path is the thing you want to assert or inspect
- you are writing tests for expected failures

## Documentation Guidance for Contributors

When you add a new client method, document:

- whether it returns `VaultResponse` or `Result<T>`
- what the success payload looks like
- whether the method narrows or reshapes Vault's raw response
- what failure mode users should expect

# OpenAPI Generator Inputs

This folder contains the source snapshot and generator configuration used by `scripts/generate-v2-openapi-types.mjs`.

## Structure

- `vault-api-openapi.json`
  The upstream Vault OpenAPI snapshot consumed by the generator.
- `targets/*.js`
  Domain-focused modules that declare which OpenAPI paths and component schemas should be emitted into `src/v2/generated/vault-openapi.ts`.
- `patches/*.js`
  Domain-focused modules for local schema and response patches used when the upstream snapshot is incomplete.

## Target Module Format

Each file in `targets/` should export:

```js
export const targetPaths = [
    {
        methods: ['get', 'post'],
        sourcePath: '/sys/example',
    },
];

export const targetSchemas = [
    'ExampleRequest',
    'ExampleResponse',
];
```

Rules:

- Group targets by domain or subclient such as `auth`, `sys`, or `kv-v2`.
- Keep `sourcePath` values exactly as they appear in `vault-api-openapi.json`.
- List only the HTTP methods that should be emitted into the generated `paths` interface.
- Add every referenced component schema name needed by those paths unless it is supplied locally from a `patches/*.js` module.
- Keep modules focused and small; prefer one file per domain instead of one file per endpoint.

Each file in `patches/` should export:

```js
export const schemaPatches = {
    ExampleResponse: {
        type: 'object',
    },
};

export const responsePatches = {
    '/sys/example': {
        get: {
            200: {
                $ref: '#/components/schemas/ExampleResponse',
            },
        },
    },
};
```

Rules:

- Match the same domain split used in `targets/` whenever possible.
- Export empty objects when a domain currently has no local patches.
- Use `schemaPatches` for locally defined component shapes.
- Use `responsePatches` only when the upstream path response is missing or needs a local override for generation.

## Updating The Generated Types

1. Update `vault-api-openapi.json` if the upstream snapshot changed.
2. Add or update the appropriate `targets/*.js` module.
3. If the upstream spec is incomplete for a needed response or schema, extend the appropriate `patches/*.js` domain module.
4. Run `npm run generate:v2:openapi`.
5. Run `npm run typecheck`.

## Notes

- The generator loads `targets/*.js` and `patches/*.js` dynamically in sorted filename order to keep output stable.
- `targetSchemas` from all modules are deduplicated before generation.
- If a declared path or schema is missing from the snapshot, the generator fails fast.

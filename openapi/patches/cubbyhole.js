// The upstream OpenAPI snapshot for GET /cubbyhole/{path} returns no response schema
// (just "200: OK"). We define a local schema that captures the Vault envelope shape
// observed during integration testing: a top-level `data` object containing
// the user-stored key/value pairs.
//
// Similarly, GET /cubbyhole/{path}/ (list) uses StandardListResponse which types
// `keys` at the top level, but Vault actually wraps it in a `data` envelope:
// { "data": { "keys": [...] } }. We define CubbyholeListResponse to reflect this.
export const schemaPatches = {
    CubbyholeReadResponse: {
        properties: {
            data: {
                additionalProperties: true,
                type: 'object',
            },
        },
        type: 'object',
    },
    CubbyholeListResponse: {
        properties: {
            data: {
                properties: {
                    keys: {
                        items: { type: 'string' },
                        type: 'array',
                    },
                },
                type: 'object',
            },
        },
        type: 'object',
    },
};

export const responsePatches = {
    '/cubbyhole/{path}': {
        get: {
            200: {
                $ref: '#/components/schemas/CubbyholeReadResponse',
            },
        },
    },
    '/cubbyhole/{path}/': {
        get: {
            200: {
                $ref: '#/components/schemas/CubbyholeListResponse',
            },
        },
    },
};

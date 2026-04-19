export const schemaPatches = {
    SecretReadResponse: {
        properties: {
            data: {
                additionalProperties: true,
                type: 'object',
            },
        },
        type: 'object',
    },
};

export const responsePatches = {
    '/{kv_v1_mount_path}/{path}': {
        get: {
            200: {
                $ref: '#/components/schemas/SecretReadResponse',
            },
        },
    },
};

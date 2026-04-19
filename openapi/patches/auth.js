export const schemaPatches = {
    AppRoleLoginResponse: {
        properties: {
            auth: {
                properties: {
                    accessor: {
                        type: 'string',
                    },
                    client_token: {
                        type: 'string',
                    },
                    lease_duration: {
                        type: 'integer',
                    },
                    metadata: {
                        additionalProperties: true,
                        type: 'object',
                    },
                    policies: {
                        items: {
                            type: 'string',
                        },
                        type: 'array',
                    },
                    renewable: {
                        type: 'boolean',
                    },
                    token_policies: {
                        items: {
                            type: 'string',
                        },
                        type: 'array',
                    },
                    token_type: {
                        type: 'string',
                    },
                },
                type: 'object',
            },
        },
        type: 'object',
    },
};

export const responsePatches = {
    '/auth/{approle_mount_path}/login': {
        post: {
            200: {
                $ref: '#/components/schemas/AppRoleLoginResponse',
            },
        },
    },
};

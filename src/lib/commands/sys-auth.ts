import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultAuthPayloadRequest {
    type: string;
    description?: string;
    config?: Record<string, unknown>;
    plugin_name?: string;
}

export const authSchema: VaultCommandSchema =  {
    req: {
        properties: {
            type: {
                type: 'string',
            },
            description: {
                type: 'string',
            },
            config: {
                type: 'object',
            },
            plugin_name: {
                type: 'string',
            },
        },
        required: ['type'],
    },
};

export const authsSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/auth',
    successCodes: [200],
};

export const enableAuthSpec: VaultCommandSpec = {
    method: 'POST',
    path: '/sys/auth/:path',
    schema: authSchema,
    successCodes: [204],
};

export const disableAuthSpec: VaultCommandSpec = {
    method: 'DELETE',
    path: '/sys/auth/:path',
    successCodes: [204],
};

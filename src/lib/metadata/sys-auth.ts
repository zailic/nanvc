import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultAuthPayloadRequest {
    type: string;
    description?: string;
    config?: object;
    plugin_name?: string;
}

export const VaultAuthJsonSchema: VaultCommandValidationSchema =  {
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

export const VaultAuthsCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/sys/auth',
    acceptedCodes: [200],
};

export const VaultEnableAuthCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/sys/auth/:path',
    schema: VaultAuthJsonSchema,
    acceptedCodes: [204],
};

export const VaultDisableAuthCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/sys/auth/:path',
    acceptedCodes: [204],
};
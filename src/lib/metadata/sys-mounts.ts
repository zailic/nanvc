import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultMountsPayloadRequest {
    type: string;
    description?: string;
    options?: VaultMountTypeConfig;
    plungin_name?: string;
    local?: boolean;
    seal_wrap?: boolean;
}

export interface VaultMountTypeConfig {
    default_lease_ttl?: string;
    max_lease_ttl?: string;
    force_no_cache?: string;
    plugin_name?: string;
}

export const VaultMountsJsonSchema: VaultCommandValidationSchema =  {
    req: {
        properties: {
            description: {
                type: 'string',
            },
            options: {
                type: 'object',
            },
            type: {
                type: 'string',
            },
            local: {
                type: 'boolean',
            },
        },
        required: ['type'],
    },
};

export const VaultMountsCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/sys/mounts',
    acceptedCodes: [200],
};

export const VaultMountCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/sys/mounts/:path',
    schema: VaultMountsJsonSchema,
    acceptedCodes: [204, 200],
};

export const VaultUnmountCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/sys/mounts/:path',
    acceptedCodes: [204],
};
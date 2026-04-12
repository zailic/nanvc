import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultMountsPayloadRequest {
    type: string;
    description?: string;
    options?: VaultMountTypeConfig;
    plugin_name?: string;
    plungin_name?: string;
    local?: boolean;
    seal_wrap?: boolean;
}

export interface VaultMountTypeConfig {
    default_lease_ttl?: string;
    max_lease_ttl?: string;
    force_no_cache?: boolean;
    plugin_name?: string;
}

export const mountsSchema: VaultCommandSchema =  {
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

export const mountsSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/mounts',
    successCodes: [200],
};

export const mountSpec: VaultCommandSpec = {
    method: 'POST',
    path: '/sys/mounts/:path',
    schema: mountsSchema,
    successCodes: [204, 200],
};

export const unmountSpec: VaultCommandSpec = {
    method: 'DELETE',
    path: '/sys/mounts/:path',
    successCodes: [204],
};

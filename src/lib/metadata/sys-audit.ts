import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultAuditPayloadRequest {
    description?: string;
    options?: object;
    type: string;
    local?: boolean;
}

export const VaultAuditJsonSchema: VaultCommandValidationSchema =  {
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

export const VaultAuditsCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/sys/audit',
    acceptedCodes: [200],
};

export const VaultEnableAuditCommandMetadata: VaultCommandMetadata = {
    method: 'PUT',
    path: '/sys/audit/:path',
    schema: VaultAuditJsonSchema,
    acceptedCodes: [204],
};

export const VaultDisableAuditCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/sys/audit/:path',
    acceptedCodes: [204],
};
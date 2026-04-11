import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultAuditPayloadRequest {
    description?: string;
    options?: Record<string, unknown>;
    type: string;
    local?: boolean;
}

export const auditSchema: VaultCommandSchema =  {
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

export const auditsSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/audit',
    successCodes: [200],
};

export const enableAuditSpec: VaultCommandSpec = {
    method: 'PUT',
    path: '/sys/audit/:path',
    schema: auditSchema,
    successCodes: [204],
};

export const disableAuditSpec: VaultCommandSpec = {
    method: 'DELETE',
    path: '/sys/audit/:path',
    successCodes: [204],
};

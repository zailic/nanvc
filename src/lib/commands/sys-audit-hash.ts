import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultAuditHashPayloadRequest {
    input: string;
}

export const auditHashSchema: VaultCommandSchema = {
    req: {
        properties: {
            input: { type: 'string' },
        },
        required: ['input'],
    },
};

export const auditHashSpec: VaultCommandSpec = {
    method: 'POST',
    path: '/sys/audit-hash/:path',
    schema: auditHashSchema,
    successCodes: [200],
};

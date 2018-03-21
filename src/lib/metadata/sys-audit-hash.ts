import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultAuditHashPayloadRequest {
    input: string;
}

export const VaultAuditHashJsonSchema: VaultCommandValidationSchema = {
    req: {
        properties: {
            input: { type: 'string' },
        },
        required: ['input'],
    },
};

export const VaultAuditHashCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/sys/audit-hash/:path',
    schema: VaultAuditHashJsonSchema,
    acceptedCodes: [200],
};
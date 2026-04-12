import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultUnsealPayloadRequest {
    key: string;
    reset?: boolean;
}

export const unsealSchema: VaultCommandSchema = {
    req: {
        properties: {
            key: { type: 'string' },
            reset: { type: 'boolean' },
        },
        required: ['key'],
    },
};

export const unsealSpec: VaultCommandSpec = {
    method: 'PUT',
    path: '/sys/unseal',
    schema: unsealSchema,
    successCodes: [200],
};

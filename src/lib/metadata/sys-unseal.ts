import { VaultCommandMetadata, VaultCommandValidationSchema } from "./common";

export interface VaultUnsealPayloadRequest {
    key: string;
    reset?: boolean;
}

export const VaultUnsealJsonSchema: VaultCommandValidationSchema = {
    req: {
        properties: {
            'key': { 'type': 'string' },
            'reset': { 'type': 'boolean' }
        },
        required: ['key']
    }
}

export const VaultUnsealCommandMetadata: VaultCommandMetadata = {
    method: 'PUT',
    path: '/sys/unseal',
    schema: VaultUnsealJsonSchema,
    acceptedCodes: [200]
}
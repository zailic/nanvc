import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultPolicyPayloadRequest {
    policy: string;
}

export const VaultPolicyJsonSchema: VaultCommandValidationSchema =  {
    req: {
        properties: {
            policy: {
                type: 'string',
            },
        },
        required: ['policy'],
    },
};

export const VaultPoliciesCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/sys/policy',
    acceptedCodes: [200],
};

export const VaultAddPolicyCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/sys/policy/:name',
    schema: VaultPolicyJsonSchema,
    acceptedCodes: [204],
};

export const VaultRemovePolicyCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/sys/policy/:path',
    acceptedCodes: [204],
};
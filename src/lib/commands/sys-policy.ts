import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultPolicyPayloadRequest {
    policy: string;
}

export const policySchema: VaultCommandSchema =  {
    req: {
        properties: {
            policy: {
                type: 'string',
            },
        },
        required: ['policy'],
    },
};

export const policiesSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/policy',
    successCodes: [200],
};

export const addPolicySpec: VaultCommandSpec = {
    method: 'POST',
    path: '/sys/policy/:name',
    schema: policySchema,
    successCodes: [204],
};

export const removePolicySpec: VaultCommandSpec = {
    method: 'DELETE',
    path: '/sys/policy/:name',
    successCodes: [204],
};

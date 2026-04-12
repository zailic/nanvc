import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultRemountPayloadRequest {
    from: string;
    to: string;
}

export const remountSchema: VaultCommandSchema =  {
    req: {
        properties: {
            from: {
                type: 'string',
            },
            to: {
                type: 'string',
            },
        },
        required: ['from', 'to'],
    },
};

export const remountSpec: VaultCommandSpec = {
    method: 'POST',
    path: '/sys/remount',
    successCodes: [200,204],
};

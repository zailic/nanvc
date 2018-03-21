import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export interface VaultRemountPayloadRequest {
    from: string;
    to: string;
}

export const VaultRemountJsonSchema: VaultCommandValidationSchema =  {
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

export const VaultRemountCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/sys/remount',
    acceptedCodes: [204],
};
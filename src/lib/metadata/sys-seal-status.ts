import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export const VaultStatusCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/sys/seal-status',
    acceptedCodes: [200],
};
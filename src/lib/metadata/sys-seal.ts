import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export const VaultSealCommandMetadata: VaultCommandMetadata = {
    method: 'PUT',
    path: '/sys/seal',
    acceptedCodes: [204],
};
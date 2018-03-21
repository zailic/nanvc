import { VaultCommandMetadata, VaultCommandValidationSchema } from './common';

export const VaultReadSecretCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/:path',
    acceptedCodes: [200],
};

export const VaultWriteSecretCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/:path',
    acceptedCodes: [204],
};

export const VaultUpdateSecretCommandMetadata: VaultCommandMetadata = {
    method: 'PUT',
    path: '/:path',
    acceptedCodes: [204],
};

export const VaultDeleteSecretCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/:path',
    acceptedCodes: [204],
};

export const VaultListCommandMetadata: VaultCommandMetadata = {
    method: 'LIST',
    path: '/:path',
    acceptedCodes: [200],
};
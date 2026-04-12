import type { VaultCommandSpec } from './spec.js';

export const readSecretSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/:path',
    successCodes: [200],
};

export const writeSecretSpec: VaultCommandSpec = {
    method: 'POST',
    path: '/:path',
    successCodes: [204],
};

export const updateSecretSpec: VaultCommandSpec = {
    method: 'PUT',
    path: '/:path',
    successCodes: [204],
};

export const deleteSecretSpec: VaultCommandSpec = {
    method: 'DELETE',
    path: '/:path',
    successCodes: [204],
};

export const listSecretsSpec: VaultCommandSpec = {
    method: 'LIST',
    path: '/:path',
    successCodes: [200],
};

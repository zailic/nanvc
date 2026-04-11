import type { VaultCommandSpec } from './spec.js';

export const sealSpec: VaultCommandSpec = {
    method: 'PUT',
    path: '/sys/seal',
    successCodes: [204],
};

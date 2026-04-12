import type { VaultCommandSpec } from './spec.js';

export const statusSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/seal-status',
    successCodes: [200],
};

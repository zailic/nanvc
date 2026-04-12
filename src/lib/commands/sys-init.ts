import type { VaultCommandSchema, VaultCommandSpec } from './spec.js';

export interface VaultInitPayloadRequest {
    pgp_keys?: Array<string>;
    root_token_pgp_key?: string;
    secret_shares: number;
    secret_threshold: number;
    stored_shares?: number;
    recovery_shares?: number;
    recovery_threshold?: number;
    recovery_pgp_keys?: Array<string>;
}

export const initSchema: VaultCommandSchema = {
    req: {
        properties: {
            pgp_keys: {
                type: 'array',
                items: { type: 'string' },
            },
            root_token_pgp_key: {type: 'string'},
            secret_shares: {type: 'integer'},
            secret_threshold: {type: 'integer'},
            stored_shares: {type: 'integer'},
            recovery_shares: {type: 'integer'},
            recovery_threshold: {type: 'integer'},
            recovery_pgp_keys: {
                type: 'array',
                items: { type: 'string' },
            },
        },
        required: ['secret_shares', 'secret_threshold'],
    },
};

export const isInitializedSpec: VaultCommandSpec = {
    method: 'GET',
    path: '/sys/init',
    successCodes: [200],
};

export const initSpec: VaultCommandSpec = {
    method: 'PUT',
    path: '/sys/init',
    schema: initSchema,
    successCodes: [200],
};

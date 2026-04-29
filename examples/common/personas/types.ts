import type VaultClient from '../../../src/main.js';
import type { VaultClientV2 } from '../../../src/main.js';

export type VaultClientVersion = 'v1' | 'v2';

export type VaultClientFor<V extends VaultClientVersion> = V extends 'v1'
    ? VaultClient
    : VaultClientV2;

export type PersonaOptions<V extends VaultClientVersion> = {
    client?: VaultClientFor<V>;
    envPath?: string;
};

export type VaultInitResponse = {
    keys: string[];
    root_token: string;
};

export type VaultResponseData<T> = {
    data?: T;
};

export type VaultLoginResponse = {
    auth?: {
        client_token?: string;
    };
};

export type AppRoleCredentials = {
    roleId: string;
    secretId: string;
};

export type AppRoleConfig = {
    token_max_ttl?: string;
    token_policies: string[];
    token_ttl?: string;
};

export type WorkflowContext<V extends VaultClientVersion> = {
    vault: VaultClientFor<V>;
};

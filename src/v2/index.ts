export type { Err, Ok, Result } from './core/result.js';
export type {
    VaultKvShortcutEngineVersion,
    VaultKvShortcutV1Options,
    VaultKvShortcutV2Options,
    VaultKvShortcutV2ReadOptions,
    VaultKvShortcutV2WriteOptions,
} from './client/vault-client.js';
export type {
    VaultInitRequest,
    VaultInitResponse,
    VaultMountRequest,
    VaultSealStatusResponse,
    VaultInitStatusResponse,
    VaultUnsealRequest,
    VaultUnsealResponse,
} from './client/sys.js';
export type {
    VaultKvV2GeneratedMetadataResponse,
    VaultKvV2GeneratedReadResponse,
    VaultKvV2GeneratedWriteRequest,
    VaultKvV2GeneratedWriteResponse,
    VaultKvV2ReadOptions,
    VaultKvV2ReadResponse,
    VaultKvV2VersionMetadata,
    VaultKvV2WriteOptions,
} from './client/secret-kv-v2.js';
export type {
    VaultAppRoleLoginRequest,
    VaultAppRoleLoginResponse,
    VaultAppRoleRequest,
    VaultAppRoleRoleIdRequest,
    VaultAppRoleRoleIdResponse,
    VaultAppRoleSecretIdRequest,
    VaultAppRoleSecretIdResponse,
    VaultAuthMethodRequest,
    VaultAuthReadConfigurationResponse,
} from './client/auth.js';
export { VaultClientError } from './transport/errors.js';
export type {
    VaultClientErrorCode,
    VaultClientErrorInput,
} from './transport/errors.js';
export type {
    VaultClientOptions,
    VaultRequestMethod,
    VaultRequestOptions,
    VaultTlsOptions,
    VaultTransportResponse,
} from './transport/types.js';

export { RawVaultClient } from './core/raw-client.js';
export { err, ok } from './core/result.js';
export { VaultClient as VaultClientV2 } from './client/vault-client.js';
export { VaultSecretKvV1Client } from './client/secret-kv-v1.js';
export { VaultSecretClient } from './client/secret.js';
export { VaultSystemClient, VaultSystemMountClient } from './client/sys.js';
export { VaultKvV2Client } from './client/secret-kv-v2.js';
export { VaultAuthClient } from './client/auth.js';

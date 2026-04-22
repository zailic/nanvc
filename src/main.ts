import { VaultClient } from './lib/client.js';
export default VaultClient;
export { VaultClient };
export type { VaultClientOptions, VaultClientTlsOptions } from './lib/client.js';
export { createLogger, createLoggerFromEnv } from './logger.js';
export type { NanvcLogger, NanvcLogLevel } from './logger.js';
export {
    RawVaultClient,
    VaultClientError,
    VaultClientV2,
    err,
    ok,
} from './v2/index.js';
export type {
    Err,
    Ok,
    Result,
    VaultClientErrorCode,
    VaultClientErrorInput,
    VaultInitRequest,
    VaultInitResponse,
    VaultInitStatusResponse,
    VaultKvShortcutEngineVersion,
    VaultKvShortcutV1Options,
    VaultKvShortcutV2Options,
    VaultKvShortcutV2ReadOptions,
    VaultKvShortcutV2WriteOptions,
    VaultKvV2GeneratedMetadataResponse,
    VaultKvV2GeneratedReadResponse,
    VaultKvV2GeneratedWriteRequest,
    VaultKvV2GeneratedWriteResponse,
    VaultKvV2ReadOptions,
    VaultKvV2ReadResponse,
    VaultKvV2VersionMetadata,
    VaultKvV2WriteOptions,
    VaultMountRequest,
    VaultSealStatusResponse,
    VaultUnsealRequest,
    VaultUnsealResponse,
} from './v2/index.js';
export type {
    VaultClientOptions as VaultClientV2Options,
    VaultRequestMethod,
    VaultRequestOptions,
    VaultTlsOptions as VaultClientV2TlsOptions,
    VaultTransportResponse,
} from './v2/index.js';

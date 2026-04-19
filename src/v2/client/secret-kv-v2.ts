import { normalize } from 'path';

import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../transport/errors.js';

export type VaultKvV2ReadOptions = {
    version?: number;
};

export type VaultKvV2WriteOptions = {
    /**
     * This flag is required if cas_required is set to true on either the secret or the engine's config.
     * If not set the write will be allowed. In order for a write to be successful, cas must be set to
     * the current version of the secret. If set to 0 a write will only be allowed if the key doesn't 
     * exist as unset keys do not have any version information. Also remember that soft deletes do not
     * remove any underlying version data from storage. In order to write to a soft deleted key, the cas
     * parameter must match the key's current version.
     */
    cas?: number;
};

export type VaultKvV2GeneratedReadResponse = components['schemas']['KvV2ReadResponse'];
export type VaultKvV2GeneratedWriteRequest = components['schemas']['KvV2WriteRequest'];
export type VaultKvV2GeneratedWriteResponse = components['schemas']['KvV2WriteResponse'];
export type VaultKvV2GeneratedMetadataResponse = components['schemas']['KvV2ReadMetadataResponse'];
export type VaultKvV2VersionMetadata = VaultKvV2GeneratedWriteResponse;

export type VaultKvV2ReadResponse<T> = {
    data: T;
    metadata: VaultKvV2VersionMetadata;
};

type VaultKvV2ReadEnvelope<T> = {
    data?: Omit<VaultKvV2GeneratedReadResponse, 'data' | 'metadata'> & {
        data?: T;
        metadata?: VaultKvV2VersionMetadata;
    };
};

type VaultKvV2ListEnvelope = components['schemas']['StandardListResponse'] | {
    data?: components['schemas']['StandardListResponse'];
};

export class VaultKvV2Client {
    constructor(private readonly raw: RawVaultClient) { }
    /**
     * @nanvc-doc
     * id: secret.kv.v2.delete
     * category: Secrets / KV v2
     * summary: Soft-delete the latest version of a KV v2 secret.
     * signatures:
     *   - secret.kv.v2.delete(mount, path)
     * example: |
     *   await vault.secret.kv.v2.delete('secret-v2', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public delete(mount: string, path: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/{kv_v2_mount_path}/data/{path}', {
                params: {
                    path: toKvV2PathParams(mount, path),
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v2.list
     * category: Secrets / KV v2
     * summary: List keys from KV v2 metadata.
     * signatures:
     *   - secret.kv.v2.list(mount, path?)
     * example: |
     *   const keys = await vault.secret.kv.v2.list('secret-v2', 'apps').unwrap();
     * @end-nanvc-doc
     */
    public list(mount: string, path = ''): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list<VaultKvV2ListEnvelope>('/{kv_v2_mount_path}/metadata/{path}/', {
                params: {
                    path: toKvV2PathParams(mount, path),
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(extractKvV2ListKeys(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v2.read
     * category: Secrets / KV v2
     * summary: Read a KV v2 secret with data and version metadata.
     * signatures:
     *   - secret.kv.v2.read<T>(mount, path, options?)
     * example: |
     *   const secret = await vault.secret.kv.v2.read<{ foo: string }>('secret-v2', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public read<T = Record<string, unknown>>(
        mount: string,
        path: string,
        options: VaultKvV2ReadOptions = {},
    ): Result<VaultKvV2ReadResponse<T>> {
        return toResult((async (): Promise<ResultTuple<VaultKvV2ReadResponse<T>>> => {
            const [data, error] = await this.raw.get<VaultKvV2ReadEnvelope<T>>('/{kv_v2_mount_path}/data/{path}', {
                params: {
                    path: toKvV2PathParams(mount, path),
                    query: {
                        version: options.version,
                    },
                },
            });
            if (error) {
                const deletedSecretResponse = extractDeletedKvV2ReadEnvelope<T>(error);
                if (deletedSecretResponse) {
                    return ok(toKvV2ReadResponse(deletedSecretResponse));
                }

                return err(error);
            }

            return ok(toKvV2ReadResponse(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v2.write
     * category: Secrets / KV v2
     * summary: Write a KV v2 secret, optionally using check-and-set.
     * signatures:
     *   - secret.kv.v2.write(mount, path, payload, options?)
     * example: |
     *   await vault.secret.kv.v2.write('secret-v2', 'apps/demo', {
     *       foo: 'bar',
     *   }, {
     *       cas: 1,
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(
        mount: string,
        path: string,
        payload: Record<string, unknown>,
        options: VaultKvV2WriteOptions = {},
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const body: VaultKvV2GeneratedWriteRequest = options.cas === undefined
                ? { data: payload }
                : { data: payload, options: { cas: options.cas } };

            const [data, error] = await this.raw.post<VaultKvV2GeneratedWriteResponse>('/{kv_v2_mount_path}/data/{path}', {
                body,
                params: {
                    path: toKvV2PathParams(mount, path),
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

function toKvV2PathParams(mount: string, path: string): {
    kv_v2_mount_path: string;
    path: string;
} {
    return {
        kv_v2_mount_path: normalize(mount),
        path: normalize(path),
    };
}

function extractKvV2ListKeys(response: VaultKvV2ListEnvelope): string[] {
    if (hasKvV2ListDataEnvelope(response)) {
        return response.data?.keys ?? [];
    }

    return response.keys ?? [];
}

function hasKvV2ListDataEnvelope(
    response: VaultKvV2ListEnvelope,
): response is { data?: components['schemas']['StandardListResponse'] } {
    return 'data' in response;
}

function toKvV2ReadResponse<T>(response: VaultKvV2ReadEnvelope<T>): VaultKvV2ReadResponse<T> {
    return {
        data: (response.data?.data ?? {}) as T,
        metadata: response.data?.metadata ?? {},
    };
}

function extractDeletedKvV2ReadEnvelope<T>(error: unknown): VaultKvV2ReadEnvelope<T> | null {
    if (!(error instanceof VaultClientError)) {
        return null;
    }

    if (error.code !== 'HTTP_ERROR' || error.status !== 404) {
        return null;
    }

    if (!hasKvV2ReadEnvelope(error.responseBody)) {
        return null;
    }

    return error.responseBody as VaultKvV2ReadEnvelope<T>;
}

function hasKvV2ReadEnvelope(value: unknown): value is VaultKvV2ReadEnvelope<unknown> {
    return typeof value === 'object' && value !== null && 'data' in value;
}

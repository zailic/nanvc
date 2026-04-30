import { normalize } from 'path';

import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../core/errors.js';

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

export type VaultKvV2PatchOptions = {
    cas?: number;
};

export type VaultKvV2MetadataWriteOptions = {
    cas_required?: boolean;
    custom_metadata?: Record<string, string>;
    delete_version_after?: string;
    max_versions?: number;
};

export type VaultKvV2ConfigureOptions = {
    cas_required?: boolean;
    delete_version_after?: string;
    max_versions?: number;
};

export type VaultKvV2SubkeysOptions = {
    depth?: number;
    version?: number;
};

export type VaultKvV2GeneratedReadResponse = components['schemas']['KvV2ReadResponse'];
export type VaultKvV2GeneratedWriteRequest = components['schemas']['KvV2WriteRequest'];
export type VaultKvV2GeneratedWriteResponse = components['schemas']['KvV2WriteResponse'];
export type VaultKvV2GeneratedMetadataResponse = components['schemas']['KvV2ReadMetadataResponse'];
export type VaultKvV2GeneratedConfigurationResponse = components['schemas']['KvV2ReadConfigurationResponse'];
export type VaultKvV2GeneratedSubkeysResponse = components['schemas']['KvV2ReadSubkeysResponse'];
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

type VaultKvV2MetadataEnvelope = {
    data?: VaultKvV2GeneratedMetadataResponse;
};

type VaultKvV2ConfigEnvelope = {
    data?: VaultKvV2GeneratedConfigurationResponse;
};

type VaultKvV2SubkeysEnvelope = {
    data?: VaultKvV2GeneratedSubkeysResponse;
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

    /**
     * @nanvc-doc
     * id: secret.kv.v2.patch
     * category: Secrets / KV v2
     * summary: Patch (partially update) a KV v2 secret using JSON Merge Patch semantics.
     * signatures:
     *   - secret.kv.v2.patch(mount, path, payload, options?)
     * example: |
     *   await vault.secret.kv.v2.patch('secret-v2', 'apps/demo', { foo: 'updated' }).unwrap();
     * @end-nanvc-doc
     */
    public patch(
        mount: string,
        path: string,
        payload: Record<string, unknown>,
        options: VaultKvV2PatchOptions = {},
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const body: components['schemas']['KvV2PatchRequest'] = options.cas === undefined
                ? { data: payload }
                : { data: payload, options: { cas: options.cas } };

            const [data, error] = await this.raw.patch('/{kv_v2_mount_path}/data/{path}', {
                body,
                headers: {
                    'Content-Type': 'application/merge-patch+json',
                },
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
     * id: secret.kv.v2.deleteVersions
     * category: Secrets / KV v2
     * summary: Soft-delete specific versions of a KV v2 secret.
     * signatures:
     *   - secret.kv.v2.deleteVersions(mount, path, versions)
     * example: |
     *   await vault.secret.kv.v2.deleteVersions('secret-v2', 'apps/demo', [1, 2]).unwrap();
     * @end-nanvc-doc
     */
    public deleteVersions(mount: string, path: string, versions: number[]): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/{kv_v2_mount_path}/delete/{path}', {
                body: { versions },
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
     * id: secret.kv.v2.undeleteVersions
     * category: Secrets / KV v2
     * summary: Restore (undelete) previously soft-deleted versions of a KV v2 secret.
     * signatures:
     *   - secret.kv.v2.undeleteVersions(mount, path, versions)
     * example: |
     *   await vault.secret.kv.v2.undeleteVersions('secret-v2', 'apps/demo', [1]).unwrap();
     * @end-nanvc-doc
     */
    public undeleteVersions(mount: string, path: string, versions: number[]): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/{kv_v2_mount_path}/undelete/{path}', {
                body: { versions },
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
     * id: secret.kv.v2.destroyVersions
     * category: Secrets / KV v2
     * summary: Permanently destroy specific versions of a KV v2 secret.
     * signatures:
     *   - secret.kv.v2.destroyVersions(mount, path, versions)
     * example: |
     *   await vault.secret.kv.v2.destroyVersions('secret-v2', 'apps/demo', [1]).unwrap();
     * @end-nanvc-doc
     */
    public destroyVersions(mount: string, path: string, versions: number[]): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/{kv_v2_mount_path}/destroy/{path}', {
                body: { versions },
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
     * id: secret.kv.v2.readMetadata
     * category: Secrets / KV v2
     * summary: Read all metadata and versions for a KV v2 secret.
     * signatures:
     *   - secret.kv.v2.readMetadata(mount, path)
     * example: |
     *   const meta = await vault.secret.kv.v2.readMetadata('secret-v2', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public readMetadata(mount: string, path: string): Result<VaultKvV2GeneratedMetadataResponse> {
        return toResult((async (): Promise<ResultTuple<VaultKvV2GeneratedMetadataResponse>> => {
            const [data, error] = await this.raw.get<VaultKvV2MetadataEnvelope>('/{kv_v2_mount_path}/metadata/{path}', {
                params: {
                    path: toKvV2PathParams(mount, path),
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v2.writeMetadata
     * category: Secrets / KV v2
     * summary: Create or update metadata for a KV v2 secret path.
     * signatures:
     *   - secret.kv.v2.writeMetadata(mount, path, options)
     * example: |
     *   await vault.secret.kv.v2.writeMetadata('secret-v2', 'apps/demo', { max_versions: 5 }).unwrap();
     * @end-nanvc-doc
     */
    public writeMetadata(mount: string, path: string, options: VaultKvV2MetadataWriteOptions = {}): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/{kv_v2_mount_path}/metadata/{path}', {
                body: options,
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
     * id: secret.kv.v2.patchMetadata
     * category: Secrets / KV v2
     * summary: Partially update metadata for a KV v2 secret path.
     * signatures:
     *   - secret.kv.v2.patchMetadata(mount, path, options)
     * example: |
     *   await vault.secret.kv.v2.patchMetadata('secret-v2', 'apps/demo', { max_versions: 10 }).unwrap();
     * @end-nanvc-doc
     */
    public patchMetadata(mount: string, path: string, options: VaultKvV2MetadataWriteOptions = {}): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.patch('/{kv_v2_mount_path}/metadata/{path}', {
                body: options,
                headers: {
                    'Content-Type': 'application/merge-patch+json',
                },
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
     * id: secret.kv.v2.deleteMetadata
     * category: Secrets / KV v2
     * summary: Permanently delete all versions and metadata for a KV v2 secret path.
     * signatures:
     *   - secret.kv.v2.deleteMetadata(mount, path)
     * example: |
     *   await vault.secret.kv.v2.deleteMetadata('secret-v2', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public deleteMetadata(mount: string, path: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/{kv_v2_mount_path}/metadata/{path}', {
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
     * id: secret.kv.v2.readConfig
     * category: Secrets / KV v2
     * summary: Read the backend-level configuration for a KV v2 mount.
     * signatures:
     *   - secret.kv.v2.readConfig(mount)
     * example: |
     *   const config = await vault.secret.kv.v2.readConfig('secret-v2').unwrap();
     * @end-nanvc-doc
     */
    public readConfig(mount: string): Result<VaultKvV2GeneratedConfigurationResponse> {
        return toResult((async (): Promise<ResultTuple<VaultKvV2GeneratedConfigurationResponse>> => {
            const [data, error] = await this.raw.get<VaultKvV2ConfigEnvelope>('/{kv_v2_mount_path}/config', {
                params: {
                    path: {
                        kv_v2_mount_path: normalize(mount),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v2.writeConfig
     * category: Secrets / KV v2
     * summary: Update the backend-level configuration for a KV v2 mount.
     * signatures:
     *   - secret.kv.v2.writeConfig(mount, options)
     * example: |
     *   await vault.secret.kv.v2.writeConfig('secret-v2', { max_versions: 10 }).unwrap();
     * @end-nanvc-doc
     */
    public writeConfig(mount: string, options: VaultKvV2ConfigureOptions = {}): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/{kv_v2_mount_path}/config', {
                body: options,
                params: {
                    path: {
                        kv_v2_mount_path: normalize(mount),
                    },
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
     * id: secret.kv.v2.readSubkeys
     * category: Secrets / KV v2
     * summary: Read the key structure of a KV v2 secret without returning values.
     * signatures:
     *   - secret.kv.v2.readSubkeys(mount, path, options?)
     * example: |
     *   const subkeys = await vault.secret.kv.v2.readSubkeys('secret-v2', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public readSubkeys(mount: string, path: string, options: VaultKvV2SubkeysOptions = {}): Result<VaultKvV2GeneratedSubkeysResponse> {
        return toResult((async (): Promise<ResultTuple<VaultKvV2GeneratedSubkeysResponse>> => {
            const [data, error] = await this.raw.get<VaultKvV2SubkeysEnvelope>('/{kv_v2_mount_path}/subkeys/{path}', {
                params: {
                    path: toKvV2PathParams(mount, path),
                    query: {
                        depth: options.depth,
                        version: options.version,
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
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

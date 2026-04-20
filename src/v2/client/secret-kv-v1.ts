import {normalize} from 'path';

import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../transport/errors.js';

export class VaultSecretKvV1Client {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: secret.kv.v1.delete
     * category: Secrets / KV v1
     * summary: Delete a KV v1 secret.
     * signatures:
     *   - secret.kv.v1.delete(path)
     *   - secret.kv.v1.delete(mount, path)
     * example: |
     *   await vault.secret.kv.v1.delete('secret', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public delete(path: string): Result<void>;
    public delete(mount: string, path: string): Result<void>;
    public delete(pathOrMount: string, maybePath?: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [secretRef, resolveError] = resolveKvV1PathParams(pathOrMount, maybePath);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.delete('/{kv_v1_mount_path}/{path}', {
                params: {
                    path: secretRef,
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
     * id: secret.kv.v1.list
     * category: Secrets / KV v1
     * summary: List keys at a KV v1 path.
     * signatures:
     *   - secret.kv.v1.list(path)
     *   - secret.kv.v1.list(mount, path?)
     * example: |
     *   const keys = await vault.secret.kv.v1.list('secret', 'apps').unwrap();
     * @end-nanvc-doc
     */
    public list(path: string): Result<string[]>;
    public list(mount: string, path?: string): Result<string[]>;
    public list(pathOrMount: string, maybePath?: string): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [secretRef, resolveError] = resolveKvV1PathParams(pathOrMount, maybePath, true);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.list('/{kv_v1_mount_path}/{path}/', {
                params: {
                    path: secretRef,
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.keys ?? []);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v1.read
     * category: Secrets / KV v1
     * summary: Read a KV v1 secret and return its nested data object.
     * signatures:
     *   - secret.kv.v1.read<T>(path)
     *   - secret.kv.v1.read<T>(mount, path)
     * example: |
     *   const secret = await vault.secret.kv.v1.read<{ foo: string }>('secret', 'apps/demo').unwrap();
     * @end-nanvc-doc
     */
    public read<T = Record<string, unknown>>(path: string): Result<T>;
    public read<T = Record<string, unknown>>(mount: string, path: string): Result<T>;
    public read<T = Record<string, unknown>>(pathOrMount: string, maybePath?: string): Result<T> {
        return toResult((async (): Promise<ResultTuple<T>> => {
            const [secretRef, resolveError] = resolveKvV1PathParams(pathOrMount, maybePath);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.get('/{kv_v1_mount_path}/{path}', {
                params: {
                    path: secretRef,
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.data as T);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.kv.v1.write
     * category: Secrets / KV v1
     * summary: Write a KV v1 secret.
     * signatures:
     *   - secret.kv.v1.write(path, payload)
     *   - secret.kv.v1.write(mount, path, payload)
     * example: |
     *   await vault.secret.kv.v1.write('secret', 'apps/demo', {
     *       foo: 'bar',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(path: string, payload: Record<string, unknown>): Result<void>;
    public write(mount: string, path: string, payload: Record<string, unknown>): Result<void>;
    public write(
        pathOrMount: string,
        pathOrPayload: string | Record<string, unknown>,
        maybePayload?: Record<string, unknown>,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const payload = typeof pathOrPayload === 'string' ? maybePayload : pathOrPayload;
            if (!payload) {
                return err(new VaultClientError({
                    code: 'VALIDATION_ERROR',
                    message: 'VaultSecretKvV1Client.write requires a payload object',
                }));
            }

            const secretRef = typeof pathOrPayload === 'string'
                ? resolveKvV1PathParams(pathOrMount, pathOrPayload)
                : resolveKvV1PathParams(pathOrMount);
            const [pathParams, resolveError] = secretRef;
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.post('/{kv_v1_mount_path}/{path}', {
                body: payload,
                params: {
                    path: pathParams,
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

function resolveKvV1PathParams(
    pathOrMount: string,
    maybePath?: string,
    allowEmptyPath = false,
): ResultTuple<{
    kv_v1_mount_path: string;
    path: string;
}> {
    if (typeof maybePath === 'string') {
        const kv_v1_mount_path = normalize(pathOrMount);
        const path = normalize(maybePath);

        if (!kv_v1_mount_path) {
            return err(new VaultClientError({
                code: 'VALIDATION_ERROR',
                message: `Expected a KV v1 mount path, got "${pathOrMount}"`,
            }));
        }

        if (!allowEmptyPath && !path) {
            return err(new VaultClientError({
                code: 'VALIDATION_ERROR',
                message: `Expected a KV v1 secret path, got "${maybePath}"`,
            }));
        }

        return ok({
            kv_v1_mount_path,
            path,
        });
    }

    const normalizedPath = normalize(pathOrMount);
    const [kv_v1_mount_path, ...segments] = normalizedPath.split('/').filter(Boolean);
    const path = segments.join('/');

    if (
        !kv_v1_mount_path || 
        kv_v1_mount_path === '.' || 
        (!allowEmptyPath && path.length === 0)
    ) {
        return err(new VaultClientError({
            code: 'VALIDATION_ERROR',
            message: `Expected a KV v1 secret path like "secret/my-app/my-secret", got "${pathOrMount}"`,
        }));
    }

    return ok({
        kv_v1_mount_path,
        path,
    });
}

import { normalize } from 'path';

import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../core/errors.js';

export type VaultCubbyholeReadResponse = components['schemas']['CubbyholeReadResponse'];
export type VaultCubbyholeListResponse = components['schemas']['CubbyholeListResponse'];

export class VaultSecretCubbyholeClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: secret.cubbyhole.read
     * category: Secrets / Cubbyhole
     * summary: Read a secret from the caller token's cubbyhole.
     * signatures:
     *   - secret.cubbyhole.read<T>(path)
     * example: |
     *   const secret = await vault.secret.cubbyhole.read<{ token: string }>('my/secret').unwrap();
     * @end-nanvc-doc
     */
    public read<T = Record<string, unknown>>(path: string): Result<T> {
        return toResult((async (): Promise<ResultTuple<T>> => {
            const [normalizedPath, resolveError] = resolveCubbyholePathParam(path);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.get('/cubbyhole/{path}', {
                params: {
                    path: { path: normalizedPath },
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
     * id: secret.cubbyhole.write
     * category: Secrets / Cubbyhole
     * summary: Write a secret into the caller token's cubbyhole.
     * signatures:
     *   - secret.cubbyhole.write(path, payload)
     * example: |
     *   await vault.secret.cubbyhole.write('my/secret', { token: 'abc123' }).unwrap();
     * @end-nanvc-doc
     */
    public write(path: string, payload: Record<string, unknown>): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [normalizedPath, resolveError] = resolveCubbyholePathParam(path);
            if (resolveError) {
                return err(resolveError);
            }

            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return err(new VaultClientError({
                    code: 'VALIDATION_ERROR',
                    message: 'VaultSecretCubbyholeClient.write requires a payload object',
                }));
            }

            const [data, error] = await this.raw.post('/cubbyhole/{path}', {
                body: payload,
                params: {
                    path: { path: normalizedPath },
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
     * id: secret.cubbyhole.delete
     * category: Secrets / Cubbyhole
     * summary: Delete a secret from the caller token's cubbyhole.
     * signatures:
     *   - secret.cubbyhole.delete(path)
     * example: |
     *   await vault.secret.cubbyhole.delete('my/secret').unwrap();
     * @end-nanvc-doc
     */
    public delete(path: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [normalizedPath, resolveError] = resolveCubbyholePathParam(path);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.delete('/cubbyhole/{path}', {
                params: {
                    path: { path: normalizedPath },
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
     * id: secret.cubbyhole.list
     * category: Secrets / Cubbyhole
     * summary: List secret keys stored in the caller token's cubbyhole at the given path prefix.
     * signatures:
     *   - secret.cubbyhole.list(path?)
     * example: |
     *   const keys = await vault.secret.cubbyhole.list('my').unwrap();
     * @end-nanvc-doc
     */
    public list(path?: string): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const normalizedPath = path ? normalize(path) : '';

            const [data, error] = await this.raw.list('/cubbyhole/{path}/', {
                params: {
                    path: { path: normalizedPath },
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.data?.keys ?? []);
        })());
    }
}

function resolveCubbyholePathParam(path: string): ResultTuple<string> {
    const normalized = normalize(path);
    if (!normalized || normalized === '.') {
        return err(new VaultClientError({
            code: 'VALIDATION_ERROR',
            message: `Expected a cubbyhole secret path, got "${path}"`,
        }));
    }
    return ok(normalized);
}

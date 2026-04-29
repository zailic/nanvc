import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../transport/errors.js';

export type VaultWrappingLookupResponse = components['schemas']['WrappingLookupData'];
export type VaultWrappingWrapInfo = components['schemas']['WrapInfo'];
export type VaultWrappingWrapResponse = components['schemas']['WrappingWrapResponse'];
export type VaultWrappingRewrapResponse = components['schemas']['WrappingRewrapResponse'];
export type VaultWrappingUnwrapResponse = components['schemas']['WrappingUnwrapResponse'];

export class VaultSystemWrappingClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.wrapping.lookup
     * category: System / Wrapping
     * summary: Look up wrapping properties for a given response-wrapped token.
     * signatures:
     *   - sys.wrapping.lookup(token)
     * example: |
     *   const info = await vault.sys.wrapping.lookup(wrappingToken).unwrap();
     * @end-nanvc-doc
     */
    public lookup(token: string): Result<VaultWrappingLookupResponse> {
        return toResult((async (): Promise<ResultTuple<VaultWrappingLookupResponse>> => {
            const [response, error] = await this.raw.post('/sys/wrapping/lookup', {
                body: { token },
            });
            if (error) {
                return err(error);
            }

            if (!response.data) {
                return err(new VaultClientError({
                    code: 'VALIDATION_ERROR',
                    message: 'Vault wrapping lookup response did not include data',
                    responseBody: response,
                }));
            }

            return ok(response.data);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.wrapping.wrap
     * category: System / Wrapping
     * summary: Response-wrap an arbitrary JSON object with the given TTL.
     * signatures:
     *   - sys.wrapping.wrap(data, ttl)
     * example: |
     *   const result = await vault.sys.wrapping.wrap({ role_id: '...', secret_id: '...' }, '300s').unwrap();
     *   const token = result.wrap_info?.token;
     * @end-nanvc-doc
     */
    public wrap(data: Record<string, unknown>, ttl: string): Result<VaultWrappingWrapResponse> {
        return this.raw.post('/sys/wrapping/wrap', {
            headers: {
                'X-Vault-Wrap-TTL': ttl,
            },
            body: data,
        });
    }

    /**
     * @nanvc-doc
     * id: sys.wrapping.unwrap
     * category: System / Wrapping
     * summary: Unwrap a response-wrapped token and return the original data.
     * signatures:
     *   - sys.wrapping.unwrap(token)
     * example: |
     *   const result = await vault.sys.wrapping.unwrap(wrappingToken).unwrap();
     *   const roleId = result.data?.role_id;
     * @end-nanvc-doc
     */
    public unwrap(token: string): Result<VaultWrappingUnwrapResponse> {
        return this.raw.post('/sys/wrapping/unwrap', { body: { token } });
    }

    /**
     * @nanvc-doc
     * id: sys.wrapping.rewrap
     * category: System / Wrapping
     * summary: Rotate a response-wrapped token, returning a new wrapping token for the same data.
     * signatures:
     *   - sys.wrapping.rewrap(token)
     * example: |
     *   const result = await vault.sys.wrapping.rewrap(oldWrappingToken).unwrap();
     *   const newToken = result.wrap_info?.token;
     * @end-nanvc-doc
     */
    public rewrap(token: string): Result<VaultWrappingRewrapResponse> {
        return this.raw.post('/sys/wrapping/rewrap', { body: { token } });
    }
}

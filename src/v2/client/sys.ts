import { normalize } from 'path';

import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultSystemPoliciesClient } from './sys-policies.js';
import { VaultSystemWrappingClient } from './sys-wrapping.js';

export type VaultInitRequest = components['schemas']['InitializeRequest'];
export type VaultInitStatusResponse = components['schemas']['InitializationStatusResponse'];
export type VaultInitResponse = components['schemas']['InitializeResponse'];
export type VaultMountRequest = components['schemas']['MountsEnableSecretsEngineRequest'];
export type VaultSealStatusResponse = components['schemas']['SealStatusResponse'];
export type VaultUnsealRequest = components['schemas']['UnsealRequest'];
export type VaultUnsealResponse = components['schemas']['UnsealResponse'];

export class VaultSystemMountClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.mount.enable
     * category: System / Mounts
     * summary: Enable a secrets engine at the given mount path.
     * signatures:
     *   - sys.mount.enable(path, payload)
     * example: |
     *   await vault.sys.mount.enable('secret', {
     *       type: 'kv',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public enable(path: string, payload: VaultMountRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/mounts/{path}', {
                body: payload,
                params: {
                    path: {
                        path: normalize(path),
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
     * id: sys.mount.disable
     * category: System / Mounts
     * summary: Disable the secrets engine mounted at the given path.
     * signatures:
     *   - sys.mount.disable(path)
     * example: |
     *   await vault.sys.mount.disable('secret').unwrap();
     * @end-nanvc-doc
     */
    public disable(path: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/mounts/{path}', {
                params: {
                    path: {
                        path: normalize(path),
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
}

export class VaultSystemClient {
    public readonly mount: VaultSystemMountClient;
    public readonly policies: VaultSystemPoliciesClient;
    public readonly wrapping: VaultSystemWrappingClient;

    constructor(private readonly raw: RawVaultClient) {
        this.mount = new VaultSystemMountClient(raw);
        this.policies = new VaultSystemPoliciesClient(raw);
        this.wrapping = new VaultSystemWrappingClient(raw);
    }

    /**
     * @nanvc-doc
     * id: sys.isInitialized
     * category: System
     * summary: Check whether the Vault server has been initialized.
     * signatures:
     *   - sys.isInitialized()
     * example: |
     *   const initialized = await vault.sys.isInitialized().unwrap();
     * @end-nanvc-doc
     */
    public isInitialized(): Result<boolean> {
        return toResult((async (): Promise<ResultTuple<boolean>> => {
            const [data, error] = await this.raw.get('/sys/init');
            if (error) {
                return err(error);
            }

            return ok(Boolean(data.initialized));
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.init
     * category: System / Operator
     * summary: Initialize Vault and set the returned root token on the client.
     * signatures:
     *   - sys.init(payload)
     * @end-nanvc-doc
     */
    public init(payload: VaultInitRequest): Result<VaultInitResponse> {
        return toResult((async (): Promise<ResultTuple<VaultInitResponse>> => {
            const [data, error] = await this.raw.post('/sys/init', {
                body: payload,
            });
            if (error) {
                return err(error);
            }

            if (typeof data.root_token === 'string' && data.root_token.length > 0) {
                this.raw.setToken(data.root_token);
            }

            return ok(data);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.sealStatus
     * category: System
     * summary: Read Vault seal status.
     * signatures:
     *   - sys.sealStatus()
     * example: |
     *   const status = await vault.sys.sealStatus().unwrap();
     * @end-nanvc-doc
     */
    public sealStatus(): Result<VaultSealStatusResponse> {
        return this.raw.get('/sys/seal-status');
    }

    /**
     * @nanvc-doc
     * id: sys.unseal
     * category: System / Operator
     * summary: Submit an unseal key to unseal Vault.
     * signatures:
     *   - sys.unseal(payload)
     * @end-nanvc-doc
     */
    public unseal(payload: VaultUnsealRequest): Result<VaultUnsealResponse> {
        return this.raw.post('/sys/unseal', { body: payload });
    }

    /**
     * @nanvc-doc
     * id: sys.status
     * category: System
     * summary: Read Vault health status.
     * signatures:
     *   - sys.status()
     * example: |
     *   const status = await vault.sys.status().unwrap();
     * @end-nanvc-doc
     */
    public status(): Result<components['schemas']['HealthStatusResponse']> {
        return this.raw.get('/sys/health');
    }

    /**
     * @nanvc-doc
     * id: sys.isReady
     * category: System
     * summary: Check whether Vault is reachable and ready.
     * signatures:
     *   - sys.isReady()
     * example: |
     *   const ready = await vault.sys.isReady().unwrap();
     * @end-nanvc-doc
     */
    public isReady(): Result<boolean> {
        return toResult((async (): Promise<ResultTuple<boolean>> => {
            const [data, error] = await this.raw.head('/sys/health');
            if (error) {
                if (
                    error.code === 'HTTP_ERROR' &&
                    error.status !== undefined &&
                    error.status != 200
                ) {
                    return ok(false);
                }
                return err(error);
            }

            void data;
            return ok(true);
        })());
    }
}

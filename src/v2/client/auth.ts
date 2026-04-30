import type { RawVaultClient } from '../core/raw-client.js';
import type { Result, ResultTuple } from '../core/result.js';
import type { components } from '../generated/vault-openapi.js';
import { err, ok, toResult } from '../core/result.js';
import { VaultClientError } from '../core/errors.js';

import { normalize } from 'path';

export type VaultAuthMethodRequest = components['schemas']['AuthEnableMethodRequest'];
export type VaultAuthReadConfigurationResponse = components['schemas']['AuthReadConfigurationResponse'];
export type VaultAppRoleRequest = components['schemas']['AppRoleWriteRoleRequest'];
export type VaultAppRoleRoleIdRequest = components['schemas']['AppRoleWriteRoleIdRequest'];
export type VaultAppRoleRoleIdResponse = components['schemas']['AppRoleReadRoleIdResponse'];
export type VaultAppRoleSecretIdRequest = components['schemas']['AppRoleWriteSecretIdRequest'];
export type VaultAppRoleSecretIdResponse = components['schemas']['AppRoleWriteSecretIdResponse'];
export type VaultAppRoleLoginRequest = components['schemas']['AppRoleLoginRequest'];
export type VaultAppRoleLoginResponse = components['schemas']['AppRoleLoginResponse'];
export class VaultAuthClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: auth.enableAuthMethod
     * category: Auth
     * summary: Enable an auth method if it is not already enabled.
     * signatures:
     *   - auth.enableAuthMethod(path, payload)
     * example: |
     *   await vault.auth.enableAuthMethod('approle', {
     *       type: 'approle',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public enableAuthMethod(path: string, payload: VaultAuthMethodRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            if (await this.isAuthMethodEnabled(path).unwrapOr(false)) {
                return ok(undefined);
            }
            const [data, error] = await this.raw.post('/sys/auth/{path}', {
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
     * id: auth.disableAuthMethod
     * category: Auth
     * summary: Disable an auth method mounted at the given path.
     * signatures:
     *   - auth.disableAuthMethod(path)
     * example: |
     *   await vault.auth.disableAuthMethod('approle').unwrap();
     * @end-nanvc-doc
     */
    public disableAuthMethod(path: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/auth/{path}', {
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
     * id: auth.registerAppRole
     * category: Auth / AppRole
     * summary: Register or update an AppRole role on an AppRole auth backend.
     * signatures:
     *   - auth.registerAppRole(roleName, payload)
     *   - auth.registerAppRole(mount, roleName, payload)
     * example: |
     *   await vault.auth.registerAppRole('jenkins', {
     *       token_policies: ['jenkins'],
     *       token_ttl: '20m',
     *       token_max_ttl: '30m',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public registerAppRole(roleName: string, payload: VaultAppRoleRequest): Result<void>;
    public registerAppRole(approleMountPath: string, roleName: string, payload: VaultAppRoleRequest): Result<void>;
    public registerAppRole(
        approleMountPathOrRoleName: string,
        roleNameOrPayload: string | VaultAppRoleRequest,
        maybePayload?: VaultAppRoleRequest,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const approleRef = resolveAppRoleParams(approleMountPathOrRoleName, roleNameOrPayload, maybePayload);
            const [data, error] = await this.raw.post('/auth/{approle_mount_path}/role/{role_name}', {
                body: approleRef.payload,
                params: {
                    path: {
                        approle_mount_path: approleRef.approle_mount_path,
                        role_name: approleRef.role_name,
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
     * id: auth.getAppRoleRoleId
     * category: Auth / AppRole
     * summary: Read the RoleID assigned to an AppRole role.
     * signatures:
     *   - auth.getAppRoleRoleId(roleName)
     *   - auth.getAppRoleRoleId(mount, roleName)
     * example: |
     *   const { role_id } = await vault.auth.getAppRoleRoleId('jenkins').unwrap();
     * @end-nanvc-doc
     */
    public getAppRoleRoleId(roleName: string): Result<VaultAppRoleRoleIdResponse>;
    public getAppRoleRoleId(approleMountPath: string, roleName: string): Result<VaultAppRoleRoleIdResponse>;
    public getAppRoleRoleId(
        approleMountPathOrRoleName: string,
        maybeRoleName?: string,
    ): Result<VaultAppRoleRoleIdResponse> {
        return toResult((async (): Promise<ResultTuple<VaultAppRoleRoleIdResponse>> => {
            const approleRef = resolveAppRoleParams(approleMountPathOrRoleName, maybeRoleName);
            const [data, error] = await this.raw.get('/auth/{approle_mount_path}/role/{role_name}/role-id', {
                params: {
                    path: approleRef,
                },
            });
            if (error) {
                return err(error);
            }

            return ok(extractVaultData(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: auth.registerAppRoleRoleId
     * category: Auth / AppRole
     * summary: Register a custom RoleID for an AppRole role.
     * signatures:
     *   - auth.registerAppRoleRoleId(roleName, payload)
     *   - auth.registerAppRoleRoleId(mount, roleName, payload)
     * example: |
     *   await vault.auth.registerAppRoleRoleId('jenkins', {
     *       role_id: 'jenkins-role-id',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public registerAppRoleRoleId(roleName: string, payload: VaultAppRoleRoleIdRequest): Result<void>;
    public registerAppRoleRoleId(approleMountPath: string, roleName: string, payload: VaultAppRoleRoleIdRequest): Result<void>;
    public registerAppRoleRoleId(
        approleMountPathOrRoleName: string,
        roleNameOrPayload: string | VaultAppRoleRoleIdRequest,
        maybePayload?: VaultAppRoleRoleIdRequest,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const approleRef = resolveAppRoleParams(approleMountPathOrRoleName, roleNameOrPayload, maybePayload);
            const [data, error] = await this.raw.post('/auth/{approle_mount_path}/role/{role_name}/role-id', {
                body: approleRef.payload,
                params: {
                    path: {
                        approle_mount_path: approleRef.approle_mount_path,
                        role_name: approleRef.role_name,
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
     * id: auth.generateAppRoleSecretId
     * category: Auth / AppRole
     * summary: Generate a SecretID for an AppRole role.
     * signatures:
     *   - auth.generateAppRoleSecretId(roleName, payload?)
     *   - auth.generateAppRoleSecretId(mount, roleName, payload?)
     * example: |
     *   const { secret_id } = await vault.auth.generateAppRoleSecretId('jenkins').unwrap();
     * @end-nanvc-doc
     */
    public generateAppRoleSecretId(roleName: string, payload?: VaultAppRoleSecretIdRequest): Result<VaultAppRoleSecretIdResponse>;
    public generateAppRoleSecretId(
        approleMountPath: string,
        roleName: string,
        payload?: VaultAppRoleSecretIdRequest,
    ): Result<VaultAppRoleSecretIdResponse>;
    public generateAppRoleSecretId(
        approleMountPathOrRoleName: string,
        roleNameOrPayload?: string | VaultAppRoleSecretIdRequest,
        maybePayload: VaultAppRoleSecretIdRequest = {},
    ): Result<VaultAppRoleSecretIdResponse> {
        return toResult((async (): Promise<ResultTuple<VaultAppRoleSecretIdResponse>> => {
            const approleRef = resolveAppRoleParams(approleMountPathOrRoleName, roleNameOrPayload, maybePayload);
            const [data, error] = await this.raw.post('/auth/{approle_mount_path}/role/{role_name}/secret-id', {
                body: approleRef.payload,
                params: {
                    path: {
                        approle_mount_path: approleRef.approle_mount_path,
                        role_name: approleRef.role_name,
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(extractVaultData(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: auth.loginWithAppRole
     * category: Auth / AppRole
     * summary: Authenticate with AppRole credentials and set the returned client token on the client.
     * signatures:
     *   - auth.loginWithAppRole(payload)
     *   - auth.loginWithAppRole(mount, payload)
     * example: |
     *   const login = await vault.auth.loginWithAppRole({
     *       role_id: roleId,
     *       secret_id: secretId,
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public loginWithAppRole(payload: VaultAppRoleLoginRequest): Result<VaultAppRoleLoginResponse>;
    public loginWithAppRole(approleMountPath: string, payload: VaultAppRoleLoginRequest): Result<VaultAppRoleLoginResponse>;
    public loginWithAppRole(
        approleMountPathOrPayload: string | VaultAppRoleLoginRequest,
        maybePayload?: VaultAppRoleLoginRequest,
    ): Result<VaultAppRoleLoginResponse> {
        return toResult((async (): Promise<ResultTuple<VaultAppRoleLoginResponse>> => {
            const [approleRef, resolveError] = resolveAppRoleLoginParams(approleMountPathOrPayload, maybePayload);
            if (resolveError) {
                return err(resolveError);
            }

            const [data, error] = await this.raw.post('/auth/{approle_mount_path}/login', {
                body: approleRef.payload,
                params: {
                    path: {
                        approle_mount_path: approleRef.approle_mount_path,
                    },
                },
            });
            if (error) {
                return err(error);
            }

            if (typeof data.auth?.client_token === 'string' && data.auth.client_token.length > 0) {
                this.raw.setToken(data.auth.client_token);
            }

            return ok(data);
        })());
    }

    /**
     * @nanvc-doc
     * id: auth.getAuthMethodConfig
     * category: Auth
     * summary: Read configuration for an enabled auth method.
     * signatures:
     *   - auth.getAuthMethodConfig(path)
     * example: |
     *   const config = await vault.auth.getAuthMethodConfig('approle').unwrap();
     * @end-nanvc-doc
     */
    public getAuthMethodConfig(path: string): Result<VaultAuthReadConfigurationResponse> {
        return toResult((async (): Promise<ResultTuple<VaultAuthReadConfigurationResponse>> => {
            const [data, error] = await this.raw.get('/sys/auth/{path}', {
                params: {
                    path: {
                        path: normalize(path),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data);
        })());
    }

    /**
     * @nanvc-doc
     * id: auth.isAuthMethodEnabled
     * category: Auth
     * summary: Check whether an auth method exists at the given path.
     * signatures:
     *   - auth.isAuthMethodEnabled(path)
     * example: |
     *   const enabled = await vault.auth.isAuthMethodEnabled('approle').unwrap();
     * @end-nanvc-doc
     */
    public isAuthMethodEnabled(path: string): Result<boolean> {
        return toResult((async (): Promise<ResultTuple<boolean>> => {
            const [data, error] = await this.getAuthMethodConfig(path);
            if (error) {
                if (
                    error.code === 'HTTP_ERROR' &&
                    (error.status === 404 ||
                        error.status === 400)
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

function resolveAppRoleParams(
    approleMountPathOrRoleName: string,
    roleNameOrPayload?: string,
): {
    approle_mount_path: string;
    role_name: string;
};
function resolveAppRoleParams<TPayload>(
    approleMountPathOrRoleName: string,
    roleNameOrPayload: string | TPayload | undefined,
    maybePayload: TPayload | undefined,
): {
    approle_mount_path: string;
    role_name: string;
    payload: TPayload;
};
function resolveAppRoleParams<TPayload>(
    approleMountPathOrRoleName: string,
    roleNameOrPayload?: string | TPayload,
    maybePayload?: TPayload,
) {
    if (roleNameOrPayload === undefined) {
        const params = {
            approle_mount_path: 'approle',
            role_name: normalize(approleMountPathOrRoleName),
        };

        if (maybePayload !== undefined) {
            return {
                ...params,
                payload: maybePayload,
            };
        }

        return params;
    }

    if (typeof roleNameOrPayload === 'string') {
        if (!maybePayload) {
            return {
                approle_mount_path: normalize(approleMountPathOrRoleName),
                role_name: normalize(roleNameOrPayload),
            };
        }

        return {
            approle_mount_path: normalize(approleMountPathOrRoleName),
            role_name: normalize(roleNameOrPayload),
            payload: maybePayload,
        };
    }

    return {
        approle_mount_path: 'approle',
        role_name: normalize(approleMountPathOrRoleName),
        payload: roleNameOrPayload ?? maybePayload ?? {},
    };
}

function extractVaultData<T>(response: T | { data?: T }): T {
    if (hasVaultDataEnvelope(response)) {
        return response.data;
    }

    return response as T;
}

function hasVaultDataEnvelope<T>(response: T | { data?: T }): response is { data: T } {
    return typeof response === 'object'
        && response !== null
        && 'data' in response
        && (response as { data?: T }).data !== undefined;
}

function resolveAppRoleLoginParams(
    approleMountPathOrPayload: string | VaultAppRoleLoginRequest,
    maybePayload?: VaultAppRoleLoginRequest,
): ResultTuple<{
    approle_mount_path: string;
    payload: VaultAppRoleLoginRequest;
}> {
    if (typeof approleMountPathOrPayload === 'string') {
        if (!maybePayload) {
            return err(new VaultClientError({
                code: 'VALIDATION_ERROR',
                message: 'VaultAuthClient.loginWithAppRole requires a payload object',
            }));
        }

        return ok({
            approle_mount_path: normalize(approleMountPathOrPayload),
            payload: maybePayload,
        });
    }

    return ok({
        approle_mount_path: 'approle',
        payload: approleMountPathOrPayload,
    });
}

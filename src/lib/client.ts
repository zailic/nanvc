import { request as httpRequest } from 'node:http';
import type { RequestOptions as NodeHttpRequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestOptions as NodeHttpsRequestOptions } from 'node:https';
import tv4 from 'tv4';

import {
    type HttpMethod,
    type PartialVaultResponse,
    type RequestOptions,
    type VaultApiResponse,
    type VaultAuditHashPayloadRequest,
    type VaultAuditPayloadRequest,
    type VaultAuthPayloadRequest,
    type VaultCommandSpec,
    type VaultInitPayloadRequest,
    type VaultMountsPayloadRequest,
    type VaultPolicyPayloadRequest,
    type VaultRemountPayloadRequest,
    type VaultUnsealPayloadRequest,
    type VaultPayload,
    commandSpecs,
    VaultResponse,
    buildRequestOptions,
    joinUrl,
} from './commands/index.js';

export type VaultClientTlsOptions = {
    ca?: string | Buffer;
    cert?: string | Buffer;
    key?: string | Buffer;
    passphrase?: string;
    rejectUnauthorized?: boolean;
};

export type VaultClientOptions = {
    apiVersion?: string;
    authToken?: string | null;
    clusterAddress?: string;
    tls?: VaultClientTlsOptions;
};

export class VaultClient {
    private _clusterAddress: string;
    private _authToken: string | null;
    private _apiVersion: string;
    private _tls?: VaultClientTlsOptions;

    constructor();
    constructor(options: VaultClientOptions);
    constructor(
        clusterAddress?: string,
        authToken?: string | null,
        apiVersion?: string,
        tls?: VaultClientTlsOptions,
    );
    constructor(
        clusterAddressOrOptions: string | VaultClientOptions = process.env.NANVC_VAULT_CLUSTER_ADDRESS || 'http://127.0.0.1:8200',
        authToken: string | null = process.env.NANVC_VAULT_AUTH_TOKEN || null,
        apiVersion: string = process.env.NANVC_VAULT_API_VERSION || 'v1',
        tls?: VaultClientTlsOptions,
    ) {
        const defaults: Required<Pick<VaultClientOptions, 'apiVersion' | 'authToken' | 'clusterAddress'>> = {
            apiVersion: process.env.NANVC_VAULT_API_VERSION || 'v1',
            authToken: process.env.NANVC_VAULT_AUTH_TOKEN || null,
            clusterAddress: process.env.NANVC_VAULT_CLUSTER_ADDRESS || 'http://127.0.0.1:8200',
        };

        if (typeof clusterAddressOrOptions === 'object' && clusterAddressOrOptions !== null) {
            this._clusterAddress = clusterAddressOrOptions.clusterAddress ?? defaults.clusterAddress;
            this._authToken = clusterAddressOrOptions.authToken ?? defaults.authToken;
            this._apiVersion = clusterAddressOrOptions.apiVersion ?? defaults.apiVersion;
            this._tls = clusterAddressOrOptions.tls;
            return;
        }

        this._clusterAddress = clusterAddressOrOptions;
        this._authToken = authToken;
        this._apiVersion = apiVersion;
        this._tls = tls;
    }

    public readonly addPolicy = (name: string, payload: VaultPolicyPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.addPolicy, name, payload);
    public readonly audits = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.audits);
    public readonly auditHash = (path: string, payload: VaultAuditHashPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.auditHash, path, payload);
    public readonly auths = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.auths);
    public readonly delete = (path: string): Promise<VaultResponse> => this.apiRequest(commandSpecs.delete, path);
    public readonly disableAudit = (path: string): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.disableAudit, path);
    public readonly disableAuth = (path: string): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.disableAuth, path);
    public readonly enableAudit = (path: string, payload: VaultAuditPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.enableAudit, path, payload);
    public readonly enableAuth = (path: string, payload: VaultAuthPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.enableAuth, path, payload);
    public readonly init = (payload: VaultInitPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.init, payload);
    public readonly isInitialized = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.isInitialized);
    public readonly list = (path: string): Promise<VaultResponse> => this.apiRequest(commandSpecs.list, path);
    public readonly mount = (path: string, payload: VaultMountsPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.mount, path, payload);
    public readonly mounts = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.mounts);
    public readonly policies = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.policies);
    public readonly read = (path: string): Promise<VaultResponse> => this.apiRequest(commandSpecs.read, path);
    public readonly remount = (payload: VaultRemountPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.remount, payload);
    public readonly removePolicy = (name: string): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.removePolicy, name);
    public readonly seal = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.seal);
    public readonly status = (): Promise<VaultResponse> => this.apiRequest(commandSpecs.status);
    public readonly unmount = (path: string): Promise<VaultResponse> => this.apiRequest(commandSpecs.unmount, path);
    public readonly unseal = (payload: VaultUnsealPayloadRequest): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.unseal, payload);
    public readonly update = (path: string, payload: VaultPayload): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.update, path, payload);
    public readonly write = (path: string, payload: VaultPayload): Promise<VaultResponse> =>
        this.apiRequest(commandSpecs.write, path, payload);

    get clusterAddress(): string {
        return this._clusterAddress;
    }

    get apiVersion(): string {
        return this._apiVersion;
    }

    get token(): string | null {
        return this._authToken;
    }

    set token(token: string | null) {
        this._authToken = token;
    }

    public async apiRequest(commandSpec: VaultCommandSpec, ...restOfArgs: unknown[]): Promise<VaultResponse> {
        const requestData = this.buildRequestOptions(commandSpec, restOfArgs);
        const partialVaultResponse: PartialVaultResponse = {};

        try {
            if (commandSpec.schema?.req) {
                const tv4ValidationResult = tv4.validate(requestData.json, commandSpec.schema.req);
                if (!tv4ValidationResult) {
                    throw new Error(JSON.stringify(tv4.error, null, 4));
                }
            }
            const response = await this.sendRequest(requestData);
            const responseBody = this.parseResponseBody(response.body);

            partialVaultResponse.httpStatusCode = response.status;

            if (response.ok) {
                partialVaultResponse.apiResponse = responseBody as VaultApiResponse;
            } else {
                partialVaultResponse.errorMessage = this.extractResponseErrorMessage(responseBody, response.statusText);
            }
        } catch (err: unknown) {
            partialVaultResponse.errorMessage = err instanceof Error ? err.message : String(err);
        }

        return VaultResponse.fromPartial(partialVaultResponse);
    }

    public getBaseUrl(): string {
        return joinUrl(this._clusterAddress, this._apiVersion);
    }

    private buildRequestOptions(
        commandSpec: VaultCommandSpec,
        args: unknown[],
    ): RequestOptions {
        const request: RequestOptions = {
            headers: this._authToken
                ? {
                    'X-Vault-Token': this._authToken,
                }
                : undefined,
            method: commandSpec.method as HttpMethod,
            url: this._clusterAddress,
        };

        return buildRequestOptions(
            this.getBaseUrl(), 
            request, 
            commandSpec.method, 
            commandSpec.path, args,
        );
    }

    private buildTransportOptions(
        url: URL,
        requestData: RequestOptions,
    ): NodeHttpRequestOptions & Partial<NodeHttpsRequestOptions> {
        const options: NodeHttpRequestOptions & Partial<NodeHttpsRequestOptions> = {
            headers: requestData.headers,
            method: requestData.method,
            path: `${url.pathname}${url.search}`,
            port: url.port ? Number(url.port) : undefined,
        };

        if (url.protocol === 'https:' && this._tls) {
            options.ca = this._tls.ca;
            options.cert = this._tls.cert;
            options.key = this._tls.key;
            options.passphrase = this._tls.passphrase;
            options.rejectUnauthorized = this._tls.rejectUnauthorized;
        }

        return options;
    }

    private async sendRequest(requestData: RequestOptions): Promise<{
        body: string;
        ok: boolean;
        status: number;
        statusText: string;
    }> {
        const url = new URL(requestData.url ?? '');
        const options = this.buildTransportOptions(url, requestData);
        const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

        return await new Promise((resolve, reject) => {
            const req = requestFn(url, options, (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (chunk: string | Buffer) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                response.on('end', () => {
                    resolve({
                        body: Buffer.concat(chunks).toString('utf8'),
                        ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
                        status: response.statusCode ?? 0,
                        statusText: response.statusMessage ?? '',
                    });
                });
                response.on('error', reject);
            });

            req.on('error', reject);

            if (requestData.body) {
                req.write(requestData.body);
            }

            req.end();
        });
    }

    private parseResponseBody(responseText: string): unknown {
        if (!responseText) {
            return undefined;
        }

        try {
            return JSON.parse(responseText) as unknown;
        } catch {
            return responseText;
        }
    }

    private extractResponseErrorMessage(
        responseBody: unknown,
        statusText: string,
    ): string | undefined {
        const errorBody = responseBody as
            | { errors?: unknown; message?: unknown }
            | undefined;

        if (Array.isArray(errorBody?.errors) && typeof errorBody.errors[0] === 'string') {
            return errorBody.errors[0];
        }

        if (typeof errorBody?.message === 'string') {
            return errorBody.message;
        }

        if (typeof responseBody === 'string' && responseBody.length > 0) {
            return responseBody;
        }

        return statusText || undefined;
    }
}

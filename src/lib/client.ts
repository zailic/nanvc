import * as tv4 from 'tv4';

import { COMMANDS } from './constants';
import {
    VaultCommandMetadata,
    VaultResponse,
    PartialVaultResponse,
    VaultAllowedHttpMethod,
} from './metadata/common';
import { VaultInitPayloadRequest } from './metadata/sys-init';
import { VaultUnsealPayloadRequest } from './metadata/sys-unseal';
import { VaultAuditHashPayloadRequest } from './metadata/sys-audit-hash';
import { VaultAuditPayloadRequest } from './metadata/sys-audit';
import { VaultMountsPayloadRequest } from './metadata/sys-mounts';
import { VaultRemountPayloadRequest } from './metadata/sys-remount';
import { VaultAuthPayloadRequest } from './metadata/sys-auth';
import got, { 
    Options as HttpReqOptions,  
    Method as HttpMethod,
    RequestError as HttpRequestError
} from 'got';


export class VaultClient {

    // tested
    public addPolicy: () => Promise<VaultResponse>;
    public audits: () => Promise<VaultResponse>;
    public auditHash: (path: string, payload: VaultAuditHashPayloadRequest) => Promise<VaultResponse>;
    public auths: () => Promise<VaultResponse>;
    public enableAudit: (path: string, payload: VaultAuditPayloadRequest) => Promise<VaultResponse>;
    public enableAuth: (path: string, payload: VaultAuthPayloadRequest) => Promise<VaultResponse>;
    public delete: (path: string) => Promise<VaultResponse>;
    public disableAudit: (path: string) => Promise<VaultResponse>;
    public disableAuth: (path: string) => Promise<VaultResponse>;
    public list: (path: string) => Promise<VaultResponse>;
    public read: (path: string) => Promise<VaultResponse>;
    public isInitialized: () => Promise<VaultResponse>;
    public init: (payload: VaultInitPayloadRequest) => Promise<VaultResponse>;
    public mount: (path: string, payload: VaultMountsPayloadRequest) => Promise<VaultResponse>;
    public mounts: () => Promise<VaultResponse>;
    public policies: () => Promise<VaultResponse>;
    public remount: (payload: VaultRemountPayloadRequest) => Promise<VaultResponse>;
    public removePolicy: () => Promise<VaultResponse>;
    public seal: () => Promise<VaultResponse>;
    public status: () => Promise<VaultResponse>;
    public unmount: (path: string) => Promise<VaultResponse>;
    public unseal: (payload: VaultUnsealPayloadRequest) => Promise<VaultResponse>;
    public update: (path: string, payload: object) => Promise<VaultResponse>;
    public write: (path: string, payload: object) => Promise<VaultResponse>;

    // not tested

    // public renew: () => Promise<VaultResponse>;
    // public revoke: () => Promise<VaultResponse>;
    // public revokePrefix: () => Promise<VaultResponse>;

    constructor(
        private _clusterAddress: string = process.env.NANVC_VAULT_CLUSTER_ADDRESS || 'http://127.0.0.1:8200',
        private _authToken: string = process.env.NANVC_VAULT_AUTH_TOKEN || null,
        private _apiVersion: string = process.env.NANVC_VAULT_API_VERSION || 'v1',
    ) {
        // tslint:disable-next-line:forin
        for (const k in COMMANDS) {
            VaultClient.prototype[k] = (...args: any[]): Promise<VaultResponse> => {
                return this.apiRequest.apply(this, [COMMANDS[k], ...args]);
            };
        }
    }

    get clusterAddress(): string {
        return this._clusterAddress;
    }

    get apiVersion(): string {
        return this._apiVersion;
    }

    get token() {
        return this._authToken;
    }

    set token(token: string) {
        this._authToken = token;
    }

    public async apiRequest( commandMetadata: VaultCommandMetadata, ...restOfArgs: any[]): Promise<VaultResponse> {

        // tslint:disable-next-line:prefer-const
        let requestData: Partial<HttpReqOptions> = {},
            fullResponse: any,
            // tslint:disable-next-line:prefer-const
            partialVaultResponse: PartialVaultResponse = {};

        requestData.url = this._clusterAddress;
        requestData.method = <HttpMethod>commandMetadata.method;
        requestData.responseType = 'json';
        

        if (this.token) {
            requestData.headers = {};
            requestData.headers['X-Vault-Token'] = this.token;
        }

        this.sanitizeRequest(
            requestData,
            commandMetadata.method,
            commandMetadata.path,
            restOfArgs,
        );

        try {

            if (commandMetadata.schema &&
                commandMetadata.schema.req
            ) {
                const tv4ValidationResult = tv4.validate(requestData.json, commandMetadata.schema.req);
                if (!tv4ValidationResult) {
                    throw new Error(JSON.stringify(tv4.error, null, 4));
                }
            }
            fullResponse = await got(requestData);
            partialVaultResponse._httpStatusCode = fullResponse.statusCode;
            partialVaultResponse._apiResponse = fullResponse.body;
        } catch (err) {
            switch(true) {
                case err instanceof HttpRequestError:
                    partialVaultResponse._httpStatusCode = err.response.statusCode;
                    partialVaultResponse._errorMessage = err.response.body.errors[0];
                    break;
                default:
                    partialVaultResponse._errorMessage = err.message;
            }
        }

        return VaultResponse.newInstanceFromPartial(partialVaultResponse);
    }

    public sanitizeRequest(
        // tslint:disable-next-line:no-shadowed-variable
        request: Partial<HttpReqOptions>,
        httpMethod: VaultAllowedHttpMethod,
        path: string,
        extraArgs: any[],
    ): void {

        let pathHasPlaceholder: boolean = false;
        const re = /^(\/?[a-z-]+(?:\/[a-z-]+)*)?((?:\/):[a-z_]+)$/,
            resolvedPath = path.replace(re, (m, $1, $2) => {
                pathHasPlaceholder = true;
                return [$1, extraArgs[0]].join('/').replace(/\/\//g, '/');
            });

        request.url = [this.getBaseUrl(), resolvedPath].join('/')
            .replace(/(https?:)?\/\//g, ($0, $1) => $1 ? $0 : '/');

        switch (httpMethod.toUpperCase()) {
            case 'POST':
            case 'PUT':
                request.json = extraArgs[pathHasPlaceholder ? 1 : 0];
                break;
        }
    }

    public getBaseUrl(): string {
        return `${this._clusterAddress}/${this._apiVersion}`;
    }
}
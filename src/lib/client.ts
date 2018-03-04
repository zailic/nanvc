import { SYSTEM_BACKEND_COMMANDS } from "./constants";
import { VaultResponse, VaultAllowedHttpMethod } from "./metadata";
import * as request from "request-promise-native";
export class VaultClient {    
    
    public status: () => Promise<VaultResponse>;
    public isInitialized: () => Promise<VaultResponse>;
    public init: () => Promise<VaultResponse>;
    public unseal: (payload:any) => Promise<VaultResponse>;
    public seal: () => Promise<VaultResponse>;
    public mounts: () => Promise<VaultResponse>;
    public mount: () => Promise<VaultResponse>;
    public unmount: () => Promise<VaultResponse>;
    public remount: () => Promise<VaultResponse>;
    public policies: () => Promise<VaultResponse>;
    public addPolicy: () => Promise<VaultResponse>;
    public removePolicy: () => Promise<VaultResponse>;
    public auths: () => Promise<VaultResponse>;
    public enableAuth: () => Promise<VaultResponse>;
    public disableAuth: () => Promise<VaultResponse>;
    public audits: () => Promise<VaultResponse>;
    public enableAudit: () => Promise<VaultResponse>;
    public disableAudit: () => Promise<VaultResponse>;
    public renew: () => Promise<VaultResponse>;
    public revoke: () => Promise<VaultResponse>;
    public revokePrefix: () => Promise<VaultResponse>;

    constructor(
        private clusterAddress: string = process.env.NANVC_VAULT_CLUSTER_ADDRESS || 'http://127.0.0.1:8200',
        private authToken: string = process.env.NANVC_VAULT_AUTH_TOKEN || '2733800b-cbb3-1c40-cebe-a3e7b2b17af0',
        private apiVersion: string = process.env.NANVC_VAULT_API_VERSION || 'v1'
    ) {
        for (let k in SYSTEM_BACKEND_COMMANDS) {
            VaultClient.prototype[k] = (...args: any[]): Promise<VaultResponse> => {
                return this.apiRequest.apply(
                    this, 
                    [
                        SYSTEM_BACKEND_COMMANDS[k].method,
                        SYSTEM_BACKEND_COMMANDS[k].path,
                        ...args
                    ]
                );
            }
        }
    }

    async read(path: string): Promise<VaultResponse> {
        return this.apiRequest('GET', '/secret/' + path);
    }

    async write(path: string, data: { [key: string]: any }): Promise<VaultResponse> {
        return this.apiRequest('POST', '/secret/' + path, data);
    }

    async delete(path: string): Promise<VaultResponse> {
        return this.apiRequest('DELETE', '/secret/' + path);
    }

    async update(path: string, data: { [key: string]: any }): Promise<VaultResponse> {
        return this.apiRequest('PUT', '/secret/' + path, data);
    }

    async apiRequest(
        httpMethod: VaultAllowedHttpMethod, 
        path: string, 
        ...restOfArgs: any[]
    ): Promise<VaultResponse> {
        let requestData: request.OptionsWithUrl = {
                url: this.clusterAddress,
                headers: {
                    "X-Vault-Token": this.authToken
                },
                resolveWithFullResponse: true
            };
        this.sanitizeRequest(requestData, httpMethod, path, restOfArgs)
        let fullResponse: request.FullResponse = await request[httpMethod.toLowerCase()](requestData);
        return fullResponse.statusCode == 200? fullResponse.body: null; 
    }

    sanitizeRequest(
        request: request.OptionsWithUrl,
        httpMethod: VaultAllowedHttpMethod,
        path: string,
        extraArgs: any[]
    ): void {

        let pathHasPlaceholder: boolean = false,
            re = /^(\/?[a-z-]+(?:\/[a-z-]+)*)((?:\/):[a-z_]+)$/,
            resolvedPath = path.replace(re, (m, $1, $2) => {
                pathHasPlaceholder = true;
                return [$1, extraArgs[0]].join("/").replace(/\/\//g, "/");
            });

        request.url = [this.getBaseUrl(), resolvedPath].join("/")
            .replace(/(https?:)?\/\//g, ($0, $1) => $1 ? $0 : "/");

        switch (httpMethod.toUpperCase()) {
            case "POST":
            case "PUT":
                request.json = extraArgs[pathHasPlaceholder ? 1 : 0];
                break;
        }
    }

    getBaseUrl(): string {
        return `${this.clusterAddress}/${this.apiVersion}`;
    }
}
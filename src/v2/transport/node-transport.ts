import { request as httpRequest } from 'node:http';
import type { RequestOptions as NodeHttpRequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestOptions as NodeHttpsRequestOptions } from 'node:https';

import { VaultClientError } from './errors.js';
import type {
    VaultClientOptions,
    VaultRequestOptions,
    VaultTransportResponse,
} from './types.js';

export class NodeVaultTransport {
    constructor(private readonly options: VaultClientOptions = {}) {}

    public async request(request: VaultRequestOptions): Promise<VaultTransportResponse> {
        const url = this.buildUrl(request);
        const body = request.body === undefined ? undefined : JSON.stringify(request.body);
        const requestOptions = this.buildRequestOptions(url, request, body);
        const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

        return await new Promise((resolve, reject) => {
            const req = requestFn(url, requestOptions, (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (chunk: Buffer | string) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                response.on('end', () => {
                    const rawBody = Buffer.concat(chunks).toString('utf8');
                    resolve({
                        body: parseResponseBody(rawBody),
                        headers: response.headers,
                        ok: (response.statusCode ?? 0) >= 200 && (response.statusCode ?? 0) < 300,
                        status: response.statusCode ?? 0,
                        statusText: response.statusMessage ?? '',
                    });
                });
                response.on('error', (cause) => {
                    reject(new VaultClientError({
                        cause,
                        code: 'NETWORK_ERROR',
                        message: cause.message,
                    }));
                });
            });

            req.on('error', (cause) => {
                reject(new VaultClientError({
                    cause,
                    code: 'NETWORK_ERROR',
                    message: cause.message,
                }));
            });

            const timeoutMs = this.options.timeoutMs;
            if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                req.setTimeout(timeoutMs, () => {
                    req.destroy(new VaultClientError({
                        code: 'TIMEOUT',
                        message: `Vault request timed out after ${timeoutMs}ms`,
                    }));
                });
            }

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }

    private buildRequestOptions(
        url: URL,
        request: VaultRequestOptions,
        body?: string,
    ): NodeHttpRequestOptions & Partial<NodeHttpsRequestOptions> {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...request.headers,
        };

        if (request.token) {
            headers['X-Vault-Token'] = request.token;
        }

        if (body) {
            headers['Content-Length'] = Buffer.byteLength(body).toString();
            headers['Content-Type'] = 'application/json';
        }

        const options: NodeHttpRequestOptions & Partial<NodeHttpsRequestOptions> = {
            headers,
            method: request.method === 'LIST' ? 'GET' : request.method,
            path: `${url.pathname}${url.search}`,
            port: url.port ? Number(url.port) : undefined,
        };

        if (url.protocol === 'https:' && this.options.tls) {
            options.ca = this.options.tls.ca;
            options.cert = this.options.tls.cert;
            options.key = this.options.tls.key;
            options.passphrase = this.options.tls.passphrase;
            options.rejectUnauthorized = this.options.tls.rejectUnauthorized;
        }

        return options;
    }

    private buildUrl(request: VaultRequestOptions): URL {
        const clusterAddress = this.options.clusterAddress
            ?? process.env.NANVC_VAULT_CLUSTER_ADDRESS
            ?? 'http://127.0.0.1:8200';
        const apiVersion = this.options.apiVersion
            ?? process.env.NANVC_VAULT_API_VERSION
            ?? 'v1';
        const normalizedClusterAddress = clusterAddress.replace(/\/+$/g, '');
        const normalizedPath = request.path.replace(/^\/+/g, '');
        const url = new URL(`${normalizedClusterAddress}/${apiVersion}/${normalizedPath}`);

        if (request.method === 'LIST') {
            url.searchParams.set('list', 'true');
        }

        for (const [key, value] of Object.entries(request.query ?? {})) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }

        return url;
    }
}

function parseResponseBody(responseText: string): unknown {
    if (!responseText) {
        return undefined;
    }

    try {
        return JSON.parse(responseText) as unknown;
    } catch {
        return responseText;
    }
}

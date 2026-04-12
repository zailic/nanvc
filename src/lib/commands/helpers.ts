import type { VaultAllowedHttpMethod } from './index.js';
export type VaultPayload = Record<string, unknown>;
export type HttpMethod = Uppercase<VaultAllowedHttpMethod>;
export type RequestOptions = {
    body?: string;
    headers?: Record<string, string>;
    json?: unknown;
    method?: HttpMethod;
    url?: string;
};

export const MAX_URL_PART_LENGTH = 500;

export function buildRequestOptions(
    baseUrl: string,
    request: RequestOptions,
    httpMethod: VaultAllowedHttpMethod,
    pathTemplate: string,
    args: unknown[],
): RequestOptions {
    const { payload, resolvedPath } = resolveCommandArguments(pathTemplate, args);
    const opts: RequestOptions = {
        ...request,
        url: joinUrl(baseUrl, resolvedPath),
    };

    if (payload !== undefined && methodSupportsJsonBody(httpMethod)) {
        opts.json = payload;
        opts.body = JSON.stringify(payload);
        opts.headers = {
            ...opts.headers,
            'Content-Type': 'application/json',
        };
    }

    return opts;
}

export function joinUrl(...parts: string[]): string {
    return parts
        .map((part, index) => {
            if (part.length > MAX_URL_PART_LENGTH) {
                throw new Error(`URL part at index ${index} exceeds maximum length of ${MAX_URL_PART_LENGTH} characters`);
            }

            if (index === 0) {
                return part.replace(/\/+$/g, '');
            }

            return part.replace(/^\/+/g, '').replace(/\/+$/g, '');
        })
        .filter(Boolean)
        .join('/');
}

function resolveCommandArguments(
    path: string,
    args: unknown[],
): { payload?: VaultPayload; resolvedPath: string } {
    const hasPathParam = /\/:[a-z_]+$/i.test(path);
    const pathArg = hasPathParam ? String(args[0] ?? '').replace(/^\/+/, '') : '';
    const resolvedPath = hasPathParam
        ? path.replace(/\/:[a-z_]+$/i, `/${pathArg}`)
        : path;
    const payloadIndex = hasPathParam ? 1 : 0;
    const payload = args[payloadIndex] as VaultPayload | undefined;

    return { payload, resolvedPath };
}

function methodSupportsJsonBody(httpMethod: VaultAllowedHttpMethod): boolean {
    return httpMethod === 'POST' || httpMethod === 'PUT';
}
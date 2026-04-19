import { unauthenticatedOperations, type paths as GeneratedPaths } from '../generated/vault-openapi.js';
import { err, ok, toResult, type Result, type ResultTuple } from './result.js';
import { VaultClientError } from '../transport/errors.js';
import { NodeVaultTransport } from '../transport/node-transport.js';
import type {
    VaultClientOptions,
    VaultRequestMethod,
    VaultRequestOptions,
} from '../transport/types.js';

type GeneratedMethod = 'delete' | 'get' | 'head' | 'post' | 'put';

type PathsWithMethod<TMethod extends GeneratedMethod> = {
    [TPath in keyof GeneratedPaths]: TMethod extends keyof GeneratedPaths[TPath] ? TPath : never;
}[keyof GeneratedPaths];

type OperationFor<
    TPath extends keyof GeneratedPaths,
    TMethod extends GeneratedMethod,
> = TMethod extends keyof GeneratedPaths[TPath]
    ? GeneratedPaths[TPath][TMethod]
    : never;

type JsonBodyOf<TOperation> =
    TOperation extends {
        requestBody: {
            content: {
                'application/json': infer TBody;
            };
        };
    }
        ? TBody
        : never;

type JsonResponseOf<TResponse> =
    TResponse extends {
        content: {
            'application/json': infer TContent;
        };
    }
        ? TContent
        : void;

type SuccessResponseOf<TOperation> =
    TOperation extends {
        responses: infer TResponses;
    }
        ? 200 extends keyof TResponses
            ? JsonResponseOf<TResponses[200]>
            : 204 extends keyof TResponses
                ? JsonResponseOf<TResponses[204]>
                : unknown
        : unknown;

type PathParamsOf<TPath extends keyof GeneratedPaths> =
    GeneratedPaths[TPath] extends {
        parameters: {
            path: infer TPathParams;
        };
    }
        ? TPathParams
        : never;

type QueryParamsOf<
    TPath extends keyof GeneratedPaths,
    TMethod extends GeneratedMethod,
> = OperationFor<TPath, TMethod> extends {
    parameters: {
        query: infer TQueryParams;
    };
}
    ? TQueryParams
    : never;

type RawRequestConfig = {
    authenticated?: boolean;
    body?: unknown;
    headers?: Record<string, string>;
    params?: {
        path?: Record<string, string>;
        query?: Record<string, boolean | number | string | undefined>;
    };
};

type GeneratedRequestConfig<
    TPath extends keyof GeneratedPaths,
    TMethod extends GeneratedMethod,
> = {
    authenticated?: boolean;
    body?: JsonBodyOf<OperationFor<TPath, TMethod>>;
    headers?: Record<string, string>;
    params?: {
        path?: PathParamsOf<TPath> extends never ? never : PathParamsOf<TPath>;
        query?: QueryParamsOf<TPath, TMethod> extends never ? never : QueryParamsOf<TPath, TMethod>;
    };
};

type ListPaths = {
    [TPath in PathsWithMethod<'get'>]:
    OperationFor<TPath, 'get'> extends {
        parameters: {
            query: {
                list: 'true';
            };
        };
    }
        ? TPath
        : never;
}[PathsWithMethod<'get'>];

export class RawVaultClient {
    private readonly transport: NodeVaultTransport;
    private token: string | null;

    constructor(options: VaultClientOptions = {}) {
        this.transport = new NodeVaultTransport(options);
        this.token = options.authToken ?? process.env.NANVC_VAULT_AUTH_TOKEN ?? null;
    }

    public setToken(token: string | null): void {
        this.token = token;
    }

    public request<TResponse>(
        method: VaultRequestMethod,
        path: string,
        config: RawRequestConfig = {},
    ): Result<TResponse> {
        return toResult(this.execute<TResponse>({
            body: config.body,
            headers: config.headers,
            method,
            path: resolvePathTemplate(path, config.params?.path),
            query: config.params?.query,
            token: this.resolveRequestToken(method, path, config.authenticated),
        }));
    }

    public delete<TPath extends PathsWithMethod<'delete'>>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'delete'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'delete'>>>;
    public delete<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public delete<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('DELETE', path, config);
    }

    public get<TPath extends PathsWithMethod<'get'>>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'get'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'get'>>>;
    public get<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public get<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('GET', path, config);
    }

    public head<TPath extends PathsWithMethod<'head'>>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'head'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'head'>>>;
    public head<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public head<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('HEAD', path, config);
    }

    public list<TPath extends ListPaths>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'get'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'get'>>>;
    public list<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public list<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('LIST', path, config);
    }

    public post<TPath extends PathsWithMethod<'post'>>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'post'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'post'>>>;
    public post<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public post<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('POST', path, config);
    }

    public put<TPath extends PathsWithMethod<'put'>>(
        path: TPath,
        config?: GeneratedRequestConfig<TPath, 'put'>,
    ): Result<SuccessResponseOf<OperationFor<TPath, 'put'>>>;
    public put<TResponse>(path: string, config?: RawRequestConfig): Result<TResponse>;
    public put<TResponse>(path: string, config: RawRequestConfig = {}): Result<TResponse> {
        return this.request<TResponse>('PUT', path, config);
    }

    private async execute<TResponse>(request: VaultRequestOptions): Promise<ResultTuple<TResponse>> {
        try {
            const response = await this.transport.request(request);

            if (!response.ok) {
                return err(new VaultClientError({
                    code: 'HTTP_ERROR',
                    message: extractErrorMessage(response.body, response.statusText),
                    responseBody: response.body,
                    status: response.status,
                }));
            }

            return ok(response.body as TResponse);
        } catch (cause) {
            if (cause instanceof VaultClientError) {
                return err(cause);
            }

            return err(new VaultClientError({
                cause,
                code: 'UNKNOWN_ERROR',
                message: cause instanceof Error ? cause.message : 'Unknown error',
            }));
        }
    }

    private resolveRequestToken(method: VaultRequestMethod, path: string, authenticated?: boolean): string | null {
        if (authenticated === false) {
            return null;
        }

        if (authenticated === true) {
            return this.token;
        }

        return isUnauthenticatedOperation(method, path) ? null : this.token;
    }
}

function isUnauthenticatedOperation(method: VaultRequestMethod, path: string): boolean {
    if (!isGeneratedUnauthenticatedPath(path)) {
        return false;
    }

    const methodKey = method.toLowerCase();
    return unauthenticatedOperations[path][methodKey as keyof typeof unauthenticatedOperations[typeof path]] === true;
}

function isGeneratedUnauthenticatedPath(path: string): path is keyof typeof unauthenticatedOperations {
    return path in unauthenticatedOperations;
}

function extractErrorMessage(responseBody: unknown, fallback: string): string {
    if (typeof responseBody === 'string' && responseBody.length > 0) {
        return responseBody;
    }

    if (responseBody && typeof responseBody === 'object') {
        const errors = (responseBody as { errors?: unknown }).errors;
        if (Array.isArray(errors) && typeof errors[0] === 'string') {
            return errors[0];
        }

        const message = (responseBody as { message?: unknown }).message;
        if (typeof message === 'string') {
            return message;
        }
    }

    return fallback || 'Vault request failed';
}

function resolvePathTemplate(
    pathTemplate: string,
    pathParams?: Record<string, string>,
): string {
    if (!pathParams) {
        return pathTemplate.replace(/^\/+/g, '');
    }

    return pathTemplate
        .replace(/\{([^}]+)\}/g, (_, key: string) => {
            const value = pathParams[key];
            if (typeof value !== 'string') {
                throw new VaultClientError({
                    code: 'VALIDATION_ERROR',
                    details: { key, pathParams, pathTemplate },
                    message: `Missing path parameter: ${key}`,
                });
            }

            return value
                .replace(/^\/+/g, '')
                .split('/')
                .map((part) => encodeURIComponent(part))
                .join('/');
        })
        .replace(/^\/+/g, '');
}

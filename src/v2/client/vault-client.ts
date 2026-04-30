import { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';
import { VaultClientError } from '../core/errors.js';
import type { VaultClientOptions } from '../transport/types.js';
import { VaultAuthClient } from './auth.js';
import { VaultSecretClient } from './secret.js';
import type { VaultKvV2ReadOptions, VaultKvV2ReadResponse, VaultKvV2WriteOptions } from './secret-kv-v2.js';
import { VaultSystemClient } from './sys.js';

export type VaultKvShortcutEngineVersion = 1 | 2;

export type VaultKvShortcutV1Options = {
    engineVersion?: 1;
};

export type VaultKvShortcutV2ReadOptions = VaultKvV2ReadOptions & {
    engineVersion: 2;
};

export type VaultKvShortcutV2WriteOptions = VaultKvV2WriteOptions & {
    engineVersion: 2;
};

export type VaultKvShortcutV2Options = {
    engineVersion: 2;
};

type VaultKvShortcutReadOptions = VaultKvShortcutV1Options | VaultKvShortcutV2ReadOptions;
type VaultKvShortcutWriteOptions = VaultKvShortcutV1Options | VaultKvShortcutV2WriteOptions;
type VaultKvShortcutDeleteOptions = VaultKvShortcutV1Options | VaultKvShortcutV2Options;
type VaultKvShortcutListOptions = VaultKvShortcutV1Options | VaultKvShortcutV2Options;

export class VaultClient {
    public readonly raw: RawVaultClient;
    public readonly secret: VaultSecretClient;
    public readonly sys: VaultSystemClient;
    public readonly auth: VaultAuthClient;

    constructor(options: VaultClientOptions = {}) {
        this.raw = new RawVaultClient(options);
        this.secret = new VaultSecretClient(this.raw);
        this.sys = new VaultSystemClient(this.raw);
        this.auth = new VaultAuthClient(this.raw);
    }

    public setToken(token: string | null): void {
        this.raw.setToken(token);
    }

    public delete(path: string, options?: VaultKvShortcutV1Options): Result<void>;
    public delete(path: string, options: VaultKvShortcutV2Options): Result<void>;
    public delete(mount: string, path: string, options?: VaultKvShortcutV1Options): Result<void>;
    public delete(mount: string, path: string, options: VaultKvShortcutV2Options): Result<void>;
    public delete(
        pathOrMount: string,
        pathOrOptions?: string | VaultKvShortcutDeleteOptions,
        maybeOptions?: VaultKvShortcutDeleteOptions,
    ): Result<void> {
        const [ref, resolveError] = resolveKvShortcutRef(pathOrMount, pathOrOptions, maybeOptions);
        if (resolveError) {
            return errorResult(resolveError);
        }

        const { mount, path, options } = ref;

        if (isKvV2Shortcut(options)) {
            return this.secret.kv.v2.delete(mount, path);
        }

        return typeof pathOrOptions === 'string'
            ? this.secret.kv.v1.delete(pathOrMount, pathOrOptions)
            : this.secret.kv.v1.delete(pathOrMount);
    }

    public list(path: string, options?: VaultKvShortcutV1Options): Result<string[]>;
    public list(path: string, options: VaultKvShortcutV2Options): Result<string[]>;
    public list(mount: string, path?: string, options?: VaultKvShortcutV1Options): Result<string[]>;
    public list(mount: string, path: string, options: VaultKvShortcutV2Options): Result<string[]>;
    public list(
        pathOrMount: string,
        pathOrOptions?: string | VaultKvShortcutListOptions,
        maybeOptions?: VaultKvShortcutListOptions,
    ): Result<string[]> {
        const [ref, resolveError] = resolveKvShortcutRef(pathOrMount, pathOrOptions, maybeOptions, true);
        if (resolveError) {
            return errorResult(resolveError);
        }

        const { mount, path, options } = ref;

        if (isKvV2Shortcut(options)) {
            return this.secret.kv.v2.list(mount, path);
        }

        return typeof pathOrOptions === 'string'
            ? this.secret.kv.v1.list(pathOrMount, pathOrOptions)
            : this.secret.kv.v1.list(pathOrMount);
    }

    public read<T = Record<string, unknown>>(path: string, options?: VaultKvShortcutV1Options): Result<T>;
    public read<T = Record<string, unknown>>(
        path: string,
        options: VaultKvShortcutV2ReadOptions,
    ): Result<VaultKvV2ReadResponse<T>>;
    public read<T = Record<string, unknown>>(
        mount: string,
        path: string,
        options?: VaultKvShortcutV1Options,
    ): Result<T>;
    public read<T = Record<string, unknown>>(
        mount: string,
        path: string,
        options: VaultKvShortcutV2ReadOptions,
    ): Result<VaultKvV2ReadResponse<T>>;
    public read<T = Record<string, unknown>>(
        pathOrMount: string,
        pathOrOptions?: string | VaultKvShortcutReadOptions,
        maybeOptions?: VaultKvShortcutReadOptions,
    ): Result<T | VaultKvV2ReadResponse<T>> {
        const [ref, resolveError] = resolveKvShortcutRef(pathOrMount, pathOrOptions, maybeOptions);
        if (resolveError) {
            return errorResult(resolveError);
        }

        const { mount, path, options } = ref;

        if (isKvV2Shortcut(options)) {
            return this.secret.kv.v2.read<T>(mount, path, {
                version: 'version' in options ? options.version : undefined,
            });
        }

        return typeof pathOrOptions === 'string'
            ? this.secret.kv.v1.read<T>(pathOrMount, pathOrOptions)
            : this.secret.kv.v1.read<T>(pathOrMount);
    }

    public write(
        path: string,
        payload: Record<string, unknown>,
        options?: VaultKvShortcutV1Options,
    ): Result<void>;
    public write(
        path: string,
        payload: Record<string, unknown>,
        options: VaultKvShortcutV2WriteOptions,
    ): Result<void>;
    public write(
        mount: string,
        path: string,
        payload: Record<string, unknown>,
        options?: VaultKvShortcutV1Options,
    ): Result<void>;
    public write(
        mount: string,
        path: string,
        payload: Record<string, unknown>,
        options: VaultKvShortcutV2WriteOptions,
    ): Result<void>;
    public write(
        pathOrMount: string,
        pathOrPayload: string | Record<string, unknown>,
        payloadOrOptions?: Record<string, unknown> | VaultKvShortcutWriteOptions,
        maybeOptions?: VaultKvShortcutWriteOptions,
    ): Result<void> {
        const payload = typeof pathOrPayload === 'string' ? payloadOrOptions : pathOrPayload;

        if (!isRecord(payload)) {
            return errorResult(new VaultClientError({
                code: 'VALIDATION_ERROR',
                message: 'VaultClient.write requires a payload object',
            }));
        }

        const [ref, resolveError] = resolveKvShortcutRef(
            pathOrMount,
            typeof pathOrPayload === 'string' ? pathOrPayload : payloadOrOptions as VaultKvShortcutWriteOptions | undefined,
            maybeOptions,
        );
        if (resolveError) {
            return errorResult(resolveError);
        }

        const { mount, path, options } = ref;

        if (isKvV2Shortcut(options)) {
            const writeOptions = options as VaultKvShortcutV2WriteOptions;
            return this.secret.kv.v2.write(mount, path, payload, {
                cas: writeOptions.cas,
            });
        }

        return typeof pathOrPayload === 'string'
            ? this.secret.kv.v1.write(pathOrMount, pathOrPayload, payload)
            : this.secret.kv.v1.write(pathOrMount, payload);
    }
}

function resolveKvShortcutRef<TOptions extends VaultKvShortcutReadOptions>(
    pathOrMount: string,
    pathOrOptions?: string | TOptions,
    maybeOptions?: TOptions,
    allowEmptyPath = false,
): ResultTuple<{
    mount: string;
    options?: TOptions;
    path: string;
}> {
    if (typeof pathOrOptions === 'string') {
        return ok({
            mount: pathOrMount,
            options: maybeOptions,
            path: pathOrOptions,
        });
    }

    const [mount, ...pathSegments] = pathOrMount.split('/').filter(Boolean);
    const path = pathSegments.join('/');

    if (!mount || (!allowEmptyPath && !path)) {
        return err(new VaultClientError({
            code: 'VALIDATION_ERROR',
            message: `Expected a KV secret path like "secret/my-app/my-secret", got "${pathOrMount}"`,
        }));
    }

    return ok({
        mount,
        options: pathOrOptions,
        path,
    });
}

function isKvV2Shortcut(options: VaultKvShortcutReadOptions | undefined): options is VaultKvShortcutV2ReadOptions {
    return options?.engineVersion === 2;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResult<T>(error: VaultClientError): Result<T> {
    return toResult(Promise.resolve(err(error) as ResultTuple<T>));
}

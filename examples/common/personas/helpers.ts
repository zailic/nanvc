import type { VaultResponse } from '../../../src/lib/commands/index.js';
import { VaultClientError } from '../../../src/main.js';
import type { VaultInitResponse } from './types.js';

export const post200Spec = {
    method: 'POST',
    path: '/:path',
    successCodes: [200],
} as const;


export async function expectSuccess<T extends { errorMessage?: string; succeeded: boolean }>(
    responsePromise: Promise<T>,
    fallbackMessage: string,
): Promise<T> {
    const response = await responsePromise;

    if (!response.succeeded) {
        throw new Error(response.errorMessage ?? fallbackMessage);
    }

    return response;
}

export async function expectSuccessOrAlreadyExists(
    responsePromise: Promise<VaultResponse>,
    fallbackMessage: string,
): Promise<VaultResponse | null> {
    const response = await responsePromise;

    if (response.succeeded) {
        return response;
    }

    if (isAlreadyExistsMessage(response.errorMessage)) {
        return null;
    }

    throw new Error(response.errorMessage ?? fallbackMessage);
}

export function validateInitData(initData: VaultInitResponse | undefined): asserts initData is VaultInitResponse {
    if (!initData || !Array.isArray(initData.keys) || initData.keys.length === 0 || !initData.root_token) {
        throw new Error('Vault init returned no keys or root token');
    }
}

export function validateV2InitData(initData: VaultInitResponse): void {
    if (!Array.isArray(initData.keys) || initData.keys.length === 0 || !initData.root_token) {
        throw new VaultClientError({
            code: 'VALIDATION_ERROR',
            details: initData,
            message: 'Vault init returned no keys or root token',
        });
    }
}

export function isMountAlreadyExistsError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && typeof error.message === 'string'
        && isAlreadyExistsMessage(error.message);
}

export function isInvalidTokenError(error: VaultClientError): boolean {
    if (error.code !== 'HTTP_ERROR' || error.status !== 403) {
        return false;
    }

    const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    if (msg.includes('invalid token') || msg.includes('permission denied')) {
        return true;
    }

    // Also inspect responseBody.errors[], which is where RawVaultClient
    // sources the error message from — Vault returns {"errors":["permission denied"]}
    // for stale/revoked tokens just as often as "invalid token".
    const body = error.responseBody;
    if (body && typeof body === 'object') {
        const errors = (body as { errors?: unknown }).errors;
        if (Array.isArray(errors)) {
            return errors.some(
                (e) => typeof e === 'string'
                    && (e.toLowerCase().includes('invalid token') || e.toLowerCase().includes('permission denied')),
            );
        }
    }

    return false;
}

export function toExampleAuthError(error: VaultClientError): Error {
    if (!isInvalidTokenError(error)) {
        return error;
    }

    const exampleError = new Error([
        'Vault rejected the token loaded for this example.',
        'The shared examples env file likely belongs to another Vault instance or an older Docker volume.',
        'Update TEST_NANVC_VAULT_AUTH_TOKEN, delete the shared env file and reset local Vault,',
        'or export a valid token before running the example.',
    ].join(' '));
    exampleError.stack = error.stack;
    return exampleError;
}

export function printSuccessBanner(title: string): void {
    console.log([
        '',
        '============================================================',
        `  ${title}`,
        '  All assertions passed',
        '============================================================',
        '',
    ].join('\n'));
}

function isAlreadyExistsMessage(message: string | undefined): boolean {
    return typeof message === 'string'
        && (
            message.toLowerCase().includes('path is already in use')
            || message.toLowerCase().includes('path is already mounted')
        );
}

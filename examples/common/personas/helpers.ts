import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { VaultResponse } from '../../../src/lib/commands/index.js';
import { VaultClientError } from '../../../src/main.js';
import type { VaultInitResponse } from './types.js';

export const post200Spec = {
    method: 'POST',
    path: '/:path',
    successCodes: [200],
} as const;

export function loadEnvFile(envPath: string): void {
    let content: string;
    try {
        content = readFileSync(envPath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return;
        }

        throw error;
    }

    for (const line of content.split('\n')) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmedLine.slice(0, separatorIndex);
        if (process.env[key] !== undefined) {
            continue;
        }

        const value = trimmedLine.slice(separatorIndex + 1);
        process.env[key] = value;
    }
}

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

export function updateEnvFile(envPath: string, initData: VaultInitResponse): void {
    const newVars = [
        `NANVC_VAULT_UNSEAL_KEY=${initData.keys[0]}`,
        `NANVC_VAULT_AUTH_TOKEN=${initData.root_token}`,
    ];

    let content: string;
    try {
        content = readFileSync(envPath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        content = '';
    }

    const updatedContent = content
        .split('\n')
        .filter((line) => !line.startsWith('NANVC_VAULT_UNSEAL_KEY=') && !line.startsWith('NANVC_VAULT_AUTH_TOKEN='))
        .filter((line) => line.trim() !== '')
        .concat(newVars)
        .join('\n');

    writeFileSync(envPath, `${updatedContent}\n`, 'utf-8');
    process.env.NANVC_VAULT_UNSEAL_KEY = initData.keys[0];
    process.env.NANVC_VAULT_AUTH_TOKEN = initData.root_token;
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
    return error.code === 'HTTP_ERROR'
        && error.status === 403
        && typeof error.message === 'string'
        && error.message.toLowerCase().includes('invalid token');
}

export function toExampleAuthError(error: VaultClientError, envPath: string | undefined): Error {
    if (!envPath || !isInvalidTokenError(error)) {
        return error;
    }

    const exampleError = new Error([
        `Vault rejected the token loaded for this example from ${envPath}.`,
        'The shared examples env file likely belongs to another Vault instance or an older Docker volume.',
        'Update NANVC_VAULT_AUTH_TOKEN, delete the shared env file and reset local Vault, or export a valid token before running the example.',
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

export function getExamplesEnvPath(exampleMetaUrl: string): string {
    return resolve(dirname(fileURLToPath(exampleMetaUrl)), '..', '.env');
}

function isAlreadyExistsMessage(message: string | undefined): boolean {
    return typeof message === 'string'
        && (
            message.toLowerCase().includes('path is already in use')
            || message.toLowerCase().includes('path is already mounted')
        );
}

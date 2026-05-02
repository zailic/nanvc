import type { VaultClientError } from '../../src/v2/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import VaultClient, { VaultClientV2 } from '../../src/main.js';
import assert from 'node:assert';
import os from 'node:os';

type VaultInitResponse = {
    keys: string[];
    root_token: string;
};

type TestVaultClientOptions = {
    clusterAddress?: string;
};

const ENV_PATH = os.tmpdir() + '/nanvc_test_vault.env';
const DEFAULT_TEST_VAULT_CLUSTER_ADDRESS = 'http://vault.local:8200';

async function ensureDbMountAvailable(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.enable(path, { type: 'database' });
    if (error && !isMountAlreadyExistsError(error)) {
        throw error;
    }
}

async function ensureMountRemoved(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.disable(path);
    if (!error || isMountNotFoundError(error)) {
        return;
    }

    // Mount disable failed (likely due to a lease whose revocation failed in a
    // previous test run). Best-effort: force-revoke all leases under this mount
    // path and retry once. If the retry still fails, log a warning rather than
    // throwing — each test uses a unique mount path so a stale mount does not
    // interfere with other tests, and a subsequent run will retry cleanup.
    await client.raw.put(`/sys/leases/revoke-force/${path}`);
    const [, retryError] = await client.sys.mount.disable(path);
    if (retryError && !isMountNotFoundError(retryError)) {
        console.warn(`Could not fully clean up mount "${path}" (${retryError.message}). `,
            `The stale mount will be retried on the next run.`);
    }
}


async function createLegacyTestVaultClient(options: TestVaultClientOptions = {}): Promise<VaultClient> {
    await createTestVaultClient(options);

    return new VaultClient({
        authToken: getTestRootToken(),
        clusterAddress: resolveTestVaultClusterAddress(options),
    });
}

async function createTestVaultClient(options: TestVaultClientOptions = {}): Promise<VaultClientV2> {
    loadEnvFile();

    let rootToken = process.env.TEST_NANVC_VAULT_AUTH_TOKEN ?? '';
    let unsealKey = process.env.TEST_NANVC_VAULT_UNSEAL_KEY ?? '';

    const client = new VaultClientV2({
        authToken: rootToken || null,
        clusterAddress: resolveTestVaultClusterAddress(options),
    });

    const [isInitialized, initCheckError] = await client.sys.isInitialized();
    if (initCheckError) {
        throw initCheckError;
    }

    if (!isInitialized) {
        const [initData, initError] = await client.sys.init({
            secret_shares: 1,
            secret_threshold: 1,
        });
        if (initError) {
            throw initError;
        }

        validateInitData(initData);
        rootToken = initData.root_token;
        unsealKey = initData.keys[0];
        client.setToken(rootToken);
        updateEnvFile(initData);
    }

    if (!rootToken || !unsealKey) {
        throw new Error('Vault initialization did not provide root credentials');
    }

    client.setToken(rootToken);

    const [status, statusError] = await client.sys.sealStatus();
    if (statusError) {
        throw statusError;
    }

    if (status.sealed) {
        const [, unsealError] = await client.sys.unseal({ key: unsealKey });
        if (unsealError) {
            throw unsealError;
        }
    }
    return client;
}

function resolveTestVaultClusterAddress(options: TestVaultClientOptions): string {
    return options.clusterAddress
        ?? process.env.TEST_NANVC_VAULT_CLUSTER_ADDRESS
        ?? process.env.NANVC_VAULT_CLUSTER_ADDRESS
        ?? DEFAULT_TEST_VAULT_CLUSTER_ADDRESS;
}

function validateInitData(initData: VaultInitResponse): void {
    assert.equal(Array.isArray(initData.keys), true);
    assert.equal(initData.keys.length > 0, true);
    assert.equal(Boolean(initData.root_token), true);
}

function loadEnvFile(): void {
    let content: string;
    try {
        content = readFileSync(ENV_PATH, 'utf8');
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

        process.env[trimmedLine.slice(0, separatorIndex)] = trimmedLine.slice(separatorIndex + 1);
    }
}

function updateEnvFile(initData: VaultInitResponse): void {
    const newVars = [
        `TEST_NANVC_VAULT_AUTH_TOKEN=${initData.root_token}`,
        `TEST_NANVC_VAULT_UNSEAL_KEY=${initData.keys[0]}`,
    ];

    let content: string;
    try {
        content = readFileSync(ENV_PATH, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        content = '';
    }

    const updatedContent = content
        .split('\n')
        .filter((line) => !line.startsWith('TEST_NANVC_VAULT_AUTH_TOKEN=') && !line.startsWith('TEST_NANVC_VAULT_UNSEAL_KEY='))
        .filter((line) => line.trim() !== '')
        .concat(newVars)
        .join('\n');

    writeFileSync(ENV_PATH, `${updatedContent}\n`, 'utf8');
    process.env.TEST_NANVC_VAULT_AUTH_TOKEN = initData.root_token;
    process.env.TEST_NANVC_VAULT_UNSEAL_KEY = initData.keys[0];
}

function isMountAlreadyExistsError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 400
        && error.message.toLowerCase().includes('path is already in use');
}

function isMountNotFoundError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 404
        && error.message.toLowerCase().includes('no matching mount');
}

function isAuthMethodNotFoundError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && error.status === 404
        && error.message.toLowerCase().includes('no auth engine at');
}

export function getTestUnsealKey(): string {
    const unsealKey = process.env.TEST_NANVC_VAULT_UNSEAL_KEY;
    if (!unsealKey) {
        throw new Error('No test unseal key found in environment variables');
    }
    return unsealKey;
}

export function getTestRootToken(): string {
    const rootToken = process.env.TEST_NANVC_VAULT_AUTH_TOKEN;
    if (!rootToken) {
        throw new Error('No test root token found in environment variables');
    }
    return rootToken;
}

export {
    createLegacyTestVaultClient,
    ensureDbMountAvailable,
    ensureMountRemoved,
    createTestVaultClient,
    isAuthMethodNotFoundError,
    isMountAlreadyExistsError,
    isMountNotFoundError,
};

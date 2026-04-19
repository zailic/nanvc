import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import VaultClient from '../../src/main.js';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');

const post200Spec = {
    method: 'POST',
    path: '/:path',
    successCodes: [200],
} as const;

type VaultInitMaterial = {
    keys: string[];
    root_token: string;
};

type VaultResponseData<T> = {
    data?: T;
};

type VaultLoginResponse = {
    auth?: {
        client_token?: string;
    };
};

async function main(): Promise<void> {
    const vault = new VaultClient();

    // Persona: operator
    await ensureVaultIsReady(vault);
    // Ensure the KV v1 secrets engine is enabled at the 'credentials' path.
    await ensureKvMountAvailable(vault, 'credentials');
    // Write a secret using the v1 client's native KV v1 shape.
    await expectSuccess(vault.write('/credentials/mysql/webapp', {
        db_name: 'users',
        username: 'admin',
        password: 'passw0rd',
    }), 'Vault KV v1 write failed');

    // Persona: admin

    // Enable AppRole auth method.
    await expectSuccessOrAlreadyExists(
        vault.enableAuth('approle', { type: 'approle' }),
        'Vault AppRole auth enable failed',
    );

    const jenkinsPolicy = [
        "# Read-only permission on secrets stored at 'credentials/mysql/webapp'",
        "path \"credentials/mysql/webapp\" {",
        "  capabilities = [\"read\"]",
        "}",
    ].join('\n');
    // Create the policy defined above within Vault.
    await expectSuccess(vault.addPolicy('jenkins', { policy: jenkinsPolicy }), 'Vault policy write failed');

    // Create an AppRole with the 'jenkins' policy attached.
    await expectSuccess(
        vault.write('/auth/approle/role/jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        }),
        'Vault AppRole registration failed',
    );

    const roleIdResponse = await expectSuccess(
        vault.read('/auth/approle/role/jenkins/role-id'),
        'Vault AppRole role ID read failed',
    );
    const roleIdData = roleIdResponse.apiResponse as VaultResponseData<{ role_id?: string }> | undefined;
    const roleId = roleIdData?.data?.role_id;

    if (!roleId) {
        throw new Error('Vault AppRole role ID response did not include role_id');
    }

    const secretIdResponse = await expectSuccess(
        vault.apiRequest(post200Spec, '/auth/approle/role/jenkins/secret-id', {}),
        'Vault AppRole secret ID generation failed',
    );
    const secretIdData = secretIdResponse.apiResponse as VaultResponseData<{ secret_id?: string }> | undefined;
    const secretId = secretIdData?.data?.secret_id;

    if (!secretId) {
        throw new Error('Vault AppRole secret ID response did not include secret_id');
    }

    // Persona: app

    // Create a new Vault client instance for the app using the retrieved token.
    const appVaultClient = new VaultClient({ authToken: null });

    // Authenticate using the RoleID and SecretID to retrieve a Vault token.
    const loginResponse = await expectSuccess(
        appVaultClient.apiRequest(post200Spec, '/auth/approle/login', {
            role_id: roleId,
            secret_id: secretId,
        }),
        'Vault AppRole login failed',
    );
    const loginData = loginResponse.apiResponse as VaultLoginResponse | undefined;
    const appToken = loginData?.auth?.client_token;

    if (!appToken) {
        throw new Error('Vault AppRole login response did not include client_token');
    }

    appVaultClient.token = appToken;

    // Read the secret at 'credentials/mysql/webapp' using the app's Vault client.
    const secretResponse = await expectSuccess(
        appVaultClient.read('/credentials/mysql/webapp'),
        'Vault KV v1 read failed',
    );
    const secret = secretResponse.apiResponse as VaultResponseData<{
        db_name: string;
        username: string;
        password: string;
    }> | undefined;

    console.log('Retrieved secret:', secret?.data);
}

async function ensureVaultIsReady(vault: VaultClient): Promise<void> {
    const statusResponse = await expectSuccess(vault.status(), 'Vault seal status failed');
    const status = statusResponse.apiResponse as { initialized?: boolean; sealed?: boolean } | undefined;

    if (!status?.initialized) {
        await initializeAndUnseal(vault);
        return;
    }

    if (status.sealed) {
        const unsealKey = process.env.NANVC_VAULT_UNSEAL_KEY;
        if (!unsealKey) {
            throw new Error('NANVC_VAULT_UNSEAL_KEY environment variable is not set');
        }

        await expectSuccess(vault.unseal({ key: unsealKey }), 'Vault unseal failed');
    }
}

async function initializeAndUnseal(vault: VaultClient): Promise<void> {
    const initResponse = await expectSuccess(
        vault.init({
            secret_shares: 1,
            secret_threshold: 1,
        }),
        'Vault init failed',
    );
    const initData = initResponse.apiResponse as VaultInitMaterial | undefined;

    validateInitData(initData);
    updateEnvFile(initData);
    vault.token = initData.root_token;

    await expectSuccess(vault.unseal({ key: initData.keys[0] }), 'Vault unseal failed');
}

async function ensureKvMountAvailable(client: VaultClient, path: string): Promise<void> {
    await expectSuccessOrAlreadyExists(
        client.mount(path, {
            type: 'kv',
        }),
        'Vault KV mount enable failed',
    );
}

async function expectSuccess<T extends { errorMessage?: string; succeeded: boolean }>(
    responsePromise: Promise<T>,
    fallbackMessage: string,
): Promise<T> {
    const response = await responsePromise;

    if (!response.succeeded) {
        throw new Error(response.errorMessage ?? fallbackMessage);
    }

    return response;
}

async function expectSuccessOrAlreadyExists<T extends { errorMessage?: string; succeeded: boolean }>(
    responsePromise: Promise<T>,
    fallbackMessage: string,
): Promise<T | null> {
    const response = await responsePromise;

    if (response.succeeded) {
        return response;
    }

    if (isAlreadyExistsError(response.errorMessage)) {
        return null;
    }

    throw new Error(response.errorMessage ?? fallbackMessage);
}

function updateEnvFile(initData: VaultInitMaterial): void {
    const newVars = [
        `NANVC_VAULT_UNSEAL_KEY=${initData.keys[0]}`,
        `NANVC_VAULT_AUTH_TOKEN=${initData.root_token}`,
    ];

    let content = '';
    try {
        content = readFileSync(ENV_PATH, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    const updatedContent = content
        .split('\n')
        .filter((line) => !line.startsWith('NANVC_VAULT_UNSEAL_KEY=') && !line.startsWith('NANVC_VAULT_AUTH_TOKEN='))
        .filter((line) => line.trim() !== '')
        .concat(newVars)
        .join('\n');

    writeFileSync(ENV_PATH, `${updatedContent}\n`, 'utf-8');
}

function validateInitData(initData: VaultInitMaterial | undefined): asserts initData is VaultInitMaterial {
    if (!initData || !Array.isArray(initData.keys) || initData.keys.length === 0 || !initData.root_token) {
        throw new Error('Vault init returned no keys or root token');
    }
}

function isAlreadyExistsError(message: string | undefined): boolean {
    return typeof message === 'string'
        && (
            message.toLowerCase().includes('path is already in use')
            || message.toLowerCase().includes('path is already mounted')
        );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

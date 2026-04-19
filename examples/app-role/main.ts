import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VaultClientV2, VaultClientError } from '../../src/main.js';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');

type VaultInitMaterial = {
    keys: string[];
    root_token: string;
};

async function main(): Promise<void> {
    const vault = new VaultClientV2();
    
    // Persona: operator
    await ensureVaultIsReady(vault);
    // Ensure the KV secrets engine is enabled at the 'secret' path
    await ensureKvMountAvailable(vault, 'secret');
    // Write a secret at 'secret/data/mysql/webapp' using the v2 KV client
    vault.secret.kv.v2.write('secret', 'mysql/webapp', {
        db_name: 'users',
        username: 'admin',
        password: 'passw0rd',
    }).unwrap();

    // Persona: admin

    // Enable AppRole auth method
    await vault.auth.enableAuthMethod('approle', { type: 'approle' }).unwrap();

    const jenkinsPolicy = [
        "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
        "path \"secret/data/mysql/webapp\" {",
        "  capabilities = [\"read\"]",
        "}",
    ].join('\n');
    // Create the policy defined above within Vault  
    await vault.raw.post('/sys/policy/jenkins', {body: {policy: jenkinsPolicy}}).unwrap();

    // Create an AppRole with the 'jenkins' policy attached
    await vault.auth.registerAppRole('jenkins', {
        token_policies: ['jenkins'],
        token_ttl: '20m',
        token_max_ttl: '30m',
    }).unwrap();

    const roleIdData = await vault.auth.getAppRoleRoleId('jenkins').unwrap();
    const roleId = roleIdData.role_id;

    const secretIdData = await vault.auth.generateAppRoleSecretId('jenkins').unwrap();
    const secretId = secretIdData.secret_id;

    // Persona: app
    
    // Create a new Vault client instance for the app using the retrieved token
    const appVaultClient = new VaultClientV2({ authToken: null });

    // Authenticate using the RoleID and SecretID to retrieve a Vault token
    await appVaultClient.auth.loginWithAppRole({
        role_id: roleId,
        secret_id: secretId,
    }).unwrap();

    // Read the secret at 'secret/data/mysql/webapp' using the app's Vault client
    const secretResponse = await appVaultClient.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();

    console.log('Retrieved secret:', secretResponse.data);
}

async function ensureVaultIsReady(vault: VaultClientV2): Promise<void> {
    if (!await vault.sys.isReady().unwrap()) {
        const isInitialized = await vault.sys.isInitialized().unwrap();
        if (!isInitialized) {
            await initializeAndUnseal(vault);
        } else {
            const unsealKey = process.env.NANVC_VAULT_UNSEAL_KEY;
            if (!unsealKey) {
                throw new Error('NANVC_VAULT_UNSEAL_KEY environment variable is not set');
            }
            await vault.sys.unseal({ key: unsealKey }).unwrap();
        }
    }
}   

async function initializeAndUnseal(vault: VaultClientV2): Promise<void> {
    const [initData, initError] = await vault.sys.init({
        secret_shares: 1,
        secret_threshold: 1,
    });
    if (initError) {
        throw initError;
    }

    validateInitData(initData);
    updateEnvFile(initData);

    const [, unsealError] = await vault.sys.unseal({
        key: initData.keys[0],
    });
    if (unsealError) {
        throw unsealError;
    }
}

async function ensureKvMountAvailable(client: VaultClientV2, path: string): Promise<void> {
    const [, error] = await client.sys.mount.enable(path, {
        type: 'kv',
        options: {
            version: '2',
        },
    });
    if (error && !isMountAlreadyExistsError(error)) {
        throw error;
    }
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

function validateInitData(initData: VaultInitMaterial): void {
    if (!Array.isArray(initData.keys) || initData.keys.length === 0 || !initData.root_token) {
        throw new VaultClientError({
            code: 'VALIDATION_ERROR',
            details: initData,
            message: 'Vault init returned no keys or root token',
        });
    }
}

function isMountAlreadyExistsError(error: VaultClientError): boolean {
    return error.code === 'HTTP_ERROR'
        && typeof error.message === 'string'
        && error.message.toLowerCase().includes('path is already in use');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

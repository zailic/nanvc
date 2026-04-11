// import VaultClient from 'nanvc';
import { VaultClient } from './lib/client.js'; 
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

async function vaultInitAndUnseal(vault: VaultClient): Promise<void> {
    const initResponse = await vault.init({
        secret_shares: 1,
        secret_threshold: 1,
    });

    if (!initResponse.succeeded || !initResponse.apiResponse) {
        throw new Error(initResponse.errorMessage ?? 'Vault init failed');
    }

    const initData = initResponse.apiResponse as {
        keys: string[];
        root_token: string;
    };
    // this is for demonstration purposes only, do not
    // do this in production
    updateEnvFile(initData);

    const unsealResponse = await vault.unseal({
        key: initData.keys[0],
    });

    if (!unsealResponse.succeeded) {
        throw new Error(unsealResponse.errorMessage ?? 'Vault unseal failed');
    }
}

function updateEnvFile(initData: { keys: string[]; root_token: string; }) {
    const envPath = resolve('.example.env');
    const newVars = [
        `NANVC_VAULT_UNSEAL_KEY=${initData.keys[0]}`,
        `NANVC_VAULT_AUTH_TOKEN=${initData.root_token}`,
    ];

    let content = '';
    try {
        content = readFileSync(envPath, 'utf-8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
        }
    }

    const updatedContent = content
        .split('\n')
        .filter(line => !line.startsWith('NANVC_VAULT_UNSEAL_KEY=') && !line.startsWith('NANVC_VAULT_AUTH_TOKEN='))
        .filter(line => line.trim() !== '')
        .concat(newVars)
        .join('\n');

    writeFileSync(envPath, updatedContent + '\n', 'utf-8');
}


async function main(): Promise<void> {

    const vault = new VaultClient();

    // let's check is vault is initialized
    const isInitializedResponse = await vault.isInitialized();
    
    if (!isInitializedResponse.succeeded || !isInitializedResponse.apiResponse?.initialized) {
        await vaultInitAndUnseal(vault);
    }
    
    // if vault is already initialized, we need to unseal it before making any other requests
    const unsealKey = process.env.NANVC_VAULT_UNSEAL_KEY;
    if (!unsealKey) {
        throw new Error('NANVC_VAULT_UNSEAL_KEY environment variable is not set');
    }
    const unsealResponse = await vault.unseal({
            key: unsealKey,
    });

    if (!unsealResponse.succeeded) {
        throw new Error(unsealResponse.errorMessage ?? 'Vault unseal failed');
    }

    // ensure that secret path is mounted
    await vault.mount('secret', { type: 'kv' });
    // now we can write and read secrets
    await vault.write('/secret/my-app/my-secret', {
        foo: 'AnaAreM3r3',
    });
    const secretResponse = await vault.read('/secret/my-app/my-secret');
    console.log(secretResponse);
    
    const auditResponse = await vault.enableAudit('/test-audit', {
        type: 'file',
        options: {  
            path: '/var/log/vault/audit-log.json',
        },
    });
    console.log(auditResponse);

    const auditHashResponse = await vault.auditHash('test-audit', { input: 'foo' });
    console.log(auditHashResponse);

    const disableAuditResponse = await vault.disableAudit('/test-audit');
    console.log(disableAuditResponse);
}

main().catch(console.error);
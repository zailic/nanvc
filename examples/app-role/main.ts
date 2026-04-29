import assert from 'node:assert';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { OperatorPersona } from '../common/personas/operator.js';
import { VaultClientError } from '../../src/main.js';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};
const assertInstanceOf = <T extends abstract new (...args: never[]) => unknown>(
    value: unknown,
    ctor: T,
): void => assert.ok(value instanceof ctor);

async function main(): Promise<void> {

    const operator = OperatorPersona.v2({ envPath: ENV_PATH });
    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('secret');
    });

    const admin = AdminPersona.v2();
    const credentials = await admin.withWorkflow(async ({ vault }) => {
        // Creating a secret to demostrate retrieval with the AppRole credentials later in the app workflow     
        await vault.secret.kv.v2.write('secret', 'mysql/webapp', { ...secretData }).unwrap();
        // Enable AppRole auth method and create an AppRole with permissions to read the secret created above
        await admin.enableAppRoleAuth();
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            "path \"secret/data/mysql/webapp\" {",
            "  capabilities = [\"read\"]",
            "}",
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);      
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });
        // Create credentials for the AppRole that will be used 
        // by the persona app to authenticate and retrieve the secret
        return admin.createAppRoleCredentials('jenkins');
    });

    const app = AppPersona.v2();
    await app.withWorkflow(async ({ vault }) => {
        // Authenticate with Vault using the AppRole credentials created in the admin workflow
        await app.loginWithAppRole(credentials);
        // Retrieve the secret created in the admin workflow using the AppRole credentials
        const secretResponse = await vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        // let's try to delete the secret to demonstrate that the AppRole credentials don't have permissions to do so
        const deleteError: unknown = await vault.secret.kv.v2.delete('secret', 'mysql/webapp').unwrapErr();
        assertInstanceOf(deleteError, VaultClientError);
        assert.strictEqual(
            (deleteError as VaultClientError).status,
            403,
            'Expected a 403 Forbidden error when trying to delete the secret with insufficient permissions',
        );
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

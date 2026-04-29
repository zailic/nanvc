import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { OperatorPersona } from '../common/personas/operator.js';


const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

async function main(): Promise<void> {
    const operator = OperatorPersona.v2({ envPath: ENV_PATH });

    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('secret');
    });

    const admin = AdminPersona.v2();
    const wrappingToken = await admin.withWorkflow(async ({ vault }) => {
        await vault.secret.kv.v2.write('secret', 'mysql/webapp', secretData).unwrap();
        
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

        const credentials = await admin.createAppRoleCredentials('jenkins');
        // Create a wrapping token that encapsulates the AppRole credentials
        // This wrapping token should be used by the persona app
        const wrappedResponse = await vault.sys.wrapping.wrap({
            role_id: credentials.roleId,
            secret_id: credentials.secretId,
        }, '60s').unwrap();
        const wrappingToken = wrappedResponse.wrap_info?.token;
        if (!wrappingToken) {
            throw new Error('Failed to create wrapping token');
        }

        return wrappingToken;
    });

    const app = AppPersona.v2();
    await app.withWorkflow(async ({ vault }) => {
        // Unwrap the credentials using the wrapping token retrieved from admin workflow
        const unwrapResponse = await vault.sys.wrapping.unwrap(wrappingToken).unwrap();
        const roleId = unwrapResponse.data?.role_id as string | undefined;
        const secretId = unwrapResponse.data?.secret_id as string | undefined;

        if (!roleId || !secretId) {
            throw new Error('Failed to unwrap wrapping token and retrieve credentials');
        }

        await app.loginWithAppRole({roleId, secretId});
        
        const secretResponse = await vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { expectSuccess } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';
import type { VaultResponseData } from '../common/personas/types.js';

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};
async function main(): Promise<void> {
    const operator = OperatorPersona.v1({ envPath: ENV_PATH });

    await operator.withWorkflow(async () => {
        await operator.ensureVaultIsReady();
        await operator.ensureKvMountAvailable('credentials');
    });

    const admin = AdminPersona.v1();
    const credentials = await admin.withWorkflow(async ({ vault }) => {
        // Creating a secret to demostrate retrieval with the AppRole credentials later in the app workflow
        await expectSuccess(
            vault.write('/credentials/mysql/webapp', secretData),
            'Vault KV v1 write failed',
        );
        // Enable AppRole auth method
        await admin.enableAppRoleAuth();
        // Creating a policy that will be attached subsequently to the AppRole demo 
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'credentials/mysql/webapp'",
            "path \"credentials/mysql/webapp\" {",
            "  capabilities = [\"read\"]",
            "}",
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);
        // Create an AppRole and associate the policy created above to it.
        // The AppRole credentials created in the next step will
        // inherit the permissions granted by the policy attached to the AppRole
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        return admin.createAppRoleCredentials('jenkins');
    });

    const app = AppPersona.v1();
    await app.withWorkflow(async ({ vault }) => {
        await app.loginWithAppRole(credentials);

        const secretResponse = await expectSuccess(
            vault.read('/credentials/mysql/webapp'),
            'Vault KV v1 read failed',
        );
        const secret = secretResponse.apiResponse as VaultResponseData<{
            db_name: string;
            username: string;
            password: string;
        }> | undefined;

        assert.deepStrictEqual(
            secret?.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

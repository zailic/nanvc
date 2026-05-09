import assert from 'node:assert';

import type { AdminPersona } from '../common/personas/admin.js';
import type { AppPersona } from '../common/personas/app.js';
import type { OperatorPersona } from '../common/personas/operator.js';
import type { VaultResponseData, AppRoleCredentials } from '../common/personas/types.js';
import { expectSuccess } from '../common/personas/helpers.js';
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';

const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

@example('AppRole authentication example')
class AppRoleExample {
    private credentials!: AppRoleCredentials;

    @workflow('operator', 'Prerequisites: ensure Vault is prepared and kv secrets engine is enabled')
    @runAs({ persona: 'operator', version: 'v1' })
    public async prepareVault(operator: OperatorPersona<'v1'>): Promise<void> {
        await operator.ensureKvMountAvailable('credentials', 1);
    }

    @workflow('admin', 'Configure AppRole and create credentials')
    @runAs({ persona: 'admin', version: 'v1' })
    public async adminWorkflow(admin: AdminPersona<'v1'>): Promise<void> {
        await expectSuccess(admin.vault.write('/credentials/mysql/webapp', secretData), 'Vault KV v1 write failed');

        await admin.enableAppRoleAuth();

        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'credentials/mysql/webapp'",
            'path "credentials/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);

        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        this.credentials = await admin.createAppRoleCredentials('jenkins');
    }

    @workflow('app', 'Log in with AppRole credentials and check policy permissions')
    @runAs({ persona: 'app', version: 'v1' })
    public async appWorkflow(app: AppPersona<'v1'>): Promise<void> {
        await app.loginWithAppRole(this.credentials);

        const secretResponse = await expectSuccess(
            app.vault.read('/credentials/mysql/webapp'),
            'Vault KV v1 read failed',
        );
        const secret = secretResponse.apiResponse as
            | VaultResponseData<{
                  db_name: string;
                  username: string;
                  password: string;
              }>
            | undefined;

        assert.deepStrictEqual(secret?.data, secretData, 'Retrieved secret data does not match the expected value');
    }
}

runExample(AppRoleExample).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

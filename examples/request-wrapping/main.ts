import assert from 'node:assert';

import type { AdminPersona } from '../common/personas/admin.js';
import type { AppPersona } from '../common/personas/app.js';
import type { OperatorPersona } from '../common/personas/operator.js';
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';

const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

@example('Request wrapping example')
class RequestWrappingExample {
    private wrappingToken!: string;

    @workflow('operator', 'Prerequisites: prepare Vault with a secret')
    @runAs({ persona: 'operator' })
    public async prepareVault(operator: OperatorPersona<'v2'>): Promise<void> {
        await operator.ensureKvMountAvailable('secret');
    }

    @workflow('admin', 'Configure AppRole and create wrapped credentials')
    @runAs({ persona: 'admin' })
    public async adminWorkflow(admin: AdminPersona<'v2'>): Promise<void> {
        await admin.vault.secret.kv.v2.write('secret', 'mysql/webapp', secretData).unwrap();
        await admin.enableAppRoleAuth();
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            'path "secret/data/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });
        const credentials = await admin.createAppRoleCredentials('jenkins');
        const wrappedResponse = await admin.vault.sys.wrapping
            .wrap(
                {
                    role_id: credentials.roleId,
                    secret_id: credentials.secretId,
                },
                '60s',
            )
            .unwrap();
        const wrappingToken = wrappedResponse.wrap_info?.token;
        if (!wrappingToken) {
            throw new Error('Failed to create wrapping token');
        }
        this.wrappingToken = wrappingToken;
    }

    @workflow('app', 'Unwrap credentials and access secret')
    @runAs({ persona: 'app' })
    public async appWorkflow(app: AppPersona<'v2'>): Promise<void> {
        app.vault.setToken(null);
        const unwrapResponse = await app.vault.sys.wrapping.unwrap(this.wrappingToken).unwrap();
        const roleId = unwrapResponse.data?.role_id as string | undefined;
        const secretId = unwrapResponse.data?.secret_id as string | undefined;
        if (!roleId || !secretId) {
            throw new Error('Failed to unwrap wrapping token and retrieve credentials');
        }
        await app.loginWithAppRole({ roleId, secretId });
        const secretResponse = await app.vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            'Retrieved secret data does not match the expected value',
        );
    }
}

runExample(RequestWrappingExample).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

import assert from 'node:assert';
import type { AdminPersona } from '../common/personas/admin.js';
import type { AppPersona } from '../common/personas/app.js';
import type { OperatorPersona } from '../common/personas/operator.js';
import { VaultClientError } from '../../src/main.js';
import { example, runAs, runExample, workflow } from '../common/workflow/decorators.js';
import type { AppRoleCredentials } from '../common/personas/types.js';
import { assertInstanceOf } from '../common/assert.js';

const CREDENTIALS = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

@example('AppRole authentication example')
class AppRoleExample {
    private credentials!: AppRoleCredentials;

    @workflow('operator', 'Prerequisites: prepare Vault with an AppRole and a secret')
    @runAs({ persona: 'operator' })
    public async prepareVault(operator: OperatorPersona<'v2'>): Promise<void> {
        await operator.ensureKvMountAvailable('secret');
    }

    @workflow('admin', 'Configure AppRole and create credentials')
    @runAs({ persona: 'admin' })
    public async adminWorkflow(admin: AdminPersona<'v2'>): Promise<void> {
        await admin.vault.secret.kv.v2.write('secret', 'mysql/webapp', { ...CREDENTIALS }).unwrap();
        await admin.vault.auth.enableAuthMethod('approle', { type: 'approle' }).unwrap();
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            'path "secret/data/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.vault.sys.policies.acl.write('jenkins', { policy: jenkinsPolicy }).unwrap();
        await admin.vault.auth
            .registerAppRole('jenkins', {
                token_policies: ['jenkins'],
                token_ttl: '20m',
                token_max_ttl: '30m',
            })
            .unwrap();

        this.credentials = await admin.createAppRoleCredentials('jenkins');
    }

    @workflow('app', 'Log in with AppRole credentials and check policy permissions')
    @runAs({ persona: 'app' })
    public async appWorkflow(app: AppPersona<'v2'>): Promise<void> {
        await app.vault.auth
            .loginWithAppRole({
                role_id: this.credentials.roleId,
                secret_id: this.credentials.secretId,
            })
            .unwrap();
        const secretResponse = await app.vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        const deleteError: unknown = await app.vault.secret.kv.v2.delete('secret', 'mysql/webapp').unwrapErr();
        assertInstanceOf(deleteError, VaultClientError);
        assert.strictEqual(
            (deleteError as VaultClientError).status,
            403,
            'Expected a 403 Forbidden error when trying to delete the secret with insufficient permissions',
        );
        assert.deepStrictEqual(
            secretResponse.data,
            CREDENTIALS,
            'Retrieved secret data does not match the expected value',
        );
    }
}

runExample(AppRoleExample).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

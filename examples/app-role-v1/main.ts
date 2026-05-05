import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { expectSuccess, printSuccessBanner } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';
import type { VaultResponseData } from '../common/personas/types.js';
import { createLegacyTestVaultClient } from '../../test/helpers/vault.js';

const VAULT_CLUSTER_ADDRESS = process.env.NANVC_VAULT_CLUSTER_ADDRESS ?? 'http://127.0.0.1:8200';
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};
async function main(): Promise<void> {
    const rootVault = await createLegacyTestVaultClient({ clusterAddress: VAULT_CLUSTER_ADDRESS });

    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed, then mount KV v1 at 'credentials'.
    // This example uses the original VaultClient (v1 API) throughout.
    const operator = OperatorPersona.v1({ client: rootVault });

    await operator.withWorkflow(async () => {
        await operator.ensureKvMountAvailable('credentials');
    });

    const admin = AdminPersona.v1({ client: rootVault });
    const credentials = await admin.withWorkflow(async ({ vault }) => {
        // ── Step 2: Admin — write the application secret ───────────────────────
        // Store a database credential set that the app will read later.
        // KV v1 stores data at the path directly with no versioning.
        await expectSuccess(vault.write('/credentials/mysql/webapp', secretData), 'Vault KV v1 write failed');

        // ── Step 3: Admin — enable AppRole auth method ─────────────────────────
        // AppRole is a machine-oriented auth method that issues tokens in exchange
        // for a role_id (public) and a secret_id (private, one-time-use).
        await admin.enableAppRoleAuth();

        // ── Step 4: Admin — write a least-privilege policy ────────────────────
        // The policy grants read-only access to the single secret path.
        // The app token will only be able to call 'read' on that path.
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'credentials/mysql/webapp'",
            'path "credentials/mysql/webapp" {',
            '  capabilities = ["read"]',
            '}',
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);

        // ── Step 5: Admin — register the AppRole and bind the policy ──────────
        // The role defines token TTLs and attaches the 'jenkins' policy so that
        // any token issued via this role inherits only its permissions.
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        // ── Step 6: Admin — generate role_id and secret_id ────────────────────
        // role_id is a stable identifier (like a username).
        // secret_id is a one-time credential (like a password).
        // Together they are exchanged for a scoped Vault token.
        return admin.createAppRoleCredentials('jenkins');
    });

    const app = AppPersona.v1();
    await app.withWorkflow(async ({ vault }) => {
        // ── Step 7: App — log in with AppRole credentials ─────────────────────
        // Exchange role_id + secret_id for a short-lived Vault token that carries
        // only the 'jenkins' policy. Subsequent calls use this token automatically.
        await app.loginWithAppRole(credentials);

        // ── Step 8: App — read the secret and verify data ─────────────────────
        // The 'jenkins' policy allows read; the KV v1 response wraps the data
        // inside an `apiResponse.data` envelope from the legacy client.
        const secretResponse = await expectSuccess(vault.read('/credentials/mysql/webapp'), 'Vault KV v1 read failed');
        const secret = secretResponse.apiResponse as
            | VaultResponseData<{
                  db_name: string;
                  username: string;
                  password: string;
              }>
            | undefined;

        assert.deepStrictEqual(secret?.data, secretData, 'Retrieved secret data does not match the expected value');
    });

    printSuccessBanner('AppRole v1 workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

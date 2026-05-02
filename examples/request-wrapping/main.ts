import assert from 'node:assert';

import { AdminPersona } from '../common/personas/admin.js';
import { AppPersona } from '../common/personas/app.js';
import { printSuccessBanner } from '../common/personas/helpers.js';
import { OperatorPersona } from '../common/personas/operator.js';
import { createTestVaultClient } from '../../test/helpers/vault.js';

const VAULT_CLUSTER_ADDRESS = process.env.NANVC_VAULT_CLUSTER_ADDRESS ?? 'http://127.0.0.1:8200';
const secretData = {
    db_name: 'users',
    username: 'admin',
    password: 'passw0rd',
};

async function main(): Promise<void> {
    const rootVault = await createTestVaultClient({ clusterAddress: VAULT_CLUSTER_ADDRESS });

    // ── Step 1: Operator — prepare Vault ──────────────────────────────────────
    // Initialize and unseal Vault if needed, then mount KV v2 at 'secret'.
    const operator = OperatorPersona.v2({ client: rootVault });

    await operator.withWorkflow(async () => {
        await operator.ensureKvMountAvailable('secret');
    });

    const admin = AdminPersona.v2({ client: rootVault });
    const wrappingToken = await admin.withWorkflow(async ({ vault }) => {
        // ── Step 2: Admin — write the application secret ───────────────────────
        // Store a database credential set that the app will read later using
        // the scoped token obtained through the wrapped AppRole login.
        await vault.secret.kv.v2.write('secret', 'mysql/webapp', secretData).unwrap();

        // ── Step 3: Admin — enable AppRole auth method ─────────────────────────
        // AppRole is a machine-oriented auth method that issues tokens in exchange
        // for a role_id (public) and a secret_id (private, one-time-use).
        await admin.enableAppRoleAuth();

        // ── Step 4: Admin — write a least-privilege policy ────────────────────
        // The policy grants read-only access to the single secret path.
        const jenkinsPolicy = [
            "# Read-only permission on secrets stored at 'secret/data/mysql/webapp'",
            "path \"secret/data/mysql/webapp\" {",
            "  capabilities = [\"read\"]",
            "}",
        ].join('\n');
        await admin.createPolicy('jenkins', jenkinsPolicy);

        // ── Step 5: Admin — register the AppRole and bind the policy ──────────
        // The role defines token TTLs and attaches the 'jenkins' policy.
        await admin.registerAppRole('jenkins', {
            token_policies: ['jenkins'],
            token_ttl: '20m',
            token_max_ttl: '30m',
        });

        // ── Step 6: Admin — generate AppRole credentials ──────────────────────
        // Produce the role_id and secret_id that will be wrapped in the next step.
        const credentials = await admin.createAppRoleCredentials('jenkins');

        // ── Step 7: Admin — wrap credentials in a single-use token ────────────
        // Vault stores the credentials inside a cubbyhole and returns a
        // wrapping token with a short TTL (60 s). Only one successful unwrap
        // is allowed; any further attempt returns an error, preventing replay.
        // The admin hands only this wrapping token to the app — not the raw
        // role_id / secret_id.
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
        // ── Step 8: App — unwrap the wrapping token ───────────────────────────
        // The app calls sys.wrapping.unwrap with the single-use token it received
        // from the admin. Vault validates the token, returns the wrapped payload
        // (role_id + secret_id), and destroys the cubbyhole — one use only.
        const unwrapResponse = await vault.sys.wrapping.unwrap(wrappingToken).unwrap();
        const roleId = unwrapResponse.data?.role_id as string | undefined;
        const secretId = unwrapResponse.data?.secret_id as string | undefined;

        if (!roleId || !secretId) {
            throw new Error('Failed to unwrap wrapping token and retrieve credentials');
        }

        // ── Step 9: App — log in with the unwrapped credentials ───────────────
        // Exchange role_id + secret_id for a short-lived token scoped to the
        // 'jenkins' policy. The wrapping token is now consumed and cannot be reused.
        await app.loginWithAppRole({ roleId, secretId });

        // ── Step 10: App — read the secret and verify data ────────────────────
        // The scoped token has read permission on the secret path; the retrieved
        // data must match what the admin stored in Step 2.
        const secretResponse = await vault.secret.kv.v2.read('secret', 'mysql/webapp').unwrap();
        assert.deepStrictEqual(
            secretResponse.data,
            secretData,
            "Retrieved secret data does not match the expected value",
        );
    });

    printSuccessBanner('Request wrapping workflow complete');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

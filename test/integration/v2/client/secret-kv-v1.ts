import assert from 'node:assert/strict';
import type { VaultSecretKvV1Client, VaultSystemMountClient } from '../../../../src/v2/index.js';
import { suite, test, beforeAll } from '../../../mocha/decorators.js';
import { createTestVaultClient } from '../../../helpers/vault.js';

type SecretData = {
    foo: string;
};

@suite('VaultClientV2 KV v1 integration test cases.')
export class VaultSecretKvV1ClientIntegrationTests {
    private client!: VaultSecretKvV1Client;
    private mount!: VaultSystemMountClient;

    @beforeAll()
    public async beforeAll() {
        const vc = await createTestVaultClient();
        this.client = vc.secret.kv.v1;
        this.mount = vc.sys.mount;
    }

    @test('should write, read and list secrets on the default secret mount')
    public async shouldWriteReadAndListSecretsOnTheDefaultSecretMountTest() {
        const secretMount = 'secret';
        const secretPath = 'integration-v2/my-secret';

        await this.ensureSecretMountAvailable();

        const [writeData, writeError] = await this.client.write(secretMount, secretPath, { foo: 'bar-v2' });
        const [secret, readError] = await this.client.read<SecretData>(secretMount, secretPath);
        const [keys, listError] = await this.client.list(secretMount, 'integration-v2');

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.equal(readError, null);
        assert.deepEqual(secret, { foo: 'bar-v2' });
        assert.equal(listError, null);
        assert.equal(Array.isArray(keys), true);
    }

    protected async ensureSecretMountAvailable(): Promise<void> {
        const [, error] = await this.mount.enable('secret', { type: 'kv' });
        if (error && !error.isMountAlreadyExistsError()) {
            throw error;
        }
    }
}

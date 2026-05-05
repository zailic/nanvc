import assert from 'node:assert/strict';
import type { RawVaultClient, VaultSecretCubbyholeClient } from '../../../../src/v2/index.js';
import { suite, test, beforeAll } from '../../../mocha/decorators.js';
import { createTestVaultClient } from '../../../helpers/vault.js';
import { VaultClientError, VaultClientV2 } from '../../../../src/v2/index.js';

@suite('VaultClientV2 cubbyhole secrets engine integration tests')
export class VaultSecretCubbyholeClientIntegrationTests {
    private client!: VaultSecretCubbyholeClient;
    private raw!: RawVaultClient;

    @beforeAll()
    public async beforeAll() {
        const vc = await createTestVaultClient();
        this.client = vc.secret.cubbyhole;
        this.raw = vc.raw;
    }

    @test('should write, read, list and delete a secret in the cubbyhole')
    public async shouldWriteReadListAndDeleteSecret() {
        const secretPath = 'integration-v2/cubbyhole-secret';
        const payload = { token: 'cubbyhole-test-value', nested: { key: 'val' } };

        // Clean up before test
        await this.client.delete(secretPath).unwrapOr(undefined);

        // Write
        const [writeData, writeError] = await this.client.write(secretPath, payload);
        assert.equal(writeError, null);
        assert.equal(writeData, undefined);

        // Read
        const [readData, readError] = await this.client.read<typeof payload>(secretPath);
        assert.equal(readError, null);
        assert.deepEqual(readData, payload);

        // List at parent prefix
        const [listData, listError] = await this.client.list('integration-v2');
        assert.equal(listError, null);
        assert.equal(Array.isArray(listData), true);
        assert.equal(listData.includes('cubbyhole-secret'), true);

        // Delete
        const [deleteData, deleteError] = await this.client.delete(secretPath);
        assert.equal(deleteError, null);
        assert.equal(deleteData, undefined);

        // Read after delete should return an error
        const [deletedData, deletedError] = await this.client.read(secretPath);
        assert.equal(deletedData, null);
        assert.equal(deletedError instanceof VaultClientError, true);
        assert.equal(deletedError?.code, 'HTTP_ERROR');
        assert.equal(deletedError?.status, 404);
    }

    @test('should return an error when reading a non-existent cubbyhole secret')
    public async shouldReturnErrorWhenReadingNonExistentCubbyholeSecret() {
        const [data, error] = await this.client.read('integration-v2/does-not-exist');

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'HTTP_ERROR');
        assert.equal(error?.status, 404);
    }

    @test('cubbyhole should be isolated per token')
    public async shouldIsolateCubbyholePerToken() {
        // Create a child token and write to cubbyhole with root, then verify isolation
        const secretPath = 'isolation-test/secret';
        const rootPayload = { owner: 'root' };

        await this.client.delete(secretPath).unwrapOr(undefined);

        const [, writeError] = await this.client.write(secretPath, rootPayload);
        assert.equal(writeError, null);

        // Create a child token
        const [tokenData, tokenError] = await this.raw.post<{
            auth?: { client_token?: string };
        }>('/auth/token/create', { body: { ttl: '5m', policies: ['default'] } });
        assert.equal(tokenError, null);
        const childToken = tokenData?.auth?.client_token;
        assert.equal(typeof childToken, 'string');

        // Use the child token to attempt reading root's cubbyhole path — should 404
        const childClient = new VaultClientV2({
            clusterAddress: 'http://vault.local:8200',
            authToken: childToken,
        });
        const [childData, childError] = await childClient.secret.cubbyhole.read(secretPath);
        assert.equal(childData, null);
        assert.equal(childError instanceof VaultClientError, true);
        assert.equal(childError?.status, 404);

        // Clean up
        await this.client.delete(secretPath).unwrapOr(undefined);
    }
}

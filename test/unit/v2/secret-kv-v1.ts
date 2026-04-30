import type { SinonSandbox } from 'sinon';
import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { VaultSecretKvV1Client } from '../../../src/v2/client/secret-kv-v1.js';
import { VaultClientError } from '../../../src/main.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';


describe('VaultSecretKvV1Client unit test cases.', function () {
    let sandbox: SinonSandbox;

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should surface resolveKvV1PathParams validation errors', async function() {
        const client = new VaultSecretKvV1Client(new RawVaultClient());

        const [deleteData, deleteError] = await client.delete('some-path', '');
        const [readData, readError] = await client.read('', '');
        const [writeData, writeError] = await client.write('invalid-path', { foo: 'bar' });
        const [listData, listError] = await client.list('');
        
        assert.equal(deleteData, null);
        assert.equal(deleteError instanceof VaultClientError, true);
        assert.equal(deleteError?.code, 'VALIDATION_ERROR');
        assert.equal(deleteError?.message, `Expected a KV v1 secret path, got ""`);

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV v1 mount path, got ""');
        
        assert.equal(writeData, null);
        assert.equal(writeError instanceof VaultClientError, true);
        assert.equal(writeError?.code, 'VALIDATION_ERROR');
        assert.equal(writeError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "invalid-path"');

        assert.equal(listData, null);
        assert.equal(listError instanceof VaultClientError, true);
        assert.equal(listError?.code, 'VALIDATION_ERROR');
        assert.equal(listError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got ""');
    });
});
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { VaultClient } from './../../../src/lib/client.js';
import { VaultResponse } from '../../../src/lib/commands/spec.js';

const certFile = (name: string): string =>
    readFileSync(path.resolve(process.cwd(), 'test/util/vault/certs', name), 'utf8');

describe('VaultClient TLS integration test cases.', function () {
    const ca = certFile('ca.pem');
    const clientCert = certFile('client.crt');
    const clientKey = certFile('client.key');

    it('should connect to a TLS-enabled Vault with a custom CA', async function () {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://127.0.0.1:8201',
            tls: {
                ca,
                rejectUnauthorized: true,
            },
        });

        // When
        const result = await client.status();

        // Then
        assert.ok(result instanceof VaultResponse);
        assert.equal(result.succeeded, true);
        assert.equal(result.httpStatusCode, 200);
    });

    it('should fail against the mTLS listener without a client certificate', async function () {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://127.0.0.1:8202',
            tls: {
                ca,
                rejectUnauthorized: true,
            },
        });

        // When
        const result = await client.status();

        // Then
        assert.ok(result instanceof VaultResponse);
        assert.equal(result.succeeded, false);
        assert.notEqual(result.errorMessage, undefined);
    });

    it('should connect to the mTLS listener with a client certificate', async function () {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://127.0.0.1:8202',
            tls: {
                ca,
                cert: clientCert,
                key: clientKey,
                rejectUnauthorized: true,
            },
        });

        // When
        const result = await client.status();

        // Then
        assert.ok(result instanceof VaultResponse);
        assert.equal(result.succeeded, true);
        assert.equal(result.httpStatusCode, 200);
    });
});

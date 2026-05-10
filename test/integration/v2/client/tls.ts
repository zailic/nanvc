import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { suite, test } from '../../../mocha/decorators.js';
import { VaultClient } from '../../../../src/v2/client/vault-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';

const certFile = (name: string): string =>
    readFileSync(path.resolve(process.cwd(), 'test/util/vault/certs', name), 'utf8');

@suite('VaultClient TLS integration test cases.')
export class VaultClientTlsIntegrationTests {
    private ca = certFile('ca.pem');
    private clientCert = certFile('client.crt');
    private clientKey = certFile('client.key');

    @test('should connect to a TLS-enabled Vault with a custom CA')
    async shouldConnectToTlsEnabledVaultWithCustomCA() {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://localhost:8201',
            tls: {
                ca: this.ca,
                cert: this.clientCert,
                key: this.clientKey,
            },
        });

        // When
        const err = await client.sys.status().unwrapErr();

        // Then

        // We didn't intialized the invoked vault server bove
        // so the /sys/health with return 501 status code(uninitialized)
        // To verify the SSL connection was successful, we check the response
        // body which should contain the status details of the vault server
        // return by the /sys/health endpoint. If the SSL connection had failed,
        // we would not have received a response body with these details.
        assert.equal(err instanceof VaultClientError, true);
        assert.equal(err?.code, 'HTTP_ERROR');
        assert.equal(err?.status, 501);
        assert.equal(err.responseBody?.initialized, false);
        assert.equal(err.responseBody?.sealed, true);
    }

    @test('should fail to connect to a TLS-enabled Vault without a custom CA')
    async shouldFailToConnectToTlsEnabledVaultWithoutCustomCA() {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://localhost:8201',
        });

        // When
        const err = await client.sys.status().unwrapErr();

        // Then
        assert.equal(err instanceof VaultClientError, true);
        assert.equal(err?.code, 'NETWORK_ERROR');
    }

    @test('should fail against the mTLS listener without a client certificate')
    async shouldFailAgainstMtlsListenerWithoutClientCertificate() {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://localhost:8202',
            tls: {
                ca: this.ca,
                rejectUnauthorized: true,
            },
        });

        // When
        const err = await client.sys.status().unwrapErr();

        // Then
        assert.equal(err instanceof VaultClientError, true);
        assert.equal(err?.code, 'NETWORK_ERROR');
    }

    @test('should connect to the mTLS listener with a client certificate')
    async shouldConnectToMtlsListenerWithClientCertificate() {
        // Given
        const client = new VaultClient({
            clusterAddress: 'https://localhost:8202',
            tls: {
                ca: this.ca,
                cert: this.clientCert,
                key: this.clientKey,
                rejectUnauthorized: true,
            },
        });

        // When
        const err = await client.sys.status().unwrapErr();

        // Then

        // Similar to the first test case, we expect a 501 status code because the vault server is not initialized.
        // The presence of the response body with the vault server's health status details confirms that the SSL connection was successful.
        assert.equal(err instanceof VaultClientError, true);
        assert.equal(err?.code, 'HTTP_ERROR');
        assert.equal(err?.status, 501);
        assert.equal(err.responseBody?.initialized, false);
        assert.equal(err.responseBody?.sealed, true);
    }
}

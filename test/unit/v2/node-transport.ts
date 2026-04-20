import assert from 'node:assert/strict';

import { NodeVaultTransport } from '../../../src/v2/transport/node-transport.js';

describe('NodeVaultTransport unit test cases.', function () {
    it('should build URLs from explicit options with LIST and query parameters', function () {
        const transport = new NodeVaultTransport({
            apiVersion: 'v2',
            clusterAddress: 'https://vault.example.test/',
        });

        const url = getPrivate<URL>(transport, 'buildUrl', {
            method: 'LIST',
            path: '/secret/apps',
            query: {
                limit: 10,
                optional: undefined,
                recurse: true,
            },
        });

        assert.equal(url.toString(), 'https://vault.example.test/v2/secret/apps?list=true&limit=10&recurse=true');
    });

    it('should build URLs from environment defaults when options are omitted', function () {
        const originalClusterAddress = process.env.NANVC_VAULT_CLUSTER_ADDRESS;
        const originalApiVersion = process.env.NANVC_VAULT_API_VERSION;
        process.env.NANVC_VAULT_CLUSTER_ADDRESS = 'http://vault.local:8200/';
        process.env.NANVC_VAULT_API_VERSION = 'v3';

        try {
            const transport = new NodeVaultTransport();

            const url = getPrivate<URL>(transport, 'buildUrl', {
                method: 'GET',
                path: '/sys/health',
            });

            assert.equal(url.toString(), 'http://vault.local:8200/v3/sys/health');
        } finally {
            restoreEnv('NANVC_VAULT_CLUSTER_ADDRESS', originalClusterAddress);
            restoreEnv('NANVC_VAULT_API_VERSION', originalApiVersion);
        }
    });

    it('should build request options with JSON body headers and tokens', function () {
        const transport = new NodeVaultTransport();
        const url = new URL('http://127.0.0.1:8200/v1/secret/apps?list=true');

        const options = getPrivate<Record<string, unknown>>(transport, 'buildRequestOptions', url, {
            headers: { 'X-Custom': 'custom' },
            method: 'LIST',
            path: 'secret/apps',
            token: 'vault-token',
        }, '{"hello":"vault"}');

        assert.equal(options.method, 'GET');
        assert.equal(options.path, '/v1/secret/apps?list=true');
        assert.equal(options.port, 8200);
        assert.deepEqual(options.headers, {
            Accept: 'application/json',
            'Content-Length': '17',
            'Content-Type': 'application/json',
            'X-Custom': 'custom',
            'X-Vault-Token': 'vault-token',
        });
    });

    it('should apply TLS options only for HTTPS URLs', function () {
        const transport = new NodeVaultTransport({
            tls: {
                ca: 'ca',
                cert: 'cert',
                key: 'key',
                passphrase: 'secret',
                rejectUnauthorized: false,
            },
        });

        const httpsOptions = getPrivate<Record<string, unknown>>(transport, 'buildRequestOptions', new URL('https://vault.local/v1/sys/health'), {
            method: 'GET',
            path: 'sys/health',
        });
        const httpOptions = getPrivate<Record<string, unknown>>(transport, 'buildRequestOptions', new URL('http://vault.local/v1/sys/health'), {
            method: 'GET',
            path: 'sys/health',
        });

        assert.equal(httpsOptions.ca, 'ca');
        assert.equal(httpsOptions.cert, 'cert');
        assert.equal(httpsOptions.key, 'key');
        assert.equal(httpsOptions.passphrase, 'secret');
        assert.equal(httpsOptions.rejectUnauthorized, false);
        assert.equal('ca' in httpOptions, false);
        assert.equal('cert' in httpOptions, false);
        assert.equal('key' in httpOptions, false);
    });
});

function getPrivate<T>(
    transport: NodeVaultTransport,
    method: 'buildRequestOptions' | 'buildUrl',
    ...args: unknown[]
): T {
    return (transport as unknown as Record<string, (...methodArgs: unknown[]) => T>)[method](...args);
}

function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}

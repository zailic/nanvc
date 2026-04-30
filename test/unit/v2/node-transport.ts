import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { VaultClientError } from '../../../src/v2/core/errors.js';
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

    it('should omit Content-Type and Content-Length when there is no body', function () {
        const transport = new NodeVaultTransport();
        const url = new URL('http://127.0.0.1:8200/v1/sys/health');

        const options = getPrivate<Record<string, unknown>>(transport, 'buildRequestOptions', url, {
            method: 'GET',
            path: 'sys/health',
        }, undefined);

        const headers = options.headers as Record<string, string>;
        assert.equal('Content-Type' in headers, false);
        assert.equal('Content-Length' in headers, false);
    });

    it('should preserve a pre-existing Content-Type header when building request options with a body', function () {
        const transport = new NodeVaultTransport();
        const url = new URL('http://127.0.0.1:8200/v1/secret/data/apps/demo');

        const options = getPrivate<Record<string, unknown>>(transport, 'buildRequestOptions', url, {
            headers: { 'Content-Type': 'application/merge-patch+json' },
            method: 'PATCH',
            path: 'secret/data/apps/demo',
        }, '{"foo":"bar"}');

        assert.equal((options.headers as Record<string, string>)['Content-Type'], 'application/merge-patch+json');
    });

    it('should resolve a successful HTTP response as an ok transport response', async function () {
        const { server, port } = await startLocalServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ initialized: true }));
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

            const response = await transport.request({ method: 'GET', path: 'sys/health', token: null });

            assert.equal(response.ok, true);
            assert.equal(response.status, 200);
            assert.deepEqual(response.body, { initialized: true });
        } finally {
            await closeServer(server);
        }
    });

    it('should return a non-ok response for non-2xx HTTP status codes', async function () {
        const { server, port } = await startLocalServer((_req, res) => {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errors: ['permission denied'] }));
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

            const response = await transport.request({ method: 'GET', path: 'sys/health', token: 'test-token' });

            assert.equal(response.ok, false);
            assert.equal(response.status, 403);
            assert.deepEqual(response.body, { errors: ['permission denied'] });
        } finally {
            await closeServer(server);
        }
    });

    it('should parse a non-JSON response body as a raw string', async function () {
        const { server, port } = await startLocalServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('plain text response');
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

            const response = await transport.request({ method: 'GET', path: 'sys/health', token: null });

            assert.equal(response.ok, true);
            assert.equal(response.body, 'plain text response');
        } finally {
            await closeServer(server);
        }
    });

    it('should return undefined body for empty HTTP responses', async function () {
        const { server, port } = await startLocalServer((_req, res) => {
            res.writeHead(204);
            res.end();
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

            const response = await transport.request({ method: 'DELETE', path: 'sys/mounts/secret', token: null });

            assert.equal(response.ok, true);
            assert.equal(response.status, 204);
            assert.equal(response.body, undefined);
        } finally {
            await closeServer(server);
        }
    });

    it('should write the serialized JSON body to the HTTP request', async function () {
        let capturedBody = '';
        const { server, port } = await startLocalServer((req, res) => {
            let data = '';
            req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
            req.on('end', () => {
                capturedBody = data;
                res.writeHead(200);
                res.end();
            });
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

            await transport.request({ body: { foo: 'bar' }, method: 'POST', path: 'secret/data/apps/demo', token: null });

            assert.equal(capturedBody, '{"foo":"bar"}');
        } finally {
            await closeServer(server);
        }
    });

    it('should reject with a NETWORK_ERROR when the connection is refused', async function () {
        const port = await unusedPort();
        const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}` });

        await assert.rejects(
            transport.request({ method: 'GET', path: 'sys/health', token: null }),
            (error: unknown) => {
                assert.equal(error instanceof VaultClientError, true);
                assert.equal((error as VaultClientError).code, 'NETWORK_ERROR');
                return true;
            },
        );
    });

    it('should reject with a TIMEOUT error when the request exceeds timeoutMs', async function () {
        const { server, port } = await startLocalServer((_req, _res) => {
            // intentionally never respond — let the client time out
        });

        try {
            const transport = new NodeVaultTransport({ clusterAddress: `http://127.0.0.1:${port}`, timeoutMs: 50 });

            await assert.rejects(
                transport.request({ method: 'GET', path: 'sys/health', token: null }),
                (error: unknown) => {
                    assert.equal(error instanceof VaultClientError, true);
                    assert.equal((error as VaultClientError).code, 'TIMEOUT');
                    return true;
                },
            );
        } finally {
            await closeServer(server);
        }
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

function startLocalServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; port: number }> {
    return new Promise((resolve) => {
        const server = createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, port });
        });
    });
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function unusedPort(): Promise<number> {
    return new Promise((resolve) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            server.close(() => resolve(port));
        });
    });
}

import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { VaultClient } from './../../../src/lib/client.js';
import { VaultResponse } from '../../../src/lib/commands/spec.js';
import { buildRequestOptions } from '../../../src/lib/commands/helpers.js';

import type { SinonSandbox } from 'sinon';

describe('VaultClient unit test cases.', function () {

    let sandbox: SinonSandbox;
    let client: VaultClient;

    beforeEach(function () {
        sandbox = createSandbox();
        client = new VaultClient(
            'https://fake.cluster.address:8200',
            'fake-token',
            'v1',
        );
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should fallback to default values', function () {
        // Given
        const c = new VaultClient();

        // Then
        assert.equal(c.token, null);
        assert.equal(c.apiVersion, 'v1');
        assert.equal(c.clusterAddress, 'http://127.0.0.1:8200');
    });

    it('baseUrl should contain api version', function () {
        // Given

        // When
        const baseUrl = client.getBaseUrl();

        // Then
        assert.equal(baseUrl, 'https://fake.cluster.address:8200/v1');
    });

    it('should handle path placeholders', function () {
        // Given
        const mountPoint = '/my-mount',
            mountPointPayload = {
                type: 'aws',
                config: {
                    force_no_cache: true,
                },
            },
            mountPointApiUriTemplate = '/sys/mounts/:mount_point',
            reqInitialData = {
                url: 'https://fake.cluster.address:8200',
                headers: {
                    'X-Vault-Token': 'fake-token',
                },
            } as Parameters<typeof buildRequestOptions>[1];
        // When
        const opts = buildRequestOptions(
            client.getBaseUrl(),
            reqInitialData,
            'POST',
            mountPointApiUriTemplate,
            [mountPoint, mountPointPayload],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/mounts/my-mount');
        assert.equal((opts.json as { type: string }).type, mountPointPayload.type);
    });

    it('should build addPolicy requests with the policy name and body', function () {
        // Given
        const requestData = {
            url: 'https://fake.cluster.address:8200',
            headers: {
                'X-Vault-Token': 'fake-token',
            },
        } as Parameters<typeof buildRequestOptions>[1];

        // When
        const opts = buildRequestOptions(
            client.getBaseUrl(),
            requestData,
            'POST',
            '/sys/policy/:name',
            ['integration-policy', { policy: 'path "secret/*" { capabilities = ["read"] }' }],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/policy/integration-policy');
        assert.equal((opts.json as { policy: string }).policy, 'path "secret/*" { capabilities = ["read"] }');
    });

    it('should build removePolicy requests with the policy name', function () {
        // Given
        const requestData = {
            url: 'https://fake.cluster.address:8200',
            headers: {
                'X-Vault-Token': 'fake-token',
            },
        } as Parameters<typeof buildRequestOptions>[1];

        // When
        const opts = buildRequestOptions(
            client.getBaseUrl(),
            requestData,
            'DELETE',
            '/sys/policy/:name',
            ['integration-policy'],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/policy/integration-policy');
        assert.equal(opts.body, undefined);
    });

    it('apiRequest method should be called within dynamic methods', async function () {

        // Given
        const vaultResponse = new VaultResponse(
            200, {
            file: {
                type: 'file',
                description: 'Store logs in a file',
                options: {
                    path: '/var/log/vault.log',
                },
            },
        });
        const spiedApiRequestMethod = sandbox.stub(client, 'apiRequest').resolves(vaultResponse);

        // When
        const result = await client.audits();

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.called, true);
    });

    it('should route addPolicy through apiRequest with the policy name and payload', async function () {
        // Given
        const vaultResponse = new VaultResponse(204);
        const spiedApiRequestMethod = sandbox.stub(client, 'apiRequest').resolves(vaultResponse);
        const payload = {
            policy: 'path "secret/*" { capabilities = ["read"] }',
        };

        // When
        const result = await client.addPolicy('integration-policy', payload);

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.calledOnce, true);
        assert.deepEqual(spiedApiRequestMethod.firstCall.args.slice(1), ['integration-policy', payload]);
    });

    it('should route removePolicy through apiRequest with the policy name', async function () {
        // Given
        const vaultResponse = new VaultResponse(204);
        const spiedApiRequestMethod = sandbox.stub(client, 'apiRequest').resolves(vaultResponse);

        // When
        const result = await client.removePolicy('integration-policy');

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.calledOnce, true);
        assert.deepEqual(spiedApiRequestMethod.firstCall.args.slice(1), ['integration-policy']);
    });

    it('Should take vault settings from environment', async function () {
        // Given
        sandbox.stub(process, 'env').value({
            NANVC_VAULT_CLUSTER_ADDRESS: 'http://vault.local:1234',
            NANVC_VAULT_AUTH_TOKEN: 'myt0k3n',
            NANVC_VAULT_API_VERSION: 'v2',
        });
        // When
        const vault = new VaultClient();

        // Then
        assert.equal(vault.apiVersion, 'v2');
        assert.equal(vault.token, 'myt0k3n');
        assert.equal(vault.clusterAddress, 'http://vault.local:1234');
    });

    it('should support object-based constructor options', function () {
        // Given
        const tls = {
            ca: 'ca-pem',
            cert: 'cert-pem',
            key: 'key-pem',
            passphrase: 'top-secret',
            rejectUnauthorized: true,
        };

        // When
        const vault = new VaultClient({
            apiVersion: 'v2',
            authToken: 'token-from-options',
            clusterAddress: 'https://vault.local:8200',
            tls,
        });

        // Then
        assert.equal(vault.apiVersion, 'v2');
        assert.equal(vault.token, 'token-from-options');
        assert.equal(vault.clusterAddress, 'https://vault.local:8200');

        const transportOptions = (vault as unknown as {
            buildTransportOptions(url: URL, requestData: { headers?: Record<string, string>; method?: string }): {
                ca?: string;
                cert?: string;
                key?: string;
                passphrase?: string;
                rejectUnauthorized?: boolean;
            };
        }).buildTransportOptions(
            new URL('https://vault.local:8200/v1/sys/health'),
            {
                headers: {
                    'X-Vault-Token': 'token-from-options',
                },
                method: 'GET',
            },
        );

        assert.equal(transportOptions.ca, tls.ca);
        assert.equal(transportOptions.cert, tls.cert);
        assert.equal(transportOptions.key, tls.key);
        assert.equal(transportOptions.passphrase, tls.passphrase);
        assert.equal(transportOptions.rejectUnauthorized, tls.rejectUnauthorized);
    });

    it('should not apply tls options to plain http requests', function () {
        // Given
        const vault = new VaultClient({
            clusterAddress: 'http://vault.local:8200',
            tls: {
                cert: 'cert-pem',
                key: 'key-pem',
            },
        });

        // When
        const transportOptions = (vault as unknown as {
            buildTransportOptions(url: URL, requestData: { method?: string }): {
                cert?: string;
                key?: string;
            };
        }).buildTransportOptions(
            new URL('http://vault.local:8200/v1/sys/health'),
            {
                method: 'GET',
            },
        );

        // Then
        assert.equal(transportOptions.cert, undefined);
        assert.equal(transportOptions.key, undefined);
    });
});

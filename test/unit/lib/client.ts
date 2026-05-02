import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { VaultClient } from './../../../src/lib/client.js';
import { VaultResponse } from '../../../src/lib/commands/spec.js';
import {suite, test, beforeEachTest, afterEachTest} from '../../mocha/decorators.js';
import { buildRequestOptions, MAX_URL_PART_LENGTH } from '../../../src/lib/commands/helpers.js';

import type { SinonSandbox } from 'sinon';

@suite('VaultClient unit test cases.')
export class VaultClientUnitTests {

    private sandbox!: SinonSandbox;
    private client!: VaultClient;
    
    @beforeEachTest()
    public beforeEach() {
        this.sandbox = createSandbox();
        this.client = new VaultClient(
            'https://fake.cluster.address:8200',
            'fake-token',
            'v1',
        );
    }

    @afterEachTest()
    public afterEach() {
        this.sandbox.restore();
    }

    @test('should fallback to default values')
    public shouldFallbackToDefaultValuesTest() {
        // Given
        const c = new VaultClient();

        // Then
        assert.equal(c.token, null);
        assert.equal(c.apiVersion, 'v1');
        assert.equal(c.clusterAddress, 'http://127.0.0.1:8200');
    };

    @test('baseUrl should contain api version')
    public baseUrlShouldContainApiVersionTest() {
        // Given

        // When
        const baseUrl = this.client.getBaseUrl();

        // Then
        assert.equal(baseUrl, 'https://fake.cluster.address:8200/v1');
    };

    @test('should handle path placeholders')
    public shouldHandlePathPlaceholdersTest() {
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
            this.client.getBaseUrl(),
            reqInitialData,
            'POST',
            mountPointApiUriTemplate,
            [mountPoint, mountPointPayload],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/mounts/my-mount');
        assert.equal((opts.json as { type: string }).type, mountPointPayload.type);
    };

    @test('should build addPolicy requests with the policy name and body')
    public shouldBuildAddPolicyRequestsTest() {
        // Given
        const requestData = {
            url: 'https://fake.cluster.address:8200',
            headers: {
                'X-Vault-Token': 'fake-token',
            },
        } as Parameters<typeof buildRequestOptions>[1];

        // When
        const opts = buildRequestOptions(
            this.client.getBaseUrl(),
            requestData,
            'POST',
            '/sys/policy/:name',
            ['integration-policy', { policy: 'path "secret/*" { capabilities = ["read"] }' }],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/policy/integration-policy');
        assert.equal((opts.json as { policy: string }).policy, 'path "secret/*" { capabilities = ["read"] }');
    };

    @test('should build removePolicy requests with the policy name')
    public shouldBuildRemovePolicyRequestsTest() {
        // Given
        const requestData = {
            url: 'https://fake.cluster.address:8200',
            headers: {
                'X-Vault-Token': 'fake-token',
            },
        } as Parameters<typeof buildRequestOptions>[1];

        // When
        const opts = buildRequestOptions(
            this.client.getBaseUrl(),
            requestData,
            'DELETE',
            '/sys/policy/:name',
            ['integration-policy'],
        );

        // Then
        assert.equal(opts.url, 'https://fake.cluster.address:8200/v1/sys/policy/integration-policy');
        assert.equal(opts.body, undefined);
    };

    @test('throw an error if URL part exceeds maximum length')
        public shouldThrowIfUrlPartExceedsMaxLengthTest() {
        // Given
        const longString = 'a'.repeat(MAX_URL_PART_LENGTH + 1);
        const requestData = {
            url: 'https://fake.cluster.address:8200',
            headers: {
                'X-Vault-Token': 'fake-token',
            },
        } as Parameters<typeof buildRequestOptions>[1];

        // When / Then
        assert.throws(() => {
            buildRequestOptions(
                this.client.getBaseUrl(),
                requestData,
                'GET',
                '/sys/mounts/:mount_point',
                [longString],
            );
        }, new RegExp(`URL part at index 1 exceeds maximum length of ${MAX_URL_PART_LENGTH} characters`));
    };

    @test('apiRequest method should be called within dynamic methods')
    public async shouldCallApiRequestWithinDynamicMethodsTest() {

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
        const spiedApiRequestMethod = this.sandbox.stub(
            this.client, 'apiRequest').resolves(vaultResponse);

        // When
        const result = await this.client.audits();

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.called, true);
    };

    @test('should route addPolicy through apiRequest with the policy name and payload')
    public async shouldRouteAddPolicyThroughApiRequestTest() {
        // Given
        const vaultResponse = new VaultResponse(204);
        const spiedApiRequestMethod = this.sandbox.stub(
            this.client, 'apiRequest').resolves(vaultResponse);
        const payload = {
            policy: 'path "secret/*" { capabilities = ["read"] }',
        };

        // When
        const result = await this.client.addPolicy('integration-policy', payload);

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.calledOnce, true);
        assert.deepEqual(spiedApiRequestMethod.firstCall.args.slice(1), ['integration-policy', payload]);
    };

    @test('should route removePolicy through apiRequest with the policy name')
    public async shouldRouteRemovePolicyThroughApiRequestTest() {
        // Given
        const vaultResponse = new VaultResponse(204);
        const spiedApiRequestMethod = this.sandbox.stub(this.client, 'apiRequest').resolves(vaultResponse);

        // When
        const result = await this.client.removePolicy('integration-policy');

        // Then
        assert.equal(result.succeeded, true);
        assert.equal(spiedApiRequestMethod.calledOnce, true);
        assert.deepEqual(spiedApiRequestMethod.firstCall.args.slice(1), ['integration-policy']);
    };

    @test('Should take vault settings from environment')
    public async shouldTakeVaultSettingsFromEnvironmentTest() {
        // Given
        this.sandbox.stub(process, 'env').value({
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
    };

    @test('should support object-based constructor options')
    public async shouldSupportObjectBasedConstructorOptionsTest() {
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
    };

    @test('should not apply tls options to plain http requests')
    public async shouldNotApplyTlsOptionsToPlainHttpRequestsTest() {
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
    };

};

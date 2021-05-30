import { suite, test } from '@testdeck/mocha';
import * as chai from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import {Options as HttpReqOptions } from 'got';
import { VaultClient } from './../../../src/lib/client';
import { VaultResponse } from '../../../src/lib/metadata/common';

const expect = chai.expect;

@suite('VaultClient unit test cases.')
class VaultClientTest {

    private sandbox: SinonSandbox;
    private client: VaultClient;

    public before() {
        this.sandbox = createSandbox();
        this.client = new VaultClient(
            'https://fake.cluster.address:8200',
            'fake-token',
            'v1',
        );
    }

    public after() {
        this.sandbox.restore();
    }

    @test('should fallback to default values')
    public shouldFallbackToDefaultValues() {
        // Given
        const client = new VaultClient();

        // Then
        expect(client.token).is.null;
        expect(client.apiVersion).equals('v1');
        expect(client.clusterAddress).equals('http://127.0.0.1:8200');
    }

    @test('baseUrl should contain api version')
    public baseUrlShouldContainApiVersion() {
        // Given

        // When
        const baseUrl = this.client.getBaseUrl();

        // Then
        expect(baseUrl).to.equal('https://fake.cluster.address:8200/v1');
    }

    @test('request sanitizer should handle path placeholders')
    public requestSanitizerShouldHandlePathPlaceholders() {
        // Given
        const spiedApiRequestMethod = this.sandbox.stub(this.client, 'apiRequest').resolves(null),
            mountPoint = 'my-mount',
            mountPointPayload = {
                type: 'aws',
                config: {
                    force_no_cache: true,
                },
            },
            mountPointApiUriTemplate = '/sys/mounts/:mount_point',
            reqInitialData: HttpReqOptions = {
                url: 'https://fake.cluster.address:8200',
                headers: {
                    'X-Vault-Token': 'fake-token',
                },
            };
        // When
        this.client.sanitizeRequest(
            reqInitialData,
            'POST',
            mountPointApiUriTemplate,
            [mountPoint, mountPointPayload],
        );

        // Then
        expect(reqInitialData.url).equals('https://fake.cluster.address:8200/v1/sys/mounts/my-mount');
        expect(reqInitialData.json.type).equals(mountPointPayload.type);
    }

    @test('apiRequest method should be called within dynamic methods')
    public async apiRequestMethodShouldBeCalledWithinDynamicMethods() {

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
        const spiedApiRequestMethod = this.sandbox.stub(this.client, 'apiRequest').resolves(vaultResponse);

        // When
        const result = await this.client.audits();

        // Then
        expect(result.succeeded).to.be.true;
        expect(spiedApiRequestMethod.called).to.be.true;
    }

    @test('Should take vault settings from environment')
    public async shouldTakeVaultSettingsFromEnvVars() {
        // Given
        this.sandbox.stub(process, 'env').value({
            NANVC_VAULT_CLUSTER_ADDRESS: 'http://vault.local:1234',
            NANVC_VAULT_AUTH_TOKEN: 'myt0k3n',
            NANVC_VAULT_API_VERSION: 'v2',
        });
        // When
        const vault = new VaultClient();

        // Then
        expect(vault.apiVersion).equals('v2');
        expect(vault.token).equals('myt0k3n');
        expect(vault.clusterAddress).equals('http://vault.local:1234');
    }
}
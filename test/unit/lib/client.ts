import { suite, test } from "mocha-typescript";
import * as chai from "chai";
import * as sinonjs from "sinon";
import * as request from "request-promise-native";
import { VaultClient } from "./../../../src/lib/client";
import { VaultResponse } from "../../../src/lib/metadata/common";

const expect = chai.expect;

@suite("VaultClient unit test cases.")
class VaultClientTest {

    private sandbox: sinon.SinonSandbox;
    private client: VaultClient;

    before() {
        this.sandbox = sinonjs.sandbox.create();
        this.client = new VaultClient(
            "https://fake.cluster.address:8200",
            "fake-token",
            "v1"
        );
    }

    after() {
        this.sandbox.restore();
    }

    @test("should fallback to default values")
    shouldFallbackToDefaultValues() {
        // Given
        let client = new VaultClient;

        // Then
        expect(client.token).is.null;
        expect(client.apiVersion).equals('v1');
        expect(client.clusterAddress).equals('http://127.0.0.1:8200')
    }

    @test("baseUrl should contain api version")
    baseUrlShouldContainApiVersion() {
        // Given

        // When
        let baseUrl = this.client.getBaseUrl();

        // Then
        expect(baseUrl).to.equal("https://fake.cluster.address:8200/v1");
    }

    @test("request sanitizer should handle path placeholders")
    requestSanitizerShouldHandlePathPlaceholders() {
        // Given
        let spiedApiRequestMethod = this.sandbox.stub(this.client, "apiRequest").resolves(null),
            reqInitialData: request.OptionsWithUrl = {
                url: 'https://fake.cluster.address:8200',
                headers: {
                    "X-Vault-Token": 'fake-token'
                },
                resolveWithFullResponse: true
            },
            mountPoint = 'my-mount',
            mountPointPayload = {
                "type": "aws",
                "config": {
                    "force_no_cache": true
                }
            },
            mountPointApiUriTemplate = "/sys/mounts/:mount_point";

        // When
        this.client.sanitizeRequest(
            reqInitialData,
            'POST',
            mountPointApiUriTemplate,
            [mountPoint, mountPointPayload]
        );

        // Then
        expect(reqInitialData.url).equals("https://fake.cluster.address:8200/v1/sys/mounts/my-mount");
        expect(reqInitialData.body.type).equals(mountPointPayload.type);
    }

    @test("apiRequest method should be called within dynamic methods")
    async apiRequestMethodShouldBeCalledWithinDynamicMethods() {

        // Given
        let vaultResponse = new VaultResponse(
            200, {
            "file": {
                "type": "file",
                "description": "Store logs in a file",
                "options": {
                    "path": "/var/log/vault.log"
                }
            }
        });
        let spiedApiRequestMethod = this.sandbox.stub(this.client, "apiRequest").resolves(vaultResponse);

        // When
        let result = await this.client.audits();

        // Then
        expect(result.succeded).to.be.true;
        expect(spiedApiRequestMethod.called).to.be.true;
    }
}
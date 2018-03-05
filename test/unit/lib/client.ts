import { suite, test } from "mocha-typescript";
import * as chai from "chai";
import * as sinonjs from "sinon";
import * as request from "request-promise-native";
import { VaultClient } from "./../../../src/lib/client";

const expect = chai.expect;

@suite("VaultClient unit test cases.")
class VaultClientTest {

    private sandbox: sinon.SinonSandbox;
    private client: VaultClient;

    before() {
        this.sandbox = sinonjs.sandbox.create();
        this.client = new VaultClient(
            "https://fake.cluster.address:8200",
            "fake-token"
        );
    }

    after() {
        this.sandbox.restore();
    }

    @test("baseUrl should contan api version")
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
        expect(reqInitialData.json).equals(mountPointPayload);
    }

    @test("apiRequest method should be called within dynamic methods")
    async apiRequestMethodShouldBeCalledWithinDynamicMethods() {

        // Given
        let spiedApiRequestMethod = this.sandbox.stub(this.client, "apiRequest").resolves({ intialized: true });

        // When
        let result = await this.client.isInitialized();

        // Then
        expect(result.intialized).to.be.true;
        expect(spiedApiRequestMethod.called).to.be.true;
    }

    @test("apiRequest method should fail")
    async apiRequestMethodShouldFail() {

        // When
        try {
            let result = await this.client.status();
        } catch (e) {
            // Then
            expect(e.message).matches(/Error: getaddrinfo/);
        }
    }
}
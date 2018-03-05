import { suite, test } from "mocha-typescript";
import * as chai from "chai";
import * as request from "request-promise-native";
import { VaultClient } from "./../../../src/lib/client";

const expect = chai.expect;

@suite("VaultClient integration test cases.")
class VaultClientIntegrationTest {

    private client: VaultClient;
    
    before() {
        this.client = new VaultClient("http://vault:8200");
    }

    @test("baseUrl should contain api version")
    baseUrlShouldContainApiVersion() {
        // Given

        // When
        let baseUrl = this.client.getBaseUrl();

        // Then
        expect(baseUrl).to.equal("http://vault:8200/v1");
    }

}
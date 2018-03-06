import { suite, test, skipOnError, timeout } from "mocha-typescript";
import * as chai from "chai";
import * as request from "request-promise-native";
import { VaultClient } from "./../../../src/lib/client";
import { VaultResponse } from "../../../src/lib/metadata";

const expect = chai.expect;

@suite("VaultClient integration test cases.")
class VaultClientIntegrationTest {

    private client: VaultClient;
    static rootToken: string;
    static unsealKey: string;
    
    before() {
        let args = [null, "http://vault.local:8200"];
        if(VaultClientIntegrationTest.rootToken) {
            args.push(VaultClientIntegrationTest.rootToken);
        }
        this.client = new (Function.prototype.bind.apply(VaultClient, args));
    }

    @test("vault initialisation process")
    async vaultInitialisationProcess(){
        // Given
        let payload = { secret_shares: 1, secret_threshold: 1 }
        
        // When
        let vaultResponse = await this.client.init(payload);

        // Then
        expect(vaultResponse.succeded).to.be.true;
        expect(vaultResponse.apiResponse.keys.length).equals(1);
        expect(vaultResponse.apiResponse.keys_base64.length).equals(1);
        expect(vaultResponse.apiResponse.root_token).not.empty;
        expect(vaultResponse.errorMessage).is.undefined;

        VaultClientIntegrationTest.rootToken = vaultResponse.apiResponse.root_token;
        VaultClientIntegrationTest.unsealKey = vaultResponse.apiResponse.keys[0];
        // testing  token setter 
        this.client.token = VaultClientIntegrationTest.rootToken;
        expect(this.client.token).equals(VaultClientIntegrationTest.rootToken);

    }

    @test("vault initialisation process should fail if is already initialized")
    async vaultInitialisationProcessShouldFail(){
        // Given
        let payload = { secret_shares: 1, secret_threshold: 1 }
        
        // When
        let vaultResponse = await this.client.init(payload);

        // Then
        expect(vaultResponse.succeded).to.be.false;    
        expect(vaultResponse.httpStatusCode).equals(400);  
    }

    @test("should get initialization status")
    async shouldGetIntializationStatus() {
        // Given

        // When
        let expectedResult = await this.client.isInitialized();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.apiResponse.initialized).to.be.true;
    }


    @test("should unseal vault")
    async shouldUnsealVault() {
        // Given

        // When
        let expectedResult = await this.client.unseal({ 
            secret_shares: 1, 
            key: VaultClientIntegrationTest.unsealKey
        });

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
    }

    @test("should write a secret")
    async shouldWriteSecret() {
        // Given
        let path = 'integration-tests/my-secret',
            secret = { "foo": "bar"};
        // When
        let expectedResult = await this.client.write(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
    } 

    @test("should update a secret")
    async shouldUpdateSecret() {
        // Given
        let path = 'integration-tests/my-secret',
            secret = { "foo": "bar-updated"};

        // When
        let expectedResult = await this.client.update(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
    } 

    @test("should read a secret")
    async shouldReadSecret() {
        // Given
        let path = 'integration-tests/my-secret';
        // When
        let expectedResult = await this.client.read(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.apiResponse.data.foo).equals("bar-updated");
    } 

    @test("should delete a secret")
    async shouldDeleteSecret() {
        // Given
        let path = 'integration-tests/my-secret';
        
        // When
        let expectedResult = await this.client.delete(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
        let checkDeleteResult = await this.client.read(path);
        expect(checkDeleteResult.succeded).to.be.false;
        expect(checkDeleteResult.httpStatusCode).equals(404);  
    } 
}
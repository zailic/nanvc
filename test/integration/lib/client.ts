import { suite, test, skipOnError, timeout } from "mocha-typescript";
import * as chai from "chai";
import * as request from "request-promise-native";
import { VaultClient } from "./../../../src/lib/client";
import { VaultResponse } from "../../../src/lib/metadata/common";

const expect = chai.expect;

@suite("VaultClient integration test cases.")
class VaultClientIntegrationTest {

    private client: VaultClient;
    static rootToken: string;
    static unsealKey: string;

    before() {
        let args = [null, "http://vault.local:8200"];
        if (VaultClientIntegrationTest.rootToken) {
            args.push(VaultClientIntegrationTest.rootToken);
        }
        this.client = new (Function.prototype.bind.apply(VaultClient, args));
    }

    @test("vault initialisation process")
    async vaultInitialisationProcess() {
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
    async vaultInitialisationProcessShouldFail() {
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


    @test("should fail tv4 validation")
    async shouldFailTv4Validation() {
        // Given

        // When
        // @ts-ignore
        let expectedResult = await this.client.unseal({ key: 123 });

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.false;
        expect(expectedResult.httpStatusCode).to.be.undefined;
    }

    @test("should unseal vault")
    async shouldUnsealVault() {
        // Given

        // When
        let expectedResult = await this.client.unseal({
            key: VaultClientIntegrationTest.unsealKey
        });

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
    }

    @test("should seal vault")
    async shouldSealVault() {
        // Given

        // When
        let expectedResult = await this.client.seal();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
        await this.client.unseal({
            key: VaultClientIntegrationTest.unsealKey
        });
    }

    @test("should write a secret")
    async shouldWriteSecret() {
        // Given
        let path = '/secret/integration-tests/my-secret',
            secret = { "foo": "bar" };
        // When
        let expectedResult = await this.client.write(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
    }

    @test("should update a secret")
    async shouldUpdateSecret() {
        // Given
        let path = '/secret/integration-tests/my-secret',
            secret = { "foo": "bar-updated" };

        // When
        let expectedResult = await this.client.update(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
    }

    @test("should read a secret")
    async shouldReadSecret() {
        // Given
        let path = '/secret/integration-tests/my-secret';
        // When
        let expectedResult = await this.client.read(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.apiResponse.data.foo).equals("bar-updated");
    }

    @test("should delete a secret")
    async shouldDeleteSecret() {
        // Given
        let path = '/secret/integration-tests/my-secret';

        // When
        let expectedResult = await this.client.delete(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse)
        expect(expectedResult.succeded).to.be.true;
        let checkDeleteResult = await this.client.read(path);
        expect(checkDeleteResult.succeded).to.be.false;
        expect(checkDeleteResult.httpStatusCode).equals(404);
    }

    @test("should get status")
    async shouldGetStatus() {
        // Given

        // When
        let expectedResult = await this.client.status();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;

        expect(expectedResult.apiResponse.t).equals(1);
        expect(expectedResult.apiResponse.n).equals(1);
    }

    @test("should retrieve audit stats")
    async shouldGetAuditStats() {
        // Given

        // When
        let expectedResult = await this.client.audits();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(200);
    }

    @test("should enable audit")
    async shouldEnableAudit() {
        // Given
        let payload = {
            "type": "file",
            "options": {
                "path": "/var/log/vault/audit-log.json"
            }
        };

        // When
        let expectedResult = await this.client.enableAudit('/test-audit', payload);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
    }

    @test("should retrieve audit hash")
    async shouldRetrieveAuditHash() {
        // Given

        // When
        let vaultResponse = await this.client.auditHash("/test-audit", { "input": "foo" });

        // Then
        expect(vaultResponse).to.be.an.instanceof(VaultResponse);
        expect(vaultResponse.succeded).to.be.true;
        expect(vaultResponse.apiResponse.hash).to.not.be.empty;
    }

    @test("should disable audit")
    async shouldDisableAudit() {
        // Given

        // When
        let expectedResult = await this.client.disableAudit('/test-audit');

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
    }

    @test("should retrieve policy list")
    async shouldRetrivePolicyList() {
        // Given

        // When
        let expectedResult = await this.client.policies()

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(200);
        expect(expectedResult.apiResponse.keys).to.be.an('array').that.is.not.empty;
    }

    @test("should validate dynamic credentials flow")
    async checkDynamicCredentialsSupport() {
        // Given
        let payload = {
            type: 'database',
            plugin_name: 'postgresql-database-plugin'
        };
        let pgSetupPayload = {
            plugin_name: 'postgresql-database-plugin',
            connection_url: 'postgresql://nanvc:integration@db:5432/postgres?sslmode=disable',
            allowed_roles: 'readonly'
        };
        let readonlyRolePayload = {
            db_name: "postgresql",
            creation_statements: `
                CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
                GRANT SELECT ON ALL TABLES IN SCHEMA public TO "{{name}}";
            `
        };
        
        // Then
        let mountResult = await this.client.mount('database', payload);
        let writePgConnSetupResult = await this.client.write('database/config/postgresql', pgSetupPayload);
        let writePgReadonlyRoleResult = await this.client.write('database/roles/readonly', readonlyRolePayload);
        let credsReadonlyResult = await this.client.read('database/creds/readonly');
        let mountsResult = await this.client.mounts();
        let unmountResult = await this.client.unmount('database');
        let mountsAfterDbUnmountResult = await this.client.mounts();

        // When
        expect(mountResult.httpStatusCode).equals(204);
        expect(writePgConnSetupResult.httpStatusCode).equals(200);
        expect(writePgReadonlyRoleResult.httpStatusCode).equals(204);
        expect(credsReadonlyResult.apiResponse.data.username).is.not.empty;
        expect(credsReadonlyResult.apiResponse.data.password).is.not.empty;
        expect(mountsResult.httpStatusCode).equals(200);
        expect(mountsResult.apiResponse.data).to.have.ownProperty('database/');
        expect(mountsResult.apiResponse.data).to.have.ownProperty('secret/');
        expect(mountsResult.apiResponse.data).to.have.ownProperty('sys/');
        expect(unmountResult.httpStatusCode).equals(204);
        expect(mountsAfterDbUnmountResult.apiResponse.data).not.ownProperty('database/');

    }
}
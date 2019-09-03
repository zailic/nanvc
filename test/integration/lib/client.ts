import { suite, test, skipOnError, timeout } from 'mocha-typescript';
import * as chai from 'chai';
import * as request from 'request-promise-native';
import { VaultClient } from './../../../src/lib/client';
import { VaultResponse } from '../../../src/lib/metadata/common';
import { VaultRemountPayloadRequest } from '../../../src/lib/metadata/sys-remount';
import { VaultAuthPayloadRequest } from '../../../src/lib/metadata/sys-auth';

const expect = chai.expect;

@suite('VaultClient integration test cases.')
class VaultClientIntegrationTest {

    private client: VaultClient;
    public static rootToken: string;
    public static unsealKey: string;

    public before() {
        const args = [null, 'http://vault.local:8200'];
        if (VaultClientIntegrationTest.rootToken) {
            args.push(VaultClientIntegrationTest.rootToken);
        }
        // tslint:disable-next-line:new-parens
        this.client = new (Function.prototype.bind.apply(VaultClient, args));
    }

    @test('vault initialisation process')
    public async vaultInitialisationProcess() {
        // Given
        const payload = { secret_shares: 1, secret_threshold: 1 };

        // When
        const vaultResponse = await this.client.init(payload);

        // Then
        expect(vaultResponse.succeeded).to.be.true;
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

    @test('vault initialisation process should fail if is already initialized')
    public async vaultInitialisationProcessShouldFail() {
        // Given
        const payload = { secret_shares: 1, secret_threshold: 1 };

        // When
        const vaultResponse = await this.client.init(payload);

        // Then
        expect(vaultResponse.succeeded).to.be.false;
        expect(vaultResponse.httpStatusCode).equals(400);
    }

    @test('should get initialization status')
    public async shouldGetIntializationStatus() {
        // Given

        // When
        const expectedResult = await this.client.isInitialized();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.apiResponse.initialized).to.be.true;
    }

    @test('should fail tv4 validation')
    public async shouldFailTv4Validation() {
        // Given

        // When
        // @ts-ignore
        const expectedResult = await this.client.unseal({ key: 123 });

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.false;
        expect(expectedResult.httpStatusCode).to.be.undefined;
    }

    @test('should unseal vault')
    public async shouldUnsealVault() {
        // Given

        // When
        const expectedResult = await this.client.unseal({
            key: VaultClientIntegrationTest.unsealKey,
        });

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
    }

    @test('should seal vault')
    public async shouldSealVault() {
        // Given

        // When
        const expectedResult = await this.client.seal();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
        await this.client.unseal({
            key: VaultClientIntegrationTest.unsealKey,
        });
    }

    @test('should write a secret')
    public async shouldWriteSecret() {
        // Given
        const path = '/secret/integration-tests/my-secret',
            secret = { foo: 'bar' };
        // When
        // ensures the secret path is mounted
        await this.client.mount('secret', { type: 'kv' });
        const expectedResult = await this.client.write(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
    }

    @test('should update a secret')
    public async shouldUpdateSecret() {
        // Given
        const path = '/secret/integration-tests/my-secret',
            secret = { foo: 'bar-updated' };

        // When
        const expectedResult = await this.client.update(path, secret);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
    }

    @test('should read a secret')
    public async shouldReadSecret() {
        // Given
        const path = '/secret/integration-tests/my-secret';
        // When
        const expectedResult = await this.client.read(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.apiResponse.data.foo).equals('bar-updated');
    }

    @test('should delete a secret')
    public async shoulddeleteSecret() {
        // Given
        const path = '/secret/integration-tests/my-secret';

        // When
        const expectedResult = await this.client.delete(path);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        const checkDeleteResult = await this.client.read(path);
        expect(checkDeleteResult.succeeded).to.be.false;
        expect(checkDeleteResult.httpStatusCode).equals(404);
    }

    @test('should get status')
    public async shouldGetStatus() {
        // Given

        // When
        const expectedResult = await this.client.status();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;

        expect(expectedResult.apiResponse.t).equals(1);
        expect(expectedResult.apiResponse.n).equals(1);
    }

    @test('should retrieve audit stats')
    public async shouldGetAuditStats() {
        // Given

        // When
        const expectedResult = await this.client.audits();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(200);
    }

    @test('should enable audit')
    public async shouldEnableAudit() {
        // Given
        const payload = {
            type: 'file',
            options: {
                path: '/var/log/vault/audit-log.json',
            },
        };

        // When
        const expectedResult = await this.client.enableAudit('/test-audit', payload);

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
    }

    @test('should retrieve audit hash')
    public async shouldRetrieveAuditHash() {
        // Given

        // When
        const vaultResponse = await this.client.auditHash('/test-audit', { input: 'foo' });

        // Then
        expect(vaultResponse).to.be.an.instanceof(VaultResponse);
        expect(vaultResponse.succeeded).to.be.true;
        expect(vaultResponse.apiResponse.hash).to.not.be.empty;
    }

    @test('should disable audit')
    public async shouldDisableAudit() {
        // Given

        // When
        const expectedResult = await this.client.disableAudit('/test-audit');

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(204);
    }

    @test('should retrieve policy list')
    public async shouldRetrivePolicyList() {
        // Given

        // When
        const expectedResult = await this.client.policies();

        // Then
        expect(expectedResult).to.be.an.instanceof(VaultResponse);
        expect(expectedResult.succeeded).to.be.true;
        expect(expectedResult.httpStatusCode).equals(200);
        expect(expectedResult.apiResponse.keys).to.be.an('array').that.is.not.empty;
    }

    @test('should validate dynamic credentials flow')
    public async checkDynamicCredentialsSupport() {
        // Given
        const payload = {
            type: 'database',
            plugin_name: 'postgresql-database-plugin',
        };
        const pgSetupPayload = {
            plugin_name: 'postgresql-database-plugin',
            connection_url: 'postgresql://nanvc:integration@db:5432/postgres?sslmode=disable',
            allowed_roles: 'readonly',
        };
        const readonlyRolePayload = {
            db_name: 'postgresql',
            creation_statements: `
                CREATE ROLE "{{name}}" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
                GRANT SELECT ON ALL TABLES IN SCHEMA public TO "{{name}}";
            `,
        };

        // Then
        const mountResult = await this.client.mount('database', payload);
        const writePgConnSetupResult = await this.client.write('database/config/postgresql', pgSetupPayload);
        const writePgReadonlyRoleResult = await this.client.write('database/roles/readonly', readonlyRolePayload);
        const credsReadonlyResult = await this.client.read('database/creds/readonly');
        const mountsResult = await this.client.mounts();
        const unmountResult = await this.client.unmount('database');
        const mountsAfterDbUnmountResult = await this.client.mounts();

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

    @test('should validate remount command')
    public async testRemountCommand() {
        // Given
        const payload: VaultRemountPayloadRequest = {
            from: 'secret',
            to: 'secret-new',
        };

        // Then
        const remountResult = await this.client.remount(payload);
        const mountsResult = await this.client.mounts();

        // When
        expect(remountResult.httpStatusCode).equals(204);
        expect(mountsResult.httpStatusCode).equals(200);
        expect(mountsResult.apiResponse.data).not.ownProperty('secret/');
        expect(mountsResult.apiResponse.data).to.have.ownProperty('secret-new/');
    }

    @test('Should validate auth flow')
    public async shouldValidateAuthFlow() {
        // Given
        const userpassAuthPayload: VaultAuthPayloadRequest = {
            type: 'userpass',
            description: 'user and password based credentials',
        };
        const createUserPayload = {
            password: 's3cr3t',
            policies: 'admin,default',
        };

        // Then
        const enableAuthResult = await this.client.enableAuth('userpass', userpassAuthPayload);
        const authResult = await this.client.auths();
        const createUserResult = await this.client.write('/auth/userpass/users/integration', createUserPayload);
        const listUsersResult = await this.client.list('/auth/userpass/users');
        const disableAuthResult = await this.client.disableAuth('userpass');
        const authResultAfterDisablingUserpass = await this.client.auths();

        // When
        expect(authResult.httpStatusCode).equals(200);
        expect(enableAuthResult.httpStatusCode).equals(204);
        expect(createUserResult.httpStatusCode).equals(204);
        expect(authResult.apiResponse.data).to.have.ownProperty('userpass/');
        expect('integration').to.be.oneOf(listUsersResult.apiResponse.data.keys);
        expect(disableAuthResult.httpStatusCode).equals(204);
        expect(authResultAfterDisablingUserpass.httpStatusCode).equals(200);
        expect(authResultAfterDisablingUserpass.apiResponse.data).not.ownProperty('userpass/');

    }
}
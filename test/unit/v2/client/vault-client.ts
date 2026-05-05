import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';
import { suite, test, beforeEachTest, afterEachTest } from '../../../mocha/decorators.js';

import { resultOf } from '../../../helpers/types.js';

import { VaultClient } from '../../../../src/v2/client/vault-client.js';
import { RawVaultClient } from '../../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';
import { err, ok } from '../../../../src/v2/core/result.js';

import type { components } from '../../../../src/v2/generated/vault-openapi.js';

import type { SinonSandbox } from 'sinon';

@suite('VaultClientV2 unit test cases.')
export class VaultClientV2UnitTests {
    private sandbox!: SinonSandbox;

    @beforeEachTest()
    public beforeEach() {
        this.sandbox = createSandbox();
    }

    @afterEachTest()
    public afterEach() {
        this.sandbox.restore();
    }

    @test('should unwrap successful high-level results')
    public async shouldUnwrapSuccessfulHighLevelResultsTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    initialized: true,
                }),
            ),
        );
        const client = new VaultClient();

        const isInitialized = await client.sys.isInitialized().unwrap();

        assert.equal(isInitialized, true);
    }

    @test('should reject unwrap with the underlying client error')
    public async shouldRejectUnwrapWithTheUnderlyingClientErrorTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        await assert.rejects(client.sys.isInitialized().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    }

    @test('should set the raw client token after a successful init')
    public async shouldSetTheRawClientTokenAfterASuccessfulInitTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(
                ok({
                    keys: ['unseal-key'],
                    root_token: 'root-token',
                }),
            ),
        );
        const setTokenSpy = this.sandbox.spy(RawVaultClient.prototype, 'setToken');
        const client = new VaultClient();

        const initData = await client.sys
            .init({
                secret_shares: 1,
                secret_threshold: 1,
            })
            .unwrap();

        assert.equal(initData.root_token, 'root-token');
        assert.equal(setTokenSpy.calledOnceWithExactly('root-token'), true);
    }

    @test('should report ready when GET /sys/health succeeds')
    public async shouldReportReadyWhenGetSysHealthSucceedsTest() {
        const requestStub = this.sandbox.stub(RawVaultClient.prototype, 'request').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const ready = await client.sys.isReady().unwrap();

        assert.equal(ready, true);
        assert.deepEqual(requestStub.firstCall.args, ['GET', '/sys/health', {}]);
    }

    @test('should get the status of the vault')
    public async shouldGetTheStatusOfTheVaultTest() {
        const healthStatus = {
            initialized: true,
            sealed: false,
            standby: false,
            performance_standby: false,
            replication_performance_mode: 'disabled',
            replication_dr_mode: 'disabled',
            server_time_utc: 1,
            version: '1.0.0',
            cluster_name: 'vault-cluster',
            cluster_id: '1234-5678',
        } as components['schemas']['HealthStatusResponse'];
        const reqStub = this.sandbox.stub(RawVaultClient.prototype, 'request').returns(resultOf(ok(healthStatus)));
        const client = new VaultClient();

        const status = await client.sys.status().unwrap();

        assert.deepEqual(status, healthStatus);
        assert.deepEqual(reqStub.firstCall.args, ['GET', '/sys/health', {}]);
    }

    @test('should fail fetching the status of the vault if the request fails')
    public async shouldFailFetchingTheStatusOfTheVaultIfTheRequestFailsTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Network error',
        });
        const reqStub = this.sandbox.stub(RawVaultClient.prototype, 'request').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        await assert.rejects(client.sys.status().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
        assert.deepEqual(reqStub.firstCall.args, ['GET', '/sys/health', {}]);
    }

    @test('should report not ready when HEAD /sys/health returns 503')
    public async shouldReportNotReadyWhenHeadSysHealthReturns503Test() {
        this.sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(
                err(
                    new VaultClientError({
                        code: 'HTTP_ERROR',
                        message: 'sealed',
                        status: 503,
                    }),
                ),
            ),
        );
        const client = new VaultClient();

        const ready = await client.sys.isReady().unwrap();

        assert.equal(ready, false);
    }

    @test('should surface non-HTTP readiness errors')
    public async shouldSurfaceNonHttpReadinessErrorsTest() {
        const clientError = new VaultClientError({
            code: 'NETWORK_ERROR',
            message: 'connection refused',
        });
        this.sandbox.stub(RawVaultClient.prototype, 'request').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        await assert.rejects(client.sys.isReady().unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    }

    @test('should route system mount enable and disable calls')
    public async shouldRouteSystemMountEnableAndDisableCallsTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const deleteStub = this.sandbox
            .stub(RawVaultClient.prototype, 'delete')
            .onFirstCall()
            .returns(resultOf(ok(undefined)));
        deleteStub.onSecondCall().returns(
            resultOf(
                err(
                    new VaultClientError({
                        code: 'HTTP_ERROR',
                        message: 'missing permission',
                        status: 403,
                    }),
                ),
            ),
        );
        const client = new VaultClient();

        const [enableData, enableError] = await client.sys.mount.enable('/secret/', {
            type: 'kv',
        });
        const [disableData, disableError] = await client.sys.mount.disable('/secret/');
        const disableErrorExpected = await client.sys.mount.disable('/secret/').unwrapErr();

        assert.equal(enableData, undefined);
        assert.equal(enableError, null);
        assert.equal(disableData, undefined);
        assert.equal(disableError, null);
        assert.equal(disableErrorExpected.code, 'HTTP_ERROR');
        assert.deepEqual(postStub.firstCall.args, [
            '/sys/mounts/{path}',
            {
                body: {
                    type: 'kv',
                },
                params: {
                    path: {
                        path: '/secret/',
                    },
                },
            },
        ]);
        assert.deepEqual(deleteStub.firstCall.args, [
            '/sys/mounts/{path}',
            {
                params: {
                    path: {
                        path: '/secret/',
                    },
                },
            },
        ]);
    }

    @test('should surface system mount errors')
    public async shouldSurfaceSystemMountErrorsTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'missing permission',
            status: 403,
        });
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        await assert.rejects(client.sys.mount.enable('secret', { type: 'kv' }).unwrap(), (error: unknown) => {
            assert.equal(error, clientError);
            return true;
        });
    }

    @test('should not set a token when init returns no root token')
    public async shouldNotSetATokenWhenInitReturnsNoRootTokenTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(
                ok({
                    keys: ['unseal-key'],
                }),
            ),
        );
        const setTokenSpy = this.sandbox.spy(RawVaultClient.prototype, 'setToken');
        const client = new VaultClient();

        const initData = await client.sys
            .init({
                secret_shares: 1,
                secret_threshold: 1,
            })
            .unwrap();

        assert.deepEqual(initData, {
            keys: ['unseal-key'],
        });
        assert.equal(setTokenSpy.called, false);
    }

    @test('should route seal status and unseal calls')
    public async shouldRouteSealStatusAndUnsealCallsTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    initialized: true,
                    sealed: true,
                }),
            ),
        );
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(
                ok({
                    sealed: false,
                }),
            ),
        );
        const client = new VaultClient();

        const sealStatus = await client.sys.sealStatus().unwrap();
        const unsealStatus = await client.sys
            .unseal({
                key: 'unseal-key',
            })
            .unwrap();

        assert.deepEqual(sealStatus, {
            initialized: true,
            sealed: true,
        });
        assert.deepEqual(unsealStatus, {
            sealed: false,
        });
        assert.deepEqual(getStub.firstCall.args, ['/sys/seal-status']);
        assert.deepEqual(postStub.firstCall.args, [
            '/sys/unseal',
            {
                body: {
                    key: 'unseal-key',
                },
            },
        ]);
    }

    @test('should route kv2 writes through the mount data path with wrapped payload')
    public async shouldRouteKv2WritesThroughTheMountDataPathWithWrappedPayloadTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.write('secret-v2', '/apps/demo', { foo: 'bar' }, { cas: 2 });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/data/{path}');
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                data: { foo: 'bar' },
                options: { cas: 2 },
            },
            params: {
                path: {
                    kv_v2_mount_path: 'secret-v2',
                    path: '/apps/demo',
                },
            },
        });
    }

    @test('should unwrap kv2 reads into data and metadata')
    public async shouldUnwrapKv2ReadsIntoDataAndMetadataTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        data: { foo: 'bar' },
                        metadata: {
                            destroyed: false,
                            version: 3,
                        },
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const secret = await client.secret.kv.v2
            .read<{ foo: string }>('secret-v2', 'apps/demo', { version: 3 })
            .unwrap();

        assert.deepEqual(secret, {
            data: { foo: 'bar' },
            metadata: {
                destroyed: false,
                version: 3,
            },
        });
    }

    @test('should surface metadata for soft-deleted kv2 secrets returned as 404 responses')
    public async shouldSurfaceMetadataForSoftDeletedKv2SecretsReturnedAs404ResponsesTest() {
        this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                err(
                    new VaultClientError({
                        code: 'HTTP_ERROR',
                        message: 'Not Found',
                        status: 404,
                        responseBody: {
                            data: {
                                data: null,
                                metadata: {
                                    deletion_time: '2026-04-17T15:13:44.847667814Z',
                                    destroyed: false,
                                    version: 1,
                                },
                            },
                        },
                    }),
                ),
            ),
        );
        const client = new VaultClient();

        const secret = await client.secret.kv.v2.read<{ foo: string }>('secret-v2', 'apps/demo').unwrap();

        assert.deepEqual(secret, {
            data: {},
            metadata: {
                deletion_time: '2026-04-17T15:13:44.847667814Z',
                destroyed: false,
                version: 1,
            },
        });
    }

    @test('should not unwrap kv2 read errors that are not soft-deleted secret responses')
    public async shouldNotUnwrapKv2ReadErrorsThatAreNotSoftDeletedSecretResponsesTest() {
        const forbiddenError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Forbidden',
            responseBody: {
                data: {
                    metadata: {
                        destroyed: false,
                    },
                },
            },
            status: 403,
        });
        const missingEnvelopeError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Not Found',
            responseBody: {
                errors: ['not found'],
            },
            status: 404,
        });
        const unknownError = new Error('socket closed') as VaultClientError;
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get');
        getStub.onFirstCall().returns(resultOf(err(forbiddenError)));
        getStub.onSecondCall().returns(resultOf(err(missingEnvelopeError)));
        getStub.onThirdCall().returns(resultOf(err(unknownError)));
        const client = new VaultClient();

        const [, forbiddenResult] = await client.secret.kv.v2.read('secret-v2', 'apps/forbidden');
        const [, missingEnvelopeResult] = await client.secret.kv.v2.read('secret-v2', 'apps/missing-envelope');
        const [, unknownResult] = await client.secret.kv.v2.read('secret-v2', 'apps/unknown');

        assert.equal(forbiddenResult, forbiddenError);
        assert.equal(missingEnvelopeResult, missingEnvelopeError);
        assert.equal(unknownResult, unknownError);
        assert.equal(getStub.callCount, 3);
    }

    @test('should list kv2 keys through the metadata path')
    public async shouldListKv2KeysThroughTheMetadataPathTest() {
        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(
                ok({
                    data: {
                        keys: ['child', 'nested/'],
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const keys = await client.secret.kv.v2.list('/secret-v2', '/apps').unwrap();

        assert.deepEqual(keys, ['child', 'nested/']);
        assert.deepEqual(listStub.firstCall.args, [
            '/{kv_v2_mount_path}/metadata/{path}/',
            {
                params: {
                    path: {
                        kv_v2_mount_path: '/secret-v2',
                        path: '/apps',
                    },
                    query: {
                        list: 'true',
                    },
                },
            },
        ]);
    }

    @test('should route kv1 reads through split mount and path arguments')
    public async shouldRouteKv1ReadsThroughSplitMountAndPathArgumentsTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        foo: 'bar',
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const secret = await client.secret.kv.v1.read<{ foo: string }>('secret', 'apps/demo').unwrap();

        assert.deepEqual(secret, { foo: 'bar' });
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/{kv_v1_mount_path}/{path}');
        assert.deepEqual(getStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v1_mount_path: 'secret',
                    path: 'apps/demo',
                },
            },
        });
    }

    @test('should route kv1 writes and lists through split mount and path arguments')
    public async shouldRouteKv1WritesAndListsThroughSplitMountAndPathArgumentsTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(
                ok({
                    keys: ['demo'],
                }),
            ),
        );
        const client = new VaultClient();

        const [writeData, writeError] = await client.secret.kv.v1.write('secret', 'apps/demo', { foo: 'bar' });
        const [keys, listError] = await client.secret.kv.v1.list('secret', 'apps');

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.deepEqual(keys, ['demo']);
        assert.equal(listError, null);
        assert.deepEqual(postStub.firstCall.args, [
            '/{kv_v1_mount_path}/{path}',
            {
                body: { foo: 'bar' },
                params: {
                    path: {
                        kv_v1_mount_path: 'secret',
                        path: 'apps/demo',
                    },
                },
            },
        ]);
        assert.deepEqual(listStub.firstCall.args, [
            '/{kv_v1_mount_path}/{path}/',
            {
                params: {
                    path: {
                        kv_v1_mount_path: 'secret',
                        path: 'apps',
                    },
                    query: {
                        list: 'true',
                    },
                },
            },
        ]);
    }

    @test('should return validation errors for invalid kv1 paths')
    public async shouldReturnValidationErrorsForInvalidKv1PathsTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: {} })));
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v1.read('secret');

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(getStub.called, false);
    }

    @test('should return validation errors for missing kv1 write payloads')
    public async shouldReturnValidationErrorsForMissingKv1WritePayloadsTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v1.write(
            'secret',
            'apps/demo',
            undefined as unknown as Record<string, unknown>,
        );

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'VaultSecretKvV1Client.write requires a payload object');
        assert.equal(postStub.called, false);
    }

    @test('should allow empty kv1 paths only for list operations')
    public async shouldAllowEmptyKv1PathsOnlyForListOperationsTest() {
        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(
                ok({
                    keys: ['apps/'],
                }),
            ),
        );
        const client = new VaultClient();

        const keys = await client.secret.kv.v1.list('secret').unwrap();

        assert.deepEqual(keys, ['apps/']);
        assert.deepEqual(listStub.firstCall.args, [
            '/{kv_v1_mount_path}/{path}/',
            {
                params: {
                    path: {
                        kv_v1_mount_path: 'secret',
                        path: '',
                    },
                    query: {
                        list: 'true',
                    },
                },
            },
        ]);
    }

    @test('should surface validation errors for invalid kv1 paths')
    public async shouldSurfaceValidationErrorsForInvalidKv1PathsTest() {
        const client = new VaultClient();
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));

        const [deleteData, deleteError] = await client.secret.kv.v1.delete('secret');

        assert.equal(deleteData, null);
        assert.equal(deleteError instanceof VaultClientError, true);
        assert.equal(deleteError?.code, 'VALIDATION_ERROR');
        assert.equal(deleteError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(deleteStub.called, false);

        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(
                ok({
                    keys: ['apps/'],
                }),
            ),
        );

        const [keys, listError] = await client.secret.kv.v1.list('');

        assert.equal(keys, null);
        assert.equal(listError instanceof VaultClientError, true);
        assert.equal(listError?.code, 'VALIDATION_ERROR');
        assert.equal(listError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got ""');
        assert.equal(listStub.called, false);

        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: {} })));

        const [readData, readError] = await client.secret.kv.v1.read('secret');

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(getStub.called, false);

        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));

        const [writeData, writeError] = await client.secret.kv.v1.write('secret', {});

        assert.equal(writeData, null);
        assert.equal(writeError instanceof VaultClientError, true);
        assert.equal(writeError?.code, 'VALIDATION_ERROR');
        assert.equal(writeError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(postStub.called, false);
    }

    @test('should surface raw client errors from kv1 shortcut methods')
    public async shouldSurfaceRawClientErrorsFromKv1ShortcutMethodsTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v1.read('secret/apps/demo');

        assert.equal(readData, null);
        assert.equal(readError, clientError);
        assert.equal(getStub.calledOnce, true);

        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));

        const [deleteData, deleteError] = await client.secret.kv.v1.delete('secret/apps/demo');

        assert.equal(deleteData, null);
        assert.equal(deleteError, clientError);
        assert.equal(deleteStub.calledOnce, true);

        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));

        const [writeData, writeError] = await client.secret.kv.v1.write('secret/apps/demo', { foo: 'bar' });

        assert.equal(writeData, null);
        assert.equal(writeError, clientError);
        assert.equal(postStub.calledOnce, true);

        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));

        const [keys, listError] = await client.secret.kv.v1.list('secret/apps');

        assert.equal(keys, null);
        assert.equal(listError, clientError);
        assert.equal(listStub.calledOnce, true);
    }

    @test('should return validation errors from invalid high-level kv shortcuts')
    public async shouldReturnValidationErrorsFromInvalidHighLevelKvShortcutsTest() {
        const client = new VaultClient();
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(ok({ data: {} })));
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));

        const [readData, readError] = await client.read('secret');
        const [writeData, writeError] = await client.write(
            'secret/apps/demo',
            undefined as unknown as Record<string, unknown>,
        );

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(writeData, null);
        assert.equal(writeError instanceof VaultClientError, true);
        assert.equal(writeError?.code, 'VALIDATION_ERROR');
        assert.equal(writeError?.message, 'VaultClient.write requires a payload object');
        assert.equal(getStub.called, false);
        assert.equal(postStub.called, false);
    }

    @test('should expose kv1 shortcut methods on the high-level client')
    public async shouldExposeKv1ShortcutMethodsOnTheHighLevelClientTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        foo: 'bar',
                    },
                }),
            ),
        );
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(
                ok({
                    keys: ['demo'],
                }),
            ),
        );
        const client = new VaultClient();

        const [writeData, writeError] = await client.write('secret/apps/demo', { foo: 'bar' });
        const secret = await client.read<{ foo: string }>('secret/apps/demo').unwrap();
        const keys = await client.list('secret/apps').unwrap();
        const [deleteData, deleteError] = await client.delete('secret/apps/demo');

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.deepEqual(secret, { foo: 'bar' });
        assert.deepEqual(keys, ['demo']);
        assert.equal(deleteData, undefined);
        assert.equal(deleteError, null);
        assert.deepEqual(postStub.firstCall.args[1], {
            body: { foo: 'bar' },
            params: {
                path: {
                    kv_v1_mount_path: 'secret',
                    path: 'apps/demo',
                },
            },
        });
        assert.deepEqual(getStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v1_mount_path: 'secret',
                    path: 'apps/demo',
                },
            },
        });
        assert.deepEqual(listStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v1_mount_path: 'secret',
                    path: 'apps',
                },
                query: {
                    list: 'true',
                },
            },
        });
        assert.deepEqual(deleteStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v1_mount_path: 'secret',
                    path: 'apps/demo',
                },
            },
        });
    }

    @test('should expose kv2 shortcut methods when engineVersion is 2')
    public async shouldExposeKv2ShortcutMethodsWhenEngineversionIs2Test() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        data: { foo: 'bar' },
                        metadata: {
                            version: 3,
                        },
                    },
                }),
            ),
        );
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const listStub = this.sandbox
            .stub(RawVaultClient.prototype, 'list')
            .onFirstCall()
            .returns(
                resultOf(
                    ok({
                        data: {
                            keys: ['demo'],
                        },
                    }),
                ),
            );
        // here we simulate scenario where list data is not enveloped in a "data" property
        listStub.onSecondCall().returns(
            resultOf(
                ok({
                    keys: ['demo'],
                }),
            ),
        );
        const client = new VaultClient();

        const [writeData, writeError] = await client.write(
            'secret-v2',
            'apps/demo',
            { foo: 'bar' },
            {
                cas: 2,
                engineVersion: 2,
            },
        );
        const secret = await client
            .read<{ foo: string }>('secret-v2', 'apps/demo', {
                engineVersion: 2,
                version: 3,
            })
            .unwrap();
        const keys = await client.list('secret-v2', 'apps', { engineVersion: 2 }).unwrap();
        const keys2 = await client.list('secret-v2', 'apps', { engineVersion: 2 }).unwrap();
        const [deleteData, deleteError] = await client.delete('secret-v2', 'apps/demo', { engineVersion: 2 });

        assert.equal(writeData, undefined);
        assert.equal(writeError, null);
        assert.deepEqual(secret, {
            data: { foo: 'bar' },
            metadata: {
                version: 3,
            },
        });
        assert.deepEqual(keys, ['demo']);
        assert.deepEqual(keys2, ['demo']);
        assert.equal(deleteData, undefined);
        assert.equal(deleteError, null);
        assert.deepEqual(postStub.firstCall.args[1], {
            body: {
                data: { foo: 'bar' },
                options: { cas: 2 },
            },
            params: {
                path: {
                    kv_v2_mount_path: 'secret-v2',
                    path: 'apps/demo',
                },
            },
        });
        assert.deepEqual(getStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v2_mount_path: 'secret-v2',
                    path: 'apps/demo',
                },
                query: {
                    version: 3,
                },
            },
        });
        assert.deepEqual(listStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v2_mount_path: 'secret-v2',
                    path: 'apps',
                },
                query: {
                    list: 'true',
                },
            },
        });
        assert.deepEqual(deleteStub.firstCall.args[1], {
            params: {
                path: {
                    kv_v2_mount_path: 'secret-v2',
                    path: 'apps/demo',
                },
            },
        });
    }

    @test('should surface raw client errors from kv2 shortcut methods')
    public async shouldSurfaceRawClientErrorsFromKv2ShortcutMethodsTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v2.read('secret-v2', 'apps/demo');

        assert.equal(readData, null);
        assert.equal(readError, clientError);
        assert.equal(getStub.calledOnce, true);

        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));

        const [deleteData, deleteError] = await client.secret.kv.v2.delete('secret-v2', 'apps/demo');

        assert.equal(deleteData, null);
        assert.equal(deleteError, clientError);
        assert.equal(deleteStub.calledOnce, true);

        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));

        const [writeData, writeError] = await client.secret.kv.v2.write('secret-v2', 'apps/demo', { foo: 'bar' });

        assert.equal(writeData, null);
        assert.equal(writeError, clientError);
        assert.equal(postStub.calledOnce, true);

        const listStub = this.sandbox.stub(RawVaultClient.prototype, 'list').returns(resultOf(err(clientError)));

        const [keys, listError] = await client.secret.kv.v2.list('secret-v2', 'apps');

        assert.equal(keys, null);
        assert.equal(listError, clientError);
        assert.equal(listStub.calledOnce, true);
    }

    @test('should route kv2 patch through the data path with merge-patch content type')
    public async shouldRouteKv2PatchThroughTheDataPathWithMergePatchContentTypeTest() {
        const patchStub = this.sandbox.stub(RawVaultClient.prototype, 'patch').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.patch('secret-v2', 'apps/demo', { foo: 'updated' });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(patchStub.calledOnce, true);
        assert.equal(patchStub.firstCall.args[0], '/{kv_v2_mount_path}/data/{path}');
        assert.deepEqual(patchStub.firstCall.args[1]?.headers, {
            'Content-Type': 'application/merge-patch+json',
        });
        assert.deepEqual(patchStub.firstCall.args[1]?.body, {
            data: { foo: 'updated' },
        });
        assert.deepEqual(patchStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
            path: 'apps/demo',
        });
    }

    @test('should route kv2 patch with cas option')
    public async shouldRouteKv2PatchWithCasOptionTest() {
        const patchStub = this.sandbox.stub(RawVaultClient.prototype, 'patch').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.patch('secret-v2', 'apps/demo', { foo: 'updated' }, { cas: 3 });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.deepEqual(patchStub.firstCall.args[1]?.body, {
            data: { foo: 'updated' },
            options: { cas: 3 },
        });
    }

    @test('should route kv2 deleteVersions through the delete path')
    public async shouldRouteKv2DeleteversionsThroughTheDeletePathTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.deleteVersions('secret-v2', 'apps/demo', [1, 2]);

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/delete/{path}');
        assert.deepEqual(postStub.firstCall.args[1]?.body, { versions: [1, 2] });
        assert.deepEqual(postStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
            path: 'apps/demo',
        });
    }

    @test('should route kv2 undeleteVersions through the undelete path')
    public async shouldRouteKv2UndeleteversionsThroughTheUndeletePathTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.undeleteVersions('secret-v2', 'apps/demo', [1]);

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/undelete/{path}');
        assert.deepEqual(postStub.firstCall.args[1]?.body, { versions: [1] });
    }

    @test('should route kv2 destroyVersions through the destroy path')
    public async shouldRouteKv2DestroyversionsThroughTheDestroyPathTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.destroyVersions('secret-v2', 'apps/demo', [1, 2]);

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/destroy/{path}');
        assert.deepEqual(postStub.firstCall.args[1]?.body, { versions: [1, 2] });
    }

    @test('should unwrap kv2 readMetadata into the data envelope')
    public async shouldUnwrapKv2ReadmetadataIntoTheDataEnvelopeTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        current_version: 2,
                        max_versions: 10,
                        versions: { '1': { destroyed: false }, '2': { destroyed: false } },
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const meta = await client.secret.kv.v2.readMetadata('secret-v2', 'apps/demo').unwrap();

        assert.equal(meta.current_version, 2);
        assert.equal(meta.max_versions, 10);
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/{kv_v2_mount_path}/metadata/{path}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
            path: 'apps/demo',
        });
    }

    @test('should route kv2 writeMetadata through the metadata path')
    public async shouldRouteKv2WritemetadataThroughTheMetadataPathTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.writeMetadata('secret-v2', 'apps/demo', { max_versions: 5 });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/metadata/{path}');
        assert.deepEqual(postStub.firstCall.args[1]?.body, { max_versions: 5 });
    }

    @test('should route kv2 patchMetadata through the metadata patch path')
    public async shouldRouteKv2PatchmetadataThroughTheMetadataPatchPathTest() {
        const patchStub = this.sandbox.stub(RawVaultClient.prototype, 'patch').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.patchMetadata('secret-v2', 'apps/demo', { cas_required: true });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(patchStub.calledOnce, true);
        assert.equal(patchStub.firstCall.args[0], '/{kv_v2_mount_path}/metadata/{path}');
        assert.deepEqual(patchStub.firstCall.args[1]?.body, { cas_required: true });
    }

    @test('should route kv2 deleteMetadata through the metadata delete path')
    public async shouldRouteKv2DeletemetadataThroughTheMetadataDeletePathTest() {
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.deleteMetadata('secret-v2', 'apps/demo');

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(deleteStub.calledOnce, true);
        assert.equal(deleteStub.firstCall.args[0], '/{kv_v2_mount_path}/metadata/{path}');
        assert.deepEqual(deleteStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
            path: 'apps/demo',
        });
    }

    @test('should unwrap kv2 readConfig into the data envelope')
    public async shouldUnwrapKv2ReadconfigIntoTheDataEnvelopeTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        max_versions: 10,
                        cas_required: false,
                        delete_version_after: '0s',
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const config = await client.secret.kv.v2.readConfig('secret-v2').unwrap();

        assert.equal(config.max_versions, 10);
        assert.equal(config.cas_required, false);
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/{kv_v2_mount_path}/config');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
        });
    }

    @test('should route kv2 writeConfig through the config path')
    public async shouldRouteKv2WriteconfigThroughTheConfigPathTest() {
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(ok(undefined)));
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v2.writeConfig('secret-v2', { max_versions: 20 });

        assert.equal(data, undefined);
        assert.equal(error, null);
        assert.equal(postStub.calledOnce, true);
        assert.equal(postStub.firstCall.args[0], '/{kv_v2_mount_path}/config');
        assert.deepEqual(postStub.firstCall.args[1]?.body, { max_versions: 20 });
    }

    @test('should unwrap kv2 readSubkeys into the data envelope')
    public async shouldUnwrapKv2ReadsubkeysIntoTheDataEnvelopeTest() {
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(
                ok({
                    data: {
                        subkeys: { foo: null, bar: { nested: null } },
                        metadata: { version: 2 },
                    },
                }),
            ),
        );
        const client = new VaultClient();

        const subkeys = await client.secret.kv.v2.readSubkeys('secret-v2', 'apps/demo').unwrap();

        assert.deepEqual(subkeys.subkeys, { foo: null, bar: { nested: null } });
        assert.equal(getStub.calledOnce, true);
        assert.equal(getStub.firstCall.args[0], '/{kv_v2_mount_path}/subkeys/{path}');
        assert.deepEqual(getStub.firstCall.args[1]?.params?.path, {
            kv_v2_mount_path: 'secret-v2',
            path: 'apps/demo',
        });
    }

    @test('should pass depth and version options to kv2 readSubkeys')
    public async shouldPassDepthAndVersionOptionsToKv2ReadsubkeysTest() {
        const getStub = this.sandbox
            .stub(RawVaultClient.prototype, 'get')
            .returns(resultOf(ok({ data: { subkeys: {} } })));
        const client = new VaultClient();

        await client.secret.kv.v2.readSubkeys('secret-v2', 'apps/demo', { depth: 2, version: 1 }).unwrap();

        assert.deepEqual(getStub.firstCall.args[1]?.params?.query, { depth: 2, version: 1 });
    }

    @test('should surface raw client errors from new kv2 methods')
    public async shouldSurfaceRawClientErrorsFromNewKv2MethodsTest() {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        const client = new VaultClient();

        // patch and patchMetadata both delegate to raw.patch
        const patchStub = this.sandbox.stub(RawVaultClient.prototype, 'patch').returns(resultOf(err(clientError)));

        const [patchData, patchError] = await client.secret.kv.v2.patch('secret-v2', 'apps/demo', { foo: 'bar' });
        assert.equal(patchData, null);
        assert.equal(patchError, clientError);

        const [patchMetaData, patchMetaError] = await client.secret.kv.v2.patchMetadata('secret-v2', 'apps/demo', {
            max_versions: 5,
        });
        assert.equal(patchMetaData, null);
        assert.equal(patchMetaError, clientError);

        assert.equal(patchStub.callCount, 2);

        // deleteVersions, undeleteVersions, destroyVersions, writeMetadata, writeConfig all delegate to raw.post
        const postStub = this.sandbox.stub(RawVaultClient.prototype, 'post').returns(resultOf(err(clientError)));

        const [deleteVersionsData, deleteVersionsError] = await client.secret.kv.v2.deleteVersions(
            'secret-v2',
            'apps/demo',
            [1],
        );
        assert.equal(deleteVersionsData, null);
        assert.equal(deleteVersionsError, clientError);

        const [undeleteVersionsData, undeleteVersionsError] = await client.secret.kv.v2.undeleteVersions(
            'secret-v2',
            'apps/demo',
            [1],
        );
        assert.equal(undeleteVersionsData, null);
        assert.equal(undeleteVersionsError, clientError);

        const [destroyVersionsData, destroyVersionsError] = await client.secret.kv.v2.destroyVersions(
            'secret-v2',
            'apps/demo',
            [1],
        );
        assert.equal(destroyVersionsData, null);
        assert.equal(destroyVersionsError, clientError);

        const [writeMetaData, writeMetaError] = await client.secret.kv.v2.writeMetadata('secret-v2', 'apps/demo', {
            max_versions: 5,
        });
        assert.equal(writeMetaData, null);
        assert.equal(writeMetaError, clientError);

        const [writeConfigData, writeConfigError] = await client.secret.kv.v2.writeConfig('secret-v2', {
            max_versions: 5,
        });
        assert.equal(writeConfigData, null);
        assert.equal(writeConfigError, clientError);

        assert.equal(postStub.callCount, 5);

        // readMetadata, readConfig, readSubkeys all delegate to raw.get
        const getStub = this.sandbox.stub(RawVaultClient.prototype, 'get').returns(resultOf(err(clientError)));

        const [readMetaData, readMetaError] = await client.secret.kv.v2.readMetadata('secret-v2', 'apps/demo');
        assert.equal(readMetaData, null);
        assert.equal(readMetaError, clientError);

        const [readConfigData, readConfigError] = await client.secret.kv.v2.readConfig('secret-v2');
        assert.equal(readConfigData, null);
        assert.equal(readConfigError, clientError);

        const [readSubkeysData, readSubkeysError] = await client.secret.kv.v2.readSubkeys('secret-v2', 'apps/demo');
        assert.equal(readSubkeysData, null);
        assert.equal(readSubkeysError, clientError);

        assert.equal(getStub.callCount, 3);

        // deleteMetadata delegates to raw.delete
        const deleteStub = this.sandbox.stub(RawVaultClient.prototype, 'delete').returns(resultOf(err(clientError)));

        const [deleteMetaData, deleteMetaError] = await client.secret.kv.v2.deleteMetadata('secret-v2', 'apps/demo');
        assert.equal(deleteMetaData, null);
        assert.equal(deleteMetaError, clientError);

        assert.equal(deleteStub.callCount, 1);
    }

    @test('should surface resolveKvShortcutRef validation errors')
    public async shouldSurfaceResolvekvshortcutrefValidationErrorsTest() {
        const client = new VaultClient();

        const [deleteData, deleteError] = await client.delete('invalid-path');
        const [listData, listError] = await client.list('');
        const [writeData, writeError] = await client.write('invalid-path', { foo: 'bar' });

        assert.equal(deleteData, null);
        assert.equal(deleteError instanceof VaultClientError, true);
        assert.equal(deleteError?.code, 'VALIDATION_ERROR');
        assert.equal(
            deleteError?.message,
            'Expected a KV secret path like "secret/my-app/my-secret", got "invalid-path"',
        );

        assert.equal(listData, null);
        assert.equal(listError instanceof VaultClientError, true);
        assert.equal(listError?.code, 'VALIDATION_ERROR');
        assert.equal(listError?.message, 'Expected a KV secret path like "secret/my-app/my-secret", got ""');

        assert.equal(writeData, null);
        assert.equal(writeError instanceof VaultClientError, true);
        assert.equal(writeError?.code, 'VALIDATION_ERROR');
        assert.equal(
            writeError?.message,
            'Expected a KV secret path like "secret/my-app/my-secret", got "invalid-path"',
        );
    }
}

import assert from 'node:assert/strict';
import { createSandbox } from 'sinon';

import { VaultClient } from '../../../src/v2/client/vault-client.js';
import { RawVaultClient } from '../../../src/v2/core/raw-client.js';
import { VaultClientError } from '../../../src/v2/transport/errors.js';
import { err, ok, toResult } from '../../../src/v2/core/result.js';

import type { components } from '../../../src/v2/generated/vault-openapi.js';

import type { SinonSandbox } from 'sinon';

describe('VaultClientV2 unit test cases.', function () {
    let sandbox: SinonSandbox;

    const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
        toResult(Promise.resolve(tuple));

    beforeEach(function () {
        sandbox = createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it('should unwrap successful high-level results', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                initialized: true,
            })),
        );
        const client = new VaultClient();

        const isInitialized = await client.sys.isInitialized().unwrap();

        assert.equal(isInitialized, true);
    });

    it('should reject unwrap with the underlying client error', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        await assert.rejects(
            client.sys.isInitialized().unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should set the raw client token after a successful init', async function () {
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                keys: ['unseal-key'],
                root_token: 'root-token',
            })),
        );
        const setTokenSpy = sandbox.spy(RawVaultClient.prototype, 'setToken');
        const client = new VaultClient();

        const initData = await client.sys.init({
            secret_shares: 1,
            secret_threshold: 1,
        }).unwrap();

        assert.equal(initData.root_token, 'root-token');
        assert.equal(setTokenSpy.calledOnceWithExactly('root-token'), true);
    });

    it('should report ready when GET /sys/health succeeds', async function () {
        const requestStub = sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultClient();

        const ready = await client.sys.isReady().unwrap();

        assert.equal(ready, true);
        assert.deepEqual(requestStub.firstCall.args, ['GET', '/sys/health', {}]);
    });

    it('should get the status of the vault', async function () {
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
        const reqStub = sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(ok(healthStatus)),
        );
        const client = new VaultClient();

        const status = await client.sys.status().unwrap();

        assert.deepEqual(status, healthStatus);
        assert.deepEqual(reqStub.firstCall.args, ['GET', '/sys/health', {}]);
    });

    it('should fail fetching the status of the vault if the request fails', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Network error',
        });
        const reqStub = sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        await assert.rejects(
            client.sys.status().unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
        assert.deepEqual(reqStub.firstCall.args, ['GET', '/sys/health', {}]);
    });

    it('should report not ready when HEAD /sys/health returns 503', async function () {
        sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(err(new VaultClientError({
                code: 'HTTP_ERROR',
                message: 'sealed',
                status: 503,
            }))),
        );
        const client = new VaultClient();

        const ready = await client.sys.isReady().unwrap();

        assert.equal(ready, false);
    });

    it('should surface non-HTTP readiness errors', async function () {
        const clientError = new VaultClientError({
            code: 'NETWORK_ERROR',
            message: 'connection refused',
        });
        sandbox.stub(RawVaultClient.prototype, 'request').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        await assert.rejects(
            client.sys.isReady().unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should route system mount enable and disable calls', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultClient();

        const [enableData, enableError] = await client.sys.mount.enable('/secret/', {
            type: 'kv',
        });
        const [disableData, disableError] = await client.sys.mount.disable('/secret/');

        assert.equal(enableData, undefined);
        assert.equal(enableError, null);
        assert.equal(disableData, undefined);
        assert.equal(disableError, null);
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
    });

    it('should surface system mount errors', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'missing permission',
            status: 403,
        });
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        await assert.rejects(
            client.sys.mount.enable('secret', { type: 'kv' }).unwrap(),
            (error: unknown) => {
                assert.equal(error, clientError);
                return true;
            },
        );
    });

    it('should not set a token when init returns no root token', async function () {
        sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                keys: ['unseal-key'],
            })),
        );
        const setTokenSpy = sandbox.spy(RawVaultClient.prototype, 'setToken');
        const client = new VaultClient();

        const initData = await client.sys.init({
            secret_shares: 1,
            secret_threshold: 1,
        }).unwrap();

        assert.deepEqual(initData, {
            keys: ['unseal-key'],
        });
        assert.equal(setTokenSpy.called, false);
    });

    it('should route seal status and unseal calls', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                initialized: true,
                sealed: true,
            })),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok({
                sealed: false,
            })),
        );
        const client = new VaultClient();

        const sealStatus = await client.sys.sealStatus().unwrap();
        const unsealStatus = await client.sys.unseal({
            key: 'unseal-key',
        }).unwrap();

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
    });

    it('should route kv2 writes through the mount data path with wrapped payload', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
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
    });

    it('should unwrap kv2 reads into data and metadata', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                data: {
                    data: { foo: 'bar' },
                    metadata: {
                        destroyed: false,
                        version: 3,
                    },
                },
            })),
        );
        const client = new VaultClient();

        const secret = await client.secret.kv.v2.read<{ foo: string }>('secret-v2', 'apps/demo', { version: 3 }).unwrap();

        assert.deepEqual(secret, {
            data: { foo: 'bar' },
            metadata: {
                destroyed: false,
                version: 3,
            },
        });
    });

    it('should surface metadata for soft-deleted kv2 secrets returned as 404 responses', async function () {
        sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(new VaultClientError({
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
            }))),
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
    });

    it('should not unwrap kv2 read errors that are not soft-deleted secret responses', async function () {
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
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get');
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
    });

    it('should list kv2 keys through the metadata path', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                data: {
                    keys: ['child', 'nested/'],
                },
            })),
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
    });

    it('should route kv1 reads through split mount and path arguments', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                data: {
                    foo: 'bar',
                },
            })),
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
    });

    it('should route kv1 writes and lists through split mount and path arguments', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                keys: ['demo'],
            })),
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
    });

    it('should return validation errors for invalid kv1 paths', async function () {
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: {} })),
        );
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v1.read('secret');

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(getStub.called, false);
    });

    it('should return validation errors for missing kv1 write payloads', async function () {
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const client = new VaultClient();

        const [data, error] = await client.secret.kv.v1.write('secret', 'apps/demo', undefined as unknown as Record<string, unknown>);

        assert.equal(data, null);
        assert.equal(error instanceof VaultClientError, true);
        assert.equal(error?.code, 'VALIDATION_ERROR');
        assert.equal(error?.message, 'VaultSecretKvV1Client.write requires a payload object');
        assert.equal(postStub.called, false);
    });

    it('should allow empty kv1 paths only for list operations', async function () {
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                keys: ['apps/'],
            })),
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
    });

    it('should surface validation errors for invalid kv1 paths', async function () {
        const client = new VaultClient();
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );

        const [deleteData, deleteError] = await client.secret.kv.v1.delete('secret');

        assert.equal(deleteData, null);
        assert.equal(deleteError instanceof VaultClientError, true);
        assert.equal(deleteError?.code, 'VALIDATION_ERROR');
        assert.equal(deleteError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(deleteStub.called, false);

        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                keys: ['apps/'],
            })),
        );

        const [keys, listError] = await client.secret.kv.v1.list('');

        assert.equal(keys, null);
        assert.equal(listError instanceof VaultClientError, true);
        assert.equal(listError?.code, 'VALIDATION_ERROR');
        assert.equal(listError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got ""');
        assert.equal(listStub.called, false);

        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: {} })),
        );
        
        const [readData, readError] = await client.secret.kv.v1.read('secret');

        assert.equal(readData, null);
        assert.equal(readError instanceof VaultClientError, true);
        assert.equal(readError?.code, 'VALIDATION_ERROR');
        assert.equal(readError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(getStub.called, false);

        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        
        const [writeData, writeError] = await client.secret.kv.v1.write('secret', {});

        assert.equal(writeData, null);
        assert.equal(writeError instanceof VaultClientError, true);
        assert.equal(writeError?.code, 'VALIDATION_ERROR');
        assert.equal(writeError?.message, 'Expected a KV v1 secret path like "secret/my-app/my-secret", got "secret"');
        assert.equal(postStub.called, false);
    });

    it('should surface raw client errors from kv1 shortcut methods', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v1.read('secret/apps/demo');

        assert.equal(readData, null);
        assert.equal(readError, clientError);
        assert.equal(getStub.calledOnce, true);

        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(err(clientError)),
        );

        const [deleteData, deleteError] = await client.secret.kv.v1.delete('secret/apps/demo');

        assert.equal(deleteData, null);
        assert.equal(deleteError, clientError);
        assert.equal(deleteStub.calledOnce, true);

        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );

        const [writeData, writeError] = await client.secret.kv.v1.write('secret/apps/demo', { foo: 'bar' });

        assert.equal(writeData, null);
        assert.equal(writeError, clientError);
        assert.equal(postStub.calledOnce, true);

        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(err(clientError)),
        );

        const [keys, listError] = await client.secret.kv.v1.list('secret/apps');

        assert.equal(keys, null);
        assert.equal(listError, clientError);
        assert.equal(listStub.calledOnce, true);

    });

    it('should return validation errors from invalid high-level kv shortcuts', async function () {
        const client = new VaultClient();
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({ data: {} })),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );

        const [readData, readError] = await client.read('secret');
        const [writeData, writeError] = await client.write('secret/apps/demo', undefined as unknown as Record<string, unknown>);

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
    });

    it('should expose kv1 shortcut methods on the high-level client', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                data: {
                    foo: 'bar',
                },
            })),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                keys: ['demo'],
            })),
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
    });

    it('should expose kv2 shortcut methods when engineVersion is 2', async function () {
        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(ok(undefined)),
        );
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(ok({
                data: {
                    data: { foo: 'bar' },
                    metadata: {
                        version: 3,
                    },
                },
            })),
        );
        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(ok(undefined)),
        );
        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(ok({
                data: {
                    keys: ['demo'],
                },
            })),
        );
        const client = new VaultClient();

        const [writeData, writeError] = await client.write('secret-v2', 'apps/demo', { foo: 'bar' }, {
            cas: 2,
            engineVersion: 2,
        });
        const secret = await client.read<{ foo: string }>('secret-v2', 'apps/demo', {
            engineVersion: 2,
            version: 3,
        }).unwrap();
        const keys = await client.list('secret-v2', 'apps', { engineVersion: 2 }).unwrap();
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
    });

    it('should surface raw client errors from kv2 shortcut methods', async function () {
        const clientError = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Vault said no',
            status: 403,
        });
        const getStub = sandbox.stub(RawVaultClient.prototype, 'get').returns(
            resultOf(err(clientError)),
        );
        const client = new VaultClient();

        const [readData, readError] = await client.secret.kv.v2.read('secret-v2', 'apps/demo');

        assert.equal(readData, null);
        assert.equal(readError, clientError);
        assert.equal(getStub.calledOnce, true);

        const deleteStub = sandbox.stub(RawVaultClient.prototype, 'delete').returns(
            resultOf(err(clientError)),
        );

        const [deleteData, deleteError] = await client.secret.kv.v2.delete('secret-v2', 'apps/demo');

        assert.equal(deleteData, null);
        assert.equal(deleteError, clientError);
        assert.equal(deleteStub.calledOnce, true);

        const postStub = sandbox.stub(RawVaultClient.prototype, 'post').returns(
            resultOf(err(clientError)),
        );

        const [writeData, writeError] = await client.secret.kv.v2.write('secret-v2', 'apps/demo', { foo: 'bar' });

        assert.equal(writeData, null);
        assert.equal(writeError, clientError);
        assert.equal(postStub.calledOnce, true);

        const listStub = sandbox.stub(RawVaultClient.prototype, 'list').returns(
            resultOf(err(clientError)),
        );

        const [keys, listError] = await client.secret.kv.v2.list('secret-v2', 'apps');

        assert.equal(keys, null);
        assert.equal(listError, clientError);
        assert.equal(listStub.calledOnce, true);
    });
});

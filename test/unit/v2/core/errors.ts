import assert from 'node:assert/strict';
import { suite, test } from '../../../mocha/decorators.js';
import { VaultClientError } from '../../../../src/v2/core/errors.js';

@suite('VaultClientError unit test cases.')
export class VaultClientErrorUnitTests {
    @test('should create an error with the correct properties')
    public shouldCreateAnErrorWithTheCorrectPropertiesTest() {
        const cause = new Error('Underlying error');
        const responseBody = { message: 'Bad Request' };
        const error = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Request failed',
            status: 400,
            responseBody,
            cause,
        });

        assert.equal(error.code, 'HTTP_ERROR');
        assert.equal(error.message, 'Request failed');
        assert.equal(error.status, 400);
        assert.deepEqual(error.responseBody, responseBody);
        assert.equal(error.cause, cause);
    }

    @test('should identify mount already exists errors correctly')
    public shouldIdentifyMountAlreadyExistsErrorsCorrectlyTest() {
        const error = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Mount already exists',
            status: 400,
            responseBody: {
                errors: ['path is already in use at secret/'],
            },
        });

        assert.equal(error.isMountAlreadyExistsError(), true);
    }

    @test('should return false for non-mount already exists errors')
    public shouldReturnFalseForNonMountAlreadyExistsErrorsTest() {
        const error = new VaultClientError({
            code: 'HTTP_ERROR',
            message: 'Some other error',
            status: 400,
            responseBody: {
                errors: ['some other error'],
            },
        });

        assert.equal(error.isMountAlreadyExistsError(), false);
    }
}

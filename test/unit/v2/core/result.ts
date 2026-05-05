import assert from 'node:assert/strict';

import { err, ok, toResult } from '../../../../src/v2/core/result.js';
import { suite, test } from '../../../mocha/decorators.js';

@suite('Result helper unit test cases.')
export class ResultHelperUnitTests {
    @test('should return tuple helpers for ok and err values')
    public shouldReturnTupleHelpersForOkAndErrValuesTest() {
        assert.deepEqual(ok({ value: 1 }), [{ value: 1 }, null]);
        assert.deepEqual(err(new Error('failed')), [null, new Error('failed')]);
    }

    @test('should return successful values from fallback helpers')
    public async shouldReturnSuccessfulValuesFromFallbackHelpersTest() {
        const result = toResult(Promise.resolve(ok('value')));

        assert.equal(await result.unwrapOr('fallback'), 'value');
        assert.equal(await result.unwrapOrElse(() => 'fallback'), 'value');
        assert.equal(await result.intoErr(), null);
    }

    @test('should return fallback values for failed results')
    public async shouldReturnFallbackValuesForFailedResultsTest() {
        const cause = new Error('failed');
        const result = toResult<string, Error>(Promise.resolve(err(cause)));

        assert.equal(await result.unwrapOr('fallback'), 'fallback');
        assert.equal(await result.unwrapOrElse((error) => error.message), 'failed');
        assert.equal(await result.unwrapErr(), cause);
        assert.equal(await result.intoErr(), cause);
    }

    @test('should reject unwrapErr on successful results')
    public async shouldRejectUnwraperrOnSuccessfulResultsTest() {
        const result = toResult(Promise.resolve(ok('value')));

        await assert.rejects(result.unwrapErr(), /Called unwrapErr on an Ok value/);
    }
}

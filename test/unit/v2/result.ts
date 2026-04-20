import assert from 'node:assert/strict';

import { err, ok, toResult } from '../../../src/v2/core/result.js';

describe('Result helper unit test cases.', function () {
    it('should return tuple helpers for ok and err values', function () {
        assert.deepEqual(ok({ value: 1 }), [{ value: 1 }, null]);
        assert.deepEqual(err(new Error('failed')), [null, new Error('failed')]);
    });

    it('should return successful values from fallback helpers', async function () {
        const result = toResult(Promise.resolve(ok('value')));

        assert.equal(await result.unwrapOr('fallback'), 'value');
        assert.equal(await result.unwrapOrElse(() => 'fallback'), 'value');
        assert.equal(await result.intoErr(), null);
    });

    it('should return fallback values for failed results', async function () {
        const cause = new Error('failed');
        const result = toResult<string, Error>(Promise.resolve(err(cause)));

        assert.equal(await result.unwrapOr('fallback'), 'fallback');
        assert.equal(await result.unwrapOrElse((error) => error.message), 'failed');
        assert.equal(await result.unwrapErr(), cause);
        assert.equal(await result.intoErr(), cause);
    });

    it('should reject unwrapErr on successful results', async function () {
        const result = toResult(Promise.resolve(ok('value')));

        await assert.rejects(
            result.unwrapErr(),
            /Called unwrapErr on an Ok value/,
        );
    });
});

import assert from 'node:assert';

export const assertInstanceOf = <T extends abstract new (...args: never[]) => unknown>(value: unknown, ctor: T): void =>
    assert.ok(value instanceof ctor);

import type { VaultClientError, err, ok } from '../../src/v2/index.js';
import { toResult } from '../../src/v2/core/result.js';

export const resultOf = <T>(tuple: ReturnType<typeof ok<T>> | ReturnType<typeof err<VaultClientError>>) =>
    toResult(Promise.resolve(tuple));

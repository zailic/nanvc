import { VaultClientError } from '../transport/errors.js';

export type Ok<T> = readonly [data: T, error: null];
export type Err<E> = readonly [data: null, error: E];
export type ResultTuple<T, E = VaultClientError> = Ok<T> | Err<E>;

export interface Result<T, E = VaultClientError> extends Promise<ResultTuple<T, E>> {
    unwrap(): Promise<T>;
    unwrapOr(defaultValue: T): Promise<T>;
    unwrapOrElse(fn: (error: E) => T): Promise<T>;
    unwrapErr(): Promise<E>;
    intoErr(): Promise<E | null>;
}

export function ok<T>(data: T): Ok<T> {
    return [data, null] as const;
}

export function err<E>(error: E): Err<E> {
    return [null, error] as const;
}

export function toResult<T, E = VaultClientError>(
    promise: Promise<ResultTuple<T, E>>,
): Result<T, E> {
    const result = promise as Result<T, E>;

    result.unwrap = async (): Promise<T> => {
        const [data, error] = await promise;

        if (error) {
            throw error;
        }

        return data as T;
    };

    result.unwrapOr = async (defaultValue: T): Promise<T> => {
        const [data, error] = await promise;

        if (error) {
            return defaultValue;
        }

        return data as T;
    };

    result.unwrapOrElse = async (fn: (error: E) => T): Promise<T> => {
        const [data, error] = await promise;

        if (error) {
            return fn(error);
        }

        return data as T;
    };

    // Rust like unwrapErr for cases where the caller expects an error and 
    // wants to get it directly, throwing if it's actually an Ok value
    result.unwrapErr = async (): Promise<E> => {
        const [_, error] = await promise;

        if (!error) {
            throw new Error('Called unwrapErr on an Ok value');
        }

        return error as E;
    };

    // Rust like intoErr for cases where the caller just wants to check the
    // error without throwing
    result.intoErr = async (): Promise<E | null> => {
        const [_, error] = await promise;
        return error;
    };


    return result;
}

export type VaultClientErrorCode =
    | 'HTTP_ERROR'
    | 'NETWORK_ERROR'
    | 'TIMEOUT'
    | 'VALIDATION_ERROR'
    | 'SERIALIZATION_ERROR'
    | 'UNKNOWN_ERROR';

export type VaultClientErrorInput = {
    cause?: unknown;
    code: VaultClientErrorCode;
    details?: unknown;
    message: string;
    responseBody?: unknown;
    status?: number;
};

export class VaultClientError extends Error {
    public readonly cause?: unknown;
    public readonly code: VaultClientErrorCode;
    public readonly details?: unknown;
    public readonly responseBody?: unknown;
    public readonly status?: number;

    constructor(input: VaultClientErrorInput) {
        super(input.message);
        this.name = 'VaultClientError';
        this.code = input.code;
        this.status = input.status;
        this.details = input.details;
        this.responseBody = input.responseBody;
        this.cause = input.cause;
    }
}

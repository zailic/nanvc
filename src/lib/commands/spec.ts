import type { JsonSchema } from 'tv4';

export type VaultAllowedHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'LIST';

export type VaultApiResponse = Record<string, unknown>;

export interface PartialVaultResponse {
    httpStatusCode?: number;
    apiResponse?: VaultApiResponse;
    errorMessage?: string;
}

export class VaultResponse {
    constructor(
        private readonly _httpStatusCode?: number,
        private readonly _apiResponse?: VaultApiResponse,
        private readonly _errorMessage?: string,
    ) {}

    get succeeded(): boolean {
        return this._httpStatusCode === 200 || this._httpStatusCode === 204;
    }

    get httpStatusCode(): number | undefined {
        return this._httpStatusCode;
    }

    get apiResponse(): VaultApiResponse | undefined {
        return this._apiResponse;
    }

    get errorMessage(): string | undefined {
        return this._errorMessage;
    }

    public static fromPartial(partial: PartialVaultResponse): VaultResponse {
        return new VaultResponse(
            partial.httpStatusCode,
            partial.apiResponse,
            partial.errorMessage,
        );
    }
}

export interface VaultCommandSchema extends JsonSchema {
    req?: JsonSchema;
    res?: JsonSchema;
}

export interface VaultCommandSpec {
    readonly method: VaultAllowedHttpMethod;
    readonly path: string;
    readonly schema?: VaultCommandSchema;
    readonly successCodes: readonly number[];
}

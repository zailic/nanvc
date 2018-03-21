import { JsonSchema } from 'tv4';

export type VaultAllowedHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'LIST';

export class PartialVaultResponse {
    public _httpStatusCode?: number;
    public _apiResponse?: { [x: string]: any };
    public _errorMessage?: string;
}

export class VaultResponse {
    private _succeeded: boolean;
    constructor(
        private _httpStatusCode: number,
        private _apiResponse?: { [x: string]: any },
        private _errorMessage?: string,
    ) {
        this._succeeded = _httpStatusCode === 200 || _httpStatusCode === 204 ? true : false;
    }

    get succeeded() {
        return this._succeeded;
    }

    get httpStatusCode() {
        return this._httpStatusCode;
    }

    get apiResponse() {
        return this._apiResponse;
    }

    get errorMessage() {
        return this._errorMessage;
    }

    public static newInstanceFromPartial(partial: PartialVaultResponse): VaultResponse {
        return new VaultResponse(
            partial._httpStatusCode,
            partial._apiResponse,
            partial._errorMessage,
        );
    }
}

export interface VaultCommandValidationSchema extends JsonSchema {
    req?: JsonSchema;
    res?: JsonSchema;
}

export interface VaultCommandMetadata {
    readonly method: VaultAllowedHttpMethod;
    readonly path: string;
    schema?: VaultCommandValidationSchema;
    acceptedCodes: Array<number>;
}
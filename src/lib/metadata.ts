export type VaultAllowedHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class PartialVaultResponse {
    _httpStatusCode?: number;
    _apiResponse?: { [x: string]: any };
    _errorMessage?: string;
}


export class VaultResponse {
    private _succeeded: boolean;
    constructor(
        private _httpStatusCode: number,
        private _apiResponse?: { [x: string]: any },
        private _errorMessage?: string
    ) {
        this._succeeded = _httpStatusCode == 200 || _httpStatusCode == 204 ? true : false
    }

    get succeded() {
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
    
    static newInstanceFromPartial(partial: PartialVaultResponse): VaultResponse {
        return new VaultResponse(
            partial._httpStatusCode,
            partial._apiResponse,
            partial._errorMessage
        );
    }
};

export interface VaultCommandMetadata {
    method: VaultAllowedHttpMethod;
    path: string;
}

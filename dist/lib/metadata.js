"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PartialVaultResponse = (function () {
    function PartialVaultResponse() {
    }
    return PartialVaultResponse;
}());
exports.PartialVaultResponse = PartialVaultResponse;
var VaultResponse = (function () {
    function VaultResponse(_httpStatusCode, _apiResponse, _errorMessage) {
        this._httpStatusCode = _httpStatusCode;
        this._apiResponse = _apiResponse;
        this._errorMessage = _errorMessage;
        this._succeeded = _httpStatusCode == 200 || _httpStatusCode == 204 ? true : false;
    }
    Object.defineProperty(VaultResponse.prototype, "succeded", {
        get: function () {
            return this._succeeded;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(VaultResponse.prototype, "httpStatusCode", {
        get: function () {
            return this._httpStatusCode;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(VaultResponse.prototype, "apiResponse", {
        get: function () {
            return this._apiResponse;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(VaultResponse.prototype, "errorMessage", {
        get: function () {
            return this._errorMessage;
        },
        enumerable: true,
        configurable: true
    });
    VaultResponse.newInstanceFromPartial = function (partial) {
        return new VaultResponse(partial._httpStatusCode, partial._apiResponse, partial._errorMessage);
    };
    return VaultResponse;
}());
exports.VaultResponse = VaultResponse;
;
//# sourceMappingURL=metadata.js.map
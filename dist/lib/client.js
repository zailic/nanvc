"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("./constants");
var metadata_1 = require("./metadata");
var request = require("request-promise-native");
var VaultClient = (function () {
    function VaultClient(clusterAddress, authToken, apiVersion) {
        if (clusterAddress === void 0) { clusterAddress = process.env.NANVC_VAULT_CLUSTER_ADDRESS || 'http://127.0.0.1:8200'; }
        if (authToken === void 0) { authToken = process.env.NANVC_VAULT_AUTH_TOKEN || null; }
        if (apiVersion === void 0) { apiVersion = process.env.NANVC_VAULT_API_VERSION || 'v1'; }
        var _this = this;
        this.clusterAddress = clusterAddress;
        this.authToken = authToken;
        this.apiVersion = apiVersion;
        var _loop_1 = function (k) {
            VaultClient.prototype[k] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return _this.apiRequest.apply(_this, [
                    constants_1.SYSTEM_BACKEND_COMMANDS[k].method,
                    constants_1.SYSTEM_BACKEND_COMMANDS[k].path
                ].concat(args));
            };
        };
        for (var k in constants_1.SYSTEM_BACKEND_COMMANDS) {
            _loop_1(k);
        }
    }
    Object.defineProperty(VaultClient.prototype, "token", {
        get: function () {
            return this.authToken;
        },
        set: function (token) {
            this.authToken = token;
        },
        enumerable: true,
        configurable: true
    });
    VaultClient.prototype.read = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.apiRequest('GET', '/secret/' + path)];
            });
        });
    };
    VaultClient.prototype.write = function (path, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.apiRequest('POST', '/secret/' + path, data)];
            });
        });
    };
    VaultClient.prototype.delete = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.apiRequest('DELETE', '/secret/' + path)];
            });
        });
    };
    VaultClient.prototype.update = function (path, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.apiRequest('PUT', '/secret/' + path, data)];
            });
        });
    };
    VaultClient.prototype.apiRequest = function (httpMethod, path) {
        var restOfArgs = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            restOfArgs[_i - 2] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var requestData, fullResponse, partialVaultResponse, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestData = {}, partialVaultResponse = {};
                        requestData.url = this.clusterAddress;
                        requestData.resolveWithFullResponse = true;
                        requestData.json = true;
                        if (this.token) {
                            requestData.headers = {};
                            requestData.headers["X-Vault-Token"] = this.token;
                        }
                        this.sanitizeRequest(requestData, httpMethod, path, restOfArgs);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, request[httpMethod.toLowerCase()](requestData)];
                    case 2:
                        fullResponse = _a.sent();
                        partialVaultResponse._httpStatusCode = fullResponse.statusCode;
                        partialVaultResponse._apiResponse = fullResponse.body;
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        partialVaultResponse._httpStatusCode = e_1.statusCode;
                        partialVaultResponse._errorMessage = e_1.message;
                        return [3, 4];
                    case 4: return [2, metadata_1.VaultResponse.newInstanceFromPartial(partialVaultResponse)];
                }
            });
        });
    };
    VaultClient.prototype.sanitizeRequest = function (request, httpMethod, path, extraArgs) {
        var pathHasPlaceholder = false, re = /^(\/?[a-z-]+(?:\/[a-z-]+)*)((?:\/):[a-z_]+)$/, resolvedPath = path.replace(re, function (m, $1, $2) {
            pathHasPlaceholder = true;
            return [$1, extraArgs[0]].join("/").replace(/\/\//g, "/");
        });
        request.url = [this.getBaseUrl(), resolvedPath].join("/")
            .replace(/(https?:)?\/\//g, function ($0, $1) { return $1 ? $0 : "/"; });
        switch (httpMethod.toUpperCase()) {
            case "POST":
            case "PUT":
                request.body = extraArgs[pathHasPlaceholder ? 1 : 0];
                break;
        }
    };
    VaultClient.prototype.getBaseUrl = function () {
        return this.clusterAddress + "/" + this.apiVersion;
    };
    return VaultClient;
}());
exports.VaultClient = VaultClient;
//# sourceMappingURL=client.js.map
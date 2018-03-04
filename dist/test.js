"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("./lib/client");
var c = new client_1.VaultClient;
c.isInitialized().then(function (r) { return console.log(r); });
c.mounts().then(function (r) { return console.log(r); });
c.auths().then(function (r) { return console.log(r); });
c.policies().then(function (r) { return console.log(r); });
c.write("ionut/test", { secret: "mysecret" }).then(function (r) { return console.log(r); });
c.read("ionut/test").then(function (r) { return console.log(r); });
c.update("ionut/test", { secret: "mysecret-updated" }).then(function (r) { return console.log(r); }).catch(function (e) { return console.log(e.body); });
c.read("ionut/test").then(function (r) { return console.log(r); });
//# sourceMappingURL=test.js.map
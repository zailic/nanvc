import { normalize } from 'path';

import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';

export type VaultAclPolicyReadResponse = components['schemas']['PatchedPoliciesReadAclPolicyResponse'];
export type VaultAclPolicyWriteRequest = components['schemas']['PoliciesWriteAclPolicyRequest'];
export type VaultEgpPolicyReadResponse = components['schemas']['PoliciesReadEgpPolicyResponse'];
export type VaultEgpPolicyWriteRequest = components['schemas']['SystemWritePoliciesEgpNameRequest'];
export type VaultPasswordPolicyGenerateResponse = components['schemas']['PoliciesGeneratePasswordFromPasswordPolicyResponse'];
export type VaultPasswordPolicyReadResponse = components['schemas']['PoliciesReadPasswordPolicyResponse'];
export type VaultPasswordPolicyWriteRequest = components['schemas']['PoliciesWritePasswordPolicyRequest'];
export type VaultRgpPolicyReadResponse = components['schemas']['PoliciesReadRgpPolicyResponse'];
export type VaultRgpPolicyWriteRequest = components['schemas']['SystemWritePoliciesRgpNameRequest'];
export type VaultRotationPolicyReadResponse = components['schemas']['PoliciesReadRotationPolicyResponse'];
export type VaultRotationPolicyWriteRequest = components['schemas']['PoliciesWriteRotationPolicyRequest'];

export class VaultSystemPoliciesAclClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.policies.acl.list
     * category: System / Policies / ACL
     * summary: List configured ACL policies.
     * signatures:
     *   - sys.policies.acl.list()
     * example: |
     *   const policies = await vault.sys.policies.acl.list().unwrap();
     * @end-nanvc-doc
     */
    public list(): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [response, error] = await this.raw.get('/sys/policies/acl/', {
                params: {
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(response.data?.keys ?? []);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.acl.read
     * category: System / Policies / ACL
     * summary: Read an ACL policy by name.
     * signatures:
     *   - sys.policies.acl.read(name)
     * example: |
     *   const policy = await vault.sys.policies.acl.read('deploy').unwrap();
     * @end-nanvc-doc
     */
    public read(name: string): Result<VaultAclPolicyReadResponse> {
        return this.raw.get('/sys/policies/acl/{name}', {
            params: {
                path: {
                    name: normalize(name),
                },
            },
        });
    }

    /**
     * @nanvc-doc
     * id: sys.policies.acl.write
     * category: System / Policies / ACL
     * summary: Create or update an ACL policy.
     * signatures:
     *   - sys.policies.acl.write(name, payload)
     * example: |
     *   await vault.sys.policies.acl.write('deploy', {
     *       policy: 'path "secret/*" { capabilities = ["read"] }',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(name: string, payload: VaultAclPolicyWriteRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/policies/acl/{name}', {
                body: payload,
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.acl.delete
     * category: System / Policies / ACL
     * summary: Delete an ACL policy.
     * signatures:
     *   - sys.policies.acl.delete(name)
     * example: |
     *   await vault.sys.policies.acl.delete('deploy').unwrap();
     * @end-nanvc-doc
     */
    public delete(name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/policies/acl/{name}', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

export class VaultSystemPoliciesEgpClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.policies.egp.list
     * category: System / Policies / EGP
     * summary: List configured endpoint governing policies.
     * signatures:
     *   - sys.policies.egp.list()
     * example: |
     *   const policies = await vault.sys.policies.egp.list().unwrap();
     * @end-nanvc-doc
     */
    public list(): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list('/sys/policies/egp/', {
                params: {
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.keys ?? []);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.egp.read
     * category: System / Policies / EGP
     * summary: Read an endpoint governing policy by name.
     * signatures:
     *   - sys.policies.egp.read(name)
     * example: |
     *   const policy = await vault.sys.policies.egp.read('breakglass').unwrap();
     * @end-nanvc-doc
     */
    public read(name: string): Result<VaultEgpPolicyReadResponse> {
        return this.raw.get('/sys/policies/egp/{name}', {
            params: {
                path: {
                    name: normalize(name),
                },
            },
        });
    }

    /**
     * @nanvc-doc
     * id: sys.policies.egp.write
     * category: System / Policies / EGP
     * summary: Create or update an endpoint governing policy.
     * signatures:
     *   - sys.policies.egp.write(name, payload)
     * example: |
     *   await vault.sys.policies.egp.write('breakglass', {
     *       enforcement_level: 'soft-mandatory',
     *       paths: ['*'],
     *       policy: 'rule main = { true }',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(name: string, payload: VaultEgpPolicyWriteRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/policies/egp/{name}', {
                body: payload,
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.egp.delete
     * category: System / Policies / EGP
     * summary: Delete an endpoint governing policy.
     * signatures:
     *   - sys.policies.egp.delete(name)
     * example: |
     *   await vault.sys.policies.egp.delete('breakglass').unwrap();
     * @end-nanvc-doc
     */
    public delete(name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/policies/egp/{name}', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

export class VaultSystemPoliciesPasswordClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.policies.password.list
     * category: System / Policies / Password
     * summary: List configured password policies.
     * signatures:
     *   - sys.policies.password.list()
     * example: |
     *   const policies = await vault.sys.policies.password.list().unwrap();
     * @end-nanvc-doc
     */
    public list(): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list('/sys/policies/password/', {
                params: {
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.keys ?? []);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.password.read
     * category: System / Policies / Password
     * summary: Read a password policy by name.
     * signatures:
     *   - sys.policies.password.read(name)
     * example: |
     *   const policy = await vault.sys.policies.password.read('app').unwrap();
     * @end-nanvc-doc
     */
    public read(name: string): Result<VaultPasswordPolicyReadResponse> {
        return this.raw.get('/sys/policies/password/{name}', {
            params: {
                path: {
                    name: normalize(name),
                },
            },
        });
    }

    /**
     * @nanvc-doc
     * id: sys.policies.password.write
     * category: System / Policies / Password
     * summary: Create or update a password policy.
     * signatures:
     *   - sys.policies.password.write(name, payload)
     * example: |
     *   await vault.sys.policies.password.write('app', {
     *       policy: 'length = 20',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(name: string, payload: VaultPasswordPolicyWriteRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/policies/password/{name}', {
                body: payload,
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.password.delete
     * category: System / Policies / Password
     * summary: Delete a password policy.
     * signatures:
     *   - sys.policies.password.delete(name)
     * example: |
     *   await vault.sys.policies.password.delete('app').unwrap();
     * @end-nanvc-doc
     */
    public delete(name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/policies/password/{name}', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.password.generate
     * category: System / Policies / Password
     * summary: Generate a password from an existing password policy.
     * signatures:
     *   - sys.policies.password.generate(name)
     * example: |
     *   const { password } = await vault.sys.policies.password.generate('app').unwrap();
     * @end-nanvc-doc
     */
    public generate(name: string): Result<VaultPasswordPolicyGenerateResponse> {
        return toResult((async (): Promise<ResultTuple<VaultPasswordPolicyGenerateResponse>> => {
            const [data, error] = await this.raw.get('/sys/policies/password/{name}/generate', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data);
        })());
    }
}

export class VaultSystemPoliciesRgpClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.policies.rgp.list
     * category: System / Policies / RGP
     * summary: List configured response governing policies.
     * signatures:
     *   - sys.policies.rgp.list()
     * example: |
     *   const policies = await vault.sys.policies.rgp.list().unwrap();
     * @end-nanvc-doc
     */
    public list(): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list('/sys/policies/rgp/', {
                params: {
                    query: {
                        list: 'true',
                    },
                },
            });
            if (error) {
                return err(error);
            }

            return ok(data.keys ?? []);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.rgp.read
     * category: System / Policies / RGP
     * summary: Read a response governing policy by name.
     * signatures:
     *   - sys.policies.rgp.read(name)
     * example: |
     *   const policy = await vault.sys.policies.rgp.read('webapp').unwrap();
     * @end-nanvc-doc
     */
    public read(name: string): Result<VaultRgpPolicyReadResponse> {
        return this.raw.get('/sys/policies/rgp/{name}', {
            params: {
                path: {
                    name: normalize(name),
                },
            },
        });
    }

    /**
     * @nanvc-doc
     * id: sys.policies.rgp.write
     * category: System / Policies / RGP
     * summary: Create or update a response governing policy.
     * signatures:
     *   - sys.policies.rgp.write(name, payload)
     * example: |
     *   await vault.sys.policies.rgp.write('webapp', {
     *       enforcement_level: 'soft-mandatory',
     *       policy: 'rule main = { true }',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(name: string, payload: VaultRgpPolicyWriteRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/policies/rgp/{name}', {
                body: payload,
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.rgp.delete
     * category: System / Policies / RGP
     * summary: Delete a response governing policy.
     * signatures:
     *   - sys.policies.rgp.delete(name)
     * example: |
     *   await vault.sys.policies.rgp.delete('webapp').unwrap();
     * @end-nanvc-doc
     */
    public delete(name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/policies/rgp/{name}', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

export class VaultSystemPoliciesRotationClient {
    constructor(private readonly raw: RawVaultClient) { }

    /**
     * @nanvc-doc
     * id: sys.policies.rotation.read
     * category: System / Policies / Rotation
     * summary: Read a rotation retry policy by name.
     * signatures:
     *   - sys.policies.rotation.read(name)
     * example: |
     *   const policy = await vault.sys.policies.rotation.read('retry').unwrap();
     * @end-nanvc-doc
     */
    public read(name: string): Result<VaultRotationPolicyReadResponse> {
        return this.raw.get('/sys/policies/rotation/{name}', {
            params: {
                path: {
                    name: normalize(name),
                },
            },
        });
    }

    /**
     * @nanvc-doc
     * id: sys.policies.rotation.write
     * category: System / Policies / Rotation
     * summary: Create or update a rotation retry policy.
     * signatures:
     *   - sys.policies.rotation.write(name, payload)
     * example: |
     *   await vault.sys.policies.rotation.write('retry', {
     *       policy: '{"max_retries":3}',
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public write(name: string, payload: VaultRotationPolicyWriteRequest): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post('/sys/policies/rotation/{name}', {
                body: payload,
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: sys.policies.rotation.delete
     * category: System / Policies / Rotation
     * summary: Delete a rotation retry policy.
     * signatures:
     *   - sys.policies.rotation.delete(name)
     * example: |
     *   await vault.sys.policies.rotation.delete('retry').unwrap();
     * @end-nanvc-doc
     */
    public delete(name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete('/sys/policies/rotation/{name}', {
                params: {
                    path: {
                        name: normalize(name),
                    },
                },
            });
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

export class VaultSystemPoliciesClient {
    public readonly acl: VaultSystemPoliciesAclClient;
    public readonly egp: VaultSystemPoliciesEgpClient;
    public readonly password: VaultSystemPoliciesPasswordClient;
    public readonly rgp: VaultSystemPoliciesRgpClient;
    public readonly rotation: VaultSystemPoliciesRotationClient;

    constructor(raw: RawVaultClient) {
        this.acl = new VaultSystemPoliciesAclClient(raw);
        this.egp = new VaultSystemPoliciesEgpClient(raw);
        this.password = new VaultSystemPoliciesPasswordClient(raw);
        this.rgp = new VaultSystemPoliciesRgpClient(raw);
        this.rotation = new VaultSystemPoliciesRotationClient(raw);
    }



}

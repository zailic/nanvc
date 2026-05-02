import type { components } from '../generated/vault-openapi.js';
import type { RawVaultClient } from '../core/raw-client.js';
import { VaultClientError } from '../core/errors.js';
import { err, ok, toResult, type Result, type ResultTuple } from '../core/result.js';

// ── Public type aliases ───────────────────────────────────────────────────────

export type VaultDbConfigureConnectionRequest =
    components['schemas']['DatabaseConfigureConnectionRequest'];

export type VaultDbWriteRoleRequest =
    components['schemas']['DatabaseWriteRoleRequest'];

export type VaultDbWriteStaticRoleRequest =
    components['schemas']['DatabaseWriteStaticRoleRequest'];

export type VaultDbConnectionData =
    components['schemas']['DatabaseConnectionData'];

export type VaultDbReadConnectionResponse =
    components['schemas']['DatabaseReadConnectionResponse'];

export type VaultDbCredentialsData =
    components['schemas']['DatabaseCredentialsData'];

export type VaultDbGenerateCredentialsResponse =
    components['schemas']['DatabaseGenerateCredentialsResponse'];

export type VaultDbRoleData =
    components['schemas']['DatabaseRoleData'];

export type VaultDbReadRoleResponse =
    components['schemas']['DatabaseReadRoleResponse'];

export type VaultDbStaticCredentialsData =
    components['schemas']['DatabaseStaticCredentialsData'];

export type VaultDbReadStaticCredsResponse =
    components['schemas']['DatabaseReadStaticCredsResponse'];

export type VaultDbStaticRoleData =
    components['schemas']['DatabaseStaticRoleData'];

export type VaultDbReadStaticRoleResponse =
    components['schemas']['DatabaseReadStaticRoleResponse'];

// ── Client ────────────────────────────────────────────────────────────────────

export class VaultSecretDbClient {
    constructor(private readonly raw: RawVaultClient) { }

    // ── Connections ───────────────────────────────────────────────────────────

    /**
     * @nanvc-doc
     * id: secret.db.configureConnection
     * category: Secrets / Database
     * summary: Configure a database connection under the given mount.
     * signatures:
     *   - secret.db.configureConnection(mount, name, options)
     * example: |
     *   await vault.secret.db.configureConnection('database', 'my-db', {
     *       plugin_name: 'postgresql-database-plugin',
     *       connection_url: 'postgresql://{{username}}:{{password}}@localhost/postgres',
     *       allowed_roles: ['*'],
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public configureConnection(
        mount: string,
        name: string,
        options: VaultDbConfigureConnectionRequest,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/config/{name}',
                {
                    body: options,
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.readConnection
     * category: Secrets / Database
     * summary: Read the configuration for a named database connection.
     * signatures:
     *   - secret.db.readConnection(mount, name)
     * example: |
     *   const conn = await vault.secret.db.readConnection('database', 'my-db').unwrap();
     * @end-nanvc-doc
     */
    public readConnection(
        mount: string,
        name: string,
    ): Result<VaultDbConnectionData> {
        return toResult((async (): Promise<ResultTuple<VaultDbConnectionData>> => {
            const [data, error] = await this.raw.get(
                '/{database_mount_path}/config/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.deleteConnection
     * category: Secrets / Database
     * summary: Delete a named database connection configuration.
     * signatures:
     *   - secret.db.deleteConnection(mount, name)
     * example: |
     *   await vault.secret.db.deleteConnection('database', 'my-db').unwrap();
     * @end-nanvc-doc
     */
    public deleteConnection(mount: string, name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete(
                '/{database_mount_path}/config/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.listConnections
     * category: Secrets / Database
     * summary: List configured database connection names under the given mount.
     * signatures:
     *   - secret.db.listConnections(mount)
     * example: |
     *   const names = await vault.secret.db.listConnections('database').unwrap();
     * @end-nanvc-doc
     */
    public listConnections(mount: string): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list(
                '/{database_mount_path}/config/',
                {
                    params: {
                        path: { database_mount_path: mount },
                        query: { list: 'true' },
                    },
                },
            );
            if (error) {
                // Vault returns 404 when no connections are configured
                if (error instanceof VaultClientError && error.status === 404) {
                    return ok([]);
                }
                return err(error);
            }

            return ok(extractListKeys(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.resetConnection
     * category: Secrets / Database
     * summary: Close and re-open a database connection, discarding existing connections.
     * signatures:
     *   - secret.db.resetConnection(mount, name)
     * example: |
     *   await vault.secret.db.resetConnection('database', 'my-db').unwrap();
     * @end-nanvc-doc
     */
    public resetConnection(mount: string, name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/reset/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.rotateRootCredentials
     * category: Secrets / Database
     * summary: Rotate the root credentials for a named database connection.
     * signatures:
     *   - secret.db.rotateRootCredentials(mount, name)
     * example: |
     *   await vault.secret.db.rotateRootCredentials('database', 'my-db').unwrap();
     * @end-nanvc-doc
     */
    public rotateRootCredentials(mount: string, name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/rotate-root/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    // ── Dynamic roles and credentials ─────────────────────────────────────────

    /**
     * @nanvc-doc
     * id: secret.db.writeRole
     * category: Secrets / Database
     * summary: Create or update a dynamic database role.
     * signatures:
     *   - secret.db.writeRole(mount, name, options)
     * example: |
     *   await vault.secret.db.writeRole('database', 'my-role', {
     *       db_name: 'my-db',
     *       creation_statements: ['CREATE ROLE "{{name}}" WITH LOGIN PASSWORD \'{{password}}\' VALID UNTIL \'{{expiration}}\''],
     *       default_ttl: 3600,
     *       max_ttl: 86400,
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public writeRole(
        mount: string,
        name: string,
        options: VaultDbWriteRoleRequest,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/roles/{name}',
                {
                    body: options,
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.readRole
     * category: Secrets / Database
     * summary: Read the configuration of a dynamic database role.
     * signatures:
     *   - secret.db.readRole(mount, name)
     * example: |
     *   const role = await vault.secret.db.readRole('database', 'my-role').unwrap();
     * @end-nanvc-doc
     */
    public readRole(mount: string, name: string): Result<VaultDbRoleData> {
        return toResult((async (): Promise<ResultTuple<VaultDbRoleData>> => {
            const [data, error] = await this.raw.get(
                '/{database_mount_path}/roles/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.deleteRole
     * category: Secrets / Database
     * summary: Delete a dynamic database role.
     * signatures:
     *   - secret.db.deleteRole(mount, name)
     * example: |
     *   await vault.secret.db.deleteRole('database', 'my-role').unwrap();
     * @end-nanvc-doc
     */
    public deleteRole(mount: string, name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete(
                '/{database_mount_path}/roles/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.listRoles
     * category: Secrets / Database
     * summary: List dynamic database role names under the given mount.
     * signatures:
     *   - secret.db.listRoles(mount)
     * example: |
     *   const roles = await vault.secret.db.listRoles('database').unwrap();
     * @end-nanvc-doc
     */
    public listRoles(mount: string): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list(
                '/{database_mount_path}/roles/',
                {
                    params: {
                        path: { database_mount_path: mount },
                        query: { list: 'true' },
                    },
                },
            );
            if (error) {
                // Vault returns 404 when no roles are configured
                if (error instanceof VaultClientError && error.status === 404) {
                    return ok([]);
                }
                return err(error);
            }

            return ok(extractListKeys(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.generateCredentials
     * category: Secrets / Database
     * summary: Generate dynamic database credentials for a role.
     * signatures:
     *   - secret.db.generateCredentials(mount, role)
     * example: |
     *   const creds = await vault.secret.db.generateCredentials('database', 'my-role').unwrap();
     * @end-nanvc-doc
     */
    public generateCredentials(
        mount: string,
        role: string,
    ): Result<VaultDbGenerateCredentialsResponse> {
        return this.raw.get('/{database_mount_path}/creds/{name}', {
            params: {
                path: toDbPathParams(mount, role),
            },
        });
    }

    // ── Static roles and credentials ──────────────────────────────────────────

    /**
     * @nanvc-doc
     * id: secret.db.writeStaticRole
     * category: Secrets / Database
     * summary: Create or update a static database role.
     * signatures:
     *   - secret.db.writeStaticRole(mount, name, options)
     * example: |
     *   await vault.secret.db.writeStaticRole('database', 'my-static-role', {
     *       db_name: 'my-db',
     *       username: 'existing_db_user',
     *       rotation_period: 86400,
     *   }).unwrap();
     * @end-nanvc-doc
     */
    public writeStaticRole(
        mount: string,
        name: string,
        options: VaultDbWriteStaticRoleRequest,
    ): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/static-roles/{name}',
                {
                    body: options,
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.readStaticRole
     * category: Secrets / Database
     * summary: Read the configuration of a static database role.
     * signatures:
     *   - secret.db.readStaticRole(mount, name)
     * example: |
     *   const role = await vault.secret.db.readStaticRole('database', 'my-static-role').unwrap();
     * @end-nanvc-doc
     */
    public readStaticRole(
        mount: string,
        name: string,
    ): Result<VaultDbStaticRoleData> {
        return toResult((async (): Promise<ResultTuple<VaultDbStaticRoleData>> => {
            const [data, error] = await this.raw.get(
                '/{database_mount_path}/static-roles/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            return ok(data.data ?? {});
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.deleteStaticRole
     * category: Secrets / Database
     * summary: Delete a static database role.
     * signatures:
     *   - secret.db.deleteStaticRole(mount, name)
     * example: |
     *   await vault.secret.db.deleteStaticRole('database', 'my-static-role').unwrap();
     * @end-nanvc-doc
     */
    public deleteStaticRole(mount: string, name: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.delete(
                '/{database_mount_path}/static-roles/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, name),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.listStaticRoles
     * category: Secrets / Database
     * summary: List static database role names under the given mount.
     * signatures:
     *   - secret.db.listStaticRoles(mount)
     * example: |
     *   const roles = await vault.secret.db.listStaticRoles('database').unwrap();
     * @end-nanvc-doc
     */
    public listStaticRoles(mount: string): Result<string[]> {
        return toResult((async (): Promise<ResultTuple<string[]>> => {
            const [data, error] = await this.raw.list(
                '/{database_mount_path}/static-roles/',
                {
                    params: {
                        path: { database_mount_path: mount },
                        query: { list: 'true' },
                    },
                },
            );
            if (error) {
                // Vault returns 404 when no static roles are configured
                if (error instanceof VaultClientError && error.status === 404) {
                    return ok([]);
                }
                return err(error);
            }

            return ok(extractListKeys(data));
        })());
    }

    /**
     * @nanvc-doc
     * id: secret.db.readStaticCredentials
     * category: Secrets / Database
     * summary: Read the current credentials for a static database role.
     * signatures:
     *   - secret.db.readStaticCredentials(mount, role)
     * example: |
     *   const creds = await vault.secret.db.readStaticCredentials('database', 'my-static-role').unwrap();
     * @end-nanvc-doc
     */
    public readStaticCredentials(
        mount: string,
        role: string,
    ): Result<VaultDbReadStaticCredsResponse> {
        return this.raw.get('/{database_mount_path}/static-creds/{name}', {
            params: {
                path: toDbPathParams(mount, role),
            },
        });
    }

    /**
     * @nanvc-doc
     * id: secret.db.rotateStaticCredentials
     * category: Secrets / Database
     * summary: Trigger an immediate rotation of the credentials for a static database role.
     * signatures:
     *   - secret.db.rotateStaticCredentials(mount, role)
     * example: |
     *   await vault.secret.db.rotateStaticCredentials('database', 'my-static-role').unwrap();
     * @end-nanvc-doc
     */
    public rotateStaticCredentials(mount: string, role: string): Result<void> {
        return toResult((async (): Promise<ResultTuple<void>> => {
            const [data, error] = await this.raw.post(
                '/{database_mount_path}/rotate-role/{name}',
                {
                    params: {
                        path: toDbPathParams(mount, role),
                    },
                },
            );
            if (error) {
                return err(error);
            }

            void data;
            return ok(undefined);
        })());
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type DbPathParams = {
    database_mount_path: string;
    name: string;
};

function toDbPathParams(mount: string, name: string): DbPathParams {
    return {
        database_mount_path: mount,
        name,
    };
}

type ListEnvelope = {
    data?: { keys?: string[] };
    keys?: string[];
};

function extractListKeys(response: ListEnvelope): string[] {
    return response.data?.keys ?? response.keys ?? [];
}

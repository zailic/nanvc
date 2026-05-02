/**
 * Local schema patches for the Database secrets engine.
 *
 * The upstream OpenAPI snapshot (vault-api-openapi.json) does not include
 * response schemas for most database GET endpoints. The shapes defined here
 * are derived from observed Vault behaviour and the Vault documentation, and
 * wrapped in the standard Vault response envelope (request_id, lease_id,
 * data, …) consistent with other patched schemas in this repository.
 *
 * The three request schemas (DatabaseConfigureConnectionRequest,
 * DatabaseWriteRoleRequest, DatabaseWriteStaticRoleRequest) are patched to
 * accept additionalProperties because the Vault database plugin passes
 * connection/role options (e.g. connection_url, username, password,
 * creation_statements) as arbitrary key/value pairs that are forwarded to
 * the underlying database plugin. The upstream OpenAPI snapshot does not
 * enumerate these fields, so omitting additionalProperties would produce a
 * closed type that rejects all plugin-specific configuration.
 */

export const schemaPatches = {
    // ── Request schema patches ──────────────────────────────────────────────
    // The three request schemas are patched to include additionalProperties so
    // that plugin-specific parameters (connection_url, username, password,
    // creation_statements, etc.) can be passed through without TypeScript
    // rejecting them as excess properties.
    DatabaseConfigureConnectionRequest: {
        type: 'object',
        properties: {
            allowed_roles: {
                type: 'array',
                items: { type: 'string' },
            },
            disable_automated_rotation: { type: 'boolean' },
            override_pinned_version: { type: 'boolean' },
            password_policy: { type: 'string' },
            plugin_name: { type: 'string' },
            plugin_version: { type: 'string' },
            root_rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            rotation_period: { type: 'string' },
            rotation_policy: { type: 'string' },
            rotation_schedule: { type: 'string' },
            rotation_window: { type: 'string' },
            skip_static_role_import_rotation: { type: 'boolean' },
            verify_connection: { type: 'boolean' },
        },
        additionalProperties: true,
    },
    DatabaseWriteRoleRequest: {
        type: 'object',
        properties: {
            creation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            credential_type: { type: 'string' },
            db_name: { type: 'string' },
            default_ttl: { type: 'integer' },
            max_ttl: { type: 'integer' },
            renew_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            revocation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            rollback_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
        },
        additionalProperties: true,
    },
    DatabaseWriteStaticRoleRequest: {
        type: 'object',
        properties: {
            credential_type: { type: 'string' },
            db_name: { type: 'string' },
            rotation_period: { type: 'integer' },
            rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            username: { type: 'string' },
        },
        additionalProperties: true,
    },
    // ── Response schema patches ─────────────────────────────────────────────
    DatabaseConnectionDetails: {
        type: 'object',
        additionalProperties: true,
    },
    DatabaseConnectionData: {
        type: 'object',
        properties: {
            allowed_roles: {
                type: 'array',
                items: { type: 'string' },
            },
            connection_details: {
                $ref: '#/components/schemas/DatabaseConnectionDetails',
            },
            name: { type: 'string' },
            password_policy: { type: 'string' },
            plugin_name: { type: 'string' },
            plugin_version: { type: 'string' },
            root_rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            verify_connection: { type: 'boolean' },
        },
    },
    DatabaseReadConnectionResponse: {
        type: 'object',
        properties: {
            request_id: { type: 'string' },
            lease_id: { type: 'string' },
            renewable: { type: 'boolean' },
            lease_duration: { type: 'integer' },
            data: {
                $ref: '#/components/schemas/DatabaseConnectionData',
            },
        },
    },
    DatabaseCredentialsData: {
        type: 'object',
        properties: {
            password: { type: 'string' },
            username: { type: 'string' },
        },
    },
    DatabaseGenerateCredentialsResponse: {
        type: 'object',
        properties: {
            request_id: { type: 'string' },
            lease_id: { type: 'string' },
            renewable: { type: 'boolean' },
            lease_duration: { type: 'integer' },
            data: {
                $ref: '#/components/schemas/DatabaseCredentialsData',
            },
        },
    },
    DatabaseRoleData: {
        type: 'object',
        properties: {
            creation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            credential_type: { type: 'string' },
            db_name: { type: 'string' },
            default_ttl: { type: 'integer' },
            max_ttl: { type: 'integer' },
            renew_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            revocation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            rollback_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
        },
    },
    DatabaseReadRoleResponse: {
        type: 'object',
        properties: {
            request_id: { type: 'string' },
            lease_id: { type: 'string' },
            renewable: { type: 'boolean' },
            lease_duration: { type: 'integer' },
            data: {
                $ref: '#/components/schemas/DatabaseRoleData',
            },
        },
    },
    DatabaseStaticCredentialsData: {
        type: 'object',
        properties: {
            last_vault_rotation: { type: 'string' },
            password: { type: 'string' },
            rotation_period: { type: 'integer' },
            ttl: { type: 'integer' },
            username: { type: 'string' },
        },
    },
    DatabaseReadStaticCredsResponse: {
        type: 'object',
        properties: {
            request_id: { type: 'string' },
            lease_id: { type: 'string' },
            renewable: { type: 'boolean' },
            lease_duration: { type: 'integer' },
            data: {
                $ref: '#/components/schemas/DatabaseStaticCredentialsData',
            },
        },
    },
    DatabaseStaticRoleData: {
        type: 'object',
        properties: {
            credential_type: { type: 'string' },
            db_name: { type: 'string' },
            rotation_period: { type: 'integer' },
            rotation_statements: {
                type: 'array',
                items: { type: 'string' },
            },
            username: { type: 'string' },
        },
    },
    DatabaseReadStaticRoleResponse: {
        type: 'object',
        properties: {
            request_id: { type: 'string' },
            lease_id: { type: 'string' },
            renewable: { type: 'boolean' },
            lease_duration: { type: 'integer' },
            data: {
                $ref: '#/components/schemas/DatabaseStaticRoleData',
            },
        },
    },
};

export const responsePatches = {
    '/{database_mount_path}/config/{name}': {
        get: {
            200: { $ref: '#/components/schemas/DatabaseReadConnectionResponse' },
        },
    },
    '/{database_mount_path}/creds/{name}': {
        get: {
            200: { $ref: '#/components/schemas/DatabaseGenerateCredentialsResponse' },
        },
    },
    '/{database_mount_path}/roles/{name}': {
        get: {
            200: { $ref: '#/components/schemas/DatabaseReadRoleResponse' },
        },
    },
    '/{database_mount_path}/static-creds/{name}': {
        get: {
            200: { $ref: '#/components/schemas/DatabaseReadStaticCredsResponse' },
        },
    },
    '/{database_mount_path}/static-roles/{name}': {
        get: {
            200: { $ref: '#/components/schemas/DatabaseReadStaticRoleResponse' },
        },
    },
};

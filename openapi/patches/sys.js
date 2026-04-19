export const schemaPatches = {
    HealthStatusResponse: {
        properties: {
            clock_skew_ms: {
                type: 'integer',
            },
            echo_duration_ms: {
                type: 'integer',
            },
            initialized: {
                type: 'boolean',
            },
            sealed: {
                type: 'boolean',
            },
            standby: {
                type: 'boolean',
            },
            performance_standby: {
                type: 'boolean',
            },
            replication_performance_mode: {
                type: 'string',
            },
            replication_dr_mode: {
                type: 'string',
            },
            server_time_utc: {
                type: 'integer',
            },
            version: {
                type: 'string',
            },
            cluster_name: {
                type: 'string',
            },
            cluster_id: {
                type: 'string',
            },
            enterprise: {
                type: 'boolean',
            },
            ha_connection_healthy: {
                type: 'boolean',
            },
            last_request_forwarding_heartbeat_ms: {
                type: 'integer',
            },
            removed_from_cluster: {
                type: 'boolean',
            },
            replication_primary_canary_age_ms: {
                type: 'integer',
            },
        },
        type: 'object',
    },
    InitializationStatusResponse: {
        properties: {
            initialized: {
                type: 'boolean',
            },
        },
        type: 'object',
    },
    InitializeResponse: {
        properties: {
            keys: {
                items: { type: 'string' },
                type: 'array',
            },
            root_token: {
                type: 'string',
            },
        },
        required: ['keys', 'root_token'],
        type: 'object',
    },
};

export const responsePatches = {
    '/sys/init': {
        get: {
            200: {
                $ref: '#/components/schemas/InitializationStatusResponse',
            },
        },
        post: {
            200: {
                $ref: '#/components/schemas/InitializeResponse',
            },
        },
    },
    '/sys/mounts/{path}': {
        delete: {
            200: {
                type: 'object',
            },
        },
    },
    '/sys/health': {
        get: {
            200: {
                $ref: '#/components/schemas/HealthStatusResponse',
            },
            472: {
                description: 'standby node but cannot connect to the active node',
            },
            530: {
                description: 'removed',
            },
        },
    },
};

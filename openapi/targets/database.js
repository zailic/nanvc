export const targetPaths = [
    {
        methods: ['get'],
        sourcePath: '/{database_mount_path}/config/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/{database_mount_path}/config/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/{database_mount_path}/creds/{name}',
    },
    {
        methods: ['post'],
        sourcePath: '/{database_mount_path}/reload/{plugin_name}',
    },
    {
        methods: ['post'],
        sourcePath: '/{database_mount_path}/reset/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/{database_mount_path}/roles/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/{database_mount_path}/roles/{name}',
    },
    {
        methods: ['post'],
        sourcePath: '/{database_mount_path}/rotate-role/{name}',
    },
    {
        methods: ['post'],
        sourcePath: '/{database_mount_path}/rotate-root/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/{database_mount_path}/static-creds/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/{database_mount_path}/static-roles/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/{database_mount_path}/static-roles/{name}',
    },
];

export const targetSchemas = [
    'DatabaseConfigureConnectionRequest',
    'DatabaseWriteRoleRequest',
    'DatabaseWriteStaticRoleRequest',
    'StandardListResponse',
];

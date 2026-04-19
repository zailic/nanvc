export const targetPaths = [
    {
        methods: ['get'],
        sourcePath: '/sys/auth',
    },
    {
        methods: ['get', 'post', 'delete'],
        sourcePath: '/sys/auth/{path}',
    },
    {
        methods: ['post'],
        sourcePath: '/auth/{approle_mount_path}/role/{role_name}',
    },
    {
        methods: ['get', 'post'],
        sourcePath: '/auth/{approle_mount_path}/role/{role_name}/role-id',
    },
    {
        methods: ['post'],
        sourcePath: '/auth/{approle_mount_path}/role/{role_name}/secret-id',
    },
    {
        methods: ['post'],
        sourcePath: '/auth/{approle_mount_path}/login',
    },
];

export const targetSchemas = [
    'AuthReadConfigurationResponse',
    'AuthEnableMethodRequest',
    'AppRoleLoginRequest',
    'AppRoleWriteRoleRequest',
    'AppRoleReadRoleIdResponse',
    'AppRoleWriteRoleIdRequest',
    'AppRoleWriteSecretIdRequest',
    'AppRoleWriteSecretIdResponse',
];

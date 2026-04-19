export const targetPaths = [
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/{kv_v2_mount_path}/data/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/{kv_v2_mount_path}/metadata/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/{kv_v2_mount_path}/metadata/{path}/',
    },
];

export const targetSchemas = [
    'KvV2ReadMetadataResponse',
    'KvV2ReadResponse',
    'KvV2WriteRequest',
    'KvV2WriteResponse',
    'StandardListResponse',
];

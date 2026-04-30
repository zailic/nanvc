export const targetPaths = [
    {
        methods: ['get', 'post'],
        sourcePath: '/{kv_v2_mount_path}/config',
    },
    {
        methods: ['delete', 'get', 'patch', 'post'],
        sourcePath: '/{kv_v2_mount_path}/data/{path}',
    },
    {
        methods: ['post'],
        sourcePath: '/{kv_v2_mount_path}/delete/{path}',
    },
    {
        methods: ['post'],
        sourcePath: '/{kv_v2_mount_path}/destroy/{path}',
    },
    {
        methods: ['delete', 'get', 'patch', 'post'],
        sourcePath: '/{kv_v2_mount_path}/metadata/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/{kv_v2_mount_path}/metadata/{path}/',
    },
    {
        methods: ['get'],
        sourcePath: '/{kv_v2_mount_path}/subkeys/{path}',
    },
    {
        methods: ['post'],
        sourcePath: '/{kv_v2_mount_path}/undelete/{path}',
    },
];

export const targetSchemas = [
    'KvV2ConfigureRequest',
    'KvV2DeleteVersionsRequest',
    'KvV2DestroyVersionsRequest',
    'KvV2PatchMetadataPathRequest',
    'KvV2PatchRequest',
    'KvV2PatchResponse',
    'KvV2ReadConfigurationResponse',
    'KvV2ReadMetadataResponse',
    'KvV2ReadResponse',
    'KvV2ReadSubkeysResponse',
    'KvV2UndeleteVersionsRequest',
    'KvV2WriteMetadataRequest',
    'KvV2WriteRequest',
    'KvV2WriteResponse',
    'StandardListResponse',
];

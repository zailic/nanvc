export const targetPaths = [
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/{kv_v1_mount_path}/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/{kv_v1_mount_path}/{path}/',
    },
];

export const targetSchemas = [];

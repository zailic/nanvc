export const targetPaths = [
    {
        methods: ['get', 'post'],
        sourcePath: '/sys/init',
    },
    {
        methods: ['delete', 'post'],
        sourcePath: '/sys/mounts/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/seal-status',
    },
    {
        methods: ['post'],
        sourcePath: '/sys/unseal',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/health',
    },
];

export const targetSchemas = [
    'InitializeRequest',
    'MountsEnableSecretsEngineRequest',
    'SealStatusResponse',
    'UnsealRequest',
    'UnsealResponse',
];

import assert from 'node:assert/strict';

import { createLogger, createLoggerFromEnv } from '../../src/logger.js';

const fixedDate = new Date(2026, 3, 22, 19, 9, 7, 42);
const fixedLoggerOptions = {
    now: () => fixedDate,
};

describe('Logger unit test cases.', function () {
    it('should stay silent when no log level is configured', function () {
        const calls: string[] = [];
        const logger = createLogger(undefined, {
            error: () => calls.push('error'),
        }, fixedLoggerOptions);

        logger.error('vault request failed');

        assert.deepEqual(calls, []);
    });

    it('should write messages at or above the configured level', function () {
        const calls: Array<{ context?: Record<string, unknown>; level: string; message: string }> = [];
        const logger = createLogger('info', {
            debug: (message, context) => calls.push({ context, level: 'debug', message }),
            error: (message, context) => calls.push({ context, level: 'error', message }),
            info: (message, context) => calls.push({ context, level: 'info', message }),
            warn: (message, context) => calls.push({ context, level: 'warn', message }),
        }, fixedLoggerOptions);

        logger.debug('debug message');
        logger.info('info message', {
            meta: { retry: false },
            path: 'sys mounts',
            status: 200,
        });
        logger.warn('warn message');
        logger.error('error message');

        assert.deepEqual(calls, [
            {
                context: undefined,
                level: 'info',
                message: '19:09:07.042 nanvc INFO   info message meta="{\\"retry\\":false}" path="sys mounts" status=200',
            },
            {
                context: undefined,
                level: 'warn',
                message: '19:09:07.042 nanvc WARN   warn message',
            },
            {
                context: undefined,
                level: 'error',
                message: '19:09:07.042 nanvc ERROR  error message',
            },
        ]);
    });

    it('should initialize from NANVC_LOG_LEVEL', function () {
        const calls: string[] = [];
        const logger = createLoggerFromEnv({ NANVC_LOG_LEVEL: 'debug' }, {
            debug: (message) => calls.push(message),
        }, fixedLoggerOptions);

        logger.debug('vault request started');

        assert.deepEqual(calls, ['19:09:07.042 nanvc DEBUG  vault request started']);
    });

    it('should colorize log level prefixes when colors are enabled', function () {
        const calls: string[] = [];
        const logger = createLogger('debug', {
            debug: (message) => calls.push(message),
            error: (message) => calls.push(message),
            info: (message) => calls.push(message),
            warn: (message) => calls.push(message),
        }, { colors: true, ...fixedLoggerOptions });

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        assert.deepEqual(calls, [
            '\u001b[2m19:09:07.042\u001b[0m \u001b[1mnanvc\u001b[0m \u001b[35mDBG\u001b[0m debug message',
            '\u001b[2m19:09:07.042\u001b[0m \u001b[1mnanvc\u001b[0m \u001b[36mINF\u001b[0m info message',
            '\u001b[2m19:09:07.042\u001b[0m \u001b[1mnanvc\u001b[0m \u001b[33mWRN\u001b[0m warn message',
            '\u001b[2m19:09:07.042\u001b[0m \u001b[1mnanvc\u001b[0m \u001b[31mERR\u001b[0m error message',
        ]);
    });

    it('should not throw when formatting unserializable context values', function () {
        const calls: string[] = [];
        const circularValue: Record<string, unknown> = {};
        circularValue.self = circularValue;
        const logger = createLogger('debug', {
            info: (message) => calls.push(message),
        }, fixedLoggerOptions);

        assert.doesNotThrow(() => {
            logger.info('info message', {
                circularValue,
                symbolValue: Symbol('nanvc'),
            });
        });

        assert.deepEqual(calls, [
            '19:09:07.042 nanvc INFO   info message circularValue=[unserializable] symbolValue=Symbol(nanvc)',
        ]);
    });
});

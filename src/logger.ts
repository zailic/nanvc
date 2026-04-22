export type NanvcLogLevel = 'debug' | 'error' | 'info' | 'silent' | 'warn';

export type NanvcLogger = {
    debug(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
};

type LogSink = Partial<NanvcLogger>;

type LoggerOptions = {
    colors?: boolean;
    now?: () => Date;
};

const logLevelPriority: Record<NanvcLogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

const defaultSink: NanvcLogger = {
    debug: console.debug.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
};

const enum color {
    Reset = '\u001b[0m',
    Bright = '\u001b[1m',
    Dim = '\u001b[2m',
    Underscore = '\u001b[4m',
    Blink = '\u001b[5m',
    Reverse = '\u001b[7m',
    Hidden = '\u001b[8m',

    FgBlack = '\u001b[30m',
    FgRed = '\u001b[31m',
    FgGreen = '\u001b[32m',
    FgYellow = '\u001b[33m',
    FgBlue = '\u001b[34m',
    FgMagenta = '\u001b[35m',
    FgCyan = '\u001b[36m',
    FgWhite = '\u001b[37m',

    BgBlack = '\u001b[40m',
    BgRed = '\u001b[41m',
    BgGreen = '\u001b[42m',
    BgYellow = '\u001b[43m',
    BgBlue = '\u001b[44m',
    BgMagenta = '\u001b[45m',
    BgCyan = '\u001b[46m',
    BgWhite = '\u001b[47m',
}

const logLevelColor: Record<Exclude<NanvcLogLevel, 'silent'>, color> = {
    debug: color.FgMagenta,
    error: color.FgRed,
    info: color.FgCyan,
    warn: color.FgYellow,
};

const logLevelAbrev: Record<Exclude<NanvcLogLevel, 'silent'>, string> = {
    debug: 'DBG',
    error: 'ERR',
    info: 'INF',
    warn: 'WRN',
};

export function createLogger(
    level: string | undefined,
    sink: LogSink = defaultSink,
    options: LoggerOptions = {},
): NanvcLogger {
    const resolvedLevel = resolveLogLevel(level);
    const useColors = options.colors ?? (sink === defaultSink && supportsColorOutput());
    const now = options.now ?? (() => new Date());

    return {
        debug: (message, context) => writeLog('debug', resolvedLevel, sink, message, context, useColors, now),
        error: (message, context) => writeLog('error', resolvedLevel, sink, message, context, useColors, now),
        info: (message, context) => writeLog('info', resolvedLevel, sink, message, context, useColors, now),
        warn: (message, context) => writeLog('warn', resolvedLevel, sink, message, context, useColors, now),
    };
}

export function createLoggerFromEnv(
    env: NodeJS.ProcessEnv = process.env,
    sink?: LogSink,
    options?: LoggerOptions,
): NanvcLogger {
    return createLogger(env.NANVC_LOG_LEVEL, sink, options);
}

function resolveLogLevel(level: string | undefined): NanvcLogLevel {
    const normalizedLevel = level?.trim().toLowerCase();

    if (normalizedLevel === undefined || normalizedLevel.length === 0) {
        return 'silent';
    }

    if (normalizedLevel === 'off' || normalizedLevel === 'none' || normalizedLevel === 'false') {
        return 'silent';
    }

    if (isLogLevel(normalizedLevel)) {
        return normalizedLevel;
    }

    return 'silent';
}

function isLogLevel(level: string): level is NanvcLogLevel {
    return level in logLevelPriority;
}

function writeLog(
    level: Exclude<NanvcLogLevel, 'silent'>,
    activeLevel: NanvcLogLevel,
    sink: LogSink,
    message: string,
    context?: Record<string, unknown>,
    colors?: boolean,
    now?: () => Date,
): void {
    if (logLevelPriority[level] > logLevelPriority[activeLevel]) {
        return;
    }

    sink[level]?.(formatLogMessage(level, message, context, colors, now?.() ?? new Date()));
}

function formatLogMessage(
    level: Exclude<NanvcLogLevel, 'silent'>,
    message: string,
    context?: Record<string, unknown>,
    colors?: boolean,
    time: Date = new Date(),
): string {
    const formattedContext = formatContext(context, colors);
    const timestamp = formatTimestamp(time);

    if (colors !== true) {
        return `${timestamp} nanvc ${padLevel(level)} ${message}${formattedContext}`;
    }

    return `${color.Dim}${timestamp}${color.Reset} ${color.Bright}nanvc${color.Reset} ${logLevelColor[level]}${logLevelAbrev[level]}${color.Reset} ${message}${formattedContext}`;
}

function formatContext(context?: Record<string, unknown>, colors?: boolean): string {
    if (context === undefined || Object.keys(context).length === 0) {
        return '';
    }

    return ` ${Object.entries(context)
        .map(([key, value]) => colors ? `${color.Dim}${key}${color.Reset}=${formatContextValue(value)}` : `${key}=${formatContextValue(value)}`)
        .join(' ')}`;
}

function formatContextValue(value: unknown): string {
    if (typeof value === 'string') {
        return quoteContextValueIfNeeded(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
        return String(value);
    }

    return quoteContextValueIfNeeded(stringifyContextValue(value));
}

function stringifyContextValue(value: unknown): string {
    try {
        const serializedValue = JSON.stringify(value);
        return serializedValue ?? String(value);
    } catch {
        return '[unserializable]';
    }
}

function quoteContextValueIfNeeded(value: string): string {
    if (/^[^\s="]+$/.test(value)) {
        return value;
    }

    return JSON.stringify(value);
}

function supportsColorOutput(): boolean {
    if (process.env.NANVC_LOG_NO_COLOR !== undefined) {
        return false;
    }

    if (process.env.NANVC_LOG_FORCE_COLOR !== undefined) {
        return process.env.NANVC_LOG_FORCE_COLOR !== '0';
    }

    return process.stdout.isTTY === true || process.stderr.isTTY === true;
}

function padLevel(level: string): string {
    const maxLevelLength = Math.max(...Object.keys(logLevelPriority).map((l) => l.length));
    return level.toUpperCase().padEnd(maxLevelLength, ' ');
}

function formatTimestamp(time: Date): string {
    return [
        time.getHours(),
        time.getMinutes(),
        time.getSeconds(),
    ].map((part) => part.toString().padStart(2, '0')).join(':')
        + `.${time.getMilliseconds().toString().padStart(3, '0')}`;
}

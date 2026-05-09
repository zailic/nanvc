import { printSuccessBanner } from '../personas/helpers.js';
import { AdminPersona } from '../personas/admin.js';
import { AppPersona } from '../personas/app.js';
import { OperatorPersona } from '../personas/operator.js';
import type { VaultClientVersion } from '../personas/types.js';
import type { VaultClientV2 } from '../../../src/main.js';
import type VaultClient from '../../../src/main.js';
import { createLegacyTestVaultClient, createTestVaultClient, getTestRootToken } from '../../../test/helpers/vault.js';

export type ExampleContext = {
    rootVault: VaultClientV2;
    rootVaultV1?: VaultClient;
    readonly state: Map<string, unknown>;
};

export type WorkflowPersona =
    | AdminPersona<VaultClientVersion>
    | AppPersona<VaultClientVersion>
    | OperatorPersona<VaultClientVersion>;

type WorkflowPersonaKind = 'admin' | 'app' | 'operator';

type RunAsOptions = {
    persona: WorkflowPersonaKind;
    version?: VaultClientVersion;
};

type ExampleClass = {
    readonly name: string;
    new (rootVault: VaultClientV2): object;
};

type DecoratedFunction = (this: object, ...args: any[]) => unknown | Promise<unknown>;

type DecoratedStep = {
    method: DecoratedFunction;
    methodName: string;
    name: string;
    persona?: string;
    runAs?: RunAsOptions;
};

type InstanceMeta = {
    cleanup: DecoratedStep[];
    pendingRunAs: Map<string, RunAsOptions>;
    setup: DecoratedStep[];
    workflows: DecoratedStep[];
};

const classNames = new WeakMap<ExampleClass, string>();
const instanceStore = new WeakMap<object, InstanceMeta>();

function getInstanceMeta(instance: object): InstanceMeta {
    let meta = instanceStore.get(instance);
    if (!meta) {
        meta = {
            cleanup: [],
            pendingRunAs: new Map(),
            setup: [],
            workflows: [],
        };
        instanceStore.set(instance, meta);
    }
    return meta;
}

async function runSteps(steps: DecoratedStep[], instance: object, context: ExampleContext): Promise<void> {
    for (const step of steps) {
        if (step.runAs) {
            try {
                await step.method.call(instance, await createWorkflowPersona(step, context), context);
                continue;
            } finally {
                resetRootVaultTokens(context);
            }
        }

        await step.method.call(instance, context);
    }
}

async function createWorkflowPersona(step: DecoratedStep, context: ExampleContext): Promise<WorkflowPersona> {
    const runAsOptions = step.runAs;
    if (!runAsOptions) {
        throw new Error(`Missing runAs options for workflow "${step.name}"`);
    }

    const version = runAsOptions.version ?? 'v2';

    if (version === 'v1') {
        context.rootVaultV1 ??= await createLegacyTestVaultClient();
        const client = context.rootVaultV1;

        if (runAsOptions.persona === 'admin') {
            return AdminPersona.v1({ client });
        }

        if (runAsOptions.persona === 'operator') {
            return OperatorPersona.v1({ client });
        }

        return AppPersona.v1({ client });
    }

    if (runAsOptions.persona === 'admin') {
        return AdminPersona.v2({ client: context.rootVault });
    }

    if (runAsOptions.persona === 'operator') {
        return OperatorPersona.v2({ client: context.rootVault });
    }

    return AppPersona.v2({ client: context.rootVault });
}

function resetRootVaultTokens(context: ExampleContext): void {
    const rootToken = getTestRootToken();
    context.rootVault.setToken(rootToken);
    if (context.rootVaultV1) {
        context.rootVaultV1.token = rootToken;
    }
}

export function example(name?: string) {
    return function (value: ExampleClass, context: ClassDecoratorContext) {
        classNames.set(value, name ?? String(context.name ?? value.name));
    };
}

export function setup(name?: string) {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            const methodName = String(context.name);
            getInstanceMeta(this as object).setup.push({
                method,
                methodName,
                name: name ?? String(context.name),
            });
        });
    };
}

export function workflow(personaName: string, name?: string) {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            const methodName = String(context.name);
            const meta = getInstanceMeta(this as object);
            meta.workflows.push({
                method,
                methodName,
                name: name ?? methodName,
                persona: personaName,
                runAs: meta.pendingRunAs.get(methodName),
            });
            meta.pendingRunAs.delete(methodName);
        });
    };
}

export function runAs(options: RunAsOptions) {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            const meta = getInstanceMeta(this as object);
            const methodName = String(context.name);
            const step = meta.workflows.find(
                (candidate) => candidate.methodName === methodName || candidate.method === method,
            );

            if (step) {
                step.runAs = options;
                return;
            }

            meta.pendingRunAs.set(methodName, options);
        });
    };
}

export function cleanup(name?: string) {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            const methodName = String(context.name);
            getInstanceMeta(this as object).cleanup.push({
                method,
                methodName,
                name: name ?? String(context.name),
            });
        });
    };
}

export async function runExample(value: ExampleClass): Promise<void> {
    const rootVault = await createTestVaultClient();
    const instance = new value(rootVault);
    const meta = getInstanceMeta(instance);
    const context: ExampleContext = {
        rootVault,
        state: new Map<string, unknown>(),
    };

    try {
        await runSteps(meta.setup, instance, context);
        await runSteps(meta.workflows, instance, context);
    } finally {
        await runSteps(meta.cleanup, instance, context);
    }

    printSuccessBanner(classNames.get(value) ?? value.name);
}

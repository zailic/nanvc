import { describe, it, before, after, beforeEach, afterEach } from 'mocha';

type DecoratedMethod = {
    name: string;
    method: DecoratedFunction;
};

type DecoratedHook = {
    method: DecoratedFunction;
};

type DecoratedFunction = (this: object) => unknown | Promise<unknown>;

type SuiteClass = {
    readonly name: string;
    new (): object;
};

type InstanceMeta = {
    tests: DecoratedMethod[];
    beforeAll: DecoratedHook[];
    afterAll: DecoratedHook[];
    beforeEach: DecoratedHook[];
    afterEach: DecoratedHook[];
};

const instanceStore = new WeakMap<object, InstanceMeta>();

function getInstanceMeta(instance: object): InstanceMeta {
    let meta = instanceStore.get(instance);
    if (!meta) {
        meta = { tests: [], beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] };
        instanceStore.set(instance, meta);
    }
    return meta;
}

async function runHooks(hooks: DecoratedHook[], instance: object): Promise<void> {
    for (const hook of hooks) {
        await hook.method.call(instance);
    }
}

export function suite(name?: string) {
    return function (value: SuiteClass, context: ClassDecoratorContext) {
        const suiteName = name ?? String(context.name ?? value.name);

        describe(suiteName, () => {
            const instance = new (value as any)();
            const meta = getInstanceMeta(instance);

            if (meta.beforeAll.length) before(() => runHooks(meta.beforeAll, instance));
            if (meta.afterAll.length) after(() => runHooks(meta.afterAll, instance));
            if (meta.beforeEach.length) beforeEach(() => runHooks(meta.beforeEach, instance));
            if (meta.afterEach.length) afterEach(() => runHooks(meta.afterEach, instance));

            for (const t of meta.tests) {
                it(t.name, () => t.method.call(instance));
            }
        });
    };
}

export function test(name?: string) {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            const meta = getInstanceMeta(this as object);
            meta.tests.push({ name: name ?? String(context.name), method });
        });
    };
}

export function beforeAll() {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            getInstanceMeta(this as object).beforeAll.push({ method });
        });
    };
}

export function afterAll() {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            getInstanceMeta(this as object).afterAll.push({ method });
        });
    };
}

export function beforeEachTest() {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            getInstanceMeta(this as object).beforeEach.push({ method });
        });
    };
}

export function afterEachTest() {
    return function (method: DecoratedFunction, context: ClassMethodDecoratorContext) {
        context.addInitializer(function () {
            getInstanceMeta(this as object).afterEach.push({ method });
        });
    };
}

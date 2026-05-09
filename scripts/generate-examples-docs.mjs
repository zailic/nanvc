import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import process from 'node:process';

const ROOT_DIR = process.cwd();
const EXAMPLES_DIR = resolve(ROOT_DIR, 'examples');
const DOCS_EXAMPLES_DIR = resolve(ROOT_DIR, 'docs/examples');
const DOCS_EXAMPLES_INDEX_PATH = resolve(ROOT_DIR, 'docs/examples.md');
const EXAMPLE_THIRD_TABS = {
    'database-secrets': {
        label: 'SQL setup',
        language: 'sql',
        path: resolve(ROOT_DIR, 'test/util/db/init.sh'),
        transform: extractSqlHeredoc,
    },
};

const examples = readExamples(EXAMPLES_DIR);

rmSync(DOCS_EXAMPLES_DIR, { force: true, recursive: true });
mkdirSync(DOCS_EXAMPLES_DIR, { recursive: true });

for (const example of examples) {
    writeFileSync(join(DOCS_EXAMPLES_DIR, `${example.slug}.md`), renderExamplePage(example), 'utf8');
}

writeFileSync(DOCS_EXAMPLES_INDEX_PATH, renderExamplesIndex(examples), 'utf8');

function readExamples(examplesDir) {
    return readdirSync(examplesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readExample(join(examplesDir, entry.name)))
        .filter((example) => example !== null)
        .sort((left, right) => left.title.localeCompare(right.title));
}

function readExample(exampleDir) {
    const readmePath = join(exampleDir, 'README.md');
    const mainPath = join(exampleDir, 'main.ts');
    const slug = basename(exampleDir);

    let readme;
    try {
        readme = readFileSync(readmePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }

    return {
        body: stripTopLevelHeading(readme),
        code: readFileSync(mainPath, 'utf8').trimEnd(),
        extraTab: readThirdTab(slug),
        mainPath: relative(ROOT_DIR, mainPath),
        readmePath: relative(ROOT_DIR, readmePath),
        runCommand: `npx tsx ${relative(ROOT_DIR, mainPath)}`,
        slug,
        summary: extractSummary(readme),
        title: extractTitle(readme),
    };
}

function readThirdTab(slug) {
    const tab = EXAMPLE_THIRD_TABS[slug];

    if (!tab) {
        return null;
    }

    return {
        content: tab.transform(readFileSync(tab.path, 'utf8')).trimEnd(),
        label: tab.label,
        language: tab.language,
        sourcePath: relative(ROOT_DIR, tab.path),
    };
}

function extractSqlHeredoc(shellScript) {
    const heredocMatch = shellScript.match(/<<-EOSQL\n(?<sql>[\s\S]*?)\nEOSQL/m);

    if (!heredocMatch?.groups?.sql) {
        throw new Error('Could not find EOSQL heredoc in PostgreSQL init script.');
    }

    return heredocMatch.groups.sql;
}

function extractTitle(markdown) {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (!titleMatch) {
        return 'Example';
    }

    return titleMatch[1].replace(/`/g, '');
}

function extractSummary(markdown) {
    const withoutTitle = stripTopLevelHeading(markdown);
    const paragraph = withoutTitle
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .find((block) => block.length > 0 && !block.startsWith('##') && !block.startsWith('- '));

    if (!paragraph) {
        return 'Runnable nanvc example.';
    }

    return paragraph
        .replace(/\s+/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`/g, '');
}

function stripTopLevelHeading(markdown) {
    return markdown.replace(/^#\s+.+\n+/, '').trim();
}

function renderExamplesIndex(examples) {
    const lines = [
        '---',
        'layout: page',
        'title: Examples',
        'description: Runnable Vault workflows that demonstrate practical nanvc usage.',
        '---',
        '',
        'These examples are generated from `examples/*/README.md` and are designed to run against the local Vault service from the repository root.',
        '',
        '## Available Examples',
        '',
    ];

    for (const example of examples) {
        lines.push(`### [${example.title}](./${example.slug}/)`);
        lines.push('');
        lines.push(example.summary);
        lines.push('');
        lines.push('```bash');
        lines.push(example.runCommand);
        lines.push('```');
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function renderExamplePage(example) {
    const lines = [
        '---',
        'layout: page',
        `title: ${quoteYaml(example.title)}`,
        `description: ${quoteYaml(example.summary)}`,
        '---',
        '',
        '{% capture example_guide %}',
        example.body,
        '{% endcapture %}',
        '',
        '{% capture example_source %}',
        '{% highlight ts %}',
        example.code,
        '{% endhighlight %}',
        '{% endcapture %}',
        '',
    ];

    if (example.extraTab) {
        lines.push('{% capture example_extra %}');
        lines.push(`{% highlight ${example.extraTab.language} %}`);
        lines.push(example.extraTab.content);
        lines.push('{% endhighlight %}');
        lines.push('{% endcapture %}');
        lines.push('');
    }

    lines.push(...renderExampleTabs(example));
    lines.push(
        '',
        '## Source Files',
        '',
        `- README source: \`${example.readmePath}\``,
        `- Runnable source: \`${example.mainPath}\``,
    );

    if (example.extraTab) {
        lines.push(`- ${example.extraTab.label} source: \`${example.extraTab.sourcePath}\``);
    }

    lines.push(
        '',
        '> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.',
        '',
    );

    return lines.join('\n');
}

function renderExampleTabs(example) {
    const lines = [
        '{% include doc-tabs.html',
        `  id="example-${example.slug}"`,
        '  aria_label="Example content"',
        '  label_one="Guide"',
        '  label_two="Source"',
        '  panel_one=example_guide',
        '  panel_two=example_source',
        '  markdown_one=true',
    ];

    if (example.extraTab) {
        lines.push(`  label_three="${example.extraTab.label}"`);
        lines.push('  panel_three=example_extra');
    }

    lines.push('%}');

    return lines;
}

function quoteYaml(value) {
    return JSON.stringify(value);
}

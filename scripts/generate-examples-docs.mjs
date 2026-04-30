import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const EXAMPLES_DIR = resolve(ROOT_DIR, "examples");
const DOCS_EXAMPLES_DIR = resolve(ROOT_DIR, "docs/examples");
const DOCS_EXAMPLES_INDEX_PATH = resolve(ROOT_DIR, "docs/examples.md");

const examples = readExamples(EXAMPLES_DIR);

rmSync(DOCS_EXAMPLES_DIR, { force: true, recursive: true });
mkdirSync(DOCS_EXAMPLES_DIR, { recursive: true });

for (const example of examples) {
  writeFileSync(
    join(DOCS_EXAMPLES_DIR, `${example.slug}.md`),
    renderExamplePage(example),
    "utf8",
  );
}

writeFileSync(DOCS_EXAMPLES_INDEX_PATH, renderExamplesIndex(examples), "utf8");

function readExamples(examplesDir) {
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readExample(join(examplesDir, entry.name)))
    .filter((example) => example !== null)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function readExample(exampleDir) {
  const readmePath = join(exampleDir, "README.md");
  const mainPath = join(exampleDir, "main.ts");

  let readme;
  try {
    readme = readFileSync(readmePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  return {
    body: stripTopLevelHeading(readme),
    code: readFileSync(mainPath, "utf8").trimEnd(),
    mainPath: relative(ROOT_DIR, mainPath),
    readmePath: relative(ROOT_DIR, readmePath),
    runCommand: `npx tsx ${relative(ROOT_DIR, mainPath)}`,
    slug: basename(exampleDir),
    summary: extractSummary(readme),
    title: extractTitle(readme),
  };
}

function extractTitle(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (!titleMatch) {
    return "Example";
  }

  return titleMatch[1].replace(/`/g, "");
}

function extractSummary(markdown) {
  const withoutTitle = stripTopLevelHeading(markdown);
  const paragraph = withoutTitle
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block.length > 0 && !block.startsWith("##") && !block.startsWith("- "));

  if (!paragraph) {
    return "Runnable nanvc example.";
  }

  return paragraph
    .replace(/\s+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`/g, "");
}

function stripTopLevelHeading(markdown) {
  return markdown.replace(/^#\s+.+\n+/, "").trim();
}

function renderExamplesIndex(examples) {
  const lines = [
    "---",
    "layout: page",
    "title: Examples",
    "description: Runnable Vault workflows that demonstrate practical nanvc usage.",
    "---",
    "",
    "These examples are generated from `examples/*/README.md` and are designed to run against the local Vault service from the repository root.",
    "",
    "## Available Examples",
    "",
  ];

  for (const example of examples) {
    lines.push(`### [${example.title}](./${example.slug}/)`);
    lines.push("");
    lines.push(example.summary);
    lines.push("");
    lines.push("```bash");
    lines.push(example.runCommand);
    lines.push("```");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderExamplePage(example) {
  const lines = [
    "---",
    "layout: page",
    `title: ${quoteYaml(example.title)}`,
    `description: ${quoteYaml(example.summary)}`,
    "---",
    "",
    "{% capture example_guide %}",
    example.body,
    "{% endcapture %}",
    "",
    "{% capture example_source %}",
    "{% highlight ts %}",
    example.code,
    "{% endhighlight %}",
    "{% endcapture %}",
    "",
    "{% include doc-tabs.html",
    `  id="example-${example.slug}"`,
    "  aria_label=\"Example content\"",
    "  label_one=\"Guide\"",
    "  label_two=\"Source\"",
    "  panel_one=example_guide",
    "  panel_two=example_source",
    "  markdown_one=true",
    "%}",
    "",
    "## Source Files",
    "",
    `- README source: \`${example.readmePath}\``,
    `- Runnable source: \`${example.mainPath}\``,
    "",
    "> This page is generated from the example README. Edit the source README and run `npm run generate:docs` to update it.",
    "",
  ];

  return lines.join("\n");
}

function quoteYaml(value) {
  return JSON.stringify(value);
}

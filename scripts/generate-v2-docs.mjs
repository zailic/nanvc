import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const CLIENT_SOURCE_DIR = resolve(ROOT_DIR, "src/v2/client");
const API_V2_DOCS_PATH = resolve(ROOT_DIR, "docs/api-v2.md");
const START_MARKER = "<!-- nanvc:client-structure:start -->";
const END_MARKER = "<!-- nanvc:client-structure:end -->";

const docs = readNanvcDocs(CLIENT_SOURCE_DIR)
  .sort((left, right) =>
    `${left.category ?? ""}:${left.id}`.localeCompare(`${right.category ?? ""}:${right.id}`),
  );

const generatedMarkdown = renderGeneratedDocs(docs);
const currentDocs = readFileSync(API_V2_DOCS_PATH, "utf8");
writeFileSync(API_V2_DOCS_PATH, replaceGeneratedSection(currentDocs, generatedMarkdown), "utf8");

function readNanvcDocs(directoryPath) {
  return listTypeScriptFiles(directoryPath).flatMap((filePath) =>
    extractNanvcDocBlocks(filePath).map((block) => ({
      ...parseNanvcDocBlock(block),
      source: relative(ROOT_DIR, filePath),
    })),
  );
}

function listTypeScriptFiles(directoryPath) {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(entryPath);
    }

    return extname(entry.name) === ".ts" ? [entryPath] : [];
  });
}

function extractNanvcDocBlocks(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    if (line.includes("@nanvc-doc")) {
      currentBlock = [];
      continue;
    }

    if (line.includes("@end-nanvc-doc")) {
      if (currentBlock) {
        blocks.push(currentBlock.join("\n"));
      }
      currentBlock = null;
      continue;
    }

    if (currentBlock) {
      currentBlock.push(stripCommentPrefix(line));
    }
  }

  return blocks;
}

function stripCommentPrefix(line) {
  return line
    .replace(/^\s*\/\*\*?/, "")
    .replace(/\*\/\s*$/, "")
    .replace(/^\s*\*\s?/, "");
}

function parseNanvcDocBlock(block) {
  const lines = block.split("\n");
  const doc = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const propertyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!propertyMatch) {
      continue;
    }

    const [, key, rawValue] = propertyMatch;
    if (rawValue === "|") {
      const valueLines = [];
      index += 1;
      while (index < lines.length && isIndented(lines[index])) {
        valueLines.push(lines[index].replace(/^ {2}/, ""));
        index += 1;
      }
      index -= 1;
      doc[key] = trimEmptyEdges(valueLines).join("\n");
      continue;
    }

    if (rawValue === "") {
      const items = [];
      index += 1;
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^ {2}-\s*(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        index += 1;
      }
      index -= 1;
      doc[key] = items;
      continue;
    }

    doc[key] = rawValue;
  }

  if (!doc.id) {
    throw new Error(`Missing id in @nanvc-doc block:\n${block}`);
  }

  return doc;
}

function isIndented(line) {
  return line.startsWith("  ") || line.length === 0;
}

function trimEmptyEdges(lines) {
  const trimmed = [...lines];
  while (trimmed[0] === "") {
    trimmed.shift();
  }
  while (trimmed.at(-1) === "") {
    trimmed.pop();
  }
  return trimmed;
}

function renderGeneratedDocs(docs) {
  const lines = [
    START_MARKER,
    "",
    "#### Generated Shorthand Reference",
    "",
    "This section is generated from `@nanvc-doc` blocks in `src/v2/client/**/*.ts`.",
    "",
  ];

  let currentCategory = null;
  for (const doc of docs) {
    if (doc.category !== currentCategory) {
      currentCategory = doc.category;
      lines.push(`##### ${currentCategory}`, "");
    }

    lines.push(`<details id="${toHtmlId(doc.id)}" markdown="1">`);
    lines.push(`<summary><code>${doc.id}</code></summary>`, "");

    if (doc.summary) {
      lines.push(doc.summary, "");
    }

    if (Array.isArray(doc.signatures) && doc.signatures.length > 0) {
      lines.push("Signatures:", "");
      lines.push(...doc.signatures.map((signature) => `- \`${signature}\``), "");
    }

    if (doc.example) {
      lines.push("Example:", "", "```ts", doc.example, "```", "");
    }

    lines.push("</details>", "");
  }

  lines.push(END_MARKER, "");
  return lines.join("\n");
}

function toHtmlId(value) {
  return value.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
}

function replaceGeneratedSection(content, generatedMarkdown) {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing generated docs markers in ${relative(ROOT_DIR, API_V2_DOCS_PATH)}`);
  }

  return [
    content.slice(0, startIndex).trimEnd(),
    generatedMarkdown.trimEnd(),
    content.slice(endIndex + END_MARKER.length).trimStart(),
  ].join("\n\n");
}

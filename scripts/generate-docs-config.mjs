import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

await writeFile(
  new URL('../docs/_config.generated.yml', import.meta.url),
  `software_version: ${pkg.version}\n`,
);

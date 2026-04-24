import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

const sourcePath = new URL('../CHANGELOG.md', import.meta.url);
const targetPath = new URL('../docs/changelog.md', import.meta.url);

const changelog = await readFile(sourcePath, 'utf8');
const indexOfUnreleased = changelog.indexOf('## Unreleased');
const trimmedChangelog = changelog.substring(indexOfUnreleased);

const page = `---
layout: page
title: Changelog
description: Release history and notable changes for nanvc.
---

${trimmedChangelog}`;

await writeFile(targetPath, page);

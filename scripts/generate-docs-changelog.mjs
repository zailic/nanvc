import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

const sourcePath = new URL('../CHANGELOG.md', import.meta.url);
const targetPath = new URL('../docs/changelog.md', import.meta.url);

const changelog = await readFile(sourcePath, 'utf8');
const body = changelog
    .replace(/^# Changelog\s*/u, '')
    .trimStart();

const page = `---
layout: page
title: Changelog
description: Release history and notable changes for nanvc.
---

${body}`;

await writeFile(targetPath, page);

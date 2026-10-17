#!/usr/bin/env node
/**
 * Runs a command with the repo-root .env loaded.
 *
 * One .env at the root configures the whole workspace, but tools like the
 * Prisma CLI only look next to themselves — this bridges the two without
 * asking anyone to keep two copies of the same file in step.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [resolve(here, '../.env'), resolve(here, '../../../.env')];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: run-with-env.mjs <command> [args...]');
  process.exit(1);
}

spawn(command, args, { stdio: 'inherit', env: process.env, shell: true }).on('exit', (code) =>
  process.exit(code ?? 0),
);

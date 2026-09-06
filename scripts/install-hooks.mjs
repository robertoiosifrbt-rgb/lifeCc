#!/usr/bin/env node

import { chmodSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const hooks = ['.githooks/pre-commit', '.githooks/pre-push']

const git = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' })
if (git.status !== 0) {
  // npm can run outside a Git checkout (for example when packaging). Nothing to install.
  process.exit(0)
}

for (const hook of hooks) {
  if (!existsSync(hook)) {
    console.error(`Cannot install Git hooks: missing ${hook}`)
    process.exit(1)
  }
  chmodSync(hook, 0o755)
}

const config = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  encoding: 'utf8',
})
if (config.status !== 0) {
  console.error(config.stderr || 'Could not set core.hooksPath')
  process.exit(config.status ?? 1)
}

console.log('Git hooks installed from .githooks.')

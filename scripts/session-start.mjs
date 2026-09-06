#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0 && !allowFailure) {
    console.error(result.stderr || `git ${args.join(' ')} failed`)
    process.exit(result.status ?? 1)
  }
  return result
}

const install = spawnSync(process.execPath, ['scripts/install-hooks.mjs'], { stdio: 'inherit' })
if (install.status !== 0) process.exit(install.status ?? 1)

const status = (run(['status', '--porcelain']).stdout ?? '').trim()
const branch = (run(['branch', '--show-current']).stdout ?? '').trim()

if (!branch) {
  console.error('BLOCKED: detached HEAD. A work session must start on main.')
  process.exit(1)
}

if (branch !== 'main') {
  if (status) {
    console.error(`BLOCKED: session started on ${branch} with uncommitted changes.`)
    console.error('Do not continue on this branch. Move or discard the changes explicitly, then run npm run session:start again.')
    process.exit(1)
  }

  run(['fetch', 'origin', 'main'])
  const hasMain = run(['show-ref', '--verify', '--quiet', 'refs/heads/main'], { allowFailure: true }).status === 0
  if (hasMain) run(['switch', 'main'])
  else run(['switch', '-c', 'main', '--track', 'origin/main'])
}

run(['fetch', 'origin', 'main'])
const merge = run(['merge', '--ff-only', 'origin/main'], { allowFailure: true })
if (merge.status !== 0) {
  console.error('BLOCKED: local main and origin/main have diverged. Resolve that explicitly before working.')
  console.error(merge.stderr || '')
  process.exit(1)
}

const finalBranch = (run(['branch', '--show-current']).stdout ?? '').trim()
if (finalBranch !== 'main') {
  console.error(`BLOCKED: expected main after session setup, got ${finalBranch || '(detached HEAD)'}.`)
  process.exit(1)
}

console.log('Session ready: main is checked out, origin/main is fetched, hooks are active.')

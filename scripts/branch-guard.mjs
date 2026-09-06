#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const mode = process.argv[2] ?? 'commit'
const remote = process.argv[3] ?? null

function git(args) {
  const run = spawnSync('git', args, { encoding: 'utf8' })
  if (run.status !== 0) {
    console.error(run.stderr || `git ${args.join(' ')} failed`)
    process.exit(run.status ?? 1)
  }
  return (run.stdout ?? '').trim()
}

const branch = git(['branch', '--show-current'])

if (branch !== 'main') {
  console.error(`BLOCKED: ${mode} is allowed only on main. Current branch: ${branch || '(detached HEAD)'}`)
  console.error('Move the work to local main first. Do not push a session branch or create a PR as a workaround.')
  process.exit(1)
}

if (mode === 'push' && remote && remote !== 'origin') {
  console.error(`BLOCKED: pushes are allowed only to origin. Requested remote: ${remote}`)
  process.exit(1)
}

console.log(`Branch guard OK: ${mode} on main${remote ? ` -> ${remote}` : ''}.`)

#!/usr/bin/env node
// The RLS test, on a local, ephemeral Supabase database.
//
// It never touches production: it requires DATABASE_URL explicitly and stops
// without it. CI starts it after `supabase start`.

import pg from 'pg'

import { CASES as AREA_CASES } from './lib/rls-areas.mjs'
import { CASES as EXPENSE_CASES } from './lib/rls-expenses.mjs'
import { CASES as JOURNAL_CASES } from './lib/rls-journal.mjs'
import { CASES as QUICK_ACTION_CASES } from './lib/rls-quick-actions.mjs'
import { CASES as QUICK_ACTION_COLUMN_CASES } from './lib/rls-quick-actions-columns.mjs'
import { CASES as SETTINGS_CASES } from './lib/rls-settings.mjs'
import { CASES as ITEM_CASES } from './lib/rls.mjs'
import { CASES as SHIFT_CASES } from './lib/rls-shifts.mjs'
import { CASES as SHIFT_INVARIANT_CASES } from './lib/rls-shift-invariants.mjs'
import { CASES as LINK_CASES } from './lib/rls-links.mjs'
import { CASES as UPSERT_CASES } from './lib/rls-upsert.mjs'
import { A, B, contextFor } from './lib/rls-context.mjs'

// One list, so a group is complete across both tables rather than per file.
const CASES = [
  ...ITEM_CASES,
  ...AREA_CASES,
  ...SHIFT_CASES,
  ...SHIFT_INVARIANT_CASES,
  ...SETTINGS_CASES,
  ...EXPENSE_CASES,
  ...UPSERT_CASES,
  ...LINK_CASES,
  ...JOURNAL_CASES,
  ...QUICK_ACTION_CASES,
  ...QUICK_ACTION_COLUMN_CASES,
]

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error(
    'DATABASE_URL is missing. The RLS test runs only against a local database:\n' +
      '  supabase start\n' +
      '  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run check:rls',
  )
  process.exit(1)
}

// Every group must have cases. An RLS test with zero negatives or zero
// positives is a green check that checks nothing.
const REQUIRED_GROUPS = ['negative', 'positive', 'writing', 'constraint']

const client = new pg.Client({ connectionString: DATABASE_URL })
const failures = []

await client.connect()

try {
  // Two users, seeded as the administrator. Each case runs inside its own
  // transaction and rolls it back, so rows do not leak between them.
  for (const [uid, email] of [
    [A, 'a@check.local'],
    [B, 'b@check.local'],
  ]) {
    await client.query(
      'insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing',
      [uid, email],
    )
  }

  for (const group of REQUIRED_GROUPS) {
    const inGroup = CASES.filter((testCase) => testCase.group === group)
    if (inGroup.length === 0) {
      failures.push({ name: `the "${group}" group`, reason: 'has no cases' })
      continue
    }
    console.log(`\n  ${group}:`)
    for (const testCase of inGroup) {
      // Each case sits in its own transaction, rolled back at the end: even
      // its setup is not committed, so cases cannot influence one another.
      await client.query('begin')
      try {
        await testCase.run(contextFor(client))
        console.log(`    ✓ ${testCase.name}`)
      } catch (error) {
        console.log(`    ✗ ${testCase.name}`)
        failures.push({ name: testCase.name, reason: error.message })
      } finally {
        await client.query('rollback')
      }
    }
  }
} finally {
  // The database is ephemeral, but the checker still leaves no rows behind.
  try {
    await client.query('delete from public.items where owner in ($1, $2)', [A, B])
    await client.query('delete from auth.users where id in ($1, $2)', [A, B])
  } catch (error) {
    failures.push({ name: 'the cleanup at the end', reason: error.message })
  }
  await client.end()
}

if (failures.length === 0) {
  console.log(`\nRLS is fine: ${CASES.length} cases.`)
  process.exit(0)
}

console.error(`\nRLS: ${failures.length} cases failed out of ${CASES.length}\n`)
for (const failure of failures) {
  console.error(`  ${failure.name}: ${failure.reason}`)
}
process.exit(1)

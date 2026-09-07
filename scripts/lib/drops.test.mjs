import { describe, expect, it } from 'vitest'

import { dropsIn, stillAsked } from './drops.mjs'

describe('dropsIn', () => {
  it('reports a dropped table and a dropped column', () => {
    const sql = `
      drop table public.reserves;
      alter table public.widgets drop column legacy_note;
    `
    expect(dropsIn(sql)).toEqual([
      { kind: 'table', name: 'reserves' },
      { kind: 'column', name: 'legacy_note' },
    ])
  })

  it('does not report a column the same migration gives right back', () => {
    // The shape 20260907030000_platform_rules actually has: a column
    // dropped from one table, and a fresh column of the same name created
    // on another, in the same file — moved, not gone. Code still naming it
    // is naming its new home.
    const sql = `
      alter table public.platforms
        drop column earning_cycle_kind,
        drop column payout_schedule;

      create table public.platform_rules (
        platform_item_id uuid not null,
        earning_cycle_kind      text,
        payout_schedule         text,
        cashout_fee_value  numeric(10, 2)
      );
    `
    expect(dropsIn(sql)).toEqual([])
  })

  it('still reports a column dropped from one table and given to a different one, if only some of it moved', () => {
    const sql = `
      alter table public.platforms
        drop column earning_cycle_kind,
        drop column cashout_settlement;

      create table public.platform_rules (
        earning_cycle_kind text
      );
    `
    expect(dropsIn(sql)).toEqual([{ kind: 'column', name: 'cashout_settlement' }])
  })
})

describe('stillAsked', () => {
  const files = [
    { path: 'src/repository/thing.ts', contents: "supabase.from('reserves').select('*')" },
    { path: 'src/repository/other.test.ts', contents: 'reserves' },
    { path: 'src/repository/prose.ts', contents: '// reserves is gone now' },
  ]

  it('finds a real request shape, ignores tests and prose', () => {
    const found = stillAsked(files, 'reserves')
    expect(found.map((f) => f.path)).toEqual(['src/repository/thing.ts'])
  })
})

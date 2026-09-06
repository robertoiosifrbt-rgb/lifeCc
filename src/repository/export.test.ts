import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { exportFile } from './export'
import type { Item } from './item'

const NOW = new Date('2026-09-04T18:30:00.000Z')

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: null,
    state: 'inbox',
    title: `title ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    area_id: null,
    waiting_since: null,
    ...over,
  }
}

describe('exportFile', () => {
  it('writes the whole snapshot, deleted rows included', () => {
    const file = exportFile(
      'a',
      [item('one'), item('two', { deleted_at: '2026-09-03T00:00:00+00:00' })],
      '2026-09-03T00:00:00+00:00',
      NOW,
    )
    const read = JSON.parse(file.contents) as { items: Item[] }

    expect(read.items.map((i) => i.id)).toEqual(['one', 'two'])
  })

  it('says how far it is synced, so it promises no more than it knows', () => {
    const file = exportFile('a', [], '2026-09-03T00:00:00+00:00', NOW)
    const read = JSON.parse(file.contents) as Record<string, unknown>

    expect(read['syncedThrough']).toBe('2026-09-03T00:00:00+00:00')
    expect(read['exportedAt']).toBe('2026-09-04T18:30:00.000Z')
    expect(read['user']).toBe('a')
  })

  it('is a valid empty file when you have nothing', () => {
    const file = exportFile('a', [], null, NOW)
    const read = JSON.parse(file.contents) as { items: Item[] }

    expect(read.items).toEqual([])
    expect(file.name).toBe('life-control-centre-2026-09-04.json')
  })
})

describe('the file name, away from UTC', () => {
  // Node re-reads TZ when it changes. In UTC the local day and the UTC day are
  // the same, so a test there would pass over the bug it is here to catch.
  beforeAll(() => {
    vi.stubEnv('TZ', 'Europe/Bucharest')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('is named after your day, not after UTC\'s', () => {
    // 21:30 UTC is half past midnight the next morning in Bucharest.
    const late = new Date('2026-09-04T21:30:00+00:00')
    expect(exportFile('a', [], null, late).name).toBe(
      'life-control-centre-2026-09-05.json',
    )
  })
})

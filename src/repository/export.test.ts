import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { exportFile } from './export'
import type { Item } from './item'
import type { JournalEntry } from './journal-entry'

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

function journalEntry(item_id: string, over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    item_id,
    owner: 'a',
    title: null,
    body: `body of ${item_id}`,
    journaled_at: '2026-09-02T20:00:00+00:00',
    ...over,
  }
}

describe('exportFile', () => {
  it('writes the whole snapshot, deleted rows included', () => {
    const file = exportFile(
      'a',
      [item('one'), item('two', { deleted_at: '2026-09-03T00:00:00+00:00' })],
      [],
      '2026-09-03T00:00:00+00:00',
      NOW,
    )
    const read = JSON.parse(file.contents) as { items: Item[] }

    expect(read.items.map((i) => i.id)).toEqual(['one', 'two'])
  })

  it('says how far it is synced, so it promises no more than it knows', () => {
    const file = exportFile('a', [], [], '2026-09-03T00:00:00+00:00', NOW)
    const read = JSON.parse(file.contents) as Record<string, unknown>

    expect(read['syncedThrough']).toBe('2026-09-03T00:00:00+00:00')
    expect(read['exportedAt']).toBe('2026-09-04T18:30:00.000Z')
    expect(read['user']).toBe('a')
  })

  it('is a valid empty file when you have nothing', () => {
    const file = exportFile('a', [], [], null, NOW)
    const read = JSON.parse(file.contents) as { items: Item[]; journal: JournalEntry[] }

    expect(read.items).toEqual([])
    expect(read.journal).toEqual([])
    expect(file.name).toBe('life-control-centre-2026-09-04.json')
  })

  it('writes the journal whole — title, body and journaled_at, not only the anchor', () => {
    // The item anchor alone (title/state/due) says nothing a person wrote —
    // it is the journal_entries row that carries the actual text. Both must
    // be in the file, or "Download everything" downloaded everything except
    // the one thing Journal is for.
    const file = exportFile(
      'a',
      [item('note', { kind: 'journal', title: 'A note to self' })],
      [
        journalEntry('note', {
          title: 'A good day',
          body: 'Wrote this down before I forgot it.',
          journaled_at: '2026-09-02T20:15:00+00:00',
        }),
      ],
      '2026-09-03T00:00:00+00:00',
      NOW,
    )
    const read = JSON.parse(file.contents) as {
      items: Item[]
      journal: JournalEntry[]
    }

    expect(read.items.map((i) => i.id)).toEqual(['note'])
    expect(read.journal).toEqual([
      {
        item_id: 'note',
        owner: 'a',
        title: 'A good day',
        body: 'Wrote this down before I forgot it.',
        journaled_at: '2026-09-02T20:15:00+00:00',
      },
    ])
  })

  it('keeps a journal entry whose anchor has been deleted, exactly like every other row', () => {
    const file = exportFile(
      'a',
      [
        item('gone', {
          kind: 'journal',
          deleted_at: '2026-09-03T00:00:00+00:00',
        }),
      ],
      [journalEntry('gone', { body: 'Should still be readable in the file.' })],
      null,
      NOW,
    )
    const read = JSON.parse(file.contents) as { journal: JournalEntry[] }
    expect(read.journal.map((e) => e.item_id)).toEqual(['gone'])
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
    expect(exportFile('a', [], [], null, late).name).toBe(
      'life-control-centre-2026-09-05.json',
    )
  })
})

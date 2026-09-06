import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import {
  anchorTitleFor,
  findRequestedEntry,
  journalFromRow,
  resolveJournalWrite,
  searchJournal,
  timelineOf,
} from './journal-entry'

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    item_id: 'j1',
    owner: 'a',
    title: null,
    body: 'Wrote this down before I forgot it.',
    journaled_at: '2026-09-04T20:00:00+00:00',
    ...over,
  }
}

describe('journalFromRow', () => {
  it('reads a whole entry, title and all', () => {
    const entry = journalFromRow(row({ title: 'A good day' }))
    expect(entry.title).toBe('A good day')
    expect(entry.body).toBe('Wrote this down before I forgot it.')
    expect(entry.journaled_at).toBe('2026-09-04T20:00:00+00:00')
  })

  it('reads an entry with no title at all', () => {
    const entry = journalFromRow(row({ title: null }))
    expect(entry.title).toBeNull()
  })

  it('refuses a title of nothing but spaces, matching journal_entries_title_not_blank', () => {
    // The database can never hold this: `title is null or title ~ '\S'`. A
    // cache that accepted it anyway would validate a row the database itself
    // cannot produce.
    expect(() => journalFromRow(row({ title: '   ' }))).toThrow(
      'title of nothing but spaces',
    )
  })

  it('refuses a blank body', () => {
    expect(() => journalFromRow(row({ body: '' }))).toThrow('Row without body')
    expect(() => journalFromRow(row({ body: '   ' }))).toThrow('no body')
  })

  it('refuses journaled_at that is not a moment in time', () => {
    expect(() => journalFromRow(row({ journaled_at: 'yesterday' }))).toThrow(
      'not a moment',
    )
  })

  it('refuses a row with no journaled_at', () => {
    expect(() => journalFromRow(row({ journaled_at: undefined }))).toThrow(
      'Row without journaled_at',
    )
  })
})

describe('anchorTitleFor', () => {
  it('keeps an explicit title, trimmed', () => {
    expect(anchorTitleFor('the body', '  A good day  ')).toBe('A good day')
  })

  it('falls back to the first line of the body when there is no title', () => {
    expect(anchorTitleFor('First line\nSecond line', null)).toBe('First line')
  })

  it('falls back to the body when there is only one line', () => {
    expect(anchorTitleFor('Just this', null)).toBe('Just this')
  })

  it('falls back when the title is only spaces', () => {
    expect(anchorTitleFor('The real content', '   ')).toBe('The real content')
  })

  it('trims leading blank lines before taking the first one', () => {
    expect(anchorTitleFor('\n\nActual first line\nmore', null)).toBe(
      'Actual first line',
    )
  })

  it('caps a long first line, so the anchor title stays a title', () => {
    const long = 'x'.repeat(120)
    const title = anchorTitleFor(long, null)
    expect(title.length).toBe(80)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('resolveJournalWrite', () => {
  const entry = journalFromRow(row({ title: 'Original title', body: 'Original body' }))

  // Regression: the write once went out as `{ ...entry, ...patch }`, which
  // carries `owner` along — a column the client has no grant to write at
  // all. This is the one thing every case below must keep proving false.
  it('never sends owner, whatever the patch', () => {
    const write = resolveJournalWrite(entry, { body: 'Changed' })
    expect(Object.keys(write).sort()).toEqual(['body', 'item_id', 'journaled_at', 'title'])
    expect('owner' in write).toBe(false)
  })

  it('with an empty patch, resolves to the entry unchanged', () => {
    expect(resolveJournalWrite(entry, {})).toEqual({
      item_id: entry.item_id,
      title: entry.title,
      body: entry.body,
      journaled_at: entry.journaled_at,
    })
  })

  it('a field left out of the patch keeps the entry’s own value', () => {
    const write = resolveJournalWrite(entry, { body: 'Only the body changed' })
    expect(write.title).toBe(entry.title)
    expect(write.journaled_at).toBe(entry.journaled_at)
    expect(write.body).toBe('Only the body changed')
  })

  it('an explicit null title clears it, rather than keeping the old one', () => {
    const write = resolveJournalWrite(entry, { title: null })
    expect(write.title).toBeNull()
  })
})

describe('timelineOf', () => {
  it('puts the newest journalled moment first, not the order given', () => {
    const a = journalFromRow(row({ item_id: 'a', journaled_at: '2026-09-01T10:00:00+00:00' }))
    const b = journalFromRow(row({ item_id: 'b', journaled_at: '2026-09-05T10:00:00+00:00' }))
    const c = journalFromRow(row({ item_id: 'c', journaled_at: '2026-09-03T10:00:00+00:00' }))
    expect(timelineOf([a, b, c]).map((e) => e.item_id)).toEqual(['b', 'c', 'a'])
  })

  it('a retrospective entry sorts by when it is about, not when it was made', () => {
    // Both would have the same created_at if JournalEntry carried one — it
    // does not, on purpose: journaled_at is the only date that decides this.
    const writtenToday = journalFromRow(
      row({ item_id: 'today', journaled_at: '2026-09-01T09:00:00+00:00' }),
    )
    const writtenLater = journalFromRow(
      row({ item_id: 'later', journaled_at: '2026-09-06T09:00:00+00:00' }),
    )
    expect(timelineOf([writtenToday, writtenLater]).map((e) => e.item_id)).toEqual([
      'later',
      'today',
    ])
  })
})

describe('searchJournal', () => {
  const entries = [
    journalFromRow(
      row({ item_id: 'a', title: 'Dentist', body: 'Booked for Tuesday.', journaled_at: '2026-09-01T09:00:00+00:00' }),
    ),
    journalFromRow(
      row({ item_id: 'b', title: null, body: 'A quiet Sunday, nothing much happened.', journaled_at: '2026-09-05T09:00:00+00:00' }),
    ),
  ]

  it('with no query, returns the whole timeline in order', () => {
    expect(searchJournal(entries, '').map((e) => e.item_id)).toEqual(['b', 'a'])
  })

  it('matches the title', () => {
    expect(searchJournal(entries, 'dentist').map((e) => e.item_id)).toEqual(['a'])
  })

  it('matches the body', () => {
    expect(searchJournal(entries, 'quiet').map((e) => e.item_id)).toEqual(['b'])
  })

  it('is case-insensitive', () => {
    expect(searchJournal(entries, 'SUNDAY').map((e) => e.item_id)).toEqual(['b'])
  })

  it('matches nothing when nothing matches', () => {
    expect(searchJournal(entries, 'holiday')).toEqual([])
  })
})

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: 'journal',
    state: 'active',
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

describe('findRequestedEntry', () => {
  const entry = journalFromRow(row({ item_id: 'j1' }))
  const anchor = item('j1')

  it('finds nothing when no id was requested', () => {
    expect(findRequestedEntry(null, [entry], [anchor])).toEqual({ found: false })
  })

  it('finds the entry and its anchor when both are in the snapshot', () => {
    expect(findRequestedEntry('j1', [entry], [anchor])).toEqual({
      found: true,
      entry,
      item: anchor,
    })
  })

  it('finds nothing for an id the journal does not hold', () => {
    expect(findRequestedEntry('missing', [entry], [anchor])).toEqual({ found: false })
  })

  it('finds nothing when the entry exists but its anchor does not', () => {
    // Should not happen given the FK, but the lookup must not assume it.
    expect(findRequestedEntry('j1', [entry], [])).toEqual({ found: false })
  })

  it('finds nothing when the anchor exists but the entry does not', () => {
    expect(findRequestedEntry('j1', [], [anchor])).toEqual({ found: false })
  })
})

// IndexedDB does not exist in Node, so a fake implementation of the same API
// is used. What gets exercised is the real adapter, not a test double.
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import type { JournalEntry } from './journal-entry'
import { journalStore } from './journal-store'

function entry(item_id: string, owner: string, over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    item_id,
    owner,
    title: null,
    body: `body of ${item_id}`,
    journaled_at: '2026-09-01T10:00:00+00:00',
    ...over,
  }
}

describe('journalStore', () => {
  it('keeps each account inside its own namespace', async () => {
    const [a, b] = ['ja-1', 'jb-1']
    await journalStore.replaceAll(a, [entry('a1', a)])
    await journalStore.replaceAll(b, [entry('b1', b)])

    expect((await journalStore.readAll(a)).map((e) => e.item_id)).toEqual(['a1'])
    expect((await journalStore.readAll(b)).map((e) => e.item_id)).toEqual(['b1'])
  })

  it('signing out of one account and into another shows none of the first', async () => {
    const [a, b] = ['ja-2', 'jb-2']
    await journalStore.replaceAll(a, [entry('a1', a), entry('a2', a)])

    // The switch: b's own read, right after a's session, sees nothing of a's.
    expect(await journalStore.readAll(b)).toEqual([])
  })

  it('a whole replace does not touch another account', async () => {
    const [a, b] = ['ja-3', 'jb-3']
    await journalStore.replaceAll(a, [entry('a1', a)])
    await journalStore.replaceAll(b, [entry('b1', b), entry('b2', b)])

    await journalStore.replaceAll(a, [])

    expect(await journalStore.readAll(a)).toEqual([])
    expect((await journalStore.readAll(b)).map((e) => e.item_id).sort()).toEqual([
      'b1',
      'b2',
    ])
  })

  it('replaces wholesale: an entry missing from the new list is gone', async () => {
    const a = 'ja-4'
    await journalStore.replaceAll(a, [entry('one', a), entry('two', a)])
    await journalStore.replaceAll(a, [entry('two', a, { body: 'edited' })])

    const rows = await journalStore.readAll(a)
    expect(rows.map((e) => e.item_id)).toEqual(['two'])
    expect(rows[0]?.body).toBe('edited')
  })

  it('refuses a row belonging to another account', async () => {
    const a = 'ja-5'
    await expect(
      journalStore.replaceAll(a, [entry('smuggled', 'someone-else')]),
    ).rejects.toThrow('not to ja-5')
  })

  it('an account with nothing cached has an empty journal, not an error', async () => {
    expect(await journalStore.readAll('ja-6-new')).toEqual([])
  })
})

import { describe, expect, it, vi } from 'vitest'

import { fromRow } from './item'
import type { Item } from './item'
import type { Store } from './store'
import { newest, PAGE, sync } from './sync'
import type { Source } from './sync'

const A = 'user-a'

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: A,
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

/** An in-memory store, with the same rules as the IndexedDB one. */
function memoryStore(initial: Item[] = [], cursor: string | null = null) {
  const rows = new Map(initial.map((i) => [i.id, i]))
  let current = cursor

  const store: Store<Item> = {
    readAll: () => Promise.resolve([...rows.values()]),
    cursor: () => Promise.resolve(current),
    replaceSnapshot: (_owner, items, nextCursor) => {
      rows.clear()
      for (const i of items) rows.set(i.id, i)
      current = nextCursor
      return Promise.resolve()
    },
    upsert: (_owner, items, nextCursor) => {
      for (const i of items) rows.set(i.id, i)
      if (nextCursor !== null) current = nextCursor
      return Promise.resolve()
    },
  }

  return {
    store,
    get items() {
      return [...rows.values()]
    },
    get cursor() {
      return current
    },
  }
}

/** A source that returns the given pages, in order. */
function sourceWith(...pages: Item[][]): Source & { calls: unknown[] } {
  const calls: unknown[] = []
  let i = 0
  return {
    calls,
    page: (options) => {
      calls.push(options)
      return Promise.resolve(pages[i++] ?? [])
    },
  }
}

describe('sync — the three distinct cases', () => {
  it('error: a failed fetch does not touch the cache', async () => {
    const cache = memoryStore([item('old')], '2026-09-01T10:00:00+00:00')
    const source: Source = { page: () => Promise.reject(new Error('the network')) }

    await expect(sync(A, source, cache.store, fromRow)).rejects.toThrow('the network')

    expect(cache.items.map((i) => i.id)).toEqual(['old'])
    expect(cache.cursor).toBe('2026-09-01T10:00:00+00:00')
  })

  it('valid empty snapshot: replaces the cache, even with nothing in it', async () => {
    // No cursor means a first visit. Empty can be legitimate: you deleted your
    // last item.
    const cache = memoryStore([item('left-over')], null)
    const result = await sync(A, sourceWith([]), cache.store, fromRow)

    expect(result).toEqual({ kind: 'full', fetched: 0, cursor: null })
    expect(cache.items).toEqual([])
    expect(cache.cursor).toBeNull()
  })

  it('empty delta: empties nothing and leaves the cursor where it was', async () => {
    const cache = memoryStore([item('one'), item('two')], '2026-09-01T10:00:00+00:00')
    const result = await sync(A, sourceWith([]), cache.store, fromRow)

    expect(result.kind).toBe('delta')
    expect(result.fetched).toBe(0)
    expect(cache.items.map((i) => i.id)).toEqual(['one', 'two'])
    expect(cache.cursor).toBe('2026-09-01T10:00:00+00:00')
  })
})

describe('sync', () => {
  it('a delta of two rows does not delete the rest of the cache', async () => {
    const cache = memoryStore(
      [item('one'), item('two'), item('three')],
      '2026-09-01T10:00:00+00:00',
    )
    const changed = item('two', {
      title: 'changed',
      version: 2,
      updated_at: '2026-09-02T09:00:00+00:00',
    })
    await sync(A, sourceWith([changed, item('four')]), cache.store, fromRow)

    expect(cache.items.map((i) => i.id).sort()).toEqual([
      'four',
      'one',
      'three',
      'two',
    ])
    expect(cache.items.find((i) => i.id === 'two')?.title).toBe('changed')
  })

  it('asks for the delta from the cached cursor, inclusive', async () => {
    const cache = memoryStore([item('one')], '2026-09-01T10:00:00+00:00')
    const source = sourceWith([])
    await sync(A, source, cache.store, fromRow)

    expect(source.calls).toEqual([
      { from: 0, to: PAGE - 1, sinceCursor: '2026-09-01T10:00:00+00:00' },
    ])
  })

  it('fetches every page, not just the first', async () => {
    const firstPage = Array.from({ length: PAGE }, (_, i) =>
      item(`i${String(i).padStart(4, '0')}`),
    )
    const cache = memoryStore()
    const source = sourceWith(firstPage, [item('last')])

    const result = await sync(A, source, cache.store, fromRow)

    expect(result.fetched).toBe(PAGE + 1)
    expect(source.calls).toEqual([
      { from: 0, to: PAGE - 1, sinceCursor: null },
      { from: PAGE, to: 2 * PAGE - 1, sinceCursor: null },
    ])
  })

  it('keeps deleted rows too — that is why we hold them', async () => {
    const cache = memoryStore()
    await sync(
      A,
      sourceWith([item('deleted', { deleted_at: '2026-09-02T08:00:00+00:00' })]),
      cache.store,
      fromRow,
    )

    expect(cache.items).toHaveLength(1)
    expect(cache.items[0]?.deleted_at).not.toBeNull()
  })

  it('the cursor is the newest updated_at that came from the server', async () => {
    const cache = memoryStore()
    const result = await sync(
      A,
      sourceWith([
        item('one', { updated_at: '2026-09-02T08:00:00+00:00' }),
        item('two', { updated_at: '2026-09-03T07:00:00+00:00' }),
        item('three', { updated_at: '2026-09-01T23:00:00+00:00' }),
      ]),
      cache.store,
      fromRow,
    )

    expect(result.cursor).toBe('2026-09-03T07:00:00+00:00')
    expect(cache.cursor).toBe('2026-09-03T07:00:00+00:00')
  })

  it('a cursor the cache cannot produce counts as a first visit', async () => {
    const cache = memoryStore([item('one')], '2026-09-01T10:00:00+00:00')
    const broken: Store<Item> = {
      ...cache.store,
      cursor: () => Promise.reject(new Error('unreadable cache')),
    }
    const source = sourceWith([item('fetched')])

    const result = await sync(A, source, broken, fromRow)

    expect(result.kind).toBe('full')
    expect(source.calls).toEqual([{ from: 0, to: PAGE - 1, sinceCursor: null }])
  })

  it('does not write to the cache before it has fetched everything', async () => {
    const cache = memoryStore([item('old')], null)
    const replace = vi.spyOn(cache.store, 'replaceSnapshot')
    const firstPage = Array.from({ length: PAGE }, (_, i) => item(`i${i}`))
    let calls = 0
    const source: Source = {
      page: () => {
        calls += 1
        if (calls === 1) return Promise.resolve(firstPage)
        return Promise.reject(new Error('it fell over on the second page'))
      },
    }

    await expect(sync(A, source, cache.store, fromRow)).rejects.toThrow('second page')
    expect(replace).not.toHaveBeenCalled()
    expect(cache.items.map((i) => i.id)).toEqual(['old'])
  })
})

describe('newest', () => {
  it('is null for an empty list', () => {
    expect(newest([])).toBeNull()
  })

  it('does not accept an invalid updated_at', () => {
    expect(() => newest([item('x', { updated_at: 'yesterday' })])).toThrow(
      'Invalid updated_at',
    )
  })
})

describe('a cache that cannot be read', () => {
  it('is rebuilt from scratch, even though the cursor is still good', async () => {
    // One row written by an older version: the cursor is fine, the rows are
    // not. Taking the delta path here would leave the bad row untouched for
    // ever.
    const cache = memoryStore([item('old')], '2026-09-01T10:00:00+00:00')
    cache.store.readAll = () => Promise.reject(new Error('Not an item'))

    const source = sourceWith([item('fresh')])
    const result = await sync(A, source, cache.store, fromRow)

    expect(result.kind).toBe('full')
    expect(cache.items.map((i) => i.id)).toEqual(['fresh'])
  })

  it('asks the server for everything, not for a delta', async () => {
    const cache = memoryStore([item('old')], '2026-09-01T10:00:00+00:00')
    cache.store.readAll = () => Promise.reject(new Error('Not an item'))

    const source = sourceWith([item('fresh')])
    await sync(A, source, cache.store, fromRow)

    expect(source.calls).toEqual([
      { from: 0, to: PAGE - 1, sinceCursor: null },
    ])
  })

  it('still takes the delta when the cache reads fine', async () => {
    const cache = memoryStore([item('kept')], '2026-09-01T10:00:00+00:00')
    const result = await sync(A, sourceWith([]), cache.store, fromRow)

    expect(result.kind).toBe('delta')
    expect(cache.items.map((i) => i.id)).toEqual(['kept'])
  })
})

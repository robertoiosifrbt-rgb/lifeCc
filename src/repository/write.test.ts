import { describe, expect, it } from 'vitest'

import type { Item, Patch } from './item'
import { applyPatch, Conflict, create, softDelete } from './write'
import type { Writer } from './write'

const TODAY = '2026-09-04'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    owner: 'a',
    kind: 'task',
    state: 'active',
    title: 'call X',
    due: null,
    done_at: null,
    version: 4,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    area_id: null,
    waiting_since: null,
    ...over,
  }
}

type Call = { id: string; version: number; patch: Patch }

/**
 * A writer that behaves like the conditional UPDATE: it writes only if the
 * requested version is the current one.
 */
function writerFor(initial: Item, options: { vanishes?: boolean } = {}) {
  let current = initial
  const calls: Call[] = []

  const writer: Writer<Patch> = {
    insert: (values) =>
      Promise.resolve(
        item({ id: 'new', state: 'inbox', kind: null, version: 1, ...values }),
      ),
    update: (id, version, patch) => {
      calls.push({ id, version, patch })
      if (version !== current.version) return Promise.resolve([])
      current = { ...current, ...patch, version: current.version + 1 }
      return Promise.resolve([current])
    },
    read: () => Promise.resolve(options.vanishes === true ? null : current),
  }

  return {
    writer,
    calls,
    get current() {
      return current
    },
    /** Someone changed the row in the meantime. */
    changeBehindOurBack(over: Partial<Item>) {
      current = { ...current, ...over, version: current.version + 1 }
    },
  }
}

describe('create', () => {
  it('writes the title only, and gets back an inbox item', async () => {
    const base = writerFor(item())
    const fresh = await create(base.writer, 'call X')

    expect(fresh.state).toBe('inbox')
    expect(fresh.kind).toBeNull()
    expect(fresh.title).toBe('call X')
  })

  it('does not tidy the title: the database is what refuses an empty one', async () => {
    const base = writerFor(item())
    const fresh = await create(base.writer, '  call X  ')
    expect(fresh.title).toBe('  call X  ')
  })
})

describe('applyPatch', () => {
  it('writes with the version the screen holds', async () => {
    const base = writerFor(item({ version: 4 }))
    await applyPatch(base.writer, item({ version: 4 }), { title: 'another title' }, TODAY)

    expect(base.calls).toEqual([
      { id: 'i1', version: 4, patch: { title: 'another title' } },
    ])
    expect(base.current.version).toBe(5)
  })

  it('sends only the changed fields', async () => {
    const base = writerFor(item())
    await applyPatch(base.writer, item(), { due: '2026-09-05' }, TODAY)

    expect(base.calls[0]?.patch).toEqual({ due: '2026-09-05' })
  })

  it('sets done_at from the local day when the item becomes done', async () => {
    const base = writerFor(item())
    const after = await applyPatch(base.writer, item(), { state: 'done' }, TODAY)

    expect(base.calls[0]?.patch).toEqual({ state: 'done', done_at: TODAY })
    expect(after.done_at).toBe(TODAY)
  })

  it('clears done_at when the item is reopened', async () => {
    const done = item({ state: 'done', done_at: '2026-09-02' })
    const base = writerFor(done)
    await applyPatch(base.writer, done, { state: 'active' }, TODAY)

    expect(base.calls[0]?.patch).toEqual({ state: 'active', done_at: null })
  })

  it('respects a done_at passed on purpose, so the day can be corrected', async () => {
    const done = item({ state: 'done', done_at: '2026-09-02' })
    const base = writerFor(done)
    await applyPatch(base.writer, done, { done_at: '2026-09-03' }, TODAY)

    expect(base.calls[0]?.patch).toEqual({ done_at: '2026-09-03' })
  })

  it('retries once, with the same patch, over the new version', async () => {
    const base = writerFor(item({ version: 4 }))
    // The laptop changed the title meanwhile: the screen's version is stale.
    base.changeBehindOurBack({ title: 'changed on the laptop' })

    const after = await applyPatch(
      base.writer,
      item({ version: 4 }),
      { due: '2026-09-05' },
      TODAY,
    )

    expect(base.calls).toEqual([
      { id: 'i1', version: 4, patch: { due: '2026-09-05' } },
      { id: 'i1', version: 5, patch: { due: '2026-09-05' } },
    ])
    // The patch landed, and the other device's change was not trampled.
    expect(after.due).toBe('2026-09-05')
    expect(after.title).toBe('changed on the laptop')
  })

  it('stops after the second attempt, with the patch on the error', async () => {
    const base = writerFor(item({ version: 4 }))
    // The screen's version is already stale...
    base.changeBehindOurBack({ title: 'changed once' })
    // ...and the row changes again right at the re-read: the second attempt
    // fails too.
    const writer: Writer<Patch> = {
      ...base.writer,
      read: async () => {
        const row = await base.writer.read('i1')
        base.changeBehindOurBack({ title: 'and once more' })
        return row
      },
    }

    const failure = await applyPatch(
      writer,
      item({ version: 4 }),
      { due: '2026-09-05' },
      TODAY,
    ).catch((reason: unknown) => reason)

    expect(failure).toBeInstanceOf(Conflict)
    expect((failure as Conflict).patch).toEqual({ due: '2026-09-05' })
    expect(base.calls).toHaveLength(2)
  })

  it('does not retry forever', async () => {
    const base = writerFor(item({ version: 4 }))
    const writer: Writer<Patch> = {
      ...base.writer,
      update: (id, version, patch) => {
        base.calls.push({ id, version, patch })
        return Promise.resolve([])
      },
    }

    await expect(
      applyPatch(writer, item({ version: 4 }), { title: 'x' }, TODAY),
    ).rejects.toBeInstanceOf(Conflict)
    expect(base.calls).toHaveLength(2)
  })

  it('says plainly when the row is gone', async () => {
    const base = writerFor(item({ version: 9 }), { vanishes: true })

    await expect(
      applyPatch(base.writer, item({ version: 4 }), { title: 'x' }, TODAY),
    ).rejects.toThrow('not there any more')
  })
})

describe('softDelete', () => {
  it('is an UPDATE on deleted_at, not a DELETE', async () => {
    const base = writerFor(item())
    const now = new Date('2026-09-04T18:30:00.000Z')
    await softDelete(base.writer, item(), now, TODAY)

    expect(base.calls[0]?.patch).toEqual({ deleted_at: '2026-09-04T18:30:00.000Z' })
  })
})

import { describe, expect, it, vi } from 'vitest'

import { SyncPending } from './not-cached'
import { runSessionRecovery, runStartSessionSafely } from './shifts'

const AT = new Date('2026-09-06T09:00:00Z')

// clockOn's real recovery path, against injected effects rather than a
// network — startSessionSafely calls this exact function with the real
// writes, so what is proven here is proven of clockOn's own behaviour.
describe('runSessionRecovery', () => {
  it('ensures the shift extension before starting the session', async () => {
    const order: string[] = []
    const ensureShift = vi.fn(() => {
      order.push('ensure')
      return Promise.resolve()
    })
    const startSession = vi.fn(() => {
      order.push('start')
      return Promise.resolve()
    })
    await runSessionRecovery('i1', AT, { ensureShift, startSession })
    expect(order).toEqual(['ensure', 'start'])
  })

  it('does not attempt the session if ensuring the extension fails', async () => {
    const ensureShift = vi.fn(() => Promise.reject(new Error('ensure failed')))
    const startSession = vi.fn(() => Promise.resolve(undefined))
    await expect(
      runSessionRecovery('i1', AT, { ensureShift, startSession }),
    ).rejects.toThrow('ensure failed')
    expect(startSession).not.toHaveBeenCalled()
  })

  it('passes the same item id and moment to both halves of the sequence', async () => {
    const ensureShift = vi.fn(() => Promise.resolve(undefined))
    const startSession = vi.fn(() => Promise.resolve(undefined))
    await runSessionRecovery('i9', AT, { ensureShift, startSession })
    expect(ensureShift).toHaveBeenCalledExactlyOnceWith('i9')
    expect(startSession).toHaveBeenCalledExactlyOnceWith('i9', AT)
  })

  it('propagates a session failure after a successful ensure', async () => {
    const ensureShift = vi.fn(() => Promise.resolve(undefined))
    const startSession = vi.fn(() => Promise.reject(new Error('network down')))
    await expect(
      runSessionRecovery('i1', AT, { ensureShift, startSession }),
    ).rejects.toThrow('network down')
  })
})

// startSessionSafely calls this exact function with the real writes: ensure,
// then start, then sync — once, at the end, never once per write. saveShift
// and startSession each already sync on their own, which is exactly the cost
// this sequence exists to avoid by never calling either of those directly.
describe('runStartSessionSafely', () => {
  it('ensures, starts, then syncs — in that order, and the sync happens once', async () => {
    const order: string[] = []
    const ensureShift = vi.fn(() => {
      order.push('ensure')
      return Promise.resolve()
    })
    const startSession = vi.fn(() => {
      order.push('start')
      return Promise.resolve()
    })
    const sync = vi.fn(() => {
      order.push('sync')
      return Promise.resolve([])
    })

    await runStartSessionSafely('i1', AT, { ensureShift, startSession, sync })

    expect(order).toEqual(['ensure', 'start', 'sync'])
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('returns exactly what sync resolves with', async () => {
    const shifts = [{ id: 'whatever' }]
    const result = await runStartSessionSafely('i1', AT, {
      ensureShift: () => Promise.resolve(),
      startSession: () => Promise.resolve(),
      sync: () => Promise.resolve(shifts as never),
    })
    expect(result).toBe(shifts)
  })

  it('never starts a session, and never syncs, if ensuring the row fails', async () => {
    const startSession = vi.fn(() => Promise.resolve())
    const sync = vi.fn(() => Promise.resolve([]))
    await expect(
      runStartSessionSafely('i1', AT, {
        ensureShift: () => Promise.reject(new Error('ensure failed')),
        startSession,
        sync,
      }),
    ).rejects.toThrow('ensure failed')
    expect(startSession).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it('never syncs — no false success — if starting the session fails after a successful ensure', async () => {
    const sync = vi.fn(() => Promise.resolve([]))
    await expect(
      runStartSessionSafely('i1', AT, {
        ensureShift: () => Promise.resolve(),
        startSession: () => Promise.reject(new Error('network down')),
        sync,
      }),
    ).rejects.toThrow('network down')
    expect(sync).not.toHaveBeenCalled()
  })

  // The committed-write/failed-refresh case: the session is already on the
  // server by the time sync can fail, so this must not surface as the same
  // kind of rejection a real write failure would — a caller (or a person
  // reading the message) must never be led to retry the write itself, which
  // is exactly how a second session would end up started on top of the one
  // that already began.
  it('rejects with SyncPending — not a plain failure — when the session commits but the final sync fails', async () => {
    const startSession = vi.fn(() => Promise.resolve())
    const rejection = await runStartSessionSafely('i1', AT, {
      ensureShift: () => Promise.resolve(),
      startSession,
      sync: () => Promise.reject(new Error('read-back failed')),
    }).catch((error: unknown) => error)

    expect(rejection).toBeInstanceOf(SyncPending)
    expect((rejection as SyncPending).item_id).toBe('i1')
    // The session write itself only ever happened once — SyncPending is not
    // a signal to attempt it again.
    expect(startSession).toHaveBeenCalledTimes(1)
  })
})

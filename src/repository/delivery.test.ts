import { describe, expect, it, vi } from 'vitest'

import { runStartDeliveryWork } from './delivery'
import { fromRow as itemFromRow } from './item'
import type { Item } from './item'
import { NotCached, SyncPending } from './not-cached'
import type { Shift } from './shift'

const DAY = '2026-09-06'
const AREA = 'area-1'
const NOW = new Date('2026-09-06T09:00:00Z')

function item(id: string): Item {
  return itemFromRow({
    id,
    owner: 'a',
    kind: 'shift',
    state: 'active',
    title: 'Shift',
    due: DAY,
    done_at: null,
    version: 1,
    created_at: '2026-09-06T07:00:00+00:00',
    updated_at: '2026-09-06T07:00:00+00:00',
    deleted_at: null,
    area_id: AREA,
    waiting_since: null,
  })
}

function effects(overrides: {
  createShift?: () => Promise<Item>
  startSessionSafely?: () => Promise<Shift[]>
}) {
  return {
    createShift: vi.fn(overrides.createShift ?? (() => Promise.resolve(item('fallback')))),
    startSessionSafely: vi.fn(overrides.startSessionSafely ?? (() => Promise.resolve([]))),
  }
}

// The exact sequence startDeliveryWork issues, against injected effects
// rather than a network — the same function production calls with the real
// writes, so what is proven here is proven of the real orchestration.
// `startSessionSafely` is the one combined effect clockOn itself calls too —
// this is the point: neither this sequence nor clockOn's own does its own
// ensure-then-start-then-sync, both share the exact same tested function, so
// there is only one place that could ever sync more than once per clock-on.
describe('runStartDeliveryWork', () => {
  it('creates the shift, then starts the session safely on it, and returns the item', async () => {
    const created = item('i1')
    const fx = effects({ createShift: () => Promise.resolve(created) })

    const result = await runStartDeliveryWork(DAY, AREA, NOW, fx)

    expect(fx.createShift).toHaveBeenCalledExactlyOnceWith(DAY, AREA)
    expect(fx.startSessionSafely).toHaveBeenCalledExactlyOnceWith('i1', NOW)
    expect(result).toEqual({ item: created, recovered: false })
  })

  it('creates the shift before starting the session, not the other way round', async () => {
    const order: string[] = []
    const fx = effects({
      createShift: () => {
        order.push('create')
        return Promise.resolve(item('i1'))
      },
      startSessionSafely: () => {
        order.push('start')
        return Promise.resolve([])
      },
    })
    await runStartDeliveryWork(DAY, AREA, NOW, fx)
    expect(order).toEqual(['create', 'start'])
  })

  it('recovers from NotCached during createShift: uses error.item, still starts the session', async () => {
    const created = item('i2')
    const fx = effects({
      createShift: () => Promise.reject(new NotCached(created, 'could not keep a copy')),
    })

    const result = await runStartDeliveryWork(DAY, AREA, NOW, fx)

    expect(result.item).toBe(created)
    expect(result.recovered).toBe(true)
    expect(fx.startSessionSafely).toHaveBeenCalledExactlyOnceWith('i2', NOW)
  })

  it('never resolves undefined: the recovered result always carries the real item', async () => {
    const created = item('i3')
    const fx = effects({ createShift: () => Promise.reject(new NotCached(created, 'gone')) })
    const result = await runStartDeliveryWork(DAY, AREA, NOW, fx)
    expect(result.item).not.toBeUndefined()
    expect(result.item.id).toBe('i3')
  })

  it('propagates a real createShift failure without attempting to start a session', async () => {
    const fx = effects({ createShift: () => Promise.reject(new Error('denied')) })
    await expect(runStartDeliveryWork(DAY, AREA, NOW, fx)).rejects.toThrow('denied')
    expect(fx.startSessionSafely).not.toHaveBeenCalled()
  })

  it('rejects visibly if starting the session fails after the shift exists — never a false success', async () => {
    const fx = effects({
      createShift: () => Promise.resolve(item('i4')),
      startSessionSafely: () => Promise.reject(new Error('network down')),
    })
    await expect(runStartDeliveryWork(DAY, AREA, NOW, fx)).rejects.toThrow('network down')
  })

  it('calls startSessionSafely exactly once — never a second sync-triggering write for one clock-on', async () => {
    const fx = effects({ createShift: () => Promise.resolve(item('i5')) })
    await runStartDeliveryWork(DAY, AREA, NOW, fx)
    expect(fx.startSessionSafely).toHaveBeenCalledTimes(1)
  })

  // The session already committed by the time startSessionSafely can throw
  // SyncPending — the write succeeded, only the refresh after it did not.
  // startDeliveryWork must resolve with the real item here, the same shape
  // NotCached from createShift already gets, not a rejection Home would show
  // as "delivery work failed to start" for a shift that is, in fact, running.
  it('resolves with the real item when starting the session commits but SyncPending follows', async () => {
    const created = item('i6')
    const fx = effects({
      createShift: () => Promise.resolve(created),
      startSessionSafely: () => Promise.reject(new SyncPending('i6', 'read-back failed')),
    })

    const result = await runStartDeliveryWork(DAY, AREA, NOW, fx)

    expect(result).toEqual({ item: created, recovered: true })
  })
})

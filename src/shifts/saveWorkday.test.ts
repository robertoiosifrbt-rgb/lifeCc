import { describe, expect, it, vi } from 'vitest'

import type { Entity } from '../repository/entity'
import type { Item } from '../repository/item'
import type { Link } from '../repository/link'
import type { Shift } from '../repository/shift'
import { draftFrom } from './draft'
import { isDirty } from './draftPatches'
import type { WorkdayWriters } from './saveWorkday'
import { saveWorkday } from './saveWorkday'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    owner: 'me',
    kind: 'shift',
    state: 'active',
    title: 'Shift',
    due: '2026-09-05',
    done_at: null,
    area_id: 'area-1',
    waiting_since: null,
    version: 1,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

function shift(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: null,
    odo_end: null,
    tips: null,
    personal_km: null,
    bonuses: null,
    parking: null,
    tolls: null,
    other_cost: null,
    rate_fuel_per_km: null,
    rate_vehicle_per_km: null,
    sessions: [],
    earnings: [],
    ...over,
  }
}

function vehicle(itemId: string): Entity {
  return {
    item_id: itemId,
    owner: 'me',
    entity_kind: 'vehicle',
    registration: null,
    make: null,
    model: null,
    fuel: null,
    odo: null,
    mot_due: null,
    road_tax_due: null,
    insurance_due: null,
    service_due: null,
    oil_changed_at: null,
    oil_due_at: null,
  }
}

function about(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-09-01T00:00:00Z' }
}

function writers(order: string[]): WorkdayWriters {
  return {
    onUpdateItem: vi.fn(() => {
      order.push('item')
      return Promise.resolve()
    }),
    onSaveShiftParts: vi.fn(() => {
      order.push('shift')
      return Promise.resolve()
    }),
    onSetPaid: vi.fn(() => {
      order.push('earning')
      return Promise.resolve()
    }),
    onRemoveEarning: vi.fn(() => {
      order.push('remove-earning')
      return Promise.resolve()
    }),
    onSetBreak: vi.fn(() => {
      order.push('break')
      return Promise.resolve()
    }),
    onDropSession: vi.fn(() => {
      order.push('drop-session')
      return Promise.resolve()
    }),
    onLink: vi.fn(() => {
      order.push('link')
      return Promise.resolve()
    }),
    onUnlink: vi.fn(() => {
      order.push('unlink')
      return Promise.resolve()
    }),
  }
}

describe('saveWorkday — write order', () => {
  it('writes the item before the shift, so a changed Area lands before the pin trigger reads it', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), area_id: 'area-2', tips: '5' }
    await saveWorkday(anchor, day, draft, [], [], writers(order))
    expect(order.indexOf('item')).toBeLessThan(order.indexOf('shift'))
  })

  it('writes nothing when the draft has not changed', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const w = writers(order)
    await saveWorkday(anchor, day, draftFrom(anchor, day, [], []), [], [], w)
    expect(order).toEqual([])
    expect(w.onSaveShiftParts).not.toHaveBeenCalled()
  })

  it('does not touch the shift row when only the item changed, unless forced', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), title: 'Renamed' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, [], [], w)
    expect(order).toEqual(['item'])
    expect(w.onSaveShiftParts).not.toHaveBeenCalled()
  })

  it('forces an empty upsert on the shift row when asked, even with nothing operational typed', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const w = writers(order)
    await saveWorkday(anchor, day, draftFrom(anchor, day, [], []), [], [], w, { forceShiftTouch: true })
    expect(w.onSaveShiftParts).toHaveBeenCalledExactlyOnceWith({})
  })

  it('does not force a second write when the shift already changed this round', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), tips: '5' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, [], [], w, { forceShiftTouch: true })
    expect(w.onSaveShiftParts).toHaveBeenCalledTimes(1)
    expect(w.onSaveShiftParts).toHaveBeenCalledWith({ tips: 5 })
  })

  it('removes a cleared earning rather than writing a fake zero over it', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 10 }] })
    const base = draftFrom(anchor, day, [], [])
    const draft = { ...base, earnings: { ...base.earnings, uber_eats: '' } }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, [], [], w)
    expect(w.onRemoveEarning).toHaveBeenCalledExactlyOnceWith('uber_eats')
    expect(w.onSetPaid).not.toHaveBeenCalled()
  })

  it('drops a closed session marked for removal, and never writes a break for it', async () => {
    const order: string[] = []
    const anchor = item()
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(anchor, day, [], []), removedSessions: ['s1'] }
    const w = writers(order)
    const settled = await saveWorkday(anchor, day, draft, [], [], w)
    expect(w.onDropSession).toHaveBeenCalledExactlyOnceWith('s1')
    expect(w.onSetBreak).not.toHaveBeenCalled()
    expect(settled.shift.sessions).toEqual([])
  })

  it('never physically deletes an open session, even from malformed Draft data', async () => {
    const order: string[] = []
    const anchor = item()
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(anchor, day, [], []), removedSessions: ['s1'] }
    const w = writers(order)
    const settled = await saveWorkday(anchor, day, draft, [], [], w)
    expect(w.onDropSession).not.toHaveBeenCalled()
    expect(settled.shift.sessions).toEqual([session])
  })

  it('settles a result whose fields already reflect what was just written', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), tips: '5', title: 'Renamed' }
    const settled = await saveWorkday(anchor, day, draft, [], [], writers(order))
    expect(settled.item.title).toBe('Renamed')
    expect(settled.shift.tips).toBe(5)
  })

  it('Save draft, then reopen: rebuilding the draft from the settled result shows the saved values, clean', async () => {
    // Exactly what ShiftSheet's onSaveDraft does with the result: draftFrom
    // over what was just written. If that composition were wrong, a reopened
    // sheet would show either stale values or a draft still marked dirty.
    const anchor = item()
    const day = shift({ odo_start: 10 })
    const draft = {
      ...draftFrom(anchor, day, [], []),
      odo_start: '10',
      odo_end: '160',
      tips: '12.50',
      title: 'Tuesday shift',
      due: '2026-09-08',
    }
    const settled = await saveWorkday(anchor, day, draft, [], [], writers([]))
    const reopened = draftFrom(settled.item, settled.shift, [], [])
    expect(reopened.odo_end).toBe('160')
    expect(reopened.tips).toBe('12.50')
    expect(reopened.title).toBe('Tuesday shift')
    expect(reopened.due).toBe('2026-09-08')
    expect(isDirty(settled.item, settled.shift, reopened, [], [])).toBe(false)
  })
})

describe('saveWorkday — the Vehicle link, deferred like every other field', () => {
  it('links the newly chosen Vehicle, before the shift row itself, when the draft names one', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), vehicle_item_id: 'v1' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, [], [], w)
    expect(w.onLink).toHaveBeenCalledExactlyOnceWith('v1', 'about')
    expect(w.onUnlink).not.toHaveBeenCalled()
    expect(order.indexOf('link')).toBeLessThan(order.length)
  })

  it('replaces an existing Vehicle link with the newly chosen one', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const links = [about('l1', 'i1', 'v1')]
    const entities = [vehicle('v1'), vehicle('v2')]
    const draft = { ...draftFrom(anchor, day, links, entities), vehicle_item_id: 'v2' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, links, entities, w)
    expect(w.onUnlink).toHaveBeenCalledExactlyOnceWith('l1')
    expect(w.onLink).toHaveBeenCalledExactlyOnceWith('v2', 'about')
  })

  it('clears an existing Vehicle link when the draft is cleared back to none', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const links = [about('l1', 'i1', 'v1')]
    const entities = [vehicle('v1')]
    const draft = { ...draftFrom(anchor, day, links, entities), vehicle_item_id: '' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, links, entities, w)
    expect(w.onUnlink).toHaveBeenCalledExactlyOnceWith('l1')
    expect(w.onLink).not.toHaveBeenCalled()
  })

  it('writes nothing about the Vehicle when the draft still matches what is linked', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const links = [about('l1', 'i1', 'v1')]
    const entities = [vehicle('v1')]
    const draft = draftFrom(anchor, day, links, entities)
    const w = writers(order)
    await saveWorkday(anchor, day, draft, links, entities, w)
    expect(w.onLink).not.toHaveBeenCalled()
    expect(w.onUnlink).not.toHaveBeenCalled()
  })

  it('never resolves an ambiguous, untouched Vehicle state as a side effect of an unrelated Save draft', async () => {
    const order: string[] = []
    const anchor = item()
    const day = shift()
    const links = [about('l1', 'i1', 'v1'), about('l2', 'i1', 'v2')]
    const entities = [vehicle('v1'), vehicle('v2')]
    // The draft never touched the Vehicle field — it seeds blank because the
    // persisted state is ambiguous — but did change the title.
    const draft = { ...draftFrom(anchor, day, links, entities), title: 'Renamed' }
    const w = writers(order)
    await saveWorkday(anchor, day, draft, links, entities, w)
    expect(w.onLink).not.toHaveBeenCalled()
    expect(w.onUnlink).not.toHaveBeenCalled()
  })
})

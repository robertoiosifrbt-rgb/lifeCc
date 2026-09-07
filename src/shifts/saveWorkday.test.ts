import { describe, expect, it, vi } from 'vitest'

import type { Entity } from '../repository/entity'
import type { Expense } from '../repository/expense'
import type { Item } from '../repository/item'
import type { Link } from '../repository/link'
import type { SaveWorkdayPayload } from '../repository/save-workday'
import type { Shift } from '../repository/shift'
import { draftFrom } from './draft'
import { isDirty } from './draftPatches'
import type { WorkdayWriters } from './saveWorkday'
import { saveWorkday } from './saveWorkday'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', owner: 'me', kind: 'shift', state: 'active', title: 'Shift', due: '2026-09-05',
    done_at: null, area_id: 'area-1', waiting_since: null, version: 1,
    created_at: '2026-09-05T00:00:00Z', updated_at: '2026-09-05T00:00:00Z', deleted_at: null,
    ...over,
  }
}

function shift(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1', owner: 'me', odo_start: null, odo_end: null, tips: null, personal_km: null,
    bonuses: null, parking: null, tolls: null, other_cost: null,
    rate_fuel_per_km: null, rate_vehicle_per_km: null, sessions: [], earnings: [],
    ...over,
  }
}

function vehicle(itemId: string): Entity {
  return {
    item_id: itemId, owner: 'me', entity_kind: 'vehicle', registration: null, make: null,
    model: null, fuel: null, odo: null, mot_due: null, road_tax_due: null,
    insurance_due: null, service_due: null, oil_changed_at: null, oil_due_at: null,
  }
}

function uses(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'uses', created_at: '2026-09-01T00:00:00Z' }
}

function about(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-09-01T00:00:00Z' }
}

function expense(item_id: string, category: Expense['category'], amount: number): Expense {
  return {
    item_id, owner: 'me', amount, category,
    odo: null, full_tank: null, litres: null,
    covers_from: null, covers_to: null, business_pct: 100,
  }
}

function writers(): WorkdayWriters {
  return {
    onCommit: vi.fn(() => Promise.resolve()),
  }
}

/** The one payload `onCommit` was called with, or a test failure if it was
 *  called zero or more than once — every case here expects exactly one. */
function committed(w: WorkdayWriters): SaveWorkdayPayload {
  const calls = (w.onCommit as ReturnType<typeof vi.fn>).mock.calls
  expect(calls).toHaveLength(1)
  return calls[0]?.[0] as SaveWorkdayPayload
}

describe('saveWorkday — the item patch, inside the same commit as everything else', () => {
  it('carries a changed Area in the same commit payload as the rest, so nothing lands as two torn writes', async () => {
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), area_id: 'area-2', tips: '5' }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w)
    const payload = committed(w)
    expect(payload.item_patch).toEqual({ area_id: 'area-2' })
    expect(payload.shift_patch).toEqual({ tips: 5 })
  })

  it('sends the item as last seen, so a concurrent edit elsewhere is refused rather than overwritten', async () => {
    const anchor = item({ version: 7 })
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), title: 'Renamed' }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w)
    expect(committed(w).expected_version).toBe(7)
  })

  it('writes nothing when the draft has not changed', async () => {
    const anchor = item()
    const day = shift()
    const w = writers()
    await saveWorkday(anchor, day, draftFrom(anchor, day, [], []), [], [], [], w)
    expect(w.onCommit).not.toHaveBeenCalled()
  })

  it('commits an item-only change even with nothing operational typed, and touches nothing on the shift', async () => {
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), title: 'Renamed' }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w)
    const payload = committed(w)
    expect(payload.item_patch).toEqual({ title: 'Renamed' })
    expect(payload.shift_patch).toEqual({})
    expect(payload.force_shift_touch).toBe(false)
  })

  it('forces an empty upsert on the shift row when asked, even with nothing operational typed', async () => {
    const anchor = item()
    const day = shift()
    const w = writers()
    await saveWorkday(anchor, day, draftFrom(anchor, day, [], []), [], [], [], w, { forceShiftTouch: true })
    const payload = committed(w)
    expect(payload.force_shift_touch).toBe(true)
    expect(payload.shift_patch).toEqual({})
    expect(payload.item_patch).toEqual({})
  })

  it('does not force a second write when the shift already changed this round', async () => {
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), tips: '5' }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w, { forceShiftTouch: true })
    const payload = committed(w)
    expect(payload.shift_patch).toEqual({ tips: 5 })
  })

  it('removes a cleared earning rather than writing a fake zero over it', async () => {
    const anchor = item()
    const day = shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 10 }] })
    const base = draftFrom(anchor, day, [], [])
    const draft = { ...base, earnings: { ...base.earnings, uber_eats: '' } }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w)
    const payload = committed(w)
    expect(payload.earnings_remove).toEqual(['uber_eats'])
    expect(payload.earnings_set).toEqual([])
  })

  it('drops a closed session marked for removal, and never writes a break for it', async () => {
    const anchor = item()
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(anchor, day, [], []), removedSessions: ['s1'] }
    const w = writers()
    const settled = await saveWorkday(anchor, day, draft, [], [], [], w)
    const payload = committed(w)
    expect(payload.sessions_remove).toEqual(['s1'])
    expect(payload.breaks_set).toEqual([])
    expect(settled.shift.sessions).toEqual([])
  })

  it('never physically deletes an open session, even from malformed Draft data', async () => {
    const anchor = item()
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(anchor, day, [], []), removedSessions: ['s1'] }
    const w = writers()
    const settled = await saveWorkday(anchor, day, draft, [], [], [], w)
    expect(w.onCommit).not.toHaveBeenCalled()
    expect(settled.shift.sessions).toEqual([session])
  })

  it('settles a result whose fields already reflect what was just written', async () => {
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), tips: '5', title: 'Renamed' }
    const settled = await saveWorkday(anchor, day, draft, [], [], [], writers())
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
    const settled = await saveWorkday(anchor, day, draft, [], [], [], writers())
    const reopened = draftFrom(settled.item, settled.shift, [], [])
    expect(reopened.odo_end).toBe('160')
    expect(reopened.tips).toBe('12.50')
    expect(reopened.title).toBe('Tuesday shift')
    expect(reopened.due).toBe('2026-09-08')
    expect(isDirty(settled.item, settled.shift, reopened, [], [], [])).toBe(false)
  })

  it('carries an already-linked road-cost Expense along when only the Workday date moves, so its own day never drifts', async () => {
    const anchor = item()
    const day = shift({ parking: 20 })
    const links = [about('l1', 'e1', 'i1')]
    const expenses = [expense('e1', 'parking', 20)]
    const draft = { ...draftFrom(anchor, day, links, []), due: '2026-09-08' }
    const w = writers()
    await saveWorkday(anchor, day, draft, links, [], expenses, w)
    const payload = committed(w)
    expect(payload.item_patch).toEqual({ due: '2026-09-08' })
    expect(payload.road_cost_set).toEqual([
      { category: 'parking', title: 'Parking', day: '2026-09-08', amount: 20, existing_expense_item_id: 'e1' },
    ])
  })
})

describe('saveWorkday — the Vehicle link, part of the same commit as everything else', () => {
  it('links the newly chosen Vehicle, in the same commit as the rest', async () => {
    const anchor = item()
    const day = shift()
    const draft = { ...draftFrom(anchor, day, [], []), vehicle_item_id: 'v1' }
    const w = writers()
    await saveWorkday(anchor, day, draft, [], [], [], w)
    const payload = committed(w)
    expect(payload.vehicle_link_to).toBe('v1')
    expect(payload.vehicle_unlink_ids).toEqual([])
  })

  it('replaces an existing Vehicle link with the newly chosen one', async () => {
    const anchor = item()
    const day = shift()
    const links = [uses('l1', 'i1', 'v1')]
    const entities = [vehicle('v1'), vehicle('v2')]
    const draft = { ...draftFrom(anchor, day, links, entities), vehicle_item_id: 'v2' }
    const w = writers()
    await saveWorkday(anchor, day, draft, links, entities, [], w)
    const payload = committed(w)
    expect(payload.vehicle_unlink_ids).toEqual(['l1'])
    expect(payload.vehicle_link_to).toBe('v2')
  })

  it('returns the Vehicle link as it will be after the save, not the stale links it was given', async () => {
    // The caller's own `links` prop will not show this change until the next
    // full resync — a draft reseeded from it right after a successful save
    // would flash back to the old Vehicle. `saveWorkday` hands back what the
    // link now is, the same way it already does for the item and the shift.
    const anchor = item()
    const day = shift()
    const links = [uses('l1', 'i1', 'v1')]
    const entities = [vehicle('v1'), vehicle('v2')]
    const draft = { ...draftFrom(anchor, day, links, entities), vehicle_item_id: 'v2' }
    const w = writers()
    const settled = await saveWorkday(anchor, day, draft, links, entities, [], w)
    expect(settled.links.some((l) => l.id === 'l1')).toBe(false)
    expect(settled.links.some((l) => l.to_id === 'v2' && l.kind === 'uses' && l.from_id === 'i1')).toBe(true)
  })

  it('clears an existing Vehicle link when the draft is cleared back to none', async () => {
    const anchor = item()
    const day = shift()
    const links = [uses('l1', 'i1', 'v1')]
    const entities = [vehicle('v1')]
    const draft = { ...draftFrom(anchor, day, links, entities), vehicle_item_id: '' }
    const w = writers()
    await saveWorkday(anchor, day, draft, links, entities, [], w)
    const payload = committed(w)
    expect(payload.vehicle_unlink_ids).toEqual(['l1'])
    expect(payload.vehicle_link_to).toBeNull()
  })

  it('writes nothing about the Vehicle when the draft still matches what is linked', async () => {
    const anchor = item()
    const day = shift()
    const links = [uses('l1', 'i1', 'v1')]
    const entities = [vehicle('v1')]
    const draft = draftFrom(anchor, day, links, entities)
    const w = writers()
    await saveWorkday(anchor, day, draft, links, entities, [], w)
    expect(w.onCommit).not.toHaveBeenCalled()
  })

  it('never resolves an ambiguous, untouched Vehicle state as a side effect of an unrelated Save draft', async () => {
    const anchor = item()
    const day = shift()
    const links = [uses('l1', 'i1', 'v1'), uses('l2', 'i1', 'v2')]
    const entities = [vehicle('v1'), vehicle('v2')]
    // The draft never touched the Vehicle field — it seeds blank because the
    // persisted state is ambiguous — but did change the title.
    const draft = { ...draftFrom(anchor, day, links, entities), title: 'Renamed' }
    const w = writers()
    await saveWorkday(anchor, day, draft, links, entities, [], w)
    const payload = committed(w)
    expect(payload.vehicle_unlink_ids).toEqual([])
    expect(payload.vehicle_link_to).toBeNull()
  })
})

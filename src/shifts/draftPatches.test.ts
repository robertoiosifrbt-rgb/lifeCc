import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import type { Expense } from '../repository/expense'
import type { Link } from '../repository/link'
import { draftFrom, previewShiftOf } from './draft'
import {
  breaksPatchOf,
  earningsPatchOf,
  earningsToRemoveOf,
  isDirty,
  itemPatchOf,
  roadCostPatchOf,
  roadCostsToRemoveOf,
  sessionsToRemoveOf,
  shiftPatchOf,
} from './draftPatches'

const NO_COSTS = { fuel_per_km: null, vehicle_per_km: null }

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

describe('isDirty / patches — Save draft only writes what changed', () => {
  it('is not dirty right after the draft is built from what is saved', () => {
    const day = shift({ tips: 5 })
    expect(isDirty(item(), day, draftFrom(item(), day, [], []), [], [], [])).toBe(false)
  })

  it('is dirty the moment a field is typed differently', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day, [], []), tips: '5' }
    expect(isDirty(item(), day, draft, [], [], [])).toBe(true)
    expect(shiftPatchOf(day, draft)).toEqual({ tips: 5 })
  })

  it('is dirty the moment a session is marked for removal', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day, [], []), removedSessions: ['s1'] }
    expect(isDirty(item(), day, draft, [], [], [])).toBe(true)
  })

  it('only patches the item when title, date or Area actually changed', () => {
    const anchor = item()
    expect(itemPatchOf(anchor, draftFrom(anchor, shift(), [], []))).toEqual({})
    const draft = { ...draftFrom(anchor, shift(), [], []), title: 'Tuesday shift', due: '2026-09-08' }
    expect(itemPatchOf(anchor, draft)).toEqual({ title: 'Tuesday shift', due: '2026-09-08' })
  })

  it('changing the date patches the same anchor rather than making a new one', () => {
    const anchor = item()
    const draft = { ...draftFrom(anchor, shift(), [], []), due: '2026-09-09' }
    const patch = itemPatchOf(anchor, draft)
    // The patch carries only the changed field; there is no id in it because
    // it is applied to the existing anchor's id, never used to create a new row.
    expect(patch).toEqual({ due: '2026-09-09' })
    expect('id' in patch).toBe(false)
  })

  it('only writes the platforms and sessions that actually changed', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session], earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 10 }] })
    const draft = draftFrom(item(), day, [], [])
    expect(earningsPatchOf(day, draft)).toEqual([])
    expect(breaksPatchOf(day, draft)).toEqual([])

    const changed = { ...draft, earnings: { ...draft.earnings, uber_eats: '11' }, breaks: { s1: '15' } }
    expect(earningsPatchOf(day, changed)).toEqual([{ platform: 'uber_eats', amount: 11 }])
    expect(breaksPatchOf(day, changed)).toEqual([{ sessionId: 's1', minutes: 15 }])
  })

  it('never writes a break for a closed session marked for removal', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day, [], []), breaks: { s1: '15' }, removedSessions: ['s1'] }
    expect(breaksPatchOf(day, draft)).toEqual([])
  })

  it('still writes a break for an open session even if malformed draft data marks it for removal', () => {
    // An open session can never legitimately end up in removedSessions —
    // the sheet never offers a × for one — but a write must not trust that.
    // sessionsToRemoveOf rejects it, so it is not actually being removed,
    // and its break edit must not be silently dropped along with it.
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day, [], []), breaks: { s1: '15' }, removedSessions: ['s1'] }
    expect(breaksPatchOf(day, draft)).toEqual([{ sessionId: 's1', minutes: 15 }])
  })

  describe('sessionsToRemoveOf — an open session can never be Draft-removed', () => {
    it('includes a closed session marked for removal', () => {
      const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
      const day = shift({ sessions: [session] })
      const draft = { ...draftFrom(item(), day, [], []), removedSessions: ['s1'] }
      expect(sessionsToRemoveOf(day, draft)).toEqual(['s1'])
    })

    it('rejects an open session even when malformed draft data names it', () => {
      const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
      const day = shift({ sessions: [session] })
      const draft = { ...draftFrom(item(), day, [], []), removedSessions: ['s1'] }
      expect(sessionsToRemoveOf(day, draft)).toEqual([])
    })

    it('ignores an id that does not name any real session on this shift', () => {
      const day = shift()
      const draft = { ...draftFrom(item(), day, [], []), removedSessions: ['nonexistent'] }
      expect(sessionsToRemoveOf(day, draft)).toEqual([])
    })
  })

  describe('earningsToRemoveOf — clearing a saved earning persists the removal', () => {
    it('is empty when nothing saved was cleared', () => {
      const day = shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 10 }] })
      expect(earningsToRemoveOf(day, draftFrom(item(), day, [], []))).toEqual([])
    })

    it('is empty for a platform that was never set, blank or not', () => {
      const day = shift()
      expect(earningsToRemoveOf(day, draftFrom(item(), day, [], []))).toEqual([])
    })

    it('names a platform whose saved amount was typed back to blank', () => {
      const day = shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 10 }] })
      const draft = { ...draftFrom(item(), day, [], []), earnings: { ...draftFrom(item(), day, [], []).earnings, uber_eats: '' } }
      expect(earningsToRemoveOf(day, draft)).toEqual(['uber_eats'])
      // The live preview already treats it as unknown, not as a fake £0.
      expect(previewShiftOf(day, draft, NO_COSTS).earnings).toEqual([])
    })
  })

  describe('roadCostPatchOf / roadCostsToRemoveOf', () => {
    function expenseFor(item_id: string, category: Expense['category'], amount: number): Expense {
      return {
        item_id, owner: 'me', amount, category,
        odo: null, full_tank: null, litres: null,
        covers_from: null, covers_to: null, business_pct: 100,
      }
    }
    function about(id: string, from_id: string, to_id: string): Link {
      return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-09-01T00:00:00Z' }
    }

    it('nothing to write when the draft still matches the effective value', () => {
      const day = shift({ parking: 5 })
      const draft = draftFrom(item(), day, [], [])
      expect(roadCostPatchOf(day, draft, [], [])).toEqual([])
      expect(roadCostsToRemoveOf(day, draft, [], [])).toEqual([])
    })

    it('a freshly typed field, never linked before, patches with no existing Expense', () => {
      const day = shift()
      const draft = { ...draftFrom(item(), day, [], []), parking: '5' }
      expect(roadCostPatchOf(day, draft, [], [])).toEqual([
        { field: 'parking', amount: 5, existingExpenseItemId: null },
      ])
    })

    it('editing a field already backed by an Expense patches against that Expense', () => {
      const day = shift({ parking: 20 })
      const links = [about('l1', 'e1', 'i1')]
      const expenses = [expenseFor('e1', 'parking', 20)]
      const draft = { ...draftFrom(item(), day, [], []), parking: '25' }
      expect(roadCostPatchOf(day, draft, expenses, links)).toEqual([
        { field: 'parking', amount: 25, existingExpenseItemId: 'e1' },
      ])
    })

    it('clearing a field backed by an Expense marks that Expense for removal', () => {
      const day = shift({ parking: 20 })
      const links = [about('l1', 'e1', 'i1')]
      const expenses = [expenseFor('e1', 'parking', 20)]
      const draft = { ...draftFrom(item(), day, [], []), parking: '' }
      expect(roadCostsToRemoveOf(day, draft, expenses, links)).toEqual([
        { field: 'parking', expenseItemId: 'e1' },
      ])
      expect(roadCostPatchOf(day, draft, expenses, links)).toEqual([])
    })

    it('clearing a field that was only ever a legacy column has nothing to remove', () => {
      const day = shift({ parking: 20 })
      const draft = { ...draftFrom(item(), day, [], []), parking: '' }
      expect(roadCostsToRemoveOf(day, draft, [], [])).toEqual([])
    })
  })
})

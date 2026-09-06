import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import {
  breaksPatchOf,
  draftFrom,
  earningsPatchOf,
  isDirty,
  itemPatchOf,
  previewShiftOf,
  shiftPatchOf,
  validateDraft,
} from './draft'

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

describe('draftFrom', () => {
  it('starts exactly at what is already saved', () => {
    const day = shift({ odo_start: 100, odo_end: 150, tips: 12.5 })
    const draft = draftFrom(item(), day)
    expect(draft.odo_start).toBe('100')
    expect(draft.odo_end).toBe('150')
    expect(draft.tips).toBe('12.50')
    expect(draft.title).toBe('Shift')
    expect(draft.due).toBe('2026-09-05')
    expect(draft.area_id).toBe('area-1')
  })

  it('reads an unset platform as a blank box, not zero', () => {
    const draft = draftFrom(item(), shift({ earnings: [{ platform: 'uber_eats', amount: 64.2 }] }))
    expect(draft.earnings.uber_eats).toBe('64.20')
    expect(draft.earnings.deliveroo).toBe('')
  })
})

describe('previewShiftOf — live preview reacts to what is typed, not what is saved', () => {
  it('changes Made immediately from a typed platform amount, tip or bonus', () => {
    const day = shift()
    const draft = draftFrom(item(), day)
    const typed = { ...draft, earnings: { ...draft.earnings, uber_eats: '64.20' }, tips: '5', bonuses: '2' }
    const preview = previewShiftOf(day, typed)
    expect(preview.earnings).toEqual([{ platform: 'uber_eats', amount: 64.2 }])
    expect(preview.tips).toBe(5)
    expect(preview.bonuses).toBe(2)
  })

  it('changes Driven immediately from odo start/end/personal km, before anything is saved', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), odo_start: '100', odo_end: '150', personal_km: '10' }
    const preview = previewShiftOf(day, draft)
    expect(preview.odo_start).toBe(100)
    expect(preview.odo_end).toBe(150)
    expect(preview.personal_km).toBe(10)
  })

  it('changes road costs immediately from parking, tolls and the rest', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), parking: '3', tolls: '2.5', other_cost: '1' }
    const preview = previewShiftOf(day, draft)
    expect(preview.parking).toBe(3)
    expect(preview.tolls).toBe(2.5)
    expect(preview.other_cost).toBe(1)
  })

  it('falls back to unknown, never to a stale number, on a bad keystroke', () => {
    const day = shift({ tips: 5 })
    const draft = { ...draftFrom(item(), day), tips: 'not a number' }
    expect(previewShiftOf(day, draft).tips).toBeNull()
  })

  it('carries a typed break onto its own session for the live hours', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day), breaks: { s1: '30' } }
    expect(previewShiftOf(day, draft).sessions[0]?.break_minutes).toBe(30)
  })
})

describe('isDirty / patches — Save draft only writes what changed', () => {
  it('is not dirty right after the draft is built from what is saved', () => {
    const day = shift({ tips: 5 })
    expect(isDirty(item(), day, draftFrom(item(), day))).toBe(false)
  })

  it('is dirty the moment a field is typed differently', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), tips: '5' }
    expect(isDirty(item(), day, draft)).toBe(true)
    expect(shiftPatchOf(day, draft)).toEqual({ tips: 5 })
  })

  it('only patches the item when title, date or Area actually changed', () => {
    const anchor = item()
    expect(itemPatchOf(anchor, draftFrom(anchor, shift()))).toEqual({})
    const draft = { ...draftFrom(anchor, shift()), title: 'Tuesday shift', due: '2026-09-08' }
    expect(itemPatchOf(anchor, draft)).toEqual({ title: 'Tuesday shift', due: '2026-09-08' })
  })

  it('changing the date patches the same anchor rather than making a new one', () => {
    const anchor = item()
    const draft = { ...draftFrom(anchor, shift()), due: '2026-09-09' }
    const patch = itemPatchOf(anchor, draft)
    // The patch carries only the changed field; there is no id in it because
    // it is applied to the existing anchor's id, never used to create a new row.
    expect(patch).toEqual({ due: '2026-09-09' })
    expect('id' in patch).toBe(false)
  })

  it('only writes the platforms and sessions that actually changed', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session], earnings: [{ platform: 'uber_eats', amount: 10 }] })
    const draft = draftFrom(item(), day)
    expect(earningsPatchOf(day, draft)).toEqual([])
    expect(breaksPatchOf(day, draft)).toEqual([])

    const changed = { ...draft, earnings: { ...draft.earnings, uber_eats: '11' }, breaks: { s1: '15' } }
    expect(earningsPatchOf(day, changed)).toEqual([{ platform: 'uber_eats', amount: 11 }])
    expect(breaksPatchOf(day, changed)).toEqual([{ sessionId: 's1', minutes: 15 }])
  })
})

describe('validateDraft', () => {
  it('refuses an end reading below the start', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), odo_start: '150', odo_end: '100' }
    expect(validateDraft(day, draft).map((e) => e.field)).toContain('odo_end')
  })

  it('refuses personal kilometres beyond the day', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), odo_start: '100', odo_end: '150', personal_km: '60' }
    expect(validateDraft(day, draft).map((e) => e.field)).toContain('personal_km')
  })

  it('refuses a break longer than the session that holds it', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day), breaks: { s1: '90' } }
    expect(validateDraft(day, draft).map((e) => e.field)).toContain('break:s1')
  })

  it('does not flag an open session missing a break as too long', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = draftFrom(item(), day)
    expect(validateDraft(day, draft)).toEqual([])
  })

  it('refuses a blank title', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day), title: '   ' }
    expect(validateDraft(day, draft).map((e) => e.field)).toContain('title')
  })

  it('is clean for an untouched draft', () => {
    const day = shift({ odo_start: 100, odo_end: 150 })
    expect(validateDraft(day, draftFrom(item(), day))).toEqual([])
  })
})

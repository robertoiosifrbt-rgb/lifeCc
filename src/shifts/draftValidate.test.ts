import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import { draftFrom } from './draft'
import { validateDraft } from './draftValidate'

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

  it('does not validate a break belonging to a session marked for removal', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T10:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day), breaks: { s1: '9999' }, removedSessions: ['s1'] }
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

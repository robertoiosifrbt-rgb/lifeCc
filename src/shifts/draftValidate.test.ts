import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import { draftFrom } from './draft'
import { validateCompletion, validateDraft } from './draftValidate'

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

describe('validateCompletion — what Complete Workday needs beyond a valid draft', () => {
  const closedSession = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }

  function completeInput(over: Partial<Parameters<typeof validateCompletion>[0]> = {}) {
    const day = shift({ odo_start: 100, odo_end: 150, sessions: [closedSession] })
    return {
      draft: draftFrom(item(), day),
      shift: day,
      fuelPerKm: 0.1,
      vehiclePerKm: 0.05,
      ...over,
    }
  }

  it('an incomplete Draft still saves — validateDraft alone is clean', () => {
    const day = shift()
    expect(validateDraft(day, draftFrom(item(), day))).toEqual([])
  })

  it('a workday with everything Complete needs can Complete', () => {
    expect(validateCompletion(completeInput())).toEqual([])
  })

  it('blocks Complete with no date', () => {
    const input = completeInput()
    const fields = validateCompletion({ ...input, draft: { ...input.draft, due: '' } }).map((e) => e.field)
    expect(fields).toContain('due')
  })

  it('blocks Complete with no sessions at all', () => {
    const day = shift({ odo_start: 100, odo_end: 150 })
    const fields = validateCompletion({
      draft: draftFrom(item(), day),
      shift: day,
      fuelPerKm: 0.1,
      vehiclePerKm: 0.05,
    }).map((e) => e.field)
    expect(fields).toContain('sessions')
  })

  it('blocks Complete with only an open session — no finished session yet', () => {
    const openSession = { id: 's2', started_at: '2026-09-05T17:00:00Z', ended_at: null, break_minutes: 0 }
    const day = shift({ odo_start: 100, odo_end: 150, sessions: [openSession] })
    const fields = validateCompletion({
      draft: draftFrom(item(), day),
      shift: day,
      fuelPerKm: 0.1,
      vehiclePerKm: 0.05,
    }).map((e) => e.field)
    expect(fields).toContain('sessions')
  })

  it('blocks Complete with no start odometer reading', () => {
    const input = completeInput()
    const fields = validateCompletion({ ...input, draft: { ...input.draft, odo_start: '' } }).map((e) => e.field)
    expect(fields).toContain('odo_start')
  })

  it('blocks Complete with no end odometer reading', () => {
    const input = completeInput()
    const fields = validateCompletion({ ...input, draft: { ...input.draft, odo_end: '' } }).map((e) => e.field)
    expect(fields).toContain('odo_end')
  })

  it('blocks Complete when the automatic fuel rate is not known', () => {
    const fields = validateCompletion(completeInput({ fuelPerKm: null })).map((e) => e.field)
    expect(fields).toContain('fuel')
  })

  it('blocks Complete when the vehicle cost is not configured', () => {
    const fields = validateCompletion(completeInput({ vehiclePerKm: null })).map((e) => e.field)
    expect(fields).toContain('vehicle')
  })

  it('does not block Complete for missing HMRC/year figures — those are not asked here at all', () => {
    // validateCompletion takes no tax-year input whatsoever: a year with no
    // figures set shows up as `sum.missing` on the summary, never here.
    expect(validateCompletion(completeInput())).toEqual([])
  })
})

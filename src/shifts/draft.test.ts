import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import { draftFrom, previewShiftOf } from './draft'

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

describe('draftFrom', () => {
  it('starts exactly at what is already saved', () => {
    const day = shift({ odo_start: 100, odo_end: 150, tips: 12.5 })
    const draft = draftFrom(item(), day, [], [])
    expect(draft.odo_start).toBe('100')
    expect(draft.odo_end).toBe('150')
    expect(draft.tips).toBe('12.50')
    expect(draft.title).toBe('Shift')
    expect(draft.due).toBe('2026-09-05')
    expect(draft.area_id).toBe('area-1')
    expect(draft.removedSessions).toEqual([])
  })

  it('reads an unset platform as a blank box, not zero', () => {
    const draft = draftFrom(
      item(),
      shift({ earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 64.2 }] }),
      [],
      [],
    )
    expect(draft.earnings.uber_eats).toBe('64.20')
    expect(draft.earnings.deliveroo).toBe('')
  })

  it('seeds the Vehicle from whatever is unambiguously linked right now', () => {
    const links = [
      { id: 'l1', owner: 'me', from_id: 'i1', to_id: 'v1', kind: 'uses' as const, created_at: '2026-09-01T00:00:00Z' },
    ]
    const entities = [{
      item_id: 'v1', owner: 'me', entity_kind: 'vehicle' as const,
      registration: null, make: null, model: null, fuel: null, odo: null,
      mot_due: null, road_tax_due: null, insurance_due: null, service_due: null,
      oil_changed_at: null, oil_due_at: null,
    }]
    const draft = draftFrom(item(), shift(), links, entities)
    expect(draft.vehicle_item_id).toBe('v1')
  })

  it('seeds blank when no Vehicle, or an ambiguous one, is linked', () => {
    expect(draftFrom(item(), shift(), [], []).vehicle_item_id).toBe('')
  })
})

describe('previewShiftOf — live preview reacts to what is typed, not what is saved', () => {
  it('changes Made immediately from a typed platform amount, tip or bonus', () => {
    const day = shift()
    const draft = draftFrom(item(), day, [], [])
    const typed = { ...draft, earnings: { ...draft.earnings, uber_eats: '64.20' }, tips: '5', bonuses: '2' }
    const preview = previewShiftOf(day, typed, NO_COSTS)
    expect(preview.earnings).toEqual([
      { id: '', platform: 'uber_eats', platform_item_id: null, amount: 64.2 },
    ])
    expect(preview.tips).toBe(5)
    expect(preview.bonuses).toBe(2)
  })

  it('changes Driven immediately from odo start/end/personal km, before anything is saved', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day, [], []), odo_start: '100', odo_end: '150', personal_km: '10' }
    const preview = previewShiftOf(day, draft, NO_COSTS)
    expect(preview.odo_start).toBe(100)
    expect(preview.odo_end).toBe(150)
    expect(preview.personal_km).toBe(10)
  })

  it('changes road costs immediately from parking, tolls and the rest', () => {
    const day = shift()
    const draft = { ...draftFrom(item(), day, [], []), parking: '3', tolls: '2.5', other_cost: '1' }
    const preview = previewShiftOf(day, draft, NO_COSTS)
    expect(preview.parking).toBe(3)
    expect(preview.tolls).toBe(2.5)
    expect(preview.other_cost).toBe(1)
  })

  it('falls back to unknown, never to a stale number, on a bad keystroke', () => {
    const day = shift({ tips: 5 })
    const draft = { ...draftFrom(item(), day, [], []), tips: 'not a number' }
    expect(previewShiftOf(day, draft, NO_COSTS).tips).toBeNull()
  })

  it('carries a typed break onto its own session for the live hours', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day, [], []), breaks: { s1: '30' } }
    expect(previewShiftOf(day, draft, NO_COSTS).sessions[0]?.break_minutes).toBe(30)
  })

  it('drops a session marked for removal from the live hours before it is saved', () => {
    const session = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
    const day = shift({ sessions: [session] })
    const draft = { ...draftFrom(item(), day, [], []), removedSessions: ['s1'] }
    expect(previewShiftOf(day, draft, NO_COSTS).sessions).toEqual([])
  })

  it('uses the cost basis handed to it, never the shift’s own stale pinned rate', () => {
    // The shift is pinned under a rate that no longer matches what the Draft
    // is showing (e.g. the Draft's Area was changed, or the fuel data moved
    // on) — the caller decides the effective basis; this never reaches past
    // it into `shift.rate_fuel_per_km` on its own.
    const day = shift({ rate_fuel_per_km: 0.5, rate_vehicle_per_km: 0.5 })
    const draft = draftFrom(item(), day, [], [])
    const preview = previewShiftOf(day, draft, { fuel_per_km: 0.12, vehicle_per_km: 0.08 })
    expect(preview.rate_fuel_per_km).toBe(0.12)
    expect(preview.rate_vehicle_per_km).toBe(0.08)
  })
})

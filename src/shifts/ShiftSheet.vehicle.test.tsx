// Vehicle-related ShiftSheet tests — split out of ShiftSheet.test.tsx at the
// 300-line limit. Delete-workday and base fixtures stay there.

// @vitest-environment jsdom
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '../repository/item'
import type { Shift } from '../repository/shift'
import { mount } from './domTestHelpers'
import { ShiftSheet } from './ShiftSheet'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    owner: 'me',
    kind: 'shift',
    state: 'active',
    title: 'Shift',
    due: '2026-09-05',
    done_at: null,
    area_id: null,
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

function baseProps(overrides: Partial<Parameters<typeof ShiftSheet>[0]> = {}) {
  return {
    item: item(),
    shift: shift(),
    areas: [],
    items: [item()],
    shifts: [shift()],
    expenses: [],
    vehicleCostRates: [],
    taxYears: [],
    links: [],
    things: [],
    today: '2026-09-05',
    onClockOn: () => Promise.resolve(),
    onClockOff: () => Promise.resolve(),
    onDropSession: () => Promise.resolve(),
    onSaveShiftParts: () => Promise.resolve(),
    onSetPaid: () => Promise.resolve(),
    onRemoveEarning: () => Promise.resolve(),
    onSetBreak: () => Promise.resolve(),
    onUpdateItem: () => Promise.resolve(),
    onDelete: () => Promise.resolve(),
    onSaveVehicleCost: () => Promise.resolve(),
    onLink: () => Promise.resolve(),
    onUnlink: () => Promise.resolve(),
    onSetRoadCost: () => Promise.resolve(),
    onRemoveRoadCost: () => Promise.resolve(),
    onClose: () => {},
    ...overrides,
  }
}

let mounted: ReturnType<typeof mount> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

// ShiftSummary's "missing rates" hint links to /hmrc, which needs a router
// context to render at all — a real one, since MemoryRouter is what the app
// itself would have mounted this sheet inside of.
function renderSheet(props: ReturnType<typeof baseProps>) {
  return mount(
    <MemoryRouter>
      <ShiftSheet {...props} />
    </MemoryRouter>,
  )
}

const vehicleEntity = {
  item_id: 'v1',
  owner: 'me',
  entity_kind: 'vehicle' as const,
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

function about(id: string, from_id: string, to_id: string) {
  return { id, owner: 'me', from_id, to_id, kind: 'about' as const, created_at: '2026-09-01T00:00:00Z' }
}

function uses(id: string, from_id: string, to_id: string) {
  return { id, owner: 'me', from_id, to_id, kind: 'uses' as const, created_at: '2026-09-01T00:00:00Z' }
}

function fuelExpense(item_id: string, odo: number, pounds: number) {
  return {
    item_id,
    owner: 'me',
    amount: pounds,
    category: 'fuel' as const,
    odo,
    full_tank: true,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
  }
}

/** A workday whose every Complete Workday requirement is already met, with
 *  a real full-tank fuel chain and a configured vehicle cost — so the only
 *  thing that can still disable Complete is `busy`. */
function completeWorkdayProps(overrides: Partial<Parameters<typeof ShiftSheet>[0]> = {}) {
  const closedSession = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
  const anchor = item({ area_id: 'area-1' })
  const day = shift({
    odo_start: 100,
    odo_end: 150,
    sessions: [closedSession],
    earnings: [{ id: 'e1', platform: 'uber_eats', platform_item_id: null, amount: 50 }],
  })
  return baseProps({
    item: anchor,
    shift: day,
    items: [anchor, item({ id: 'f1', kind: 'expense' }), item({ id: 'f2', kind: 'expense' })],
    shifts: [day],
    expenses: [fuelExpense('f1', 1000, 0), fuelExpense('f2', 1100, 10)],
    things: [vehicleEntity],
    links: [uses('l1', 'i1', 'v1'), about('l2', 'f1', 'v1'), about('l3', 'f2', 'v1')],
    vehicleCostRates: [
      {
        vehicle_item_id: 'v1',
        owner: 'me',
        effective_from: '2026-01-01',
        vehicle_per_km: 0.05,
        version: 1,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
      },
    ],
    ...overrides,
  })
}

describe('ShiftSheet — the Vehicle used gates Complete Workday', () => {
  it('Complete is disabled with no Vehicle linked, even though everything else qualifies', () => {
    mounted = renderSheet(completeWorkdayProps({ links: [] }))
    const complete = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(complete?.disabled).toBe(true)
    expect(mounted.container.textContent).toContain('unambiguous Vehicle')
  })

  it('Complete is enabled once a Vehicle is linked and every other requirement is met', () => {
    mounted = renderSheet(completeWorkdayProps())
    const complete = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(complete?.disabled).toBe(false)
  })
})

describe('ShiftSheet — the Vehicle used is deferred to Save draft, like every other field', () => {
  it('Save draft links the Vehicle chosen in the header', async () => {
    const onLink = vi.fn(() => Promise.resolve())
    const onUnlink = vi.fn(() => Promise.resolve())
    mounted = renderSheet(
      baseProps({ onLink, onUnlink, things: [vehicleEntity], items: [item(), item({ id: 'v1' })] }),
    )
    act(() => {
      const select = mounted?.container.querySelector<HTMLSelectElement>('select[name="vehicle"]')
      if (select !== null && select !== undefined) {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- rebound explicitly via .call below
        const setValue = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value',
        )?.set
        setValue?.call(select, 'v1')
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    expect(onLink).not.toHaveBeenCalled()
    await act(async () => {
      mounted?.container.querySelector<HTMLButtonElement>('button[name="save-draft"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onLink).toHaveBeenCalledExactlyOnceWith('v1', 'uses')
  })

  it('Discard writes nothing — picking a Vehicle and discarding never links it', () => {
    const onLink = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    mounted = renderSheet(
      baseProps({ onLink, onClose, things: [vehicleEntity], items: [item(), item({ id: 'v1' })] }),
    )
    act(() => {
      const select = mounted?.container.querySelector<HTMLSelectElement>('select[name="vehicle"]')
      if (select !== null && select !== undefined) {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- rebound explicitly via .call below
        const setValue = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value',
        )?.set
        setValue?.call(select, 'v1')
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    // Closing while dirty (a Vehicle was picked but never saved) asks for
    // confirmation first, the same path any other unsaved field already
    // goes through — Escape is the sheet's own close trigger.
    act(() => {
      mounted?.container
        .querySelector('[role="dialog"], [aria-modal="true"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(mounted?.container.textContent).toContain('unsaved changes')
    act(() => {
      const discard = [...(mounted?.container.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        .find((button) => button.textContent === 'Discard changes')
      discard?.click()
    })
    expect(onLink).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ShiftSheet — a pending vehicle-cost configuration save blocks Complete Workday', () => {
  it('Complete is disabled while the save is pending, and re-enabled once it resolves', async () => {
    let resolveSave: (() => void) | null = null
    const onSaveVehicleCost = vi.fn(
      () => new Promise<void>((resolve) => { resolveSave = resolve }),
    )
    mounted = renderSheet(completeWorkdayProps({ onSaveVehicleCost }))

    const completeBefore = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(completeBefore?.disabled).toBe(false)

    act(() => {
      mounted?.container.querySelector<HTMLButtonElement>('button[name="configure-vehicle-cost"]')?.click()
    })
    act(() => {
      const input = mounted?.container.querySelector<HTMLInputElement>('input[name="vehicle_per_km"]')
      if (input !== null && input !== undefined) {
        // A plain `input.value = ...` does not make React's onChange fire —
        // it tracks the native value setter itself, so the value has to go
        // through that same setter for the dispatched event to be seen as a
        // real change.
        // eslint-disable-next-line @typescript-eslint/unbound-method -- rebound explicitly via .call below
        const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setValue?.call(input, '0.06')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    act(() => {
      mounted?.container.querySelector<HTMLButtonElement>('button[name="save-vehicle-cost"]')?.click()
    })

    const completeWhilePending = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(completeWhilePending?.disabled).toBe(true)

    await act(async () => {
      resolveSave?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    const completeAfter = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(completeAfter?.disabled).toBe(false)
    expect(onSaveVehicleCost).toHaveBeenCalledWith('v1', '2026-09-05', 0.06)
  })
})

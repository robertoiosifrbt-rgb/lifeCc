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
    costs: [],
    taxYears: [],
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

async function clickDelete() {
  const button = mounted?.container.querySelector<HTMLButtonElement>('button[name="delete-workday"]')
  await act(async () => {
    button?.click()
    // Let the click handler's own promise chain settle.
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('ShiftSheet — Delete workday', () => {
  it('closes the sheet after a successful delete', async () => {
    const onClose = vi.fn()
    const onDelete = vi.fn(() => Promise.resolve())
    mounted = renderSheet(baseProps({ onDelete, onClose }))
    await clickDelete()
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close the sheet, and shows the error, when delete fails', async () => {
    const onClose = vi.fn()
    const onDelete = vi.fn(() => Promise.reject(new Error('network down')))
    mounted = renderSheet(baseProps({ onDelete, onClose }))
    await clickDelete()
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(mounted.container.textContent).toContain('network down')
  })

  it('Delete is blocked, and never called, while a session is open', async () => {
    const onClose = vi.fn()
    const onDelete = vi.fn(() => Promise.resolve())
    const open = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    mounted = renderSheet(baseProps({ onDelete, onClose, shift: shift({ sessions: [open] }) }))
    const button = mounted.container.querySelector<HTMLButtonElement>('button[name="delete-workday"]')
    expect(button?.disabled).toBe(true)
    await clickDelete()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

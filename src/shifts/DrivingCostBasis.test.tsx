// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { FuelRate, RunningCosts } from '../repository/items'
import { DrivingCostBasis } from './DrivingCostBasis'
import { mount } from './domTestHelpers'

const KNOWN: FuelRate = { perKm: 0.1234, legs: 2, km: 200, litresPer100Km: null, mpg: null, reason: 'ok' }
const UNKNOWN: FuelRate = { perKm: null, legs: 0, km: 0, litresPer100Km: null, mpg: null, reason: 'no-fills' }

const configuredVehicle: RunningCosts = {
  area_id: 'area-1',
  owner: 'me',
  fuel_per_km: 0.1234,
  vehicle_per_km: 0.05,
  version: 1,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  deleted_at: null,
}

let mounted: ReturnType<typeof mount> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('DrivingCostBasis — Fuel £/km is never a daily editable input', () => {
  function anyFuelInput(container: HTMLElement): Element | null {
    return container.querySelector(
      'input[name*="fuel" i], input[aria-label*="fuel" i], input[id*="fuel" i]',
    )
  }

  it('no fuel input exists when the rate is known', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        busy={false}
        readOnly={false}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    expect(anyFuelInput(mounted.container)).toBeNull()
    expect(mounted.container.textContent).toContain('Automatic · £0.1234/km')
  })

  it('no fuel input exists when the rate is unknown — text says so, never £0', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={UNKNOWN}
        costs={null}
        busy={false}
        readOnly={false}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    expect(anyFuelInput(mounted.container)).toBeNull()
    expect(mounted.container.textContent).toContain('Not enough full-tank data yet')
    expect(mounted.container.textContent).not.toContain('£0.00')
  })

  it('no fuel input exists even after opening "Configure vehicle cost" — only the vehicle rate is editable', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        busy={false}
        readOnly={false}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    act(() => {
      mounted?.container.querySelector<HTMLButtonElement>('button')?.click()
    })
    expect(anyFuelInput(mounted.container)).toBeNull()
    expect(mounted.container.querySelector('input[name="vehicle_per_km"]')).not.toBeNull()
  })

  it('Completed (readOnly): no inputs and no Configure button at all', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        busy={false}
        readOnly={true}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    expect(mounted.container.querySelector('input')).toBeNull()
    expect(mounted.container.querySelector('button')).toBeNull()
  })
})

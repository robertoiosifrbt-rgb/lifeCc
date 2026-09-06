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
        pinned={null}
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
        pinned={null}
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
        pinned={null}
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
        pinned={{ fuel_per_km: 0.1234, vehicle_per_km: 0.05 }}
        busy={false}
        readOnly={true}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    expect(mounted.container.querySelector('input')).toBeNull()
    expect(mounted.container.querySelector('button')).toBeNull()
  })
})

describe('DrivingCostBasis — Completed shows only its pinned basis', () => {
  it('shows the pinned rates, not the live ones, even when they differ', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={{ perKm: 9.9999, legs: 5, km: 500, litresPer100Km: null, mpg: null, reason: 'ok' }}
        costs={{ ...configuredVehicle, vehicle_per_km: 9.9999 }}
        pinned={{ fuel_per_km: 0.1234, vehicle_per_km: 0.05 }}
        busy={false}
        readOnly={true}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('Pinned · £0.1234/km')
    expect(text).toContain('Pinned · £0.0500/km')
    expect(text).not.toContain('9.9999')
  })

  it('says "Not recorded" for a pinned value that is null, never today\'s rate', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        pinned={{ fuel_per_km: null, vehicle_per_km: null }}
        busy={false}
        readOnly={true}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('Not recorded')
    expect(text).not.toContain('0.1234')
    expect(text).not.toContain('0.0500')
  })
})

describe('DrivingCostBasis — Configure vehicle cost always opens from the latest props', () => {
  it('the same Area receiving a newer rate shows the new one once opened, not a value captured earlier', () => {
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        pinned={null}
        busy={false}
        readOnly={false}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    mounted.rerender(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={{ ...configuredVehicle, vehicle_per_km: 0.099 }}
        pinned={null}
        busy={false}
        readOnly={false}
        onConfigureVehicle={() => Promise.resolve()}
      />,
    )
    act(() => {
      mounted?.container.querySelector<HTMLButtonElement>('button')?.click()
    })
    const input = mounted.container.querySelector<HTMLInputElement>('input[name="vehicle_per_km"]')
    expect(input?.value).toBe('0.099')
  })
})

describe('DrivingCostBasis — a pending configuration save blocks nothing it shouldn\'t and reverts nothing it shouldn\'t', () => {
  it('a rejected save keeps the editor open with the old rate still shown, and the error visible', async () => {
    const onConfigureVehicle = () => Promise.reject(new Error('offline'))
    mounted = mount(
      <DrivingCostBasis
        fuelRate={KNOWN}
        costs={configuredVehicle}
        pinned={null}
        busy={false}
        readOnly={false}
        onConfigureVehicle={onConfigureVehicle}
      />,
    )
    act(() => {
      mounted?.container.querySelector<HTMLButtonElement>('button')?.click()
    })
    const input = mounted.container.querySelector<HTMLInputElement>('input[name="vehicle_per_km"]')
    expect(input).not.toBeNull()
    await act(async () => {
      const save = mounted?.container.querySelector<HTMLButtonElement>('button')
      save?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    const stillOpen = mounted.container.querySelector<HTMLInputElement>('input[name="vehicle_per_km"]')
    expect(stillOpen).not.toBeNull()
    expect(stillOpen?.value).toBe(String(configuredVehicle.vehicle_per_km))
    expect(mounted.container.textContent).toContain('offline')
  })
})

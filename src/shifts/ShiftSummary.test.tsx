// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import type { TakeHome } from '../repository/items'
import { mount } from './domTestHelpers'
import { ShiftSummary } from './ShiftSummary'

function sum(over: Partial<TakeHome> = {}): TakeHome {
  return {
    grossPence: 0,
    costsPence: 0,
    directPence: 0,
    profitPence: 0,
    taxPence: 0,
    niPence: 0,
    netPence: 0,
    missing: [],
    ...over,
  }
}

const baseProps = {
  sum: sum(),
  worked: 0,
  km: null,
  dateKnown: true,
  fuelUnknown: false,
  vehicleCostUnknown: false,
}

let mounted: ReturnType<typeof mount> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

function renderSummary(props: typeof baseProps) {
  return mount(
    <MemoryRouter>
      <ShiftSummary {...props} />
    </MemoryRouter>,
  )
}

describe('ShiftSummary — Tax/NI missing reasons never conflate a blank date with unset year figures', () => {
  it('a blank date shows its own message, not the HMRC one', () => {
    mounted = renderSummary({ ...baseProps, sum: sum({ missing: ['rates'] }), dateKnown: false })
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('Add a workday date to calculate Tax and NI.')
    expect(text).not.toContain('HMRC')
  })

  it('a known date with rates missing shows the HMRC message, not the date one', () => {
    mounted = renderSummary({ ...baseProps, sum: sum({ missing: ['rates'] }), dateKnown: true })
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('figures are not set')
    expect(text).not.toContain('Add a workday date')
  })
})

describe('ShiftSummary — fuel unknown is never confused with vehicle cost unset', () => {
  it('fuel unknown, vehicle cost known: only the fuel message, never "vehicle cost"', () => {
    mounted = renderSummary({
      ...baseProps,
      sum: sum({ missing: ['costs'] }),
      fuelUnknown: true,
      vehicleCostUnknown: false,
    })
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('The automatic fuel rate is not known yet.')
    expect(text).not.toContain('vehicle cost is not configured')
  })

  it('vehicle cost unset, fuel known: only the vehicle cost message, never "full tanks"', () => {
    mounted = renderSummary({
      ...baseProps,
      sum: sum({ missing: ['costs'] }),
      fuelUnknown: false,
      vehicleCostUnknown: true,
    })
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('The vehicle cost is not configured yet.')
    expect(text).not.toContain('full tanks')
  })

  it('both unknown: one combined message covering both', () => {
    mounted = renderSummary({
      ...baseProps,
      sum: sum({ missing: ['costs'] }),
      fuelUnknown: true,
      vehicleCostUnknown: true,
    })
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('No cost per kilometre yet')
  })

  it('neither missing: no cost-basis hint at all, even if `costs` were mistakenly still flagged', () => {
    mounted = renderSummary({
      ...baseProps,
      sum: sum({ missing: [] }),
      fuelUnknown: false,
      vehicleCostUnknown: false,
    })
    const text = mounted.container.textContent ?? ''
    expect(text).not.toContain('cost per kilometre')
    expect(text).not.toContain('fuel rate')
  })
})

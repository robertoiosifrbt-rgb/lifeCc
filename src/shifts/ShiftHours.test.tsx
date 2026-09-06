// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Shift } from '../repository/shift'
import { mount } from './domTestHelpers'
import { ShiftHours } from './ShiftHours'

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

const baseProps = {
  busy: false,
  breaks: {},
  removedSessions: [],
  onChangeBreak: () => {},
  onRemoveSession: () => {},
  onClockOn: () => Promise.resolve(),
  onClockOff: () => Promise.resolve(),
  onRun: (body: () => Promise<void>) => void body(),
}

let mounted: ReturnType<typeof mount> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('ShiftHours — rendered', () => {
  it('an open session shows Stop, and no × on that session', () => {
    const open = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    mounted = mount(<ShiftHours {...baseProps} shift={shift({ sessions: [open] })} readOnly={false} />)
    const html = mounted.container.innerHTML
    expect(mounted.container.querySelector('button[name="clock-off"]')).not.toBeNull()
    expect(mounted.container.querySelector('button[name="clock-on"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="drop-session"]')).toBeNull()
    expect(html).toContain('Stop')
  })

  it('a closed session shows × but no Stop; Start shows instead', () => {
    const closed = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
    mounted = mount(<ShiftHours {...baseProps} shift={shift({ sessions: [closed] })} readOnly={false} />)
    expect(mounted.container.querySelector('button[name="drop-session"]')).not.toBeNull()
    expect(mounted.container.querySelector('button[name="clock-on"]')).not.toBeNull()
    expect(mounted.container.querySelector('button[name="clock-off"]')).toBeNull()
  })

  it('two open sessions: the fail-safe message shows, and neither Start, Stop nor × appear', () => {
    const first = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    const second = { id: 's2', started_at: '2026-09-05T18:00:00Z', ended_at: null, break_minutes: 0 }
    mounted = mount(<ShiftHours {...baseProps} shift={shift({ sessions: [first, second] })} readOnly={false} />)
    expect(mounted.container.textContent).toContain(
      'Multiple active sessions were found. This workday needs data repair before it can continue.',
    )
    expect(mounted.container.querySelector('button[name="clock-on"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="clock-off"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="drop-session"]')).toBeNull()
  })

  it('Completed (readOnly): no Start even with no sessions, no × on a closed one', () => {
    const closed = { id: 's1', started_at: '2026-09-05T09:00:00Z', ended_at: '2026-09-05T12:00:00Z', break_minutes: 0 }
    mounted = mount(<ShiftHours {...baseProps} shift={shift({ sessions: [closed] })} readOnly={true} />)
    expect(mounted.container.querySelector('button[name="clock-on"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="clock-off"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="drop-session"]')).toBeNull()
  })

  it('clicking Stop calls onClockOff with the one open session’s id', () => {
    const onClockOff = vi.fn(() => Promise.resolve())
    const open = { id: 's7', started_at: '2026-09-05T09:00:00Z', ended_at: null, break_minutes: 0 }
    mounted = mount(
      <ShiftHours {...baseProps} onClockOff={onClockOff} shift={shift({ sessions: [open] })} readOnly={false} />,
    )
    mounted.container.querySelector<HTMLButtonElement>('button[name="clock-off"]')?.click()
    expect(onClockOff).toHaveBeenCalledExactlyOnceWith('s7')
  })
})

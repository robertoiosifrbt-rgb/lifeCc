import { describe, expect, it } from 'vitest'

import {
  earnedPence,
  earningFromRow,
  isOut,
  kilometres,
  minutesWorked,
  sessionFromRow,
  shiftFromRow,
} from './shift'
import type { Shift } from './shift'

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

describe('sessionFromRow', () => {
  it('takes a session that is still open', () => {
    expect(
      sessionFromRow({ id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null, break_minutes: 0 }),
    ).toEqual({ id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null, break_minutes: 0 })
  })

  it('refuses one that ends before it starts, as the database does', () => {
    expect(() =>
      sessionFromRow({
        id: 's1',
        started_at: '2026-09-05T09:00:00+00:00',
        ended_at: '2026-09-05T08:00:00+00:00',
      }),
    ).toThrow('ends before it starts')
  })
})

describe('earningFromRow', () => {
  it('reads the amount PostgREST hands back as text', () => {
    expect(earningFromRow({ platform: 'uber_eats', amount: '64.20' })).toEqual({
      platform: 'uber_eats',
      amount: 64.2,
    })
  })

  it('refuses a platform nobody drives for', () => {
    expect(() => earningFromRow({ platform: 'bolt', amount: '5' })).toThrow('bolt')
  })

  it('refuses a platform that paid less than nothing', () => {
    expect(() => earningFromRow({ platform: 'just_eat', amount: '-1' })).toThrow(
      'less than nothing',
    )
  })
})

describe('shiftFromRow', () => {
  it('refuses an odometer that runs backwards', () => {
    expect(() =>
      shiftFromRow({ item_id: 'i1', owner: 'me', odo_start: '100', odo_end: '90' }, [], []),
    ).toThrow('backwards')
  })
})

describe('kilometres', () => {
  it('is the difference between the two readings', () => {
    expect(kilometres(shift({ odo_start: 120345, odo_end: 120512.4 }))).toBeCloseTo(167.4)
  })

  it('is unknown until both readings are there, not zero', () => {
    expect(kilometres(shift({ odo_start: 120345 }))).toBeNull()
    expect(kilometres(shift({ odo_end: 120512 }))).toBeNull()
  })
})

describe('minutesWorked', () => {
  const finished = {
    id: 's1',
    started_at: '2026-09-05T09:00:00+00:00',
    ended_at: '2026-09-05T12:30:00+00:00',
    break_minutes: 0,
  }
  const open = { id: 's2', started_at: '2026-09-05T17:00:00+00:00', ended_at: null, break_minutes: 0 }

  it('adds up every session that has finished', () => {
    expect(minutesWorked(shift({ sessions: [finished] }))).toBe(210)
  })

  it('counts a session that runs past midnight for what it is', () => {
    expect(
      minutesWorked(
        shift({
          sessions: [
            {
              id: 's3',
              started_at: '2026-09-05T21:00:00+00:00',
              ended_at: '2026-09-06T01:00:00+00:00',
              break_minutes: 0,
            },
          ],
        }),
      ),
    ).toBe(240)
  })

  it('leaves out the one still running, and says so separately', () => {
    const both = shift({ sessions: [finished, open] })
    expect(minutesWorked(both)).toBe(210)
    expect(isOut(both)).toBe(true)
    expect(isOut(shift({ sessions: [finished] }))).toBe(false)
  })
})

describe('earnedPence', () => {
  it('adds the platforms and the tips, in pence', () => {
    const day = shift({
      tips: 12.5,
      personal_km: null,
      earnings: [
        { platform: 'uber_eats', amount: 64.2 },
        { platform: 'deliveroo', amount: 31.0 },
        { platform: 'just_eat', amount: 18.75 },
      ],
    })
    expect(earnedPence(day)).toBe(12645)
  })

  it('does not drift the way adding the pounds would', () => {
    // 0.1 + 0.2 in floating point is not 0.3, and a month of shifts adds up
    // the error in the direction nobody checks.
    const day = shift({
      earnings: [
        { platform: 'uber_eats', amount: 0.1 },
        { platform: 'deliveroo', amount: 0.2 },
      ],
    })
    expect(earnedPence(day)).toBe(30)
  })

  it('is nothing at all for a shift with nothing written in it', () => {
    expect(earnedPence(shift())).toBe(0)
  })
})

describe('the break comes off the hours', () => {
  const nineToHalfTwelve = {
    id: 's1',
    started_at: '2026-09-05T09:00:00+00:00',
    ended_at: '2026-09-05T12:30:00+00:00',
    break_minutes: 0,
  }

  it('takes the break off the session that holds it', () => {
    expect(minutesWorked(shift({ sessions: [{ ...nineToHalfTwelve, break_minutes: 30 }] }))).toBe(
      180,
    )
  })

  it('takes each session’s own break, not one number for the day', () => {
    const evening = {
      id: 's2',
      started_at: '2026-09-05T17:00:00+00:00',
      ended_at: '2026-09-05T20:00:00+00:00',
      break_minutes: 15,
    }
    expect(
      minutesWorked(
        shift({ sessions: [{ ...nineToHalfTwelve, break_minutes: 30 }, evening] }),
      ),
    ).toBe(180 + 165)
  })

  it('never goes below nothing, whatever the break says', () => {
    // The database refuses a break longer than its session, but a row written
    // before that constraint existed would otherwise report negative hours —
    // and every rate per hour in the app divides by this number.
    expect(
      minutesWorked(shift({ sessions: [{ ...nineToHalfTwelve, break_minutes: 900 }] })),
    ).toBe(0)
  })

  it('reads a row with no break at all as a break of nothing', () => {
    expect(sessionFromRow({ ...nineToHalfTwelve, break_minutes: undefined }).break_minutes).toBe(0)
  })
})

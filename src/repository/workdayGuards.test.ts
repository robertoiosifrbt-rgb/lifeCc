import { describe, expect, it } from 'vitest'

import type { Shift } from './shift'
import {
  canCompleteWorkday,
  canDeleteWorkday,
  MULTIPLE_OPEN_SESSIONS,
  sessionControlsOf,
  sessionMessageOf,
  STOP_SESSION_FIRST,
} from './workdayGuards'

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

describe('canCompleteWorkday / canDeleteWorkday', () => {
  const openSession = { id: 's2', started_at: '2026-09-05T17:00:00+00:00', ended_at: null, break_minutes: 0 }
  const closedSession = { id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: '2026-09-05T12:30:00+00:00', break_minutes: 0 }

  it('refuses both while a session is open', () => {
    const out = shift({ sessions: [openSession] })
    expect(canCompleteWorkday(out)).toBe(false)
    expect(canDeleteWorkday(out)).toBe(false)
  })

  it('allows both once every session has ended', () => {
    const day = shift({ sessions: [closedSession] })
    expect(canCompleteWorkday(day)).toBe(true)
    expect(canDeleteWorkday(day)).toBe(true)
  })

  it('a day with no sessions at all passes the session gate — this alone never blocks it', () => {
    // Not the same claim as "a day with no sessions can Complete": it can
    // pass through this gate and still be refused by `validateCompletion`,
    // which is the function that actually requires at least one finished
    // session before a Workday can be marked done.
    expect(canCompleteWorkday(shift())).toBe(true)
    expect(canDeleteWorkday(shift())).toBe(true)
  })

  it('still refuses with two or more open sessions, the known corrupt case', () => {
    const secondOpen = { id: 's3', started_at: '2026-09-05T18:00:00+00:00', ended_at: null, break_minutes: 0 }
    const ambiguous = shift({ sessions: [openSession, secondOpen] })
    expect(canCompleteWorkday(ambiguous)).toBe(false)
    expect(canDeleteWorkday(ambiguous)).toBe(false)
  })

  it('stopping the open session is what turns the refusal off — Stop alone, not Complete', () => {
    // Stop only ever closes the one session (`endSession` touches
    // shift_sessions, never items.state): the day becomes completable
    // because `isOut` now reads false, not because anything decided to
    // complete it.
    const wasOut = shift({ sessions: [openSession] })
    expect(canCompleteWorkday(wasOut)).toBe(false)
    const afterStop = shift({
      sessions: [{ ...openSession, ended_at: '2026-09-05T19:00:00+00:00' }],
    })
    expect(canCompleteWorkday(afterStop)).toBe(true)
  })
})

describe('sessionControlsOf', () => {
  const openSession = { id: 's2', started_at: '2026-09-05T17:00:00+00:00', ended_at: null, break_minutes: 0 }
  const closedSession = { id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: '2026-09-05T12:30:00+00:00', break_minutes: 0 }

  it('says Start (no session to stop) when every session has ended, or there are none', () => {
    expect(sessionControlsOf(shift())).toEqual({ kind: 'closed' })
    expect(sessionControlsOf(shift({ sessions: [closedSession] }))).toEqual({ kind: 'closed' })
  })

  it('names the exact session to show Stop for when exactly one is open', () => {
    expect(sessionControlsOf(shift({ sessions: [closedSession, openSession] }))).toEqual({
      kind: 'one-open',
      sessionId: 's2',
    })
  })

  it('never picks one to guess at when two or more are open — the known corrupt case', () => {
    const secondOpen = { id: 's3', started_at: '2026-09-05T18:00:00+00:00', ended_at: null, break_minutes: 0 }
    expect(sessionControlsOf(shift({ sessions: [openSession, secondOpen] }))).toEqual({
      kind: 'ambiguous',
    })
  })
})

describe('sessionMessageOf', () => {
  it('says nothing when there is no open session', () => {
    expect(sessionMessageOf(shift())).toBeNull()
  })

  it('asks to Stop, by name, when exactly one session is open', () => {
    const open = { id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null, break_minutes: 0 }
    expect(sessionMessageOf(shift({ sessions: [open] }))).toBe(STOP_SESSION_FIRST)
  })

  it('asks for data repair when two or more sessions are open at once', () => {
    const first = { id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null, break_minutes: 0 }
    const second = { id: 's2', started_at: '2026-09-05T18:00:00+00:00', ended_at: null, break_minutes: 0 }
    expect(sessionMessageOf(shift({ sessions: [first, second] }))).toBe(MULTIPLE_OPEN_SESSIONS)
  })
})

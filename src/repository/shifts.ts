// The shifts, as the screens ask for them.
//
// Every write here ends the same way: the parts of the account are read back
// whole and put in the cache. The parts have no version of their own, so
// there is nothing to merge — replacing is the only honest move, and it is
// the strategy the migration declares.

import { currentSession } from './auth'
import { supabaseShiftParts, supabaseShiftWriter } from './source'
import { earningFromRow, sessionFromRow, shiftFromRow } from './shift'
import type { Platform, Shift, ShiftPatch, ShiftSession } from './shift'
import { shiftStore } from './store'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Reads every shift part from the server and puts the lot in the cache. */
export async function syncShifts(owner: string): Promise<Shift[]> {
  const parts = await supabaseShiftParts()

  const sessions = new Map<string, ShiftSession[]>()
  for (const row of parts.sessions) {
    const anchor = (row as Record<string, unknown>)['item_id']
    if (typeof anchor !== 'string') throw new Error('A session with no anchor')
    const held = sessions.get(anchor) ?? []
    held.push(sessionFromRow(row))
    sessions.set(anchor, held)
  }

  const earnings = new Map<string, ReturnType<typeof earningFromRow>[]>()
  for (const row of parts.earnings) {
    const anchor = (row as Record<string, unknown>)['item_id']
    if (typeof anchor !== 'string') throw new Error('An earning with no anchor')
    const held = earnings.get(anchor) ?? []
    held.push(earningFromRow(row))
    earnings.set(anchor, held)
  }

  const shifts = parts.shifts.map((row) => {
    const anchor = (row as Record<string, unknown>)['item_id']
    const id = typeof anchor === 'string' ? anchor : ''
    return shiftFromRow(row, sessions.get(id) ?? [], earnings.get(id) ?? [])
  })

  await shiftStore.replaceAll(owner, shifts)
  return shifts
}

/** Everything cached, by anchor. */
export async function shiftsOf(owner: string): Promise<Shift[]> {
  await requireAccount(owner)
  return shiftStore.readAll(owner)
}

/** The readings and the tips. Creates the row if the shift has none yet. */
export async function saveShift(
  owner: string,
  item_id: string,
  patch: ShiftPatch,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).upsertShift({ item_id, ...patch })
  return syncShifts(owner)
}

/** Clocking on. The moment comes from the device, and the database keeps it. */
export async function startSession(
  owner: string,
  item_id: string,
  at: Date,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).addSession({
    item_id,
    started_at: at.toISOString(),
  })
  return syncShifts(owner)
}

/** Clocking off. */
export async function endSession(
  owner: string,
  id: string,
  at: Date,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).endSession(id, at.toISOString())
  return syncShifts(owner)
}

/**
 * The break inside one session.
 *
 * On the session rather than the shift: a day with a lunch stint and an
 * evening stint has two breaks in different places. The database refuses a
 * break longer than the session it sits in, so an hour typed into a
 * twenty-minute stint comes back as a refusal rather than as negative hours.
 */
export async function setSessionBreak(
  owner: string,
  id: string,
  break_minutes: number,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).setBreak(id, break_minutes)
  return syncShifts(owner)
}

/** A session written down by mistake. Gone outright, not hidden. */
export async function removeSession(owner: string, id: string): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).removeSession(id)
  return syncShifts(owner)
}

/** What one platform paid. Writing it again replaces it, never adds a second. */
export async function setEarning(
  owner: string,
  item_id: string,
  platform: Platform,
  amount: number,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).setEarning({ item_id, platform, amount })
  return syncShifts(owner)
}

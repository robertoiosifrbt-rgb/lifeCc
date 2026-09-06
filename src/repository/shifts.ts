// The shifts, as the screens ask for them.
//
// Every write here ends the same way: the parts of the account are read back
// whole and put in the cache. The parts have no version of their own, so
// there is nothing to merge — replacing is the only honest move, and it is
// the strategy the migration declares.

import { currentSession } from './auth'
import { SyncPending } from './not-cached'
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

/** The two writes `startSessionSafely` sequences, as callbacks — so the
 *  sequence itself can be run against a spy in a test, not only the real
 *  network. */
export type SessionRecoveryEffects = {
  ensureShift: (item_id: string) => Promise<unknown>
  startSession: (item_id: string, at: Date) => Promise<unknown>
}

/**
 * Clocking on, safe against a shift item that has no `shifts` row yet — the
 * sequence itself, told how to do each half.
 *
 * A shift's anchor can exist on its own — created but never saved, or a
 * partial write that stopped after the item — and `syncShifts` has nowhere
 * to attach a session with no `shifts` row to join it to: the session would
 * write successfully and then be invisible in the cache, not just until the
 * next sync but for good. Ensuring the row first never overwrites odo/tips
 * already there when the ensure is the real, idempotent upsert — it only
 * ever fills in what is missing. If ensuring it fails, the session is never
 * attempted: the `await` below is what makes that true, not a convention a
 * caller has to remember.
 *
 * `runStartSessionSafely` is production calling this exact function with the
 * real writes — not a second copy of the same decision.
 */
export async function runSessionRecovery(
  item_id: string,
  at: Date,
  effects: SessionRecoveryEffects,
): Promise<void> {
  await effects.ensureShift(item_id)
  await effects.startSession(item_id, at)
}

/** The shift row alone, upserted — no sync. Only ever meant to run as one
 *  half of a sequence that syncs once at its own end, never on its own: a
 *  caller that stops here without the sync half has a write the cache never
 *  learns about. */
async function ensureShiftRow(owner: string, item_id: string): Promise<void> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).upsertShift({ item_id })
}

/** The session row alone, inserted — no sync. Same rule as `ensureShiftRow`:
 *  one half of a sequence, never a write on its own. */
async function addSessionRow(owner: string, item_id: string, at: Date): Promise<void> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).addSession({ item_id, started_at: at.toISOString() })
}

/** `runSessionRecovery`'s two writes, plus the one sync that used to happen
 *  once per write instead of once for the whole sequence — `saveShift` and
 *  `startSession` each already sync on their own, so ensuring the row with
 *  one and starting the session with the other made every clock-on take
 *  three full shift-part syncs for one change. Told how to do all three
 *  parts, the same way `runSessionRecovery` is told how to do two, so a test
 *  can prove the sync happens exactly once, after both writes, never before
 *  either has succeeded. */
export type StartSessionSafelyEffects = SessionRecoveryEffects & {
  sync: () => Promise<Shift[]>
}

/**
 * `runSessionRecovery`'s two writes have already committed by the time
 * `effects.sync()` runs — the session exists on the server whatever happens
 * next. A failure here is a readback problem, not a write problem, and must
 * never be reported as one: told "it failed", a caller would retry the whole
 * sequence and start a second session on top of the one that already began.
 * `SyncPending` carries that distinction forward instead of a plain
 * rejection — `write()` already knows how to turn it into a soft success
 * plus a later resync, the same way it already does for `NotCached`.
 */
export async function runStartSessionSafely(
  item_id: string,
  at: Date,
  effects: StartSessionSafelyEffects,
): Promise<Shift[]> {
  await runSessionRecovery(item_id, at, effects)
  try {
    return await effects.sync()
  } catch (error) {
    throw new SyncPending(item_id, error)
  }
}

/**
 * Clocking on, safe against a shift item with no `shifts` row yet — the same
 * capability `startDeliveryWork` shares, ending in exactly one full sync
 * rather than the one-sync-per-write `saveShift`/`startSession` would give
 * for free but expensively.
 */
export async function startSessionSafely(
  owner: string,
  item_id: string,
  at: Date,
): Promise<Shift[]> {
  return runStartSessionSafely(item_id, at, {
    ensureShift: (id) => ensureShiftRow(owner, id),
    startSession: (id, when) => addSessionRow(owner, id, when),
    sync: () => syncShifts(owner),
  })
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

/**
 * A platform's earning, taken back — not set to zero.
 *
 * A platform that paid nothing and a platform nobody has said anything about
 * are different claims; the row itself is the only honest way to tell them
 * apart, so clearing a typed amount removes the row outright rather than
 * writing a zero that would read as "checked, and it was nothing".
 */
export async function removeEarning(
  owner: string,
  item_id: string,
  platform: Platform,
): Promise<Shift[]> {
  await requireAccount(owner)
  await supabaseShiftWriter(owner).removeEarning(item_id, platform)
  return syncShifts(owner)
}

// The face the screens see. They ask and receive; Supabase is never visible.
//
//     UI → repository → Supabase

import { currentSession } from './auth'
import type { Session } from './auth'
import { exportFile } from './export'
import type { ExportFile } from './export'
import { fromRow as fromAreaRow } from './area'
import { fromRow as fromItemRow, localToday } from './item'
import type { Item, Patch } from './item'
import { supabaseSource, supabaseWriter } from './source'
import { syncSettings } from './settings-api'
import { syncCore } from './core'
import { syncExpenses } from './expenses'
import { syncJournalEntries } from './journal-entries'
import { journalStore } from './journal-store'
import { syncShifts } from './shifts'
import { areaStore, store } from './store'
import { sync } from './sync'
import type { SyncResult } from './sync'
import { applyPatch, create, createDated, softDelete } from './write'

export type { Item, Patch } from './item'
// The filters live here, in one place; the screens call them over the snapshot
// they already hold instead of re-reading the cache for every group.
export { forCalendar, forTasks, forToday, forWaiting } from './filters'
export { localToday } from './item'
export type { CalendarDay, TaskGroups, TodayGroups } from './filters'
export type { SyncResult } from './sync'
export type { ExportFile } from './export'
export { Conflict, isItemConflict } from './write'
export type { Area, AreaPatch } from './area'
export type { Platform, Shift, ShiftPatch, ShiftSession } from './shift'
export { takeHome, takeHomeOfAll } from './takehome'
export { currentYearMoney, monthRange, periodMoney } from './period'
export { dayBefore, sliceOfYear } from './slice'
export type { Slice } from './slice'
export { reserveFor } from './reserve'
export type { Reserve } from './reserve'
export type { Period } from './period'
export type { Category, Expense } from './expense'
export { CATEGORIES, CATEGORY_NAMES, fillsOf } from './expense'
export { fuelRate } from './fuel'
export type { Fill, FuelRate } from './fuel'
export { expensesOf, recordExpense, removeExpense } from './expenses'
export type { RunningCosts } from './settings'
export { costsFor, hasCosts } from './settings'
export {
  runningCostsOf,
  saveRunningCosts,
  saveTaxYear,
  taxYearsOf,
} from './settings-api'
export { taxBill } from './hmrc'
export type { Income, TaxBill, TaxFigures } from './hmrc'
export { AMOUNTS, RATES, figuresOf, incomeOf, yearIn } from './hmrc-year'
export type { Figure, TaxYearPatch, TaxYearRow } from './hmrc-year'
export { dueDates, taxYearOf } from './taxyear'
export type { DueDates, TaxYear } from './taxyear'
export type { TakeHome } from './takehome'
export { setSessionBreak } from './shifts'
export {
  earnedPence,
  isOut,
  kilometres,
  minutesWorked,
  PLATFORM_NAMES,
  PLATFORMS,
} from './shift'
export {
  endSession,
  removeSession,
  saveShift,
  setEarning,
  shiftsOf,
  startSession,
} from './shifts'
export { countUnder, pathOf, treeOf } from './area'
export {
  areasOf,
  createArea,
  discardArea,
  updateArea,
} from './areas'

/** The two synced tables, named once. */
export const ITEMS = 'items'
export const AREAS = 'areas'

/**
 * Checks that the requested namespace really belongs to the user signed in
 * right now.
 *
 * The cache is never read without the current user: otherwise signing out of A
 * and into B would show, if only for a moment, A's data.
 */
export function assertAccount(owner: string, session: Session | null): void {
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error(`The requested cache belongs to ${owner}, but the current account is another.`)
  }
}

async function requireAccount(owner: string): Promise<void> {
  assertAccount(owner, await currentSession())
}

/**
 * Fetches what changed and puts it in the cache. The first time, everything.
 *
 * Two tables, two cursors, one sync — because "is it up to date?" is a
 * question about the account, not about a table. Areas go first: an item can
 * name an area, so arriving in the other order shows, for a moment, an item
 * pointing at an area this device has never heard of.
 *
 * They are reported as one. A count split in two would have to be explained
 * on every screen that shows it, and no screen cares which table a row was in.
 */
export async function syncAccount(owner: string): Promise<SyncResult> {
  await requireAccount(owner)
  const areas = await sync(owner, supabaseSource(AREAS), areaStore, fromAreaRow)
  const items = await sync(owner, supabaseSource(ITEMS), store, fromItemRow)
  // The shift parts last, and whole: they carry no cursor, so there is
  // nothing to ask them "since when". Their anchors have already arrived.
  // The settings before the shifts: a shift is read with the rates pinned on
  // it, but a screen that has one and not the other shows a cost of nothing.
  await syncSettings(owner)
  const shifts = await syncShifts(owner)
  const spent = await syncExpenses(owner)
  // The core last, and whole. Entities and links carry no cursor either: both
  // ride the anchors that have just arrived above. The journal rides its own
  // anchors the same way, so it goes here too, not with the other two.
  await syncCore(owner)
  const journal = await syncJournalEntries(owner)
  return {
    // A full snapshot of either table is a full sync: something was rebuilt
    // from nothing, and that is what the word has to keep meaning.
    kind: areas.kind === 'full' || items.kind === 'full' ? 'full' : 'delta',
    fetched: areas.fetched + items.fetched + shifts.length + spent.length + journal.length,
    cursor: items.cursor,
  }
}

/** Everything cached for this account, deleted rows included. */
export async function all(owner: string): Promise<Item[]> {
  await requireAccount(owner)
  return store.readAll(owner)
}

/** Capture: a title, nothing else. */
export async function capture(owner: string, title: string): Promise<Item> {
  await requireAccount(owner)
  return cache(owner, await create(supabaseWriter(ITEMS, owner), title))
}

/** A day worked, as an item. The numbers hang off it afterwards. */
export async function createShift(
  owner: string,
  day: string,
  area_id: string | null,
): Promise<Item> {
  await requireAccount(owner)
  return cache(
    owner,
    await createDated(supabaseWriter(ITEMS, owner), {
      kind: 'shift',
      title: 'Shift',
      day,
      area_id,
    }),
  )
}

/** Changes an item, with a version check. Throws Conflict if it will not hold. */
export async function update(
  owner: string,
  item: Item,
  patch: Patch,
  now: Date,
): Promise<Item> {
  await requireAccount(owner)
  return cache(
    owner,
    await applyPatch(supabaseWriter(ITEMS, owner), item, patch, localToday(now)),
  )
}

/** Deleting is an UPDATE on deleted_at. The row stays, so sync can carry it. */
export async function discard(owner: string, item: Item, now: Date): Promise<Item> {
  await requireAccount(owner)
  return cache(
    owner,
    await softDelete(supabaseWriter(ITEMS, owner), item, now, localToday(now)),
  )
}

/** "Download everything": the entire snapshot, as a file. */
export async function exportAll(owner: string, now: Date): Promise<ExportFile> {
  await requireAccount(owner)
  const [items, cursor, journal] = await Promise.all([
    store.readAll(owner),
    store.cursor(owner),
    journalStore.readAll(owner),
  ])
  return exportFile(owner, items, journal, cursor, now)
}

/**
 * The write reached the server, and the cache would not take the row.
 *
 * It is not a failed write, and must never be shown as one. The row is on the
 * server; only the local copy is behind. Told "it did not work", you press
 * Save again — and Capture inserts a second row for a first one that was
 * already there.
 *
 * It carries the item so the screen can stop calling it unsaved, and ask for a
 * sync instead: the next delta brings the same row back, and the upsert is
 * idempotent.
 */
export class NotCached extends Error {
  readonly item: Item

  constructor(item: Item, reason: unknown) {
    super(
      `Saved, but this device could not keep a copy: ${
        reason instanceof Error ? reason.message : String(reason)
      }`,
    )
    this.name = 'NotCached'
    this.item = item
  }
}

/**
 * The row the server returned goes into the cache straight away.
 *
 * The cursor does not move: this row will come back on the next delta anyway,
 * and a cursor moved on a single write could skip past what somebody else
 * wrote in the meantime.
 */
async function cache(owner: string, item: Item): Promise<Item> {
  try {
    await store.upsert(owner, [item], null)
  } catch (reason) {
    throw new NotCached(item, reason)
  }
  return item
}
export type { Entity, EntityKind, EntityPatch, Fuel, VehicleDate } from './entity'
export {
  ENTITY_KINDS,
  ENTITY_KIND_NAMES,
  FUELS,
  FUEL_NAMES,
  VEHICLE_DATES,
  dueOn,
} from './entity'
export type { Link, LinkKind, Neighbour } from './link'
export { LINK_KINDS, LINK_NAMES, neighboursOf } from './link'
export {
  link,
  linksOf,
  recordThing,
  removeThing,
  saveThing,
  syncCore,
  thingsOf,
  unlink,
} from './core'
export type { JournalEntry, JournalPatch } from './journal-entry'
export { findRequestedEntry, searchJournal, timelineOf } from './journal-entry'
export { createJournalEntry, journalEntriesOf, saveJournalEntry } from './journal-entries'

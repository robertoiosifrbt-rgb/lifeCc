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
import { NotCached } from './not-cached'
import { fromRow as fromQuickActionRow } from './quick-action'
import { supabaseSource, supabaseWriter } from './source'
import { syncSettings } from './settings-api'
import { syncCore } from './core'
import { syncExpenses } from './expenses'
import { syncJournalEntries } from './journal-entries'
import { journalStore } from './journal-store'
import { syncPlatforms } from './platforms'
import { syncShifts } from './shifts'
import { areaStore, quickActionStore, store } from './store'
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
export type { Platform, Shift, ShiftEarning, ShiftPatch, ShiftSession } from './shift'
export type { RoadCostField } from './road-cost'
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
export { expensesOf, recordExpense, removeExpense, setRoadCost } from './expenses'
export type { RunningCosts } from './settings'
export { costsFor, hasCosts } from './settings'
export {
  runningCostsOf,
  saveRunningCosts,
  saveTaxYear,
  saveVehicleCostRate,
  taxYearsOf,
  vehicleCostRatesOf,
} from './settings-api'
export type { VehicleCostRate } from './vehicle-cost'
export { currentVehicleCostRateOf } from './vehicle-cost'
export { taxBill } from './hmrc'
export type { Income, TaxBill, TaxFigures } from './hmrc'
export { AMOUNTS, RATES, figuresOf, incomeOf, yearIn } from './hmrc-year'
export type { Figure, TaxYearPatch, TaxYearRow } from './hmrc-year'
export { dueDates, taxYearOf } from './taxyear'
export type { DueDates, TaxYear } from './taxyear'
export type { TakeHome } from './takehome'
export { setSessionBreak } from './shifts'
export { earnedPence, isOut, kilometres, minutesWorked, PLATFORM_NAMES, PLATFORMS } from './shift'
export { roadCostExpenseOf, ROAD_COST_FIELDS, withRoadCostExpenses } from './road-cost'
export {
  canCompleteWorkday,
  canDeleteWorkday,
  MULTIPLE_OPEN_SESSIONS,
  sessionControlsOf,
  sessionMessageOf,
  STOP_SESSION_FIRST,
} from './workdayGuards'
export type { SessionControls } from './workdayGuards'
export {
  endSession,
  removeEarning,
  removePlatformEarning,
  removeSession,
  saveShift,
  setEarning,
  setPlatformEarning,
  shiftsOf,
  startSession,
} from './shifts'
export { runSessionRecovery, startSessionSafely } from './shifts'
export type { SessionRecoveryEffects } from './shifts'
export { runStartDeliveryWork } from './delivery'
export type { StartDeliveryWorkEffects, StartDeliveryWorkResult } from './delivery'
export { NotCached, SyncPending } from './not-cached'
export { countUnder, pathOf, settingsPatch, subtreeOf, treeOf } from './area'
export {
  areasOf,
  createArea,
  discardArea,
  updateArea,
} from './areas'
export {
  needsArea,
  nextPositionOf,
  normalizeLabel,
  orderedOf,
  positionForMove,
  QUICK_ACTION_KINDS,
} from './quick-action'
export type { QuickAction, QuickActionKind, QuickActionPatch } from './quick-action'
export { createQuickAction, discardQuickAction, quickActionsOf, updateQuickAction } from './quick-actions'
/** The synced tables, named once. */
export const ITEMS = 'items'
export const AREAS = 'areas'
export const QUICK_ACTIONS = 'quick_actions'

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
 * Areas go first: an item can name an area, so arriving in the other order
 * shows, for a moment, an item pointing at an area this device has never
 * heard of. Reported as one count — no screen cares which table a row was in.
 */
export async function syncAccount(owner: string): Promise<SyncResult> {
  await requireAccount(owner)
  const areas = await sync(owner, supabaseSource(AREAS), areaStore, fromAreaRow)
  const items = await sync(owner, supabaseSource(ITEMS), store, fromItemRow)
  // Quick Actions carry their own cursor too, after areas: a delivery.work
  // row can name one.
  const quickActions = await sync(
    owner, supabaseSource(QUICK_ACTIONS), quickActionStore, fromQuickActionRow,
  )
  // The shift parts last, and whole: they carry no cursor, so there is
  // nothing to ask them "since when". Their anchors have already arrived.
  // The settings before the shifts: a shift is read with the rates pinned on
  // it, but a screen that has one and not the other shows a cost of nothing.
  await syncSettings(owner)
  const shifts = await syncShifts(owner)
  const spent = await syncExpenses(owner)
  // The core last, and whole. Entities and links carry no cursor either: both
  // ride the anchors that have just arrived above. The journal and Platforms
  // ride their own anchors the same way, so they go here too, not with the
  // other two.
  await syncCore(owner)
  const journal = await syncJournalEntries(owner)
  await syncPlatforms(owner)
  return {
    // A full snapshot of either table is a full sync: something was rebuilt
    // from nothing, and that is what the word has to keep meaning.
    kind:
      areas.kind === 'full' || items.kind === 'full' || quickActions.kind === 'full'
        ? 'full'
        : 'delta',
    fetched:
      areas.fetched +
      items.fetched +
      quickActions.fetched +
      shifts.length +
      spent.length +
      journal.length,
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
  const [items, cursor, journal, quickActions] = await Promise.all([
    store.readAll(owner),
    store.cursor(owner),
    journalStore.readAll(owner),
    quickActionStore.readAll(owner),
  ])
  return exportFile(owner, items, journal, quickActions, cursor, now)
}

/** The row the server returned goes into the cache straight away. The cursor
 *  does not move: a cursor moved on a single write could skip past what
 *  somebody else wrote in the meantime. */
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
export type { Vehicle, VehicleLink } from './vehicle'
export { fuelRateForVehicle, vehicleLinkIdsOf, vehicleLinkOf, vehiclesOf } from './vehicle'
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
export type { CashoutFeeType, NamedPlatform, PlatformPatch, PlatformRecord } from './platform-record'
export { CASHOUT_FEE_TYPES, namedPlatformsFor, orderedPlatformsOf } from './platform-record'
export { platformsOf, recordPlatform, removePlatform, savePlatform } from './platforms'

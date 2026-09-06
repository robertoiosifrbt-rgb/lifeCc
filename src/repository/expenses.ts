// The expenses, as the screens ask for them — and the one thing that follows
// from writing one down: the fuel rate changes.

import { currentSession } from './auth'
import { expenseFromRow, fillsOf } from './expense'
import type { Category, Expense } from './expense'
import { fuelRate } from './fuel'
import type { FuelRate } from './fuel'
import { createDated, softDelete } from './write'
import { supabaseExpenses, supabaseExpenseWriter, supabaseWriter } from './source'
import { runningCostsOf, saveRunningCosts } from './settings-api'
import { expenseStore } from './settings-store'
import { store } from './store'
import { localToday } from './item'
import type { Item, Patch } from './item'

const ITEMS = 'items'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Reads every expense from the server and puts them in the cache. */
export async function syncExpenses(owner: string): Promise<Expense[]> {
  const rows = (await supabaseExpenses()).map(expenseFromRow)
  await expenseStore.replaceAll(owner, rows)
  return rows
}

export async function expensesOf(owner: string): Promise<Expense[]> {
  await requireAccount(owner)
  return expenseStore.readAll(owner)
}

/**
 * Money out, on the day it went out.
 *
 * The anchor is made the same way a shift's is — already processed, on its
 * day, in its area — because an expense is not something you found in your
 * pocket either.
 */
export async function recordExpense(
  owner: string,
  what: {
    day: string
    area_id: string | null
    title: string
    category: Category
    amount: number
    odo: number | null
    full_tank: boolean | null
    business_pct: number
  },
): Promise<Item> {
  await requireAccount(owner)
  const anchor = await createDated(supabaseWriter<Patch>(ITEMS, owner), {
    kind: 'expense',
    title: what.title,
    day: what.day,
    area_id: what.area_id,
  })
  await supabaseExpenseWriter(owner).save({
    item_id: anchor.id,
    amount: what.amount,
    category: what.category,
    odo: what.odo,
    full_tank: what.full_tank,
    business_pct: what.business_pct,
  })
  // The cache first, and then the rate. Working the rate out before this line
  // reads a cache that does not hold the fill just written, so the rate would
  // always be one fill-up behind — right until the moment somebody checked it
  // against the pump and could not see why.
  // The anchor into the cache before the rate is worked out: the fills of an
  // area are found through their anchors, and one that is only on the server
  // is one the sum cannot see.
  await store.upsert(owner, [anchor], null)
  await syncExpenses(owner)
  await refreshFuelRate(owner, await store.readAll(owner), what.area_id)
  return anchor
}

/**
 * The fuel rate this area's fill-ups work out to, right now.
 *
 * The one function that reads the pump receipts of an area — the automatic
 * "what a kilometre costs" a shift shows, and the same sum `refreshFuelRate`
 * freezes onto a shift when it writes one. Two callers, one formula: a screen
 * showing its own guess at this would be a second answer to the question the
 * fill-ups already answer.
 */
export function fuelRateForArea(
  items: readonly Item[],
  expenses: readonly Expense[],
  area_id: string | null,
): FuelRate {
  if (area_id === null) return fuelRate([])
  // Only this area's fill-ups. A second line of work is a second vehicle
  // burning fuel at its own price, and one rate worked out from both bonnets
  // is a number that describes neither.
  const here = new Set(
    items.filter((item) => item.area_id === area_id).map((item) => item.id),
  )
  const mine = expenses.filter(
    (expense) => expense.category === 'fuel' && here.has(expense.item_id),
  )
  return fuelRate(fillsOf(mine))
}

/**
 * Works the fuel rate out again and writes it where the shifts can pin it.
 *
 * Derived, but stored, and on purpose: a shift freezes the rate it was worked
 * under, and the database does that freezing at the moment of writing. It
 * cannot run this sum inside a trigger, so the value it reads has to be
 * sitting there. One function works it out, and this is the only one that
 * writes it.
 */
export async function refreshFuelRate(
  owner: string,
  items: readonly Item[],
  area_id: string | null,
): Promise<void> {
  if (area_id === null) return

  const rate = fuelRateForArea(items, await expensesOf(owner), area_id)
  if (rate.perKm === null) return

  const held = (await runningCostsOf(owner)).find((row) => row.area_id === area_id)
  // The wear is the owner's to set, and there is no honest guess at it. Until
  // he has said, the fuel rate waits: writing zero here would put a cost per
  // kilometre on screen with half of it silently missing, which is the same
  // lie as £0 of tax.
  if (held === undefined) return

  await saveRunningCosts(owner, area_id, rate.perKm, held.vehicle_per_km)
}

/**
 * An expense written down by mistake.
 *
 * The numbers go outright — they are only ever read as this anchor's — and
 * the anchor is soft-deleted like everything else, so the other device learns
 * it is gone instead of keeping it for good.
 *
 * Then the rate again: removing a fill-up moves the cost per kilometre, and
 * leaving it stale would mean the number on screen came from a receipt that
 * no longer exists.
 */
export async function removeExpense(owner: string, item: Item, now: Date): Promise<void> {
  await requireAccount(owner)
  await supabaseExpenseWriter(owner).remove(item.id)
  const writer = supabaseWriter<Patch>(ITEMS, owner)
  const gone = await softDelete(writer, item, now, localToday(now))
  await store.upsert(owner, [gone], null)
  await syncExpenses(owner)
  await refreshFuelRate(owner, await store.readAll(owner), item.area_id)
}

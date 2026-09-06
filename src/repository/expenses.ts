// The expenses, as the screens ask for them — and the one thing that follows
// from writing one down: the fuel rate changes.

import { currentSession } from './auth'
import { link, linksOf, thingsOf } from './core'
import { expenseFromRow } from './expense'
import type { Category, Expense } from './expense'
import { fuelRateForVehicle, vehicleLinkOf } from './vehicle'
import { createDated, softDelete } from './write'
import { supabaseExpenses, supabaseExpenseWriter, supabaseWriter } from './source'
import { supabaseSettingsWriter } from './settings-source'
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
    /** Which Vehicle this was for, or null when it is left unknown. */
    vehicle_item_id: string | null
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
  // A Vehicle is never assigned by guessing — only when the person actually
  // said which one this was for, at the moment of writing it down.
  if (what.vehicle_item_id !== null) {
    await link(owner, anchor.id, what.vehicle_item_id, 'about')
  }
  // The cache first, and then the rate. Working the rate out before this line
  // reads a cache that does not hold the fill just written, so the rate would
  // always be one fill-up behind — right until the moment somebody checked it
  // against the pump and could not see why.
  await store.upsert(owner, [anchor], null)
  await syncExpenses(owner)
  if (what.category === 'fuel' && what.vehicle_item_id !== null) {
    await refreshVehicleFuelRate(owner, what.vehicle_item_id)
  }
  return anchor
}

/**
 * Works a Vehicle's fuel rate out again and writes it where a shift's pin
 * trigger can read it.
 *
 * Derived, but stored, and on purpose: a shift freezes the rate it was worked
 * under, and the database does that freezing at the moment of writing. It
 * cannot run the full-tank sum inside a trigger, so the value it reads has to
 * be sitting there already — the same reason `running_costs.fuel_per_km` used
 * to hold this for an Area. One function works it out, and this is the only
 * one that writes it.
 */
export async function refreshVehicleFuelRate(owner: string, vehicleItemId: string): Promise<void> {
  const [expenses, links, entities] = await Promise.all([
    expensesOf(owner),
    linksOf(owner),
    thingsOf(owner),
  ])
  const rate = fuelRateForVehicle(expenses, links, entities, vehicleItemId)
  if (rate.perKm === null) {
    // The rate this Vehicle used to have has become unknowable — an edit or
    // a removal broke the full-tank chain. Left alone, the cache would keep
    // pinning a number no fill-up here still supports; invalidating it is
    // what makes "unknown" and "stale" the same thing again.
    await supabaseSettingsWriter().clearVehicleFuelRate(vehicleItemId)
    return
  }
  await supabaseSettingsWriter().saveVehicleFuelRate({
    vehicle_item_id: vehicleItemId,
    fuel_per_km: rate.perKm,
  })
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
  const [links, entities] = await Promise.all([linksOf(owner), thingsOf(owner)])
  const own = vehicleLinkOf(links, entities, item.id)
  await supabaseExpenseWriter(owner).remove(item.id)
  const writer = supabaseWriter<Patch>(ITEMS, owner)
  const gone = await softDelete(writer, item, now, localToday(now))
  await store.upsert(owner, [gone], null)
  await syncExpenses(owner)
  if (own.kind === 'one') await refreshVehicleFuelRate(owner, own.vehicleItemId)
}

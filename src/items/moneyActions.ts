// Everything you do to money: the shifts, what went out, and the settings
// behind both.
//
// Apart from useItems because that file is a hook with a lifecycle in it —
// what to read, when to read it again, what to do about a write that failed —
// and this is a plain list of writes. They grew together past the 300 lines
// the checker allows, which was the point at which the difference between
// them became worth having.
//
// Every one goes through the same `write`: a failed write is still a failed
// write whether it was a task, a fill-up or a percentage.

import {
  createShift,
  endSession as endShiftSession,
  NotCached,
  recordExpense,
  removeExpense,
  runStartDeliveryWork,
  saveRunningCosts,
  saveTaxYear,
  saveVehicleCostRate,
  saveWorkdayAtomic,
  startSessionSafely,
} from '../repository/items'
import type {
  Category,
  Item,
  SaveWorkdayPayload,
  TaxYearPatch,
} from '../repository/items'

type Write = (body: () => Promise<unknown>) => Promise<void>

export type MoneyActions = {
  spend: (what: {
    day: string
    area_id: string | null
    title: string
    category: Category
    amount: number
    odo: number | null
    full_tank: boolean | null
    business_pct: number
    vehicle_item_id: string | null
  }) => Promise<void>
  unspend: (item: Item) => Promise<void>
  saveTaxYear: (year: TaxYearPatch) => Promise<void>
  saveCosts: (
    area_id: string,
    fuel_per_km: number,
    vehicle_per_km: number,
  ) => Promise<void>
  /** A Vehicle's own cost per km, effective from a given date — never the
   *  Area's, and never requiring a known fuel rate first. */
  saveVehicleCost: (vehicle_item_id: string, effective_from: string, vehicle_per_km: number) => Promise<void>
  /**
   * The delivery.work Quick Action's "start" state: a shift made and its
   * first session already running, in one tap — the previous "Start a
   * shift" only ever made the container, which is a different thing this
   * action never leaves half done. Resolves to the shift's own item, so the
   * caller can open it straight away without waiting for the next snapshot
   * to say where it landed.
   */
  startDeliveryWork: (day: string, area_id: string) => Promise<Item>
  clockOn: (item_id: string) => Promise<void>
  clockOff: (sessionId: string) => Promise<void>
  /** Everything Save draft/Complete Workday changed beyond the item's own
   *  patch — its numbers, earnings, sessions, Vehicle link and road-cost
   *  Expenses — as one Postgres transaction. See `SaveWorkdayPayload`. */
  commitWorkday: (payload: SaveWorkdayPayload) => Promise<void>
}

export function moneyActions(owner: string, write: Write): MoneyActions {
  return {
  unspend: (item) => write(() => removeExpense(owner, item, new Date())),

  spend: (what) => write(() => recordExpense(owner, what)),

  saveTaxYear: (year) => write(() => saveTaxYear(owner, year)),

  saveCosts: (area_id, fuel_per_km, vehicle_per_km) =>
    write(() => saveRunningCosts(owner, area_id, fuel_per_km, vehicle_per_km)),

  saveVehicleCost: (vehicle_item_id, effective_from, vehicle_per_km) =>
    write(() => saveVehicleCostRate(owner, vehicle_item_id, effective_from, vehicle_per_km)),

  // A shift is made already processed: it is not something you found in
  // your pocket, it is a day you worked. So it goes in with its kind, its
  // day and its area, and never passes through the inbox — then its first
  // session starts immediately (through the same recovery path clockOn
  // uses below), so the tap that made the shift also starts it.
  //
  // The sequence itself — including what NotCached from `createShift` means
  // partway through it — is `runStartDeliveryWork`, tested on its own with
  // injected effects; this is that same function called with the real
  // writes. Its `recovered` flag means the session genuinely started but
  // this device could not keep a copy of the shift item: the shared `write`
  // already has a recovery path for exactly that, for every other write,
  // so it is reused here rather than invented again — a fresh NotCached,
  // thrown only after the result is captured, so `write`'s own resync runs
  // and this call still resolves with the real item. `anchor` is set on
  // every path that does not throw, which is the only way `write` can
  // resolve; the check below is a real guard, not a cast, for the path
  // that cannot happen but must never be assumed.
  startDeliveryWork: (day, area_id) => {
    let anchor: Item | null = null
    return write(async () => {
      const result = await runStartDeliveryWork(day, area_id, new Date(), {
        createShift: (d, a) => createShift(owner, d, a),
        startSessionSafely: (id, at) => startSessionSafely(owner, id, at),
      })
      anchor = result.item
      if (result.recovered) {
        throw new NotCached(result.item, 'the session started; only this device could not keep the shift')
      }
    }).then(() => {
      if (anchor === null) {
        throw new Error('Delivery work did not start: no confirmation reached this device.')
      }
      return anchor
    })
  },

  // Recoverable: a shift item can exist with no `shifts` row yet, especially
  // after a previous partial write, and starting a session straight onto
  // that would leave it invisible in the cache. Same path startDeliveryWork
  // uses, so the Start button inside the sheet recovers exactly the same way.
  clockOn: (item_id) => write(() => startSessionSafely(owner, item_id, new Date())),
  clockOff: (sessionId) => write(() => endShiftSession(owner, sessionId, new Date())),
  commitWorkday: (payload) => write(() => saveWorkdayAtomic(owner, payload)),
  }
}

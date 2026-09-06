// What the top of the Workday sheet shows, worked out from the draft rather
// than from what happens to be saved. Its own file, pulled out of
// ShiftSheet.tsx at the 300-line limit — the computation, not the markup.
//
// Split in three so the two expensive parts — the cost basis and the tax
// slice, each a scan over the whole account — are only worth redoing when
// what they actually depend on changes (the caller memoizes those two on
// the Vehicle used and the date), while the cheap part — one shift's own
// preview — is free to run on every keystroke, which is the whole point of it.

import {
  currentVehicleCostRateOf,
  fuelRateForVehicle,
  kilometres,
  minutesWorked,
  reserveFor,
  sliceOfYear,
  takeHome,
  vehicleLinkOf,
} from '../repository/items'
import type {
  Entity,
  Expense,
  FuelRate,
  Item,
  Link,
  Shift,
  Slice,
  TakeHome,
  TaxYearRow,
  VehicleCostRate,
  VehicleLink,
} from '../repository/items'
import type { CostBasis, Draft } from './draft'
import { previewShiftOf } from './draft'

/**
 * The Vehicle a Draft's cost basis and Live preview follow, now that the
 * Vehicle link is itself deferred to Save draft/Complete: a Draft follows
 * whatever is currently chosen in the form (never "ambiguous" — the draft
 * field is always none or one), Completed follows exactly what is actually
 * linked, frozen along with everything else about it.
 */
export function vehicleIdOf(
  item: Item,
  draft: Draft,
  completed: boolean,
  links: readonly Link[],
  entities: readonly Entity[],
): VehicleLink {
  if (completed) return vehicleLinkOf(links, entities, item.id, 'uses')
  return draft.vehicle_item_id === ''
    ? { kind: 'none' }
    : { kind: 'one', vehicleItemId: draft.vehicle_item_id, linkId: '' }
}

/** A stable primitive to key a memoized call on — `VehicleLink` is a fresh
 *  object every call, and comparing it by reference would recompute on
 *  every render even when nothing about it actually changed. */
export function vehicleKeyOf(vehicle: VehicleLink): string {
  return vehicle.kind === 'one' ? `one:${vehicle.vehicleItemId}` : vehicle.kind
}

export type CostBasisInfo = {
  fuelRate: FuelRate
  /** The Vehicle's own currently-applicable cost rate — never the Area's. */
  currentVehicleCost: number | null
  costBasis: CostBasis
}

/**
 * The cost basis a preview should use, and what `DrivingCostBasis` shows
 * alongside it — worked out once for whichever Vehicle is currently in play.
 *
 * Takes the Vehicle as an already-resolved `VehicleLink` rather than the
 * draft or the raw links it came from: the caller already resolved it
 * (`vehicleIdOf`), and reading only the primitive this actually depends on
 * is what lets a memoized call skip redoing this whenever some other field
 * of the draft changes instead.
 *
 * Both rates are the linked Vehicle's now, never the Area's: fuel from its
 * full-tank fill-ups, wear from its own effective-dated configuration — two
 * vehicles sharing an Area never share either, and an ambiguous or missing
 * Vehicle leaves both unknown rather than guessed.
 *
 * Completed uses exactly what the shift itself was pinned to, frozen; a
 * Draft uses the current rate for whichever Vehicle is currently chosen —
 * the same numbers `DrivingCostBasis` shows a Draft, never a stale one left
 * behind by fuel data or a configuration that has since moved on.
 */
export function costBasisOf(input: {
  shift: Shift
  completed: boolean
  vehicle: VehicleLink
  expenses: readonly Expense[]
  links: readonly Link[]
  entities: readonly Entity[]
  vehicleCostRates: readonly VehicleCostRate[]
  today: string
}): CostBasisInfo {
  const { shift, completed, vehicle } = input
  const vehicleItemId = vehicle.kind === 'one' ? vehicle.vehicleItemId : null
  const fuelRate = fuelRateForVehicle(input.expenses, input.links, input.entities, vehicleItemId)
  const currentVehicleCost = currentVehicleCostRateOf(input.vehicleCostRates, vehicleItemId, input.today)
  const costBasis: CostBasis = completed
    ? { fuel_per_km: shift.rate_fuel_per_km, vehicle_per_km: shift.rate_vehicle_per_km }
    : { fuel_per_km: fuelRate.perKm, vehicle_per_km: currentVehicleCost }
  return { fuelRate, currentVehicleCost, costBasis }
}

/**
 * The tax year slice the Draft's own date names.
 *
 * Follows the Draft's own date rather than whatever is still persisted, and
 * excludes this Workday itself from "what the year made before this": it is
 * not "before", it is added back in, once, as the preview's own gross and
 * costs. Counting it from the stale persisted row as well would tax the
 * same day twice the moment its date crosses a threshold.
 *
 * A blank date is never today's in disguise: an undated Draft has no known
 * position in a tax year, so the slice comes back unknown rather than
 * scanning the account against a date the owner has not actually said.
 */
export function sliceFor(input: {
  item: Item
  due: string
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  taxYears: readonly TaxYearRow[]
}): Slice {
  if (input.due === '') return { figures: null, income: null, beforePence: 0 }
  const othersItems = input.items.filter((candidate) => candidate.id !== input.item.id)
  return sliceOfYear({
    items: othersItems,
    shifts: input.shifts,
    expenses: input.expenses,
    taxYears: input.taxYears,
    from: input.due,
  })
}

export type LiveSummary = { sum: TakeHome; worked: number; km: number | null }

/**
 * What the live summary shows, from the shift, the draft and the two
 * already-worked-out pieces above. Cheap on purpose: this is the part meant
 * to run on every keystroke. The same `takeHome`/`kilometres`/`minutesWorked`
 * a persisted shift uses read the preview — there is no second formula.
 */
export function liveSummaryOf(
  shift: Shift,
  draft: Draft,
  costBasis: CostBasis,
  slice: Slice,
): LiveSummary {
  const preview = previewShiftOf(shift, draft, costBasis)
  const worked = minutesWorked(preview)
  const km = kilometres(preview)
  const sum = takeHome(preview, (profitPence) =>
    slice.figures === null || slice.income === null
      ? null
      : reserveFor(slice.figures, slice.income, slice.beforePence, profitPence),
  )
  return { sum, worked, km }
}

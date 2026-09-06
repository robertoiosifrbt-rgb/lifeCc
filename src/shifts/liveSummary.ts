// What the top of the Workday sheet shows, worked out from the draft rather
// than from what happens to be saved. Its own file, pulled out of
// ShiftSheet.tsx at the 300-line limit — the computation, not the markup.
//
// Split in three so the two expensive parts — the cost basis and the tax
// slice, each a scan over the whole account — are only worth redoing when
// what they actually depend on changes (the caller memoizes those two on
// the Area and the date), while the cheap part — one shift's own preview —
// is free to run on every keystroke, which is the whole point of it.

import {
  costsFor,
  fuelRateForArea,
  kilometres,
  minutesWorked,
  reserveFor,
  sliceOfYear,
  takeHome,
} from '../repository/items'
import type {
  Expense,
  FuelRate,
  Item,
  RunningCosts,
  Shift,
  Slice,
  TakeHome,
  TaxYearRow,
} from '../repository/items'
import type { CostBasis, Draft } from './draft'
import { previewShiftOf } from './draft'

/**
 * The Area a Draft's cost basis and Live preview follow.
 *
 * Completed always means the shift's own, already-settled Area — nothing
 * about a Completed workday is still moving. A Draft follows whatever the
 * form is currently showing, blank meaning none chosen yet.
 */
export function areaIdOf(item: Item, draft: Draft, completed: boolean): string | null {
  if (completed) return item.area_id
  return draft.area_id === '' ? null : draft.area_id
}

export type CostBasisInfo = { fuelRate: FuelRate; runningCosts: RunningCosts | null; costBasis: CostBasis }

/**
 * The cost basis a preview should use, and what `DrivingCostBasis` shows
 * alongside it — worked out once for whichever Area is currently in play.
 *
 * Takes the Area as a plain id rather than the draft it came from: the
 * caller already resolved it with `areaIdOf`, and reading only the one
 * primitive this actually depends on is what lets a memoized call skip
 * redoing this whenever some other field of the draft changes instead.
 *
 * Completed uses exactly what the shift itself was pinned to, frozen; a
 * Draft uses the Area's rate as it stands right now — the same number
 * `DrivingCostBasis` shows, never a stale one left behind by an Area (or
 * fuel data) that has since moved on.
 */
export function costBasisOf(input: {
  shift: Shift
  completed: boolean
  areaId: string | null
  items: readonly Item[]
  expenses: readonly Expense[]
  costs: readonly RunningCosts[]
}): CostBasisInfo {
  const { shift, completed, areaId } = input
  const fuelRate = fuelRateForArea(input.items, input.expenses, areaId)
  const runningCosts = costsFor(input.costs, areaId)
  const costBasis: CostBasis = completed
    ? { fuel_per_km: shift.rate_fuel_per_km, vehicle_per_km: shift.rate_vehicle_per_km }
    : { fuel_per_km: fuelRate.perKm, vehicle_per_km: runningCosts?.vehicle_per_km ?? null }
  return { fuelRate, runningCosts, costBasis }
}

/**
 * The tax year slice the Draft's own date names.
 *
 * Follows the Draft's own date rather than whatever is still persisted, and
 * excludes this Workday itself from "what the year made before this": it is
 * not "before", it is added back in, once, as the preview's own gross and
 * costs. Counting it from the stale persisted row as well would tax the
 * same day twice the moment its date crosses a threshold.
 */
export function sliceFor(input: {
  item: Item
  due: string
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  taxYears: readonly TaxYearRow[]
  today: string
}): Slice {
  const from = input.due === '' ? input.today : input.due
  const othersItems = input.items.filter((candidate) => candidate.id !== input.item.id)
  return sliceOfYear({
    items: othersItems,
    shifts: input.shifts,
    expenses: input.expenses,
    taxYears: input.taxYears,
    from,
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

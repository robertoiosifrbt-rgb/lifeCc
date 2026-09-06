// Everything ShiftSheet reads to show a Workday's numbers and decide whether
// Complete Workday is allowed — pulled out of ShiftSheet.tsx at the 300-line
// limit, the same reason liveSummary.ts itself was split out earlier. This is
// composition, not new logic: every real computation still lives in
// `liveSummary.ts`/`draftValidate.ts`/`repository/vehicle.ts`, memoized here
// exactly as it was inline.

import { useMemo } from 'react'

import { vehicleLinkOf, vehiclesOf } from '../repository/items'
import type {
  Entity,
  Expense,
  Item,
  Link,
  RunningCosts,
  Shift,
  TaxYearRow,
} from '../repository/items'
import type { Draft } from './draft'
import { validateCompletion } from './draftValidate'
import { areaIdOf, costBasisOf, liveSummaryOf, sliceFor } from './liveSummary'

export function useWorkdayComputations(input: {
  item: Item
  shift: Shift
  draft: Draft
  completed: boolean
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  costs: readonly RunningCosts[]
  taxYears: readonly TaxYearRow[]
  links: readonly Link[]
  things: readonly Entity[]
}) {
  const { item, shift, draft, completed } = input

  // The Vehicle used is a real link, not a draft field — it writes the
  // moment it is chosen, so both Draft and Completed simply read whatever
  // is actually linked to this Workday's own item right now.
  const vehicleLink = vehicleLinkOf(input.links, input.things, item.id)
  const vehicles = vehiclesOf(input.items, input.things)

  // The two expensive parts — each a scan over the whole account — only
  // redone when what they actually depend on changes: the Area, the Vehicle
  // (and the fuel data behind it), and the date.
  const areaId = areaIdOf(item, draft, completed)
  const { fuelRate, runningCosts, costBasis } = useMemo(
    () =>
      costBasisOf({
        shift,
        completed,
        areaId,
        vehicle: vehicleLink,
        expenses: input.expenses,
        links: input.links,
        entities: input.things,
        costs: input.costs,
      }),
    [shift, completed, areaId, vehicleLink, input.expenses, input.links, input.things, input.costs],
  )
  const slice = useMemo(
    () =>
      sliceFor({
        item,
        due: draft.due,
        items: input.items,
        shifts: input.shifts,
        expenses: input.expenses,
        taxYears: input.taxYears,
      }),
    [item, draft.due, input.items, input.shifts, input.expenses, input.taxYears],
  )
  const { sum, worked, km } = liveSummaryOf(shift, draft, costBasis, slice)

  // What Completed shows in "Driving cost basis": exactly what this shift
  // was pinned to, never today's Area/Vehicle rate — even after either has
  // since moved on.
  const pinnedBasis = completed
    ? { fuel_per_km: shift.rate_fuel_per_km, vehicle_per_km: shift.rate_vehicle_per_km }
    : null

  const completionErrors = completed
    ? []
    : validateCompletion({
        draft,
        shift,
        vehicle: vehicleLink,
        fuelPerKm: costBasis.fuel_per_km,
        vehiclePerKm: costBasis.vehicle_per_km,
        grossPence: sum.grossPence,
      })

  return { vehicleLink, vehicles, areaId, fuelRate, runningCosts, costBasis, sum, worked, km, pinnedBasis, completionErrors }
}

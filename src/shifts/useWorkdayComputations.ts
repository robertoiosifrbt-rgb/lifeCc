// Everything ShiftSheet reads to show a Workday's numbers and decide whether
// Complete Workday is allowed — pulled out of ShiftSheet.tsx at the 300-line
// limit, the same reason liveSummary.ts itself was split out earlier. This is
// composition, not new logic: every real computation still lives in
// `liveSummary.ts`/`draftValidate.ts`/`repository/vehicle.ts`, memoized here
// exactly as it was inline.

import { useMemo } from 'react'

import { vehiclesOf } from '../repository/items'
import type {
  Entity,
  Expense,
  Item,
  Link,
  Shift,
  TaxYearRow,
  VehicleCostRate,
} from '../repository/items'
import type { Draft } from './draft'
import { workdayDayOf } from './draft'
import { validateCompletion } from './draftValidate'
import { costBasisOf, liveSummaryOf, sliceFor, vehicleIdOf, vehicleKeyOf } from './liveSummary'

export function useWorkdayComputations(input: {
  item: Item
  shift: Shift
  draft: Draft
  completed: boolean
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  vehicleCostRates: readonly VehicleCostRate[]
  today: string
  taxYears: readonly TaxYearRow[]
  links: readonly Link[]
  things: readonly Entity[]
}) {
  const { item, shift, draft, completed } = input

  const vehicleLink = vehicleIdOf(item, draft, completed, input.links, input.things)
  const vehicleKey = vehicleKeyOf(vehicleLink)
  const vehicles = vehiclesOf(input.items, input.things)

  // The rate in force on the Workday's own day, not on whichever day it is
  // typed up, so a retrospective Draft's preview never disagrees with what
  // Complete Workday is actually about to pin.
  const asOf = workdayDayOf(item, draft, input.today)

  // The two expensive parts — each a scan over the whole account — only
  // redone when what they actually depend on changes: the Vehicle (and the
  // fuel/cost data behind it), and the date. `vehicleKey`, not `vehicleLink`
  // itself, is the dependency: a fresh object every render would defeat the
  // memo even when nothing it actually reads has changed.
  const { fuelRate, currentVehicleCost, costBasis } = useMemo(
    () =>
      costBasisOf({
        shift,
        completed,
        vehicle: vehicleLink,
        expenses: input.expenses,
        links: input.links,
        entities: input.things,
        vehicleCostRates: input.vehicleCostRates,
        asOf,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vehicleKey stands in for vehicleLink on purpose
    [shift, completed, vehicleKey, input.expenses, input.links, input.things, input.vehicleCostRates, asOf],
  )
  const slice = useMemo(
    () =>
      sliceFor({
        item,
        due: draft.due,
        items: input.items,
        shifts: input.shifts,
        expenses: input.expenses,
        links: input.links,
        taxYears: input.taxYears,
      }),
    [item, draft.due, input.items, input.shifts, input.expenses, input.links, input.taxYears],
  )
  const { sum, worked, km } = liveSummaryOf(shift, draft, costBasis, slice)

  // What Completed shows in "Driving cost basis": exactly what this shift
  // was pinned to, never today's Vehicle rate — even after either has since
  // moved on.
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

  return { vehicleLink, vehicles, fuelRate, currentVehicleCost, costBasis, sum, worked, km, pinnedBasis, completionErrors }
}

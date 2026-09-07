// ShiftSheet's own Props — split out at the 300-line limit.

import type {
  Area,
  Entity,
  Expense,
  Item,
  Link,
  Patch,
  PlatformRecord,
  SaveWorkdayPayload,
  Shift,
  TaxYearRow,
  VehicleCostRate,
} from '../repository/items'

export type Props = {
  item: Item
  shift: Shift | null
  areas: Area[]
  items: Item[]
  shifts: Shift[]
  expenses: Expense[]
  vehicleCostRates: VehicleCostRate[]
  platforms: PlatformRecord[]
  taxYears: TaxYearRow[]
  links: Link[]
  things: Entity[]
  today: string // Picks the Vehicle cost rate actually in force right now.
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onUpdateItem: (patch: Patch) => Promise<void>
  /** Everything else a Save draft/Complete Workday changed, in one
   *  transaction — see `SaveWorkdayPayload`. */
  onCommitWorkday: (payload: SaveWorkdayPayload) => Promise<void>
  onDelete: () => Promise<void>
  /** A new dated row for the Vehicle's own cost — never the Area's. */
  onSaveVehicleCost: (
    vehicle_item_id: string,
    effective_from: string,
    vehicle_per_km: number,
  ) => Promise<void>
  onClose: () => void
}

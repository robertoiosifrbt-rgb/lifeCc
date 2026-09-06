// ShiftSheet's own Props — split out at the 300-line limit.

import type {
  Area,
  Entity,
  Expense,
  Item,
  Link,
  LinkKind,
  Patch,
  Platform,
  PlatformRecord,
  RoadCostField,
  Shift,
  ShiftPatch,
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
  onDropSession: (sessionId: string) => Promise<void>
  onSaveShiftParts: (patch: ShiftPatch) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  /** Taking a platform's earning back — never a fake zero over it. */
  onRemoveEarning: (platform: Platform) => Promise<void>
  onSetPlatformPaid: (platform_item_id: string, amount: number) => Promise<void>
  onRemovePlatformEarning: (platform_item_id: string) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onUpdateItem: (patch: Patch) => Promise<void>
  onDelete: () => Promise<void>
  /** A new dated row for the Vehicle's own cost — never the Area's. */
  onSaveVehicleCost: (
    vehicle_item_id: string,
    effective_from: string,
    vehicle_per_km: number,
  ) => Promise<void>
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
  onSetRoadCost: (
    field: RoadCostField,
    amount: number,
    existingExpenseItemId: string | null,
    day: string,
  ) => Promise<void>
  onRemoveRoadCost: (expenseItem: Item) => Promise<void>
  onClose: () => void
}

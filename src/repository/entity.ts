// The shape of a thing that exists whether or not you do anything about it:
// a person, a company, a property, a car.
//
// One row per anchor item, like a shift's numbers. The name is the anchor's
// title, because a thing with two names would eventually disagree with itself.

import { asRecord, optionalDay, optionalNumber, optionalText, requiredText } from './row'

/** The four the owner named. A fifth is a migration, not a guess. */
export const ENTITY_KINDS = ['person', 'company', 'property', 'vehicle'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export const ENTITY_KIND_NAMES: Record<EntityKind, string> = {
  person: 'Person',
  company: 'Company',
  property: 'Property',
  vehicle: 'Vehicle',
}

/** What a vehicle burns. Only a vehicle has one. */
export const FUELS = ['petrol', 'diesel', 'electric', 'hybrid'] as const
export type Fuel = (typeof FUELS)[number]

export const FUEL_NAMES: Record<Fuel, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  electric: 'Electric',
  hybrid: 'Hybrid',
}

/**
 * The four dates that cost money when they pass unnoticed, in the order they
 * are asked about. Kept as one list so the screen and the warnings cannot
 * disagree about which dates matter.
 */
export const VEHICLE_DATES = [
  { key: 'mot_due', label: 'MOT' },
  { key: 'road_tax_due', label: 'Road tax' },
  { key: 'insurance_due', label: 'Insurance' },
  { key: 'service_due', label: 'Service' },
] as const

export type VehicleDate = (typeof VEHICLE_DATES)[number]['key']

export type Entity = {
  item_id: string
  owner: string
  entity_kind: EntityKind

  registration: string | null
  make: string | null
  model: string | null
  fuel: Fuel | null

  /** What the odometer read when you last looked. The car's own figure. */
  odo: number | null

  mot_due: string | null
  road_tax_due: string | null
  insurance_due: string | null
  service_due: string | null

  oil_changed_at: number | null
  oil_due_at: number | null
}

export type EntityPatch = Partial<Omit<Entity, 'item_id' | 'owner'>>

function fuelOf(raw: Record<string, unknown>): Fuel | null {
  const value = optionalText(raw, 'fuel')
  if (value === null) return null
  if (!(FUELS as readonly string[]).includes(value)) {
    throw new Error(`Unknown fuel: ${value}`)
  }
  return value as Fuel
}

export function entityFromRow(row: unknown): Entity {
  const raw = asRecord(row)

  const entity_kind = requiredText(raw, 'entity_kind')
  if (!(ENTITY_KINDS as readonly string[]).includes(entity_kind)) {
    throw new Error(`Unknown kind of thing: ${entity_kind}`)
  }

  const entity: Entity = {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    entity_kind: entity_kind as EntityKind,
    registration: optionalText(raw, 'registration'),
    make: optionalText(raw, 'make'),
    model: optionalText(raw, 'model'),
    fuel: fuelOf(raw),
    odo: optionalNumber(raw, 'odo'),
    mot_due: optionalDay(raw, 'mot_due'),
    road_tax_due: optionalDay(raw, 'road_tax_due'),
    insurance_due: optionalDay(raw, 'insurance_due'),
    service_due: optionalDay(raw, 'service_due'),
    oil_changed_at: optionalNumber(raw, 'oil_changed_at'),
    oil_due_at: optionalNumber(raw, 'oil_due_at'),
  }

  // The database says these belong to a vehicle and to nothing else, so a row
  // saying otherwise did not come from there as it stands.
  if (entity.entity_kind !== 'vehicle') {
    const carried = VEHICLE_ONLY.filter((key) => entity[key] !== null)
    if (carried.length > 0) {
      throw new Error(`A ${entity_kind} carrying ${carried.join(', ')}`)
    }
  }

  return entity
}

const VEHICLE_ONLY = [
  'registration',
  'make',
  'model',
  'fuel',
  'odo',
  'mot_due',
  'road_tax_due',
  'insurance_due',
  'service_due',
  'oil_changed_at',
  'oil_due_at',
] as const

/**
 * The dates a vehicle owes, soonest first, with how many days are left.
 *
 * Days rather than a formatted string: a screen decides how to say "in 3 days",
 * and a number can be compared. Past dates come back negative rather than
 * clamped — an MOT that expired eleven days ago is not the same as one due
 * today, and the screen has to be able to tell.
 */
export function dueOn(entity: Entity, today: string): {
  key: VehicleDate
  label: string
  day: string
  inDays: number
}[] {
  const now = Date.parse(`${today}T00:00:00Z`)
  const due = []
  for (const { key, label } of VEHICLE_DATES) {
    const day = entity[key]
    if (day === null) continue
    due.push({
      key,
      label,
      day,
      inDays: Math.round((Date.parse(`${day}T00:00:00Z`) - now) / 86400000),
    })
  }
  return due.sort((one, other) => one.inDays - other.inDays)
}

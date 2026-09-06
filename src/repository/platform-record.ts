// A Platform: an income source an owner drives for, as a record rather than
// a hardcoded name. A person's Uber Eats and someone else's local courier
// firm are both just a row here — adding one never touches application code.
//
// Named `PlatformRecord` rather than `Platform`: that name is already the
// legacy earning enum in `shift.ts` (`uber_eats`/`deliveroo`/`just_eat`/
// `other`), kept there untouched for the earnings a shift already has.
//
// The Company a Platform pays through is not a column here — it is an
// `about` Link to a Company Entity, the same generic relation everything
// else in Life Core already reuses. No parallel model.
//
// The rule fields below (earning cycle, payout, cash-out) are D2's to
// execute, not D1's: a single current row, exactly like every other settings
// extension in this schema, because nothing yet reads a past version of one
// — a Completed Workday's own money is pinned on the shift itself, never
// re-derived from a Platform's current configuration.

import type { Item } from './item'
import { asRecord, optionalNumber, optionalText, requiredText } from './row'

export const CASHOUT_FEE_TYPES = ['fixed', 'percent'] as const
export type CashoutFeeType = (typeof CASHOUT_FEE_TYPES)[number]

export type PlatformRecord = {
  item_id: string
  owner: string
  active: boolean
  display_order: number
  earning_cycle_kind: string | null
  earning_cycle_starts_on: string | null
  payout_schedule: string | null
  cashout_enabled: boolean
  cashout_settlement: string | null
  cashout_fee_type: CashoutFeeType | null
  cashout_fee_value: number | null
}

export type PlatformPatch = Partial<Omit<PlatformRecord, 'item_id' | 'owner'>>

function requiredBoolean(raw: Record<string, unknown>, key: string): boolean {
  const value = raw[key]
  if (typeof value !== 'boolean') throw new Error(`Row without a real ${key}`)
  return value
}

function requiredInteger(raw: Record<string, unknown>, key: string): number {
  const value = optionalNumber(raw, key)
  if (value === null || !Number.isInteger(value)) throw new Error(`Row without a real ${key}`)
  return value
}

function feeTypeOf(raw: Record<string, unknown>): CashoutFeeType | null {
  const value = optionalText(raw, 'cashout_fee_type')
  if (value === null) return null
  if (!(CASHOUT_FEE_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Unknown cash-out fee type: ${value}`)
  }
  return value as CashoutFeeType
}

export function platformRecordFromRow(row: unknown): PlatformRecord {
  const raw = asRecord(row)
  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    active: requiredBoolean(raw, 'active'),
    display_order: requiredInteger(raw, 'display_order'),
    earning_cycle_kind: optionalText(raw, 'earning_cycle_kind'),
    earning_cycle_starts_on: optionalText(raw, 'earning_cycle_starts_on'),
    payout_schedule: optionalText(raw, 'payout_schedule'),
    cashout_enabled: requiredBoolean(raw, 'cashout_enabled'),
    cashout_settlement: optionalText(raw, 'cashout_settlement'),
    cashout_fee_type: feeTypeOf(raw),
    cashout_fee_value: optionalNumber(raw, 'cashout_fee_value'),
  }
}

/** Every Platform the owner can currently pick, active first, in display order. */
export function orderedPlatformsOf(
  platforms: readonly PlatformRecord[],
): PlatformRecord[] {
  return [...platforms].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.display_order - b.display_order
  })
}

export type NamedPlatform = { itemId: string; name: string }

/**
 * Every active Platform, named from its own anchor — the same
 * item-plus-extension resolution `vehiclesOf` already does for Vehicles —
 * plus any Platform an earning on this Workday already names even if it has
 * since been deactivated. Deactivating a Platform hides it from new picks;
 * it must never make an existing earning vanish from the sheet.
 */
export function namedPlatformsFor(
  items: readonly Item[],
  platforms: readonly PlatformRecord[],
  alsoInclude: readonly string[],
): NamedPlatform[] {
  const wanted = new Set(alsoInclude)
  for (const platform of platforms) {
    if (platform.active) wanted.add(platform.item_id)
  }
  const byId = new Map(platforms.map((platform) => [platform.item_id, platform]))
  return orderedPlatformsOf([...wanted].flatMap((id) => byId.get(id) ?? []))
    .flatMap((platform) => {
      const item = items.find((candidate) => candidate.id === platform.item_id && candidate.deleted_at === null)
      return item === undefined ? [] : [{ itemId: platform.item_id, name: item.title }]
    })
}

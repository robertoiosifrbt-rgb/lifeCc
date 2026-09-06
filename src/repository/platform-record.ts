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
// `PlatformRecord` itself is identity only (active, ordering) — the rule
// fields (earning cycle, payout, cash-out) live in `platform_rules`,
// effective-dated the same way `vehicle_cost_rates` is: a rule changed today
// must not rewrite what applied on an earlier date. D2 is what actually
// executes them; this is only the data foundation.

import type { Item } from './item'
import { asRecord, optionalDay, optionalNumber, optionalText, requiredText, stampsOf } from './row'
import type { Row } from './row'

export const CASHOUT_FEE_TYPES = ['fixed', 'percent'] as const
export type CashoutFeeType = (typeof CASHOUT_FEE_TYPES)[number]

export type PlatformRecord = {
  item_id: string
  owner: string
  active: boolean
  display_order: number
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

export function platformRecordFromRow(row: unknown): PlatformRecord {
  const raw = asRecord(row)
  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    active: requiredBoolean(raw, 'active'),
    display_order: requiredInteger(raw, 'display_order'),
  }
}

/**
 * One Platform's rule configuration as it stood from a given date —
 * earning cycle, payout schedule, cash-out behaviour — never a second
 * mutable row a later change could rewrite history through. Effective-dated
 * the same way `VehicleCostRate` is.
 */
export type PlatformRule = Omit<Row, 'id'> & {
  platform_item_id: string
  effective_from: string
  earning_cycle_kind: string | null
  earning_cycle_starts_on: string | null
  payout_schedule: string | null
  cashout_enabled: boolean
  cashout_settlement: string | null
  cashout_fee_type: CashoutFeeType | null
  cashout_fee_value: number | null
}

export type PlatformRulePatch = Partial<
  Omit<PlatformRule, 'platform_item_id' | 'effective_from' | keyof Row>
>

function feeTypeOf(raw: Record<string, unknown>): CashoutFeeType | null {
  const value = optionalText(raw, 'cashout_fee_type')
  if (value === null) return null
  if (!(CASHOUT_FEE_TYPES as readonly string[]).includes(value)) {
    throw new Error(`Unknown cash-out fee type: ${value}`)
  }
  return value as CashoutFeeType
}

export function platformRuleFromRow(row: unknown): PlatformRule {
  const raw = asRecord(row)
  const effective_from = optionalDay(raw, 'effective_from')
  if (effective_from === null) throw new Error('A platform rule without an effective date')
  return {
    platform_item_id: requiredText(raw, 'platform_item_id'),
    owner: requiredText(raw, 'owner'),
    effective_from,
    earning_cycle_kind: optionalText(raw, 'earning_cycle_kind'),
    earning_cycle_starts_on: optionalText(raw, 'earning_cycle_starts_on'),
    payout_schedule: optionalText(raw, 'payout_schedule'),
    cashout_enabled: requiredBoolean(raw, 'cashout_enabled'),
    cashout_settlement: optionalText(raw, 'cashout_settlement'),
    cashout_fee_type: feeTypeOf(raw),
    cashout_fee_value: optionalNumber(raw, 'cashout_fee_value'),
    ...stampsOf(raw),
  }
}

/**
 * The rule actually in force for a Platform on a given day — the newest row
 * whose `effective_from` has already arrived, never one that has not taken
 * effect yet and never a soft-deleted (invalidated) one. The same "current"
 * definition `currentVehicleCostRateOf` already uses for Vehicle wear.
 */
export function currentPlatformRuleOf(
  rules: readonly PlatformRule[],
  platformItemId: string,
  today: string,
): PlatformRule | null {
  let best: PlatformRule | null = null
  for (const rule of rules) {
    if (rule.platform_item_id !== platformItemId) continue
    if (rule.deleted_at !== null) continue
    if (rule.effective_from > today) continue
    if (best === null || rule.effective_from > best.effective_from) best = rule
  }
  return best
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

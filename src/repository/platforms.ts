// Platforms, as the screens ask for them: the data foundation for
// configurable income sources. D2 executes payout/cash-out; this only reads
// and writes the record.

import { currentSession } from './auth'
import { fromRow as fromItemRow, localToday } from './item'
import type { Item, Patch } from './item'
import type { PlatformPatch, PlatformRecord, PlatformRule, PlatformRulePatch } from './platform-record'
import { platformRecordFromRow, platformRuleFromRow } from './platform-record'
import {
  supabasePlatformRules,
  supabasePlatformRuleWriter,
  supabasePlatforms,
  supabasePlatformWriter,
  supabaseRecordPlatform,
} from './platform-source'
import { platformStore } from './platform-store'
import { settingsStore } from './settings-store'
import { supabaseWriter } from './source'
import { store } from './store'
import { softDelete } from './write'

const ITEMS = 'items'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Reads every Platform, and every rule it has ever had, from the server. */
export async function syncPlatforms(owner: string): Promise<void> {
  const [rows, rules] = await Promise.all([supabasePlatforms(), supabasePlatformRules()])
  await platformStore.replaceAll(owner, rows.map(platformRecordFromRow))
  await settingsStore.replacePlatformRules(owner, rules.map(platformRuleFromRow))
}

export async function platformsOf(owner: string): Promise<PlatformRecord[]> {
  await requireAccount(owner)
  return platformStore.readAll(owner)
}

/** Every rule a Platform has ever had, every effective date — not just the
 *  one in force today. */
export async function platformRulesOf(owner: string): Promise<PlatformRule[]> {
  await requireAccount(owner)
  return settingsStore.platformRules(owner)
}

/**
 * A new Platform, written down.
 *
 * Its anchor carries no date, the same reason a Vehicle's does not: a
 * Platform is not an event, it is a thing an owner sets up once and reuses.
 *
 * One RPC, not two separate inserts: the anchor and its extension are written
 * in the same transaction, so a connection dropped between them can never
 * leave an orphan `items` row of kind='platform' with nothing behind it.
 */
export async function recordPlatform(owner: string, title: string): Promise<Item> {
  await requireAccount(owner)
  const anchor = fromItemRow(await supabaseRecordPlatform(title))
  await store.upsert(owner, [anchor], null)
  await syncPlatforms(owner)
  return anchor
}

/** What is known about a Platform's identity — active flag, ordering. The
 *  rule fields live in `platform_rules`; see `savePlatformRule`. */
export async function savePlatform(
  owner: string,
  platform: PlatformRecord,
  patch: PlatformPatch,
): Promise<void> {
  await requireAccount(owner)
  await supabasePlatformWriter(owner).save({ ...platform, ...patch })
  await syncPlatforms(owner)
}

/**
 * A Platform's rule configuration, from this date on.
 *
 * A new row, not an overwrite — `effective_from` defaults to today unless
 * the caller names an earlier date to correct, so a rule set once already
 * stands for every day it actually applied to. D2's to actually execute;
 * this only ever writes the record.
 */
export async function savePlatformRule(
  owner: string,
  platform_item_id: string,
  effective_from: string,
  patch: PlatformRulePatch,
): Promise<void> {
  await requireAccount(owner)
  await supabasePlatformRuleWriter(owner).save({ platform_item_id, effective_from, ...patch })
  await syncPlatforms(owner)
}

/**
 * A Platform written down by mistake.
 *
 * Its historical earnings are not destroyed: `shift_earnings.platform_item_id`
 * only cascades on a hard delete of the anchor, and this soft-deletes it —
 * exactly the same rule "deactivate" already relies on, just permanent. Its
 * extension row goes outright, the same as an Entity's does.
 */
export async function removePlatform(owner: string, item: Item, now: Date): Promise<void> {
  await requireAccount(owner)
  await supabasePlatformWriter(owner).remove(item.id)
  const gone = await softDelete(supabaseWriter<Patch>(ITEMS, owner), item, now, localToday(now))
  await store.upsert(owner, [gone], null)
  await syncPlatforms(owner)
}

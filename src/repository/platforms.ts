// Platforms, as the screens ask for them: the data foundation for
// configurable income sources. D2 executes payout/cash-out; this only reads
// and writes the record.

import { currentSession } from './auth'
import { fromRow as fromItemRow, localToday } from './item'
import type { Item, Patch } from './item'
import type { PlatformPatch, PlatformRecord } from './platform-record'
import { platformRecordFromRow } from './platform-record'
import { supabasePlatforms, supabasePlatformWriter } from './platform-source'
import { platformStore } from './platform-store'
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

/** Reads every Platform from the server and puts it in the cache. */
export async function syncPlatforms(owner: string): Promise<void> {
  const rows = (await supabasePlatforms()).map(platformRecordFromRow)
  await platformStore.replaceAll(owner, rows)
}

export async function platformsOf(owner: string): Promise<PlatformRecord[]> {
  await requireAccount(owner)
  return platformStore.readAll(owner)
}

/**
 * A new Platform, written down.
 *
 * Its anchor carries no date, the same reason a Vehicle's does not: a
 * Platform is not an event, it is a thing an owner sets up once and reuses.
 */
export async function recordPlatform(owner: string, title: string): Promise<Item> {
  await requireAccount(owner)
  const anchor = fromItemRow(
    await supabaseWriter<Patch>(ITEMS, owner).insert({
      title,
      kind: 'platform',
      state: 'active',
      area_id: null,
    }),
  )
  await supabasePlatformWriter(owner).save({ item_id: anchor.id })
  await store.upsert(owner, [anchor], null)
  await syncPlatforms(owner)
  return anchor
}

/** What is known about a Platform — active flag, ordering, D2's rule fields. */
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

// The core, as the screens ask for it: the things, and the arrows between
// them.
//
// One module for both because nothing ever wants one without the other. An
// arrow whose far end you cannot name is not worth drawing, and a thing with
// no arrows is a row in a list nobody visits.

import { currentSession } from './auth'
import { supabaseCore, supabaseEntityWriter, supabaseLinkWriter } from './core-source'
import { entityStore, linkStore } from './core-store'
import { entityFromRow } from './entity'
import type { Entity, EntityKind, EntityPatch } from './entity'
import { fromRow as fromItemRow, localToday } from './item'
import type { Item, Patch } from './item'
import { linkFromRow } from './link'
import type { Link, LinkKind } from './link'
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

/** Reads every thing and every arrow from the server, and caches both. */
export async function syncCore(owner: string): Promise<void> {
  const fetched = await supabaseCore()
  await entityStore.replaceAll(owner, fetched.entities.map(entityFromRow))
  await linkStore.replaceAll(owner, fetched.links.map(linkFromRow))
}

export async function thingsOf(owner: string): Promise<Entity[]> {
  await requireAccount(owner)
  return entityStore.readAll(owner)
}

export async function linksOf(owner: string): Promise<Link[]> {
  await requireAccount(owner)
  return linkStore.readAll(owner)
}

/**
 * A thing, written down.
 *
 * The anchor carries no date, and that is the difference between this and
 * every other anchor the app makes. A shift happened on a day and an expense
 * left on a day; a car is not an event. Law 6 still holds — it is found on the
 * Things screen, which is where it lives — so this is not a row without a
 * place, it is a row whose place is not the calendar.
 */
export async function recordThing(
  owner: string,
  what: { kind: EntityKind; title: string; area_id: string | null },
): Promise<Item> {
  await requireAccount(owner)
  const anchor = fromItemRow(
    await supabaseWriter<Patch>(ITEMS, owner).insert({
      title: what.title,
      kind: 'entity',
      state: 'active',
      area_id: what.area_id,
    }),
  )
  await supabaseEntityWriter(owner).save({
    item_id: anchor.id,
    entity_kind: what.kind,
  })
  await store.upsert(owner, [anchor], null)
  await syncCore(owner)
  return anchor
}

/**
 * What is known about a thing. Creates the row if it somehow has none.
 *
 * The whole patch goes, not the changed fields: an entity has no version of
 * its own and rides its anchor, so there is nothing here for two devices to
 * disagree over field by field — the anchor's version is where that argument
 * is had.
 */
export async function saveThing(
  owner: string,
  entity: Entity,
  patch: EntityPatch,
): Promise<void> {
  await requireAccount(owner)
  await supabaseEntityWriter(owner).save({ ...entity, ...patch })
  await syncCore(owner)
}

/**
 * A thing written down by mistake.
 *
 * Its arrows go with it, and not by this code: both ends of a link are
 * composite keys to the anchor with `on delete cascade`, so the database is
 * what removes them. Doing it here as well would be a second answer to a
 * question that already has one.
 */
export async function removeThing(owner: string, item: Item, now: Date): Promise<void> {
  await requireAccount(owner)
  await supabaseEntityWriter(owner).remove(item.id)
  const gone = await softDelete(
    supabaseWriter<Patch>(ITEMS, owner),
    item,
    now,
    localToday(now),
  )
  await store.upsert(owner, [gone], null)
  await syncCore(owner)
}

/**
 * An arrow, drawn.
 *
 * Both anchors are stamped by the database, so the version of each grows and
 * the items delta carries the news to the other device. That is why the items
 * are pulled again here and not only the links: without it this device shows
 * the arrow and the anchors still claim their old version, and the next delta
 * would hand them back unchanged.
 */
export async function link(
  owner: string,
  from_id: string,
  to_id: string,
  kind: LinkKind,
): Promise<void> {
  await requireAccount(owner)
  if (from_id === to_id) throw new Error('A thing cannot point at itself.')
  await supabaseLinkWriter(owner).add({ from_id, to_id, kind })
  await syncCore(owner)
}

/** An arrow, rubbed out. Gone outright: there is nothing to keep. */
export async function unlink(owner: string, id: string): Promise<void> {
  await requireAccount(owner)
  await supabaseLinkWriter(owner).remove(id)
  await syncCore(owner)
}

// The shape of an area: a name, and the area it hangs under.
//
// The field names are the column names, like everywhere else in the
// repository. A second vocabulary for the same thing is a place for mistakes
// to hide.

import { asRecord, optionalText, requiredText, stampsOf } from './row'
import type { Row } from './row'

export type Area = Row & {
  /** Null is a root. Business has no parent; MultiApp Delivery has one. */
  parent_id: string | null
  name: string
}

/**
 * What a client is allowed to change.
 *
 * Exactly the column list in `grant update` — id, owner, version, created_at
 * and updated_at are absent because the database refuses them anyway. Here
 * the type refuses them earlier.
 */
export type AreaPatch = Partial<Pick<Area, 'name' | 'parent_id' | 'deleted_at'>>

/**
 * An area row, checked exactly as the database checks it.
 *
 * The same function decides whether a cached area is worth keeping, so a
 * check that lets a broken row through declares the cache good, the rebuild
 * never runs, and the row goes on to break the tree somewhere far from here.
 */
export function fromRow(row: unknown): Area {
  const raw = asRecord(row)

  const id = requiredText(raw, 'id')
  const name = requiredText(raw, 'name')
  if (name.trim() === '') throw new Error('Area named nothing but spaces')

  const parent_id = optionalText(raw, 'parent_id')
  // The one-hop loop, refused by a check constraint in the database and
  // therefore refused here too: a row carrying it did not come from there.
  if (parent_id === id) throw new Error(`Area ${id} is its own parent`)

  return {
    id,
    owner: requiredText(raw, 'owner'),
    parent_id,
    name,
    ...stampsOf(raw),
  }
}

/**
 * The areas of a tree, deepest path first, each with how deep it sits.
 *
 * The screens need the tree as a list they can render in order, and walking
 * it is the kind of thing that gets written three slightly different ways if
 * it is not written once. Deleted areas are left out, and so is anything that
 * hangs under one: an area whose parent is gone has nowhere to be shown.
 *
 * A row whose parent is missing from the list is dropped rather than raised to
 * the root. Silently reparenting is how a tree starts lying about itself.
 */
export function treeOf(areas: readonly Area[]): { area: Area; depth: number }[] {
  const alive = areas.filter((area) => area.deleted_at === null)
  const children = new Map<string | null, Area[]>()
  for (const area of alive) {
    const siblings = children.get(area.parent_id) ?? []
    siblings.push(area)
    children.set(area.parent_id, siblings)
  }
  for (const siblings of children.values()) {
    siblings.sort((one, other) => one.name.localeCompare(other.name))
  }

  const ordered: { area: Area; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const area of children.get(parent) ?? []) {
      ordered.push({ area, depth })
      walk(area.id, depth + 1)
    }
  }
  walk(null, 0)
  return ordered
}

/**
 * The id itself, and everything living under it, at any depth.
 *
 * Read off the same walk that draws the tree rather than counted separately:
 * two ways of asking "what is under this" is how a warning ends up naming a
 * different number from the list it warns about, and the move picker ends up
 * offering a parent the cycle check would only refuse after a round trip.
 */
export function subtreeOf(areas: readonly Area[], id: string): string[] {
  const rows = treeOf(areas)
  const start = rows.findIndex((row) => row.area.id === id)
  if (start === -1) return [id]
  // The walk is depth first, so everything under an area sits right after it,
  // until the depth comes back to its own.
  const depth = rows[start]?.depth ?? 0
  const ids = [id]
  for (let at = start + 1; at < rows.length; at += 1) {
    if ((rows[at]?.depth ?? 0) <= depth) break
    ids.push(rows[at]!.area.id)
  }
  return ids
}

/** How many living areas hang under this one, at any depth. */
export function countUnder(areas: readonly Area[], id: string): number {
  return subtreeOf(areas, id).length - 1
}

/**
 * The one patch a settings save may send — name and parent together, in the
 * same version-checked write, never as two separate ones on the same row.
 * The second of two sequential writes would otherwise discard whichever
 * field the first one did not carry, and the sheet would have already closed
 * on it.
 *
 * `null` means the whole form is unsaveable: a blank name does not make the
 * function quietly drop just the name and save the parent anyway — that is
 * the same partial save by another route. The typed name stays right there
 * until it is either fixed or abandoned, same as `areas_name_not_blank` on
 * the write that actually reaches the database.
 */
export function settingsPatch(
  area: Area,
  name: string,
  parent_id: string | null,
): AreaPatch | null {
  const trimmed = name.trim()
  if (trimmed === '') return null
  const patch: AreaPatch = {}
  if (trimmed !== area.name) patch.name = trimmed
  if (parent_id !== area.parent_id) patch.parent_id = parent_id
  return patch
}

/** The path to an area, root first: 'Business › Self-employed › Delivery'. */
export function pathOf(areas: readonly Area[], id: string): string {
  const byId = new Map(areas.map((area) => [area.id, area]))
  const names: string[] = []
  let at = byId.get(id)
  // The database refuses cycles, and 64 is the depth it refuses beyond. This
  // stops at the same place rather than trusting that it did.
  for (let hops = 0; at !== undefined && hops <= 64; hops += 1) {
    names.unshift(at.name)
    at = at.parent_id === null ? undefined : byId.get(at.parent_id)
  }
  return names.join(' › ')
}

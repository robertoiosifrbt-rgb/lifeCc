// The Vehicle a Workday used, or a fuel Expense was for — resolved from the
// same Life Core primitive every other association already uses: a Link from
// the item to a Vehicle Entity's own anchor. No parallel model.
//
// The two callers mean different things by "linked to a Vehicle", so each
// names its own link kind explicitly rather than sharing one guessed default:
// a Workday's actual cost basis resolves only a `uses` link (never an
// unrelated `about` mention), while a fuel Expense's Vehicle stays `about` —
// see `link.ts` for why the two are kept apart.
//
// `links` has no constraint stopping a second link of the same kind to a
// different Vehicle from the same item, so "the" Vehicle is never assumed —
// it is resolved here, the same none/one/ambiguous shape `sessionControlsOf`
// already uses for open sessions, and an ambiguous result is never guessed
// into either side.

import type { Entity } from './entity'
import type { Expense } from './expense'
import { fillsOf } from './expense'
import { fuelRate } from './fuel'
import type { FuelRate } from './fuel'
import type { Item } from './item'
import type { Link, LinkKind } from './link'

export type VehicleLink =
  | { kind: 'none' }
  | { kind: 'one'; vehicleItemId: string; linkId: string }
  | { kind: 'ambiguous' }

function vehicleItemIds(entities: readonly Entity[]): Set<string> {
  return new Set(
    entities.filter((entity) => entity.entity_kind === 'vehicle').map((entity) => entity.item_id),
  )
}

/** The links of one given kind from an item to a Vehicle Entity — never any other kind. */
function vehicleLinksOf(
  links: readonly Link[],
  entities: readonly Entity[],
  itemId: string,
  linkKind: LinkKind,
): Link[] {
  const vehicles = vehicleItemIds(entities)
  return links.filter(
    (link) => link.kind === linkKind && link.from_id === itemId && vehicles.has(link.to_id),
  )
}

/** The one Vehicle an item points at with a link of this kind, or why there is no such thing. */
export function vehicleLinkOf(
  links: readonly Link[],
  entities: readonly Entity[],
  itemId: string,
  linkKind: LinkKind,
): VehicleLink {
  const found = vehicleLinksOf(links, entities, itemId, linkKind)
  const only = found[0]
  if (only === undefined) return { kind: 'none' }
  if (found.length > 1) return { kind: 'ambiguous' }
  return { kind: 'one', vehicleItemId: only.to_id, linkId: only.id }
}

/** Every link of this kind from an item to a Vehicle — for replacing them, not reading "the" one. */
export function vehicleLinkIdsOf(
  links: readonly Link[],
  entities: readonly Entity[],
  itemId: string,
  linkKind: LinkKind,
): string[] {
  return vehicleLinksOf(links, entities, itemId, linkKind).map((link) => link.id)
}

export type Vehicle = { itemId: string; name: string }

/** Every Vehicle Entity there is, named from its own anchor item. */
export function vehiclesOf(items: readonly Item[], entities: readonly Entity[]): Vehicle[] {
  return entities
    .filter((entity) => entity.entity_kind === 'vehicle')
    .flatMap((entity) => {
      const item = items.find(
        (candidate) => candidate.id === entity.item_id && candidate.deleted_at === null,
      )
      return item === undefined ? [] : [{ itemId: item.id, name: item.title }]
    })
}

/**
 * The fuel rate this Vehicle's fill-ups work out to, right now.
 *
 * Replaces `fuelRateForArea` outright: fuel is the Vehicle's, never the
 * Area's. Two vehicles in the same Area never share one fuel chain, because
 * each expense's own Vehicle link — not the Area it happened in — decides
 * which chain it belongs to; the same Vehicle keeps one chain no matter how
 * many Areas it has been used across, for the same reason. A fuel expense
 * whose own Vehicle link is missing or ambiguous is left out of every chain
 * rather than guessed into one — unknown, not assigned.
 */
export function fuelRateForVehicle(
  expenses: readonly Expense[],
  links: readonly Link[],
  entities: readonly Entity[],
  vehicleItemId: string | null,
): FuelRate {
  if (vehicleItemId === null) return fuelRate([])
  const mine = expenses.filter((expense) => {
    if (expense.category !== 'fuel') return false
    const own = vehicleLinkOf(links, entities, expense.item_id, 'about')
    return own.kind === 'one' && own.vehicleItemId === vehicleItemId
  })
  return fuelRate(fillsOf(mine))
}

// The writes to the core: the things, and the arrows between them.
//
// Declared here rather than in the hook for the same reason the money writes
// are: a handle that lists its actions in one file and implements them in
// another ends up promising something the hook does not return.

import {
  link as drawLink,
  recordThing,
  removeThing,
  saveThing,
  unlink as rubOutLink,
} from '../repository/items'
import type { Entity, EntityKind, EntityPatch, Item, LinkKind } from '../repository/items'

export type CoreActions = {
  addThing: (kind: EntityKind, title: string, area_id: string | null) => Promise<void>
  saveThing: (entity: Entity, patch: EntityPatch) => Promise<void>
  dropThing: (item: Item) => Promise<void>
  link: (from_id: string, to_id: string, kind: LinkKind) => Promise<void>
  unlink: (id: string) => Promise<void>
}

export function coreActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): CoreActions {
  return {
    addThing: (kind, title, area_id) =>
      write(() => recordThing(owner, { kind, title, area_id })),

    saveThing: (entity, patch) => write(() => saveThing(owner, entity, patch)),

    dropThing: (item) => write(() => removeThing(owner, item, new Date())),

    link: (from_id, to_id, kind) => write(() => drawLink(owner, from_id, to_id, kind)),

    unlink: (id) => write(() => rubOutLink(owner, id)),
  }
}

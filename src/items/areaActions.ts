// The writes to areas — split out of useItems.ts at the 300-line limit, the
// same reason coreActions/journalActions live on their own: a handle that
// lists its actions in one file and implements them in another ends up
// promising something the hook does not return.

import { createArea, discardArea, updateArea } from '../repository/items'
import type { Area, AreaPatch } from '../repository/items'

export type AreaActions = {
  addArea: (name: string, parent_id: string | null) => Promise<void>
  /** Name and parent together, in the one write a settings save may make. */
  saveArea: (area: Area, patch: AreaPatch) => Promise<void>
  dropArea: (area: Area) => Promise<void>
}

export function areaActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): AreaActions {
  return {
    addArea: (name, parent_id) => write(() => createArea(owner, name, parent_id)),

    saveArea: (area, patch) => write(() => updateArea(owner, area, patch)),

    dropArea: (area) => write(() => discardArea(owner, area, new Date())),
  }
}

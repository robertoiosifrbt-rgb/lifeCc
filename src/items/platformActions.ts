// The writes to Platforms — its own file for the same reason coreActions.ts
// is: a handle that lists its actions in one file and implements them in
// another ends up promising something the hook does not return.

import {
  recordPlatform as recordPlatformRow,
  removePlatform,
  savePlatform as savePlatformRow,
} from '../repository/items'
import type { Item, PlatformPatch, PlatformRecord } from '../repository/items'

export type PlatformActions = {
  addPlatform: (title: string) => Promise<void>
  savePlatform: (platform: PlatformRecord, patch: PlatformPatch) => Promise<void>
  dropPlatform: (item: Item) => Promise<void>
}

export function platformActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): PlatformActions {
  return {
    addPlatform: (title) => write(() => recordPlatformRow(owner, title)),

    savePlatform: (platform, patch) => write(() => savePlatformRow(owner, platform, patch)),

    dropPlatform: (item) => write(() => removePlatform(owner, item, new Date())),
  }
}

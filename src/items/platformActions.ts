// The writes to Platforms — its own file for the same reason coreActions.ts
// is: a handle that lists its actions in one file and implements them in
// another ends up promising something the hook does not return.

import {
  recordPlatform as recordPlatformRow,
  removePlatform,
  savePlatform as savePlatformRow,
  savePlatformRule as savePlatformRuleRow,
} from '../repository/items'
import type { Item, PlatformPatch, PlatformRecord, PlatformRulePatch } from '../repository/items'

export type PlatformActions = {
  addPlatform: (title: string) => Promise<void>
  savePlatform: (platform: PlatformRecord, patch: PlatformPatch) => Promise<void>
  /** A Platform's rule configuration, effective from a given date — never
   *  the Platform's own identity row (see `savePlatform`). */
  savePlatformRule: (
    platform_item_id: string,
    effective_from: string,
    patch: PlatformRulePatch,
  ) => Promise<void>
  dropPlatform: (item: Item) => Promise<void>
}

export function platformActions(
  owner: string,
  write: (body: () => Promise<unknown>) => Promise<void>,
): PlatformActions {
  return {
    addPlatform: (title) => write(() => recordPlatformRow(owner, title)),

    savePlatform: (platform, patch) => write(() => savePlatformRow(owner, platform, patch)),

    savePlatformRule: (platform_item_id, effective_from, patch) =>
      write(() => savePlatformRuleRow(owner, platform_item_id, effective_from, patch)),

    dropPlatform: (item) => write(() => removePlatform(owner, item, new Date())),
  }
}

// Where Platforms sit in the cache — same shape as entities/links: no
// cursor, replaced whole, because each rides the anchor it hangs off.

import type { PlatformRecord } from './platform-record'
import { platformRecordFromRow } from './platform-record'
import { wholeStore } from './core-store'
import { STORES } from './store'

export const platformStore = wholeStore<PlatformRecord>(
  STORES.PLATFORMS,
  platformRecordFromRow,
  (platform) => `The platform ${platform.item_id}`,
)

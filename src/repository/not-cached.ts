// Its own file so a repository module that needs to recognise one of these
// errors — delivery.ts and shifts.ts, to keep going on what a write already
// carries — can do so without importing the whole items.ts facade back into
// something items.ts itself pulls in, which is exactly the cycle that would
// make.

import type { Item } from './item'

/**
 * The write reached the server, and the cache would not take the row.
 *
 * It is not a failed write, and must never be shown as one. The row is on the
 * server; only the local copy is behind. Told "it did not work", you press
 * Save again — and Capture inserts a second row for a first one that was
 * already there.
 *
 * It carries the item so the screen can stop calling it unsaved, and ask for a
 * sync instead: the next delta brings the same row back, and the upsert is
 * idempotent.
 */
export class NotCached extends Error {
  readonly item: Item

  constructor(item: Item, reason: unknown) {
    super(
      `Saved, but this device could not keep a copy: ${
        reason instanceof Error ? reason.message : String(reason)
      }`,
    )
    this.name = 'NotCached'
    this.item = item
  }
}

/**
 * The same idea as `NotCached`, for a write with no `Item` of its own to
 * carry: a shift session is committed on the server by the time this can be
 * thrown, and only the full-shift-sync that normally follows it did not
 * complete on this device.
 *
 * Not a failed write, and must never be shown as one — told "it did not
 * work", clockOn's own recovery would start a second session on top of the
 * one that already began. Carries the shift's item id only, since that is
 * all `runStartSessionSafely` ever has in hand; the shared `write()` wrapper
 * treats it as a soft success, the same way it already does for
 * `NotCached` — a bumped sync round is the "later resync" this asks for,
 * not a second copy of the sync engine.
 */
export class SyncPending extends Error {
  readonly item_id: string

  constructor(item_id: string, reason: unknown) {
    super(
      `Saved, but this device could not refresh: ${
        reason instanceof Error ? reason.message : String(reason)
      }`,
    )
    this.name = 'SyncPending'
    this.item_id = item_id
  }
}

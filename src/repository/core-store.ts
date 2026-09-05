// Where the core's two tables sit in the cache.
//
// Apart from store.ts for the same reason settings-store.ts is: neither is a
// snapshot of a synced table. Both are replaced whole, with no cursor, because
// both ride the anchors they hang off — a changed entity or a new arrow
// arrives as a bumped version on an item, and the item delta carries that.

import type { Entity } from './entity'
import { entityFromRow } from './entity'
import type { Link } from './link'
import { linkFromRow } from './link'
import { completed, open, request, STORES } from './store'

const { ENTITIES, LINKS } = STORES

/**
 * One keeper, told which store it is for, how to read a row of it, and what to
 * call a row when it belongs to somebody else.
 *
 * Written once rather than twice, because the difference between entities and
 * links is what a row means, not how it is kept — the same reason storeFor
 * exists for items and areas.
 */
function wholeStore<T extends { owner: string }>(
  name: string,
  parse: (row: unknown) => T,
  describe: (row: T) => string,
) {
  return {
    async readAll(owner: string): Promise<T[]> {
      const opened = await open()
      const tx = opened.transaction(name, 'readonly')
      const rows: unknown = await request(
        tx.objectStore(name).index('owner').getAll(owner),
      )
      if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
      // Checked exactly like rows from the server: a cache written by an older
      // version must not enter half-formed.
      return rows.map(parse)
    },

    async replaceAll(owner: string, rows: readonly T[]): Promise<void> {
      for (const row of rows) {
        if (row.owner !== owner) {
          throw new Error(`${describe(row)} belongs to ${row.owner}, not to ${owner}`)
        }
      }
      const opened = await open()
      const tx = opened.transaction(name, 'readwrite')
      const store = tx.objectStore(name)
      const keys = await request(store.index('owner').getAllKeys(owner))
      for (const key of keys) store.delete(key)
      for (const row of rows) store.put(row)
      await completed(tx)
    },
  }
}

export const entityStore = wholeStore<Entity>(
  ENTITIES,
  entityFromRow,
  (entity) => `The thing ${entity.item_id}`,
)

export const linkStore = wholeStore<Link>(LINKS, linkFromRow, (link) => `Link ${link.id}`)

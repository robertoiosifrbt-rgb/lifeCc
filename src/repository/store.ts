// The cache: a complete snapshot of the user's rows, in IndexedDB, under
// namespace = auth.uid().
//
// It is never read without the currently authenticated user — otherwise
// signing out of A and into B would show, if only for a moment, A's data.
// That is why every method takes the owner instead of guessing it.

import { fromRow as fromAreaRow } from './area'
import type { Area } from './area'
import { fromRow as fromItemRow } from './item'
import type { Item } from './item'
import type { Row } from './row'
import type { Shift } from './shift'

export type Store<T extends Row> = {
  readAll(owner: string): Promise<T[]>
  cursor(owner: string): Promise<string | null>
  /**
   * Deletes everything this owner has and puts back exactly the given list.
   * Only a complete, successful snapshot has the right to do this.
   */
  replaceSnapshot(owner: string, rows: T[], cursor: string | null): Promise<void>
  /**
   * Adds or updates row by row. Deletes NOTHING.
   * `nextCursor === null` means "leave the cursor as it was".
   */
  upsert(owner: string, rows: T[], nextCursor: string | null): Promise<void>
}

const DB_NAME = 'life-control-centre'
// Two, because areas arrived: a second object store, and a cursor key that
// says which table it belongs to. The old cursors are dropped rather than
// converted — a missing cursor costs one full snapshot, and a converted one
// that is wrong costs rows that never arrive.
const DB_VERSION = 9
const ITEMS = 'items'
const AREAS = 'areas'
// The core's two: the things an item can point at, and the arrows themselves.
// Neither has a cursor — both ride the anchors they hang off, which is the
// strategy their migration declares.
const ENTITIES = 'entities'
const LINKS = 'links'
// The parts of a shift, one record per anchor. Not a synced table of its own:
// it has no cursor, because the anchor carries the news that it changed.
const SHIFTS = 'shifts'
const EXPENSES = 'expenses'
// The settings: one row per area, and one per tax year. No cursor either, and
// few enough to be fetched whole every time.
const COSTS = 'running_costs'
// One row per tax year, because the figures change every April and last
// year's bill must not move when this year's are set.
const TAX_YEARS = 'tax_years'
// The personal journal. No cursor either, for the same reason as entities: it
// rides the anchor that carries the news it changed.
const JOURNAL = 'journal_entries'
const CURSORS = 'cursors'

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB refused'))
  })
}

export function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'))
  })
}

export const STORES = { COSTS, ENTITIES, EXPENSES, JOURNAL, LINKS, TAX_YEARS }

let db: Promise<IDBDatabase> | null = null

export function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const opened = req.result
      for (const name of [ITEMS, AREAS]) {
        if (!opened.objectStoreNames.contains(name)) {
          const rows = opened.createObjectStore(name, { keyPath: 'id' })
          rows.createIndex('owner', 'owner', { unique: false })
        }
      }
      if (!opened.objectStoreNames.contains(SHIFTS)) {
        const shifts = opened.createObjectStore(SHIFTS, { keyPath: 'item_id' })
        shifts.createIndex('owner', 'owner', { unique: false })
      }
      if (!opened.objectStoreNames.contains(EXPENSES)) {
        const spent = opened.createObjectStore(EXPENSES, { keyPath: 'item_id' })
        spent.createIndex('owner', 'owner', { unique: false })
      }
      // The two typed percentages went when the year's own figures arrived.
      // Dropped rather than left behind: a store nothing writes to still gets
      // read by an old tab, and would answer with last week's answer.
      if (opened.objectStoreNames.contains('reserves')) {
        opened.deleteObjectStore('reserves')
      }
      if (!opened.objectStoreNames.contains(TAX_YEARS)) {
        const years = opened.createObjectStore(TAX_YEARS, {
          keyPath: ['owner', 'tax_year'],
        })
        years.createIndex('owner', 'owner', { unique: false })
      }
      if (!opened.objectStoreNames.contains(COSTS)) {
        const costs = opened.createObjectStore(COSTS, { keyPath: 'area_id' })
        costs.createIndex('owner', 'owner', { unique: false })
      }
      if (!opened.objectStoreNames.contains(ENTITIES)) {
        const things = opened.createObjectStore(ENTITIES, { keyPath: 'item_id' })
        things.createIndex('owner', 'owner', { unique: false })
      }
      // Keyed by the link's own id, not by either end: an item has many
      // arrows, and both ends are wanted as an index, not as a key.
      if (!opened.objectStoreNames.contains(LINKS)) {
        const arrows = opened.createObjectStore(LINKS, { keyPath: 'id' })
        arrows.createIndex('owner', 'owner', { unique: false })
      }
      if (!opened.objectStoreNames.contains(JOURNAL)) {
        const journal = opened.createObjectStore(JOURNAL, { keyPath: 'item_id' })
        journal.createIndex('owner', 'owner', { unique: false })
      }
      if (opened.objectStoreNames.contains(CURSORS)) {
        opened.deleteObjectStore(CURSORS)
      }
      opened.createObjectStore(CURSORS, { keyPath: ['table', 'owner'] })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB did not open'))
  })
  return db
}

/** The version of a row already in the cache, or null if there is none. */
function versionOf(row: unknown): number | null {
  if (typeof row !== 'object' || row === null) return null
  const version = (row as Record<string, unknown>)['version']
  return typeof version === 'number' ? version : null
}

/**
 * Writes a row unless the cache already holds a newer one.
 *
 * A sync and a write can be in flight at once, and nothing serialises them: a
 * delta fetched at version 4 can land after a write has already cached version
 * 5. Without this, the screen falls back to the older row until the next sync
 * — which reads exactly like the app eating what you just typed, on an app
 * that has in fact lost nothing.
 *
 * The version is written by the database trigger, never by a client, so it is
 * the one number here worth trusting.
 *
 * The read is issued inside the same transaction and the put is issued from
 * its success handler, not after an await: a transaction stays alive while
 * requests keep chaining off one another, and dies if the turn ends first.
 */
function putIfNotOlder(store: IDBObjectStore, row: Row): void {
  const existing = store.get(row.id)
  existing.onsuccess = () => {
    const held = versionOf(existing.result)
    if (held === null || held <= row.version) store.put(row)
  }
}

/** Another user's row has no business in this namespace. */
function assertOwner(owner: string, rows: readonly Row[]) {
  for (const row of rows) {
    if (row.owner !== owner) {
      throw new Error(`Row ${row.id} belongs to ${row.owner}, not to ${owner}`)
    }
  }
}

async function write(
  table: string,
  owner: string,
  rows: readonly Row[],
  nextCursor: string | null,
  clear: boolean,
): Promise<void> {
  assertOwner(owner, rows)
  const opened = await open()
  const tx = opened.transaction([table, CURSORS], 'readwrite')
  const store = tx.objectStore(table)

  if (clear) {
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const row of rows) store.put(row)
  } else {
    for (const row of rows) putIfNotOlder(store, row)
  }

  if (nextCursor !== null || clear) {
    tx.objectStore(CURSORS).put({ table, owner, cursor: nextCursor })
  }

  await completed(tx)
}

/**
 * One adapter, told which table it is for and how to read a row of it.
 *
 * Items and areas differ in what a row means, not in how a snapshot is kept,
 * so the keeping is written once. Each gets its own object store and its own
 * cursor, because they travel by separate deltas.
 */
function storeFor<T extends Row>(
  table: string,
  parse: (row: unknown) => T,
): Store<T> {
  return {
    async readAll(owner) {
      const opened = await open()
      const tx = opened.transaction(table, 'readonly')
      const rows: unknown = await request(
        tx.objectStore(table).index('owner').getAll(owner),
      )
      if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
      // Rows from the cache are checked exactly like rows from the server. A
      // cache written by an older version must not enter half-formed.
      return rows.map(parse)
    },

    async cursor(owner) {
      const opened = await open()
      const tx = opened.transaction(CURSORS, 'readonly')
      const row: unknown = await request(tx.objectStore(CURSORS).get([table, owner]))
      if (typeof row !== 'object' || row === null) return null
      const cursor = (row as Record<string, unknown>)['cursor']
      return typeof cursor === 'string' ? cursor : null
    },

    replaceSnapshot: (owner, rows, cursor) => write(table, owner, rows, cursor, true),

    upsert: (owner, rows, nextCursor) =>
      write(table, owner, rows, nextCursor, false),
  }
}

export const store: Store<Item> = storeFor(ITEMS, fromItemRow)
export const areaStore: Store<Area> = storeFor(AREAS, fromAreaRow)

/**
 * The parts of every shift this account has, kept whole.
 *
 * There is no upsert and no cursor here on purpose. The parts of a shift are
 * never asked for on their own — only ever as "the parts of this anchor" — so
 * they are replaced wholesale, which is exactly the strategy the migration
 * declares. What tells you a shift changed is its anchor's version, and that
 * travels in the items delta.
 */
export const shiftStore = {
  async readAll(owner: string): Promise<Shift[]> {
    const opened = await open()
    const tx = opened.transaction(SHIFTS, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(SHIFTS).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as Shift[]
  },

  async replaceAll(owner: string, shifts: readonly Shift[]): Promise<void> {
    for (const shift of shifts) {
      if (shift.owner !== owner) {
        throw new Error(`Shift ${shift.item_id} belongs to ${shift.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(SHIFTS, 'readwrite')
    const store = tx.objectStore(SHIFTS)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const shift of shifts) store.put(shift)
    await completed(tx)
  },
}

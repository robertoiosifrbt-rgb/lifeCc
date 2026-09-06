import { useCallback, useEffect, useState } from 'react'

import {
  capture as captureItem,
  isItemConflict,
  discard as discardItem,
  exportAll,
  NotCached,
  syncAccount,
  update as updateItem,
} from '../repository/items'
import {
  createArea,
  discardArea,
  updateArea,
} from '../repository/items'
import { coreActions } from './coreActions'
import type { CoreActions } from './coreActions'
import { journalActions } from './journalActions'
import type { JournalActions } from './journalActions'
import { moneyActions } from './moneyActions'
import type { MoneyActions } from './moneyActions'
import { readSnapshot } from './snapshot'
import type { Snapshot } from './snapshot'
import type {
  Area,
  AreaPatch,
  Entity,
  Item,
  JournalEntry,
  Link,
  Patch,
  Expense,
  RunningCosts,
  TaxYearRow,
  Shift,
} from '../repository/items'
import { downloadText } from '../ui/download'

/**
 * What the sync indicator is allowed to say.
 *
 * There is no state that means "synced" while it is not. A failure stays
 * visible with its reason, because the rows on screen then come from the cache
 * and may be stale.
 */
export type SyncState =
  | { kind: 'never' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: Date; fetched: number }
  | { kind: 'failed'; reason: string }

/** A patch that could not be written, kept visible until you retry it. */
export type Unsaved = { item: Item; patch: Patch; reason: string }

// The money writes are declared once, where they are written. Repeating them
// here is how a handle ends up promising something the hook does not return.
export type ItemsHandle = MoneyActions &
  CoreActions &
  JournalActions & {
  items: Item[]
  areas: Area[]
  shifts: Shift[]
  expenses: Expense[]
  costs: RunningCosts[]
  taxYears: TaxYearRow[]
  things: Entity[]
  links: Link[]
  journal: JournalEntry[]
  loading: boolean
  sync: SyncState
  unsaved: Unsaved[]
  resync: () => void
  capture: (title: string) => Promise<void>
  update: (item: Item, patch: Patch) => Promise<void>
  discard: (item: Item) => Promise<void>
  retry: (itemId: string) => Promise<void>
  download: () => Promise<void>
  addArea: (name: string, parent_id: string | null) => Promise<void>
  /** Name and parent together, in the one write a settings save may make. */
  saveArea: (area: Area, patch: AreaPatch) => Promise<void>
  dropArea: (area: Area) => Promise<void>
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The items of the signed-in account, and everything you can do to them.
 *
 * It reads the cache first so the screen paints straight away, then syncs and
 * reads it again. A failed sync leaves the cached rows alone — that is the
 * whole point of holding a snapshot.
 */
export function useItems(owner: string): ItemsHandle {
  const [items, setItems] = useState<Item[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [costs, setCosts] = useState<RunningCosts[]>([])
  const [taxYears, setTaxYears] = useState<TaxYearRow[]>([])
  const [things, setThings] = useState<Entity[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<SyncState>({ kind: 'never' })
  const [unsaved, setUnsaved] = useState<Unsaved[]>([])
  const [round, setRound] = useState(0)

  const apply = useCallback((snapshot: Snapshot) => {
    setItems(snapshot.items)
    setAreas(snapshot.areas)
    setShifts(snapshot.shifts)
    setExpenses(snapshot.expenses)
    setCosts(snapshot.costs)
    setTaxYears(snapshot.taxYears)
    setThings(snapshot.things)
    setLinks(snapshot.links)
    setJournal(snapshot.journal)
  }, [])

  const reload = useCallback(async () => {
    // Both, together: an item names an area, so a screen holding a fresh item
    // and a stale area list would show a row pointing nowhere.
    apply(await readSnapshot(owner))
  }, [owner, apply])

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const cached = await readSnapshot(owner)
        if (active) {
          apply(cached)
          setLoading(false)
        }
      } catch (error) {
        // An unreadable cache is not a reason to hide the app: the sync below
        // finds it unreadable too and takes a full snapshot, which replaces
        // every row. That is now true — it used to say so while sync happily
        // took the delta path and left the bad row where it was.
        console.warn('The cache could not be read:', error)
        if (active) setLoading(false)
      }

      if (active) setSync({ kind: 'syncing' })
      try {
        const result = await syncAccount(owner)
        const fresh = await readSnapshot(owner)
        if (active) {
          apply(fresh)
          setSync({ kind: 'synced', at: new Date(), fetched: result.fetched })
        }
      } catch (error) {
        if (active) setSync({ kind: 'failed', reason: reasonOf(error) })
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [owner, round, apply])

  /**
   * Runs a write, keeping an unresolved conflict visible instead of losing it.
   *
   * It always throws on. A conflict is recorded so the row stays marked
   * unsaved, but the caller still has to hear that the write did not happen —
   * a screen that closes on a resolved promise would tell you it saved when it
   * did not, and that is the one thing this system may not do.
   *
   * A failed write is not a failed sync, either. The snapshot can be perfectly
   * fresh while one write is refused, and a sync indicator that lies in one
   * direction is not believed in the other.
   */
  const write = useCallback(
    async (body: () => Promise<unknown>) => {
      try {
        await body()
      } catch (error) {
        // The server took it; only this device could not keep a copy. Saying
        // "it did not work" here is how Capture ends up inserting a second row
        // for a first one that is already there.
        if (error instanceof NotCached) {
          setUnsaved((left) => left.filter((u) => u.item.id !== error.item.id))
          setRound((n) => n + 1)
          return
        }
        if (isItemConflict(error)) {
          setUnsaved((left) => [
            ...left.filter((u) => u.item.id !== error.item.id),
            { item: error.item, patch: error.patch, reason: error.message },
          ])
        }
        throw error
      } finally {
        // A cache that cannot be read must not turn a write that worked into
        // an error on its way out. The sync rebuilds it; the screen keeps what
        // it already has until then.
        try {
          await reload()
        } catch (reason) {
          console.warn('The cache could not be read after a write:', reason)
        }
      }
    },
    [reload],
  )

  return {
    items,
    areas,
    shifts,
    expenses,
    costs,
    taxYears,
    things,
    links,
    journal,
    loading,
    sync,
    unsaved,

    resync: () => setRound((n) => n + 1),

    capture: (title) => write(() => captureItem(owner, title)),

    update: (item, patch) =>
      write(async () => {
        const written = await updateItem(owner, item, patch, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== item.id))
        return written
      }),

    discard: (item) =>
      write(async () => {
        const written = await discardItem(owner, item, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== item.id))
        return written
      }),

    retry: async (itemId) => {
      const stuck = unsaved.find((u) => u.item.id === itemId)
      if (stuck === undefined) return
      const fresh = items.find((i) => i.id === itemId) ?? stuck.item
      await write(async () => {
        const written = await updateItem(owner, fresh, stuck.patch, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== itemId))
        return written
      })
    },

    download: async () => {
      const file = await exportAll(owner, new Date())
      downloadText(file.name, file.contents)
    },

    // The area writes go through the same `write`: a conflict on an area is
    // still a write that did not happen, and the caller still has to hear it.
    ...moneyActions(owner, write),

    // The core writes go through the same `write` as everything else: an arrow
    // that did not get drawn is still a write the caller has to hear about.
    ...coreActions(owner, write),

    // Same for the journal: an entry that did not save is still unsaved.
    ...journalActions(owner, write),

    addArea: (name, parent_id) => write(() => createArea(owner, name, parent_id)),

    saveArea: (area, patch) => write(() => updateArea(owner, area, patch)),

    dropArea: (area) => write(() => discardArea(owner, area, new Date())),
  }
}

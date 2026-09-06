// Where the parts of a shift sit in the cache — split out of store.ts at the
// 300-line limit.
//
// There is no upsert and no cursor here on purpose. The parts of a shift are
// never asked for on their own — only ever as "the parts of this anchor" — so
// they are replaced wholesale, the same factory core-store.ts and
// journal-store.ts already share. What tells you a shift changed is its
// anchor's version, and that travels in the items delta.

import type { Shift } from './shift'
import { wholeStore } from './core-store'
import { STORES } from './store'

export const shiftStore = wholeStore<Shift>(
  STORES.SHIFTS,
  (row) => row as Shift,
  (shift) => `Shift ${shift.item_id}`,
)

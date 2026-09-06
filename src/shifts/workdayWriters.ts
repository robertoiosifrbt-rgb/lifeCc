// The WorkdayWriters ShiftSheet hands to saveWorkday — split out at the
// 300-line limit. Pure plumbing: each field here is one prop, renamed or
// wrapped just enough to match what saveWorkday actually calls.

import type {
  Item,
  LinkKind,
  Patch,
  Platform,
  RoadCostField,
  ShiftPatch,
} from '../repository/items'
import type { Draft } from './draft'
import type { WorkdayWriters } from './saveWorkday'

type WriterProps = {
  items: Item[]
  onUpdateItem: (patch: Patch) => Promise<void>
  onSaveShiftParts: (patch: ShiftPatch) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  onRemoveEarning: (platform: Platform) => Promise<void>
  onSetPlatformPaid: (platform_item_id: string, amount: number) => Promise<void>
  onRemovePlatformEarning: (platform_item_id: string) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
  onSetRoadCost: (
    field: RoadCostField,
    amount: number,
    existingExpenseItemId: string | null,
    day: string,
  ) => Promise<void>
  onRemoveRoadCost: (expenseItem: Item) => Promise<void>
}

/**
 * `onSetRoadCost` needs a day to create a fresh Expense against, when none
 * exists yet — the Workday's own date, typed or already saved, never
 * today's. `onRemoveRoadCost` takes a whole Item, not just an id, so the id
 * `saveWorkday` names is resolved against the cache here, once.
 */
export function workdayWritersFrom(props: WriterProps, item: Item, draft: Draft): WorkdayWriters {
  return {
    onUpdateItem: props.onUpdateItem,
    onSaveShiftParts: props.onSaveShiftParts,
    onSetPaid: props.onSetPaid,
    onRemoveEarning: props.onRemoveEarning,
    onSetPlatformPaid: props.onSetPlatformPaid,
    onRemovePlatformEarning: props.onRemovePlatformEarning,
    onSetBreak: props.onSetBreak,
    onDropSession: props.onDropSession,
    onLink: props.onLink,
    onUnlink: props.onUnlink,
    onSetRoadCost: (field, amount, existingExpenseItemId) =>
      props.onSetRoadCost(field, amount, existingExpenseItemId, draft.due !== '' ? draft.due : item.due ?? ''),
    onRemoveRoadCost: (expenseItemId) => {
      const found = props.items.find((candidate) => candidate.id === expenseItemId)
      return found === undefined ? Promise.resolve() : props.onRemoveRoadCost(found)
    },
  }
}

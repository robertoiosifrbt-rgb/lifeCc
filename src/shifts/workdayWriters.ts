// The WorkdayWriters ShiftSheet hands to saveWorkday — split out at the
// 300-line limit. Pure plumbing: each field here is one prop, renamed or
// wrapped just enough to match what saveWorkday actually calls.

import type { Patch, SaveWorkdayPayload } from '../repository/items'
import type { WorkdayWriters } from './saveWorkday'

type WriterProps = {
  onUpdateItem: (patch: Patch) => Promise<void>
  onCommitWorkday: (payload: SaveWorkdayPayload) => Promise<void>
}

export function workdayWritersFrom(props: WriterProps): WorkdayWriters {
  return {
    onUpdateItem: props.onUpdateItem,
    onCommit: props.onCommitWorkday,
  }
}

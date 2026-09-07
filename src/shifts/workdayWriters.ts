// The WorkdayWriters ShiftSheet hands to saveWorkday — split out at the
// 300-line limit. Pure plumbing: each field here is one prop, renamed or
// wrapped just enough to match what saveWorkday actually calls.

import type { SaveWorkdayPayload } from '../repository/items'
import type { WorkdayWriters } from './saveWorkday'

type WriterProps = {
  onCommitWorkday: (payload: SaveWorkdayPayload) => Promise<void>
}

export function workdayWritersFrom(props: WriterProps): WorkdayWriters {
  return {
    onCommit: props.onCommitWorkday,
  }
}

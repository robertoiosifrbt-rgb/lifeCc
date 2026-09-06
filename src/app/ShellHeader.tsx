import { Link } from 'react-router-dom'

import { syncLabel } from './syncLabel'
import type { SyncState } from '../items/useItems'
import './ShellHeader.css'

type Props = {
  title: string
  sync: SyncState
  onMore: () => void
}

/**
 * The normal global header: just the current context and a door to
 * everything else. Account email, sign-out, resync and export used to sit
 * here on every screen; they moved to Settings, reached through More.
 *
 * Sync trust does not disappear with them: a healthy sync earns no space
 * here, but a real problem still gets a compact, visible way back to where
 * it can be seen and retried.
 */
export function ShellHeader({ title, sync, onMore }: Props) {
  const label = syncLabel(sync)

  return (
    <header className="head">
      <div className="head-row">
        <h1 className="head-title">{title}</h1>
        <button className="head-button" type="button" name="more" onClick={onMore}>
          More
        </button>
      </div>

      {label.bad && (
        <Link className="head-sync-warn" to="/settings" title={label.text}>
          Sync problem — {label.text}
        </Link>
      )}
    </header>
  )
}

import { Link } from 'react-router-dom'

import { syncLabel } from './syncLabel'
import type { SyncState } from '../items/useItems'
import './ShellHeader.css'

type Props = {
  title: string
  /** The account you are in. Without it you cannot tell whose data is shown. */
  email: string | null
  sync: SyncState
  onResync: () => void
  onDownload: () => void
  onSignOut: () => void
  error: string | null
}

export function ShellHeader({
  title,
  email,
  sync,
  onResync,
  onDownload,
  onSignOut,
  error,
}: Props) {
  const label = syncLabel(sync)

  return (
    <header className="head">
      <div className="head-row">
        <h1 className="head-title">{title}</h1>
        <button className="head-button" type="button" name="sign-out" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      {email !== null && <p className="head-account">{email}</p>}

      <div className="head-row head-row-tools">
        <button
          className={`head-sync${label.bad ? ' head-sync-bad' : ''}`}
          type="button"
          name="resync"
          onClick={onResync}
          title="Sync again"
        >
          {label.text}
        </button>
        <button className="head-button" type="button" name="download" onClick={onDownload}>
          Download everything
        </button>
        {/* The way into the year. It used to be reachable only from a link
            under the month in the Calendar, and that block is not drawn at all
            for a month with no work in it — so a new year, or a quiet one, had
            no door to the screen that decides what every other number on the
            app means. */}
        <Link className="head-button" to="/hmrc">
          HMRC
        </Link>
        {/* The door to the things — the car, the landlord, the insurer. Beside
            HMRC because the bar is full at three, and behind a door is still a
            door: check:reachable is what makes sure of that. */}
        <Link className="head-button" to="/things">
          Things
        </Link>
      </div>

      {error !== null && (
        <p className="head-error" role="alert">
          {error}
        </p>
      )}
    </header>
  )
}

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
        {/* The door to the people and things a life is made of — the car, the
            landlord, the insurer. Named after all four kinds it holds, not a
            shorthand that quietly drops two of them. The bar is full at
            four, and behind a door is still a door: check:reachable is what
            makes sure of that. */}
        <Link className="head-button" to="/things">
          People, Companies, Vehicles &amp; Property
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

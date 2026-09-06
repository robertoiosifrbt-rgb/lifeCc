import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useScreen } from '../../items/context'
import { syncLabel } from '../../app/syncLabel'
import { signOut } from '../../repository/auth'
import './SettingsScreen.css'

/**
 * App and account configuration, in one place.
 *
 * Everything here already existed — the global header used to carry it on
 * every screen. Moving it here is the whole point: these are utilities you
 * reach for occasionally, not something that belongs beside Home's Inbox or
 * an Area's numbers. Nothing here is new state or a new handler; it wires
 * the same `data`/`signOut` the rest of the app already uses.
 */
export function SettingsScreen() {
  const { data, email } = useScreen()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function run(body: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    void body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  const label = syncLabel(data.sync)

  return (
    <section className="settings">
      {email !== null && (
        <div className="settings-block">
          <h2 className="settings-heading">Account</h2>
          <p className="settings-email">{email}</p>
          <button
            type="button"
            name="sign-out"
            className="settings-button settings-signout"
            disabled={busy}
            onClick={() => run(signOut)}
          >
            Sign out
          </button>
        </div>
      )}

      <div className="settings-block">
        <h2 className="settings-heading">Sync</h2>
        <p className={`settings-sync${label.bad ? ' settings-sync-bad' : ''}`}>{label.text}</p>
        <button
          type="button"
          name="resync"
          className="settings-button"
          disabled={busy}
          onClick={data.resync}
        >
          Sync again
        </button>
      </div>

      <div className="settings-block">
        <h2 className="settings-heading">Quick Actions</h2>
        <p className="settings-note">Choose what appears on Home, and in what order.</p>
        <Link className="settings-button settings-link" to="/quick-actions">
          Configure Quick Actions
        </Link>
      </div>

      <div className="settings-block">
        <h2 className="settings-heading">Data</h2>
        <button
          type="button"
          name="download"
          className="settings-button"
          disabled={busy}
          onClick={() => run(data.download)}
        >
          Download everything
        </button>
      </div>

      {error !== null && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

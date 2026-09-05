import { useCallback, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { CaptureSheet } from '../items/CaptureSheet'
import { ItemSheet } from '../items/ItemSheet'
import type { ScreenContext } from '../items/context'
import { useItems } from '../items/useItems'
import { ExpenseSheet } from '../spend/ExpenseSheet'
import { ShiftSheet } from '../shifts/ShiftSheet'
import { costsFor, sliceOfYear } from '../repository/items'
import { signOut } from '../repository/auth'
import type { Session } from '../repository/auth'
import { useToday } from './today'
import { ShellHeader } from './ShellHeader'
import { SCREENS } from './screens'
import './AppShell.css'

type Props = { session: Session }

export function AppShell({ session }: Props) {
  const location = useLocation()
  const current = SCREENS.find((screen) => screen.path === location.pathname)
  const data = useItems(session.userId)

  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  // Looked up fresh every render, so the sheet never shows a stale version. If
  // the item is gone, the sheet closes itself with it.
  const openItem = data.items.find((item) => item.id === openId) ?? null
  const today = useToday()

  // Stable, so the sheets' effects do not tear down and set up again on every
  // render of the shell. One of those effects moves the focus, and a shell
  // that re-renders on every keystroke would move it while you type.
  const closeItem = useCallback(() => setOpenId(null), [])
  const closeCapture = useCallback(() => setCapturing(false), [])

  function report(body: () => Promise<unknown>) {
    setError(null)
    void body().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const context: ScreenContext = {
    data,
    openItem: (item) => setOpenId(item.id),
    today,
  }

  return (
    <div className="shell">
      <ShellHeader
        title={current?.label ?? 'Life Control Centre'}
        email={session.email}
        sync={data.sync}
        onResync={data.resync}
        onDownload={() => report(() => data.download())}
        onSignOut={() => report(signOut)}
        error={error}
      />

      <main className="shell-body">
        <Outlet context={context} />
      </main>

      {/* Stuck to the bottom, where the thumb already is. The thing that has
          to be easiest is putting something in. */}
      <div className="shell-bottom">
        <button
          className="shell-capture"
          type="button"
          name="capture"
          onClick={() => setCapturing(true)}
        >
          Write a line
        </button>

        <nav className="shell-nav" aria-label="Screens">
          {SCREENS.map((screen) => (
            <NavLink key={screen.path} to={screen.path} className="shell-nav-button">
              {screen.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {capturing && (
        <CaptureSheet
          onSave={(title) => data.capture(title)}
          onClose={closeCapture}
        />
      )}

      {openItem !== null && openItem.kind === 'shift' && (
        <ShiftSheet
          item={openItem}
          shift={data.shifts.find((s) => s.item_id === openItem.id) ?? null}
          areas={data.areas}
          onClockOn={() => data.clockOn(openItem.id)}
          onClockOff={(sessionId) => data.clockOff(sessionId)}
          onDropSession={(sessionId) => data.dropSession(sessionId)}
          onSetPaid={(platform, amount) => data.setPaid(openItem.id, platform, amount)}
          onSaveReadings={(odo_start, odo_end) =>
            data.saveShiftParts(openItem.id, { odo_start, odo_end })
          }
          onSaveTips={(tips) => data.saveShiftParts(openItem.id, { tips })}
          onSaveMoney={(patch) => data.saveShiftParts(openItem.id, patch)}
          onSetBreak={(sessionId, minutes) => data.setBreak(sessionId, minutes)}
          onSavePersonalKm={(personal_km) =>
            data.saveShiftParts(openItem.id, { personal_km })
          }
          onSetArea={(area_id) => data.update(openItem, { area_id })}
          costs={costsFor(data.costs, openItem.area_id)}
          slice={sliceOfYear({
            items: data.items,
            shifts: data.shifts,
            expenses: data.expenses,
            taxYears: data.taxYears,
            from: openItem.due ?? today,
          })}
          onSaveCosts={(fuel, vehicle) =>
            openItem.area_id === null
              ? Promise.resolve()
              : data.saveCosts(openItem.area_id, fuel, vehicle)
          }
          onClose={closeItem}
        />
      )}

      {openItem !== null && openItem.kind === 'expense' && (
        <ExpenseSheet
          item={openItem}
          expense={data.expenses.find((e) => e.item_id === openItem.id) ?? null}
          areas={data.areas}
          onRemove={() => data.unspend(openItem)}
          onClose={closeItem}
        />
      )}

      {openItem !== null &&
        openItem.kind !== 'shift' &&
        openItem.kind !== 'expense' && (
        <ItemSheet
          item={openItem}
          today={today}
          items={data.items}
          links={data.links}
          unsaved={data.unsaved.find((u) => u.item.id === openItem.id)?.reason}
          onUpdate={data.update}
          onLink={(to_id, kind) => data.link(openItem.id, to_id, kind)}
          onUnlink={(id) => data.unlink(id)}
          onDiscard={data.discard}
          onRetry={(item) => data.retry(item.id)}
          onClose={closeItem}
        />
      )}
    </div>
  )
}

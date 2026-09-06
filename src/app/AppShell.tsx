import { useCallback, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { CaptureSheet } from '../items/CaptureSheet'
import { ItemSheet } from '../items/ItemSheet'
import type { ScreenContext } from '../items/context'
import { useItems } from '../items/useItems'
import { ExpenseSheet } from '../spend/ExpenseSheet'
import { ShiftSheet } from '../shifts/ShiftSheet'
import type { Session } from '../repository/auth'
import { useToday } from './today'
import { MoreSheet } from './MoreSheet'
import { ShellHeader } from './ShellHeader'
import { journalEntryPath, opensInJournal, SCREENS, tabInfoFor } from './screens'
import './AppShell.css'

type Props = { session: Session }

export function AppShell({ session }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const tab = tabInfoFor(location.pathname)
  const data = useItems(session.userId)

  const [capturing, setCapturing] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
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
  const closeMore = useCallback(() => setMoreOpen(false), [])

  const context: ScreenContext = {
    data,
    // A journal entry has no sheet of its own to open into: it goes to its
    // composer instead, wherever openItem was called from — today's list, an
    // area's page, anywhere.
    openItem: (item) => {
      if (opensInJournal(item)) {
        void navigate(journalEntryPath(item.id))
        return
      }
      setOpenId(item.id)
    },
    today,
    email: session.email,
  }

  return (
    // data-sync carries the sync state for checks and tests: the header no
    // longer shows it in text once sync is healthy, but nothing that reads
    // sync state should have to scrape the header's visible copy for it.
    <div className="shell" data-sync={data.sync.kind}>
      <ShellHeader
        title={tab?.title ?? 'Life Control Centre'}
        sync={data.sync}
        onMore={() => setMoreOpen(true)}
      />

      <main className="shell-body">
        <Outlet context={context} />
      </main>

      {/* Stuck to the bottom, where the thumb already is. Capture stays one
          gesture away without dominating the screen or costing the bar a
          fifth slot. */}
      <div className="shell-bottom">
        <nav className="shell-nav" aria-label="Screens">
          {SCREENS.map((screen) => (
            <NavLink
              key={screen.path}
              to={screen.path}
              // React Router's own match lights the tab for its own URL and
              // anything nested under it (an area's own page under Areas).
              // The `||` adds the one case it cannot see: a screen reached
              // by name rather than by URL nesting — Calendar under Plan,
              // Tax under Money — still lights its parent tab.
              className={({ isActive }) =>
                `shell-nav-button${isActive || tab?.tabPath === screen.path ? ' active' : ''}`
              }
            >
              {screen.label}
            </NavLink>
          ))}
        </nav>

        <button
          className="shell-capture"
          type="button"
          name="capture"
          aria-label="Capture"
          onClick={() => setCapturing(true)}
        >
          +
        </button>
      </div>

      {moreOpen && <MoreSheet onClose={closeMore} />}

      {capturing && (
        <CaptureSheet
          onSave={(title) => data.capture(title)}
          onClose={closeCapture}
        />
      )}

      {openItem !== null && openItem.kind === 'shift' && (
        <ShiftSheet
          key={openItem.id}
          item={openItem}
          shift={data.shifts.find((s) => s.item_id === openItem.id) ?? null}
          areas={data.areas}
          items={data.items}
          shifts={data.shifts}
          expenses={data.expenses}
          vehicleCostRates={data.vehicleCostRates}
          taxYears={data.taxYears}
          links={data.links}
          things={data.things}
          today={today}
          onClockOn={() => data.clockOn(openItem.id)}
          onClockOff={(sessionId) => data.clockOff(sessionId)}
          onDropSession={(sessionId) => data.dropSession(sessionId)}
          onSaveShiftParts={(patch) => data.saveShiftParts(openItem.id, patch)}
          onSetPaid={(platform, amount) => data.setPaid(openItem.id, platform, amount)}
          onRemoveEarning={(platform) => data.removeEarning(openItem.id, platform)}
          onSetBreak={(sessionId, minutes) => data.setBreak(sessionId, minutes)}
          onUpdateItem={(patch) => data.update(openItem, patch)}
          onDelete={() => data.discard(openItem)}
          onSaveVehicleCost={(vehicle_item_id, effective_from, vehicle_per_km) =>
            data.saveVehicleCost(vehicle_item_id, effective_from, vehicle_per_km)
          }
          onLink={(to_id, kind) => data.link(openItem.id, to_id, kind)}
          onUnlink={(id) => data.unlink(id)}
          onSetRoadCost={(field, amount, existingExpenseItemId, day) =>
            data.setRoadCost(openItem.id, field, amount, existingExpenseItemId, day)
          }
          onRemoveRoadCost={(expenseItem) => data.removeRoadCost(expenseItem)}
          onClose={closeItem}
        />
      )}

      {openItem !== null && openItem.kind === 'expense' && (
        <ExpenseSheet
          item={openItem}
          expense={data.expenses.find((e) => e.item_id === openItem.id) ?? null}
          areas={data.areas}
          items={data.items}
          links={data.links}
          things={data.things}
          onRemove={() => data.unspend(openItem)}
          onClose={closeItem}
        />
      )}

      {openItem !== null &&
        openItem.kind !== 'shift' &&
        openItem.kind !== 'expense' &&
        // Defensive: openItem above already routes a journal entry to its
        // composer instead of setting openId, so this should never be true.
        // If some future caller sets openId directly on a journal item
        // anyway, the sheet still must not be the one that opens for it.
        !opensInJournal(openItem) && (
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

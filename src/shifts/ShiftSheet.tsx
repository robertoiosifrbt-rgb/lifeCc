import { useState } from 'react'

import {
  costsFor,
  fuelRateForArea,
  isOut,
  kilometres,
  minutesWorked,
  reserveFor,
  takeHome,
} from '../repository/items'
import type {
  Area,
  Expense,
  Item,
  Patch,
  Platform,
  RunningCosts,
  Shift,
  ShiftPatch,
  Slice,
} from '../repository/items'
import { Sheet } from '../ui/Sheet'
import { DrivingCostBasis } from './DrivingCostBasis'
import {
  breaksPatchOf,
  draftFrom,
  earningsPatchOf,
  isDirty,
  itemPatchOf,
  previewShiftOf,
  shiftPatchOf,
  validateDraft,
} from './draft'
import type { Draft } from './draft'
import { ShiftActions } from './ShiftActions'
import { ShiftEarnings } from './ShiftEarnings'
import { ShiftHeader } from './ShiftHeader'
import { ShiftHours } from './ShiftHours'
import { ShiftOdometer } from './ShiftOdometer'
import { ShiftRoadCosts } from './ShiftRoadCosts'
import { ShiftSummary } from './ShiftSummary'
import { EMPTY_SHIFT } from './money'
import './ShiftSheet.css'

type Props = {
  item: Item
  shift: Shift | null
  areas: Area[]
  items: Item[]
  expenses: Expense[]
  costs: RunningCosts[]
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onSaveShiftParts: (patch: ShiftPatch) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onUpdateItem: (patch: Patch) => Promise<void>
  onDelete: () => Promise<void>
  onSaveVehicleCost: (
    area_id: string,
    fuel_per_km: number,
    vehicle_per_km: number,
  ) => Promise<void>
  /** Where this shift's day sits in its tax year, for working out the reserve. */
  slice: Slice
  onClose: () => void
}

/**
 * One workday, Draft or Completed.
 *
 * Everything typed here goes into a local draft first. The live summary reads
 * that draft immediately, on every keystroke; nothing is written until Save
 * draft or Complete Workday is pressed. Start and Stop are the one exception —
 * they are real events, not form fields, so they write the moment they are
 * pressed, same as before.
 */
export function ShiftSheet(props: Props) {
  const { item, onClose } = props
  const shift = props.shift ?? EMPTY_SHIFT
  const completed = item.state === 'done'

  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, shift))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const dirty = !completed && isDirty(item, shift, draft)
  const errors = completed ? [] : validateDraft(shift, draft)
  const blockedByOpenSession = isOut(shift)

  /** Runs a write, catching its own error rather than throwing past the caller. */
  function guarded(body: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    return body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  function run(body: () => Promise<void>) {
    void guarded(body)
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** Writes every field that changed, then settles the draft on the result. */
  async function saveAll(): Promise<{ item: Item; shift: Shift }> {
    const itemPatch = itemPatchOf(item, draft)
    const shiftPatch = shiftPatchOf(shift, draft)
    const earningsPatch = earningsPatchOf(shift, draft)
    const breaksPatch = breaksPatchOf(shift, draft)

    if (Object.keys(shiftPatch).length > 0) await props.onSaveShiftParts(shiftPatch)
    for (const { platform, amount } of earningsPatch) await props.onSetPaid(platform, amount)
    for (const { sessionId, minutes } of breaksPatch) await props.onSetBreak(sessionId, minutes)
    if (Object.keys(itemPatch).length > 0) await props.onUpdateItem(itemPatch)

    const nextItem: Item = { ...item, ...itemPatch }
    const nextShift: Shift = {
      ...shift,
      ...shiftPatch,
      earnings: shift.earnings
        .filter((earning) => !earningsPatch.some((changed) => changed.platform === earning.platform))
        .concat(earningsPatch),
      sessions: shift.sessions.map((session) => {
        const changed = breaksPatch.find((entry) => entry.sessionId === session.id)
        return changed === undefined ? session : { ...session, break_minutes: changed.minutes }
      }),
    }
    return { item: nextItem, shift: nextShift }
  }

  function onSaveDraft() {
    void guarded(async () => {
      const settled = await saveAll()
      setDraft(draftFrom(settled.item, settled.shift))
    })
  }

  function onComplete() {
    if (blockedByOpenSession) return
    void guarded(async () => {
      await saveAll()
      await props.onUpdateItem({ state: 'done' })
    })
  }

  function onDelete() {
    if (blockedByOpenSession) return
    void guarded(() => props.onDelete())
  }

  function requestClose() {
    if (dirty) {
      setConfirmingClose(true)
      return
    }
    onClose()
  }

  const preview = previewShiftOf(shift, draft)
  const worked = minutesWorked(preview)
  const km = kilometres(preview)
  const sum = takeHome(preview, (profitPence) =>
    props.slice.figures === null || props.slice.income === null
      ? null
      : reserveFor(props.slice.figures, props.slice.income, props.slice.beforePence, profitPence),
  )

  const areaId = completed ? item.area_id : draft.area_id === '' ? null : draft.area_id
  const fuelRate = fuelRateForArea(props.items, props.expenses, areaId)
  const fuelPerKm = fuelRate.perKm
  const runningCosts = costsFor(props.costs, areaId)

  return (
    <Sheet title={`Workday · ${item.due ?? 'undated'}`} onClose={requestClose}>
      {confirmingClose && (
        <div className="shift-unsaved" role="alert">
          <p>You have unsaved changes. Close anyway?</p>
          <div className="shift-actions">
            <button
              type="button"
              className="shift-button"
              onClick={() => setConfirmingClose(false)}
            >
              Keep editing
            </button>
            <button type="button" className="shift-button shift-danger" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </div>
      )}

      <ShiftHeader
        title={draft.title}
        due={draft.due}
        area_id={draft.area_id}
        areas={props.areas}
        completed={completed}
        busy={busy}
        onChangeTitle={(typed) => set('title', typed)}
        onChangeDue={(typed) => set('due', typed)}
        onChangeArea={(area_id) => set('area_id', area_id)}
      />

      <ShiftSummary sum={sum} worked={worked} km={km} />

      {error !== null && <p className="shift-error">{error}</p>}

      <ShiftHours
        shift={shift}
        busy={busy}
        readOnly={completed}
        breaks={draft.breaks}
        onChangeBreak={(sessionId, typed) =>
          setDraft((current) => ({ ...current, breaks: { ...current.breaks, [sessionId]: typed } }))
        }
        onClockOn={props.onClockOn}
        onClockOff={props.onClockOff}
        onDropSession={props.onDropSession}
        onRun={run}
      />

      <ShiftEarnings
        earnings={draft.earnings}
        tips={draft.tips}
        bonuses={draft.bonuses}
        busy={busy}
        readOnly={completed}
        onChangePlatform={(platform, typed) =>
          setDraft((current) => ({ ...current, earnings: { ...current.earnings, [platform]: typed } }))
        }
        onChangeTips={(typed) => set('tips', typed)}
        onChangeBonuses={(typed) => set('bonuses', typed)}
      />

      <ShiftOdometer
        odo_start={draft.odo_start}
        odo_end={draft.odo_end}
        personal_km={draft.personal_km}
        busy={busy}
        readOnly={completed}
        onChange={(key, typed) => set(key, typed)}
      />

      <ShiftRoadCosts
        parking={draft.parking}
        tolls={draft.tolls}
        other_cost={draft.other_cost}
        busy={busy}
        readOnly={completed}
        onChange={(key, typed) => set(key, typed)}
      />

      {areaId !== null && (
        <DrivingCostBasis
          fuelRate={fuelRate}
          costs={runningCosts}
          busy={busy}
          readOnly={completed}
          onConfigureVehicle={(vehicle_per_km) => {
            if (fuelPerKm === null) return Promise.resolve()
            // The Area this writes is the one the draft is showing right now
            // — not necessarily the persisted item's — so a rate typed after
            // changing the Area, before Save draft, lands on the Area it was
            // actually shown against.
            return props.onSaveVehicleCost(areaId, fuelPerKm, vehicle_per_km)
          }}
        />
      )}

      <ShiftActions
        completed={completed}
        dirty={dirty}
        busy={busy}
        blockedByOpenSession={blockedByOpenSession}
        errors={errors}
        onSaveDraft={onSaveDraft}
        onComplete={onComplete}
        onDelete={onDelete}
      />
    </Sheet>
  )
}

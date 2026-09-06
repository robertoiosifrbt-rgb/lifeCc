import { useMemo, useState } from 'react'

import { canCompleteWorkday, canDeleteWorkday, sessionMessageOf } from '../repository/items'
import type {
  Area,
  Expense,
  Item,
  Patch,
  Platform,
  RunningCosts,
  Shift,
  ShiftPatch,
  TaxYearRow,
} from '../repository/items'
import { Sheet } from '../ui/Sheet'
import { DrivingCostBasis } from './DrivingCostBasis'
import { draftFrom } from './draft'
import type { Draft } from './draft'
import { isDirty } from './draftPatches'
import { validateCompletion, validateDraft } from './draftValidate'
import { areaIdOf, costBasisOf, liveSummaryOf, sliceFor } from './liveSummary'
import { saveWorkday } from './saveWorkday'
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
  shifts: Shift[]
  expenses: Expense[]
  costs: RunningCosts[]
  taxYears: TaxYearRow[]
  /** For the tax slice when the draft carries no date at all. */
  today: string
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onSaveShiftParts: (patch: ShiftPatch) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  /** Taking a platform's earning back — never a fake zero over it. */
  onRemoveEarning: (platform: Platform) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onUpdateItem: (patch: Patch) => Promise<void>
  onDelete: () => Promise<void>
  onSaveVehicleCost: (
    area_id: string,
    fuel_per_km: number,
    vehicle_per_km: number,
  ) => Promise<void>
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
  const blockedByOpenSession = !canCompleteWorkday(shift) || !canDeleteWorkday(shift)
  const sessionMessage = sessionMessageOf(shift)

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

  const writers = {
    onUpdateItem: props.onUpdateItem,
    onSaveShiftParts: props.onSaveShiftParts,
    onSetPaid: props.onSetPaid,
    onRemoveEarning: props.onRemoveEarning,
    onSetBreak: props.onSetBreak,
    onDropSession: props.onDropSession,
  }

  function onSaveDraft() {
    void guarded(async () => {
      const settled = await saveWorkday(item, shift, draft, writers)
      setDraft(draftFrom(settled.item, settled.shift))
    })
  }

  function onComplete() {
    if (blockedByOpenSession) return
    void guarded(async () => {
      await saveWorkday(item, shift, draft, writers, { forceShiftTouch: true })
      await props.onUpdateItem({ state: 'done' })
    })
  }

  function onDelete() {
    if (blockedByOpenSession) return
    void guarded(async () => {
      await props.onDelete()
      onClose()
    })
  }

  function requestClose() {
    if (dirty) {
      setConfirmingClose(true)
      return
    }
    onClose()
  }

  // The two expensive parts — each a scan over the whole account — only
  // redone when what they actually depend on changes: the Area (and the
  // fuel/vehicle data behind it), and the date. Typing a tip or an odometer
  // reading recomputes neither.
  const areaId = areaIdOf(item, draft, completed)
  const { fuelRate, runningCosts, costBasis } = useMemo(
    () => costBasisOf({ shift, completed, areaId, items: props.items, expenses: props.expenses, costs: props.costs }),
    [shift, completed, areaId, props.items, props.expenses, props.costs],
  )
  const slice = useMemo(
    () => sliceFor({ item, due: draft.due, items: props.items, shifts: props.shifts, expenses: props.expenses, taxYears: props.taxYears, today: props.today }),
    [item, draft.due, props.items, props.shifts, props.expenses, props.taxYears, props.today],
  )
  const { sum, worked, km } = liveSummaryOf(shift, draft, costBasis, slice)
  const fuelPerKm = fuelRate.perKm
  const completionErrors = completed
    ? []
    : validateCompletion({
        draft,
        shift,
        fuelPerKm: costBasis.fuel_per_km,
        vehiclePerKm: costBasis.vehicle_per_km,
      })

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
        removedSessions={draft.removedSessions}
        onChangeBreak={(sessionId, typed) =>
          setDraft((current) => ({ ...current, breaks: { ...current.breaks, [sessionId]: typed } }))
        }
        onRemoveSession={(sessionId) =>
          setDraft((current) =>
            current.removedSessions.includes(sessionId)
              ? current
              : { ...current, removedSessions: [...current.removedSessions, sessionId] },
          )
        }
        onClockOn={props.onClockOn}
        onClockOff={props.onClockOff}
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
          key={areaId}
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
        sessionMessage={sessionMessage}
        errors={errors}
        completionErrors={completionErrors}
        onSaveDraft={onSaveDraft}
        onComplete={onComplete}
        onDelete={onDelete}
      />
    </Sheet>
  )
}

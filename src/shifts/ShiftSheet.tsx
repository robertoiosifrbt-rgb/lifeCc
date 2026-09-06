import { useState } from 'react'

import { canCompleteWorkday, canDeleteWorkday, sessionMessageOf } from '../repository/items'
import type {
  Area,
  Entity,
  Expense,
  Item,
  Link,
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
import { validateDraft } from './draftValidate'
import { saveWorkday } from './saveWorkday'
import { ShiftActions } from './ShiftActions'
import { ShiftEarnings } from './ShiftEarnings'
import { ShiftHeader } from './ShiftHeader'
import { ShiftHours } from './ShiftHours'
import { ShiftOdometer } from './ShiftOdometer'
import { ShiftRoadCosts } from './ShiftRoadCosts'
import { ShiftSummary } from './ShiftSummary'
import { UnsavedChangesBanner } from './UnsavedChangesBanner'
import { useWorkdayComputations } from './useWorkdayComputations'
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
  links: Link[]
  things: Entity[]
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
  /** Replaces whatever Vehicle is linked with this one, or none when null.
   *  Immediate, not deferred to Save draft: an association, not a field. */
  onSetVehicle: (vehicleItemId: string | null) => Promise<void>
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
  const [savingVehicleCost, setSavingVehicleCost] = useState(false)
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

  const {
    vehicleLink,
    vehicles,
    areaId,
    fuelRate,
    runningCosts,
    costBasis,
    sum,
    worked,
    km,
    pinnedBasis,
    completionErrors,
  } = useWorkdayComputations({
    item,
    shift,
    draft,
    completed,
    items: props.items,
    shifts: props.shifts,
    expenses: props.expenses,
    costs: props.costs,
    taxYears: props.taxYears,
    links: props.links,
    things: props.things,
  })
  const fuelPerKm = fuelRate.perKm

  return (
    <Sheet title={`Workday · ${item.due ?? 'undated'}`} onClose={requestClose}>
      {confirmingClose && (
        <UnsavedChangesBanner onKeepEditing={() => setConfirmingClose(false)} onDiscard={onClose} />
      )}

      <ShiftHeader
        title={draft.title}
        due={draft.due}
        area_id={draft.area_id}
        areas={props.areas}
        vehicles={vehicles}
        vehicle={vehicleLink}
        completed={completed}
        busy={busy}
        onChangeTitle={(typed) => set('title', typed)}
        onChangeDue={(typed) => set('due', typed)}
        onChangeArea={(area_id) => set('area_id', area_id)}
        onChangeVehicle={(vehicleItemId) => run(() => props.onSetVehicle(vehicleItemId))}
      />

      <ShiftSummary
        sum={sum}
        worked={worked}
        km={km}
        dateKnown={draft.due !== ''}
        fuelUnknown={costBasis.fuel_per_km === null}
        vehicleCostUnknown={costBasis.vehicle_per_km === null}
      />

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

      {(areaId !== null || pinnedBasis !== null) && (
        <DrivingCostBasis
          fuelRate={fuelRate}
          costs={runningCosts}
          pinned={pinnedBasis}
          busy={busy || savingVehicleCost}
          readOnly={completed}
          // Not routed through `guarded()`: that swallows a rejection into
          // `error`, which would resolve this promise either way and close
          // the editor even on failure. `savingVehicleCost` still blocks
          // Complete the same as `busy` does everywhere else.
          onConfigureVehicle={(vehicle_per_km) => {
            if (fuelPerKm === null || areaId === null) return Promise.resolve()
            setSavingVehicleCost(true)
            return props.onSaveVehicleCost(areaId, fuelPerKm, vehicle_per_km)
              .finally(() => setSavingVehicleCost(false))
          }}
        />
      )}

      <ShiftActions
        completed={completed}
        dirty={dirty}
        busy={busy || savingVehicleCost}
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

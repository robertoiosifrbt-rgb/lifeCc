import { useState } from 'react'

import { canCompleteWorkday, canDeleteWorkday, namedPlatformsFor, sessionMessageOf } from '../repository/items'
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
import type { Props } from './ShiftSheet.types'
import { ShiftSummary } from './ShiftSummary'
import { UnsavedChangesBanner } from './UnsavedChangesBanner'
import { useWorkdayComputations } from './useWorkdayComputations'
import { workdayWritersFrom } from './workdayWriters'
import { EMPTY_SHIFT } from './money'
import './ShiftSheet.css'

/**
 * One workday, Draft or Completed.
 *
 * Everything typed here goes into a local draft first. The live summary reads
 * that draft immediately, on every keystroke; nothing is written until Save
 * draft or Complete Workday is pressed. Start and Stop are the one exception —
 * they write the moment they are pressed. The Vehicle used follows the same
 * deferred rule now, not an immediate write: Discard has to be able to undo it.
 */
export function ShiftSheet(props: Props) {
  const { item, onClose } = props
  const shift = props.shift ?? EMPTY_SHIFT
  const completed = item.state === 'done'

  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, shift, props.links, props.things))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savingVehicleCost, setSavingVehicleCost] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const dirty = !completed && isDirty(item, shift, draft, props.links, props.things, props.expenses)
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

  const writers = workdayWritersFrom(props)

  function onSaveDraft() {
    void guarded(async () => {
      const settled = await saveWorkday(item, shift, draft, props.links, props.things, props.expenses, writers)
      setDraft(draftFrom(settled.item, settled.shift, settled.links, props.things))
    })
  }

  function onComplete() {
    if (blockedByOpenSession) return
    void guarded(async () => {
      await saveWorkday(item, shift, draft, props.links, props.things, props.expenses, writers, {
        forceShiftTouch: true,
      })
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
    fuelRate,
    currentVehicleCost,
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
    vehicleCostRates: props.vehicleCostRates,
    today: props.today,
    taxYears: props.taxYears,
    links: props.links,
    things: props.things,
  })
  const vehicleItemId = vehicleLink.kind === 'one' ? vehicleLink.vehicleItemId : null
  const namedPlatforms = namedPlatformsFor(props.items, props.platforms, Object.keys(draft.platformEarnings))

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
        onChangeVehicle={(id) => set('vehicle_item_id', id ?? '')}
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
        platforms={namedPlatforms}
        platformEarnings={draft.platformEarnings}
        tips={draft.tips}
        bonuses={draft.bonuses}
        busy={busy}
        readOnly={completed}
        onChangePlatform={(platform, typed) =>
          setDraft((current) => ({ ...current, earnings: { ...current.earnings, [platform]: typed } }))
        }
        onChangePlatformEarning={(platform_item_id, typed) =>
          setDraft((current) => ({
            ...current,
            platformEarnings: { ...current.platformEarnings, [platform_item_id]: typed },
          }))
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

      {(vehicleItemId !== null || pinnedBasis !== null) && (
        <DrivingCostBasis
          fuelRate={fuelRate}
          vehicleCost={currentVehicleCost}
          pinned={pinnedBasis}
          busy={busy || savingVehicleCost}
          readOnly={completed}
          // Not `guarded()`: that swallows a rejection into `error`, which
          // would close the editor even on failure. `savingVehicleCost`
          // still blocks Complete the same as `busy` does everywhere else.
          onConfigureVehicle={(vehicle_per_km) => {
            if (vehicleItemId === null) return Promise.resolve()
            setSavingVehicleCost(true)
            return props.onSaveVehicleCost(vehicleItemId, props.today, vehicle_per_km)
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

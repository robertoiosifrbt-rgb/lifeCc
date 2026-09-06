import { useState } from 'react'

import type { FuelRate } from '../repository/items'
import { rateOf } from './money'

/** Exactly what a Completed workday was pinned to — never today's rate. */
export type PinnedBasis = { fuel_per_km: number | null; vehicle_per_km: number | null }

type Props = {
  /** Worked out fresh from the linked Vehicle's full-tank fill-ups, not typed. */
  fuelRate: FuelRate
  /** The Vehicle's own currently-applicable cost rate, or null if nobody has
   *  set one yet — independent of `fuelRate`: configuring this never needs a
   *  known fuel rate first. */
  vehicleCost: number | null
  /** Set only once Completed: the shift's own frozen rates, shown instead of
   *  `fuelRate`/`vehicleCost` — which stay live even after this workday is
   *  done. */
  pinned: PinnedBasis | null
  busy: boolean
  readOnly: boolean
  onConfigureVehicle: (vehicle_per_km: number) => Promise<void>
}

function rateText(value: number | null): string {
  return value === null ? 'Not recorded' : `Pinned · £${value.toFixed(4)}/km`
}

/**
 * What a kilometre costs, shown for what it is: fuel worked out for you, and
 * the Vehicle's own wear rate as a setting you configure, not a box you fill
 * in on your way out the door.
 *
 * Fuel is never typed here. The repo already knows the full-tank-to-full-tank
 * price from the linked Vehicle's fuel expenses — that is the one number this
 * shows, or it says plainly that there is not enough of it yet. A shift that
 * shows £0 for a rate nobody has set is a lie in the direction that costs
 * money, so it never does. The two are independent: an unknown fuel rate
 * never blocks configuring the Vehicle's own cost, and vice versa.
 *
 * Once Completed, `pinned` takes over entirely: the shift's own frozen rates,
 * labelled as pinned, never the Vehicle's rate as it stands today — changing
 * it after the day is done must not make this screen and the summary above
 * it disagree about what the day actually cost.
 */
export function DrivingCostBasis(props: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fuelKnown = props.fuelRate.perKm !== null

  /** Always seeded from the latest props at the moment it opens — never a
   *  value captured once and left stale by a newer rate arriving underneath
   *  while the editor was closed. */
  function openEditor() {
    setTyped(props.vehicleCost === null ? '' : String(props.vehicleCost))
    setOpen(true)
  }

  function onSave() {
    let rate: number | null
    try {
      rate = rateOf(typed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    if (rate === null) return
    setSaving(true)
    setError(null)
    void props
      .onConfigureVehicle(rate)
      .then(() => setOpen(false))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setSaving(false))
  }

  return (
    <section className="shift-block">
      <h3 className="shift-heading">Driving cost basis</h3>

      <div className="shift-paid">
        <span className="shift-platform">Fuel cost</span>
        <span className="shift-cost-value">
          {props.pinned !== null
            ? rateText(props.pinned.fuel_per_km)
            : fuelKnown
              ? `Automatic · £${props.fuelRate.perKm?.toFixed(4)}/km`
              : 'Not enough full-tank data yet'}
        </span>
      </div>

      <div className="shift-paid">
        <span className="shift-platform">Vehicle cost</span>
        <span className="shift-cost-value">
          {props.pinned !== null
            ? rateText(props.pinned.vehicle_per_km)
            : props.vehicleCost === null
              ? 'Not set'
              : `£${props.vehicleCost.toFixed(4)}/km`}
        </span>
      </div>

      {!props.readOnly && !open && (
        <button
          type="button"
          name="configure-vehicle-cost"
          className="shift-button"
          disabled={props.busy}
          onClick={openEditor}
        >
          Configure vehicle cost
        </button>
      )}

      {!props.readOnly && open && (
        <div className="shift-paid">
          <span className="shift-platform">Vehicle £/km</span>
          <input
            className="shift-amount"
            name="vehicle_per_km"
            inputMode="decimal"
            value={typed}
            disabled={saving}
            onChange={(event) => setTyped(event.target.value)}
          />
          <button
            type="button"
            name="save-vehicle-cost"
            className="shift-button"
            disabled={saving}
            onClick={onSave}
          >
            Save
          </button>
        </div>
      )}

      {error !== null && <p className="shift-error">{error}</p>}
    </section>
  )
}

import { useState } from 'react'

import type { FuelRate, RunningCosts } from '../repository/items'
import { rateOf } from './money'

type Props = {
  /** Worked out fresh from this area's full-tank fill-ups, not typed. */
  fuelRate: FuelRate
  /** The area's current vehicle rate, or null if nobody has set it yet. */
  costs: RunningCosts | null
  busy: boolean
  readOnly: boolean
  onConfigureVehicle: (vehicle_per_km: number) => Promise<void>
}

/**
 * What a kilometre costs, shown for what it is: fuel worked out for you, and
 * the vehicle rate as a setting you configure, not a box you fill in on your
 * way out the door.
 *
 * Fuel is never typed here. The repo already knows the full-tank-to-full-tank
 * price from the fuel expenses of this area — that is the one number this
 * shows, or it says plainly that there is not enough of it yet. A shift that
 * shows £0 for a rate nobody has set is a lie in the direction that costs
 * money, so it never does.
 */
export function DrivingCostBasis(props: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(
    props.costs === null ? '' : String(props.costs.vehicle_per_km),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fuelKnown = props.fuelRate.perKm !== null

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
          {fuelKnown
            ? `Automatic · £${props.fuelRate.perKm?.toFixed(4)}/km`
            : 'Not enough full-tank data yet'}
        </span>
      </div>

      <div className="shift-paid">
        <span className="shift-platform">Vehicle cost</span>
        <span className="shift-cost-value">
          {props.costs === null ? 'Not set' : `£${props.costs.vehicle_per_km.toFixed(4)}/km`}
        </span>
      </div>

      {!props.readOnly && !fuelKnown && (
        <p className="shift-missing">
          Add full-tank fuel purchases for this Area before the vehicle cost
          can be configured.
        </p>
      )}

      {!props.readOnly && fuelKnown && !open && (
        <button
          type="button"
          className="shift-button"
          disabled={props.busy}
          onClick={() => setOpen(true)}
        >
          Configure vehicle cost
        </button>
      )}

      {!props.readOnly && fuelKnown && open && (
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
          <button type="button" className="shift-button" disabled={saving} onClick={onSave}>
            Save
          </button>
        </div>
      )}

      {error !== null && <p className="shift-error">{error}</p>}
    </section>
  )
}

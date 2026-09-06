import { Link } from 'react-router-dom'

import type { TakeHome } from '../repository/items'
import { hoursAndMinutes, pounds } from './money'

type Props = {
  sum: TakeHome
  worked: number
  km: number | null
  /** Whether the Draft carries a date at all — a blank one is never today's
   *  in disguise, so Tax and NI need their own reason for being unknown. */
  dateKnown: boolean
  /** The automatic fuel rate is unknown — no full-tank data for the linked
   *  Vehicle yet. Distinguished from `vehicleCostUnknown` so the hint never
   *  tells the owner to add fuel data he has already given. */
  fuelUnknown: boolean
  /** The Area's vehicle cost has not been configured. */
  vehicleCostUnknown: boolean
}

/**
 * The live summary: what the draft is worth right now, before any of it is
 * saved.
 *
 * Reads exactly the `TakeHome` the caller worked out from the preview shift —
 * the same `takeHome()` a persisted shift uses. There is no second formula
 * here for "while you are typing".
 */
export function ShiftSummary({ sum, worked, km, dateKnown, fuelUnknown, vehicleCostUnknown }: Props) {
  return (
    <>
      <dl className="shift-totals">
        <div className="shift-total">
          <dt>Made</dt>
          <dd>{pounds(sum.grossPence)}</dd>
        </div>
        <div className="shift-total shift-total-net">
          <dt>Roughly yours</dt>
          {/* Roughly, and the word is not modesty. What this day is worth
              depends on what was actually spent over the month; here the
              fuel and the wear are what the day used up, at the rate the
              pump has been charging. */}
          <dd>{sum.missing.length === 0 ? pounds(sum.netPence) : '—'}</dd>
        </div>
        <div className="shift-total">
          <dt>Worked</dt>
          <dd>{hoursAndMinutes(worked)}</dd>
        </div>
      </dl>

      <dl className="shift-breakdown">
        <div className="shift-line">
          <dt>Driven</dt>
          {/* Unknown, not zero: one reading tells you nothing about the other. */}
          <dd>{km === null ? '—' : `${km.toFixed(1)} km`}</dd>
        </div>
        <div className="shift-line">
          <dt>Fuel and wear used</dt>
          <dd>
            {sum.missing.includes('costs') || sum.missing.includes('kilometres')
              ? '—'
              : `−${pounds(sum.costsPence)}`}
          </dd>
        </div>
        <div className="shift-line">
          <dt>Parking, tolls and the rest</dt>
          {/* Not an estimate like the line above it: this is money that left a
              pocket on the day, so it is shown even when the rates are not
              set and nothing else can be worked out. */}
          <dd>{sum.directPence === 0 ? '—' : `−${pounds(sum.directPence)}`}</dd>
        </div>
        <div className="shift-line">
          <dt>Tax and NI to put aside</dt>
          <dd>{sum.missing.includes('rates') ? '—' : `−${pounds(sum.taxPence + sum.niPence)}`}</dd>
        </div>
      </dl>

      {/* Never a silent zero: a missing rate is an unknown reserve, not a
          reserve of nothing, and £0 tax is the lie that costs money. A blank
          date and unset year figures are different missing reasons, so they
          never share one message — a date typed in fixes the first and does
          nothing about the second. */}
      {sum.missing.includes('rates') && !dateKnown && (
        <p className="shift-missing">Add a workday date to calculate Tax and NI.</p>
      )}
      {sum.missing.includes('rates') && dateKnown && (
        <p className="shift-missing">
          This year&rsquo;s figures are not set, so what this day owes is
          unknown — not nothing. Put them in on <Link to="/hmrc">HMRC</Link>.
        </p>
      )}
      {/* Fuel unknown and vehicle cost unset are different gaps — telling
          the owner to add fuel data he has already given helps nobody. */}
      {sum.missing.includes('costs') && fuelUnknown && vehicleCostUnknown && (
        <p className="shift-missing">
          No cost per kilometre yet. Write down two full tanks for the
          Vehicle used under Money out, and configure the vehicle cost.
        </p>
      )}
      {sum.missing.includes('costs') && fuelUnknown && !vehicleCostUnknown && (
        <p className="shift-missing">
          The automatic fuel rate is not known yet. Write down two full tanks
          for the Vehicle used under Money out and it works itself out.
        </p>
      )}
      {sum.missing.includes('costs') && !fuelUnknown && vehicleCostUnknown && (
        <p className="shift-missing">
          The vehicle cost is not configured yet. Open Driving cost basis and
          configure it.
        </p>
      )}
      {sum.missing.includes('kilometres') && (
        <p className="shift-missing">
          Both odometer readings are needed before fuel can be worked out.
        </p>
      )}
    </>
  )
}

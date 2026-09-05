import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  kilometres,
  minutesWorked,
  PLATFORM_NAMES,
  PLATFORMS,
  reserveFor,
  takeHome,
} from '../repository/items'
import { treeOf } from '../repository/items'
import type {
  Area,
  Item,
  Platform,
  RunningCosts,
  Shift,
  ShiftPatch,
  Slice,
} from '../repository/items'
import { Sheet } from '../ui/Sheet'
import { ShiftCosts } from './ShiftCosts'
import { ShiftHours } from './ShiftHours'
import { ShiftRoadCosts } from './ShiftRoadCosts'
import { ShiftOdometer } from './ShiftOdometer'
import { EMPTY_SHIFT, hoursAndMinutes, penceOf, pounds } from './money'
import './ShiftSheet.css'

type Props = {
  item: Item
  shift: Shift | null
  areas: Area[]
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  onSaveReadings: (odo_start: number | null, odo_end: number | null) => Promise<void>
  onSaveTips: (tips: number | null) => Promise<void>
  /** Bonuses, parking, tolls and the rest — everything else on the day. */
  onSaveMoney: (patch: ShiftPatch) => Promise<void>
  onSetBreak: (sessionId: string, minutes: number) => Promise<void>
  onSavePersonalKm: (personal_km: number | null) => Promise<void>
  onSetArea: (area_id: string | null) => Promise<void>
  /** What a kilometre costs in this shift's area, or null if nobody said. */
  costs: RunningCosts | null
  onSaveCosts: (fuel_per_km: number, vehicle_per_km: number) => Promise<void>
  /** Where this shift's day sits in its tax year, for working out the reserve. */
  slice: Slice
  onClose: () => void
}

function amountOf(shift: Shift, platform: Platform): string {
  const found = shift.earnings.find((earning) => earning.platform === platform)
  return found === undefined ? '' : found.amount.toFixed(2)
}

/**
 * One shift, open: the hours, what each platform paid, the odometer, tips.
 *
 * Everything writes on blur rather than on a Save button. A shift is filled in
 * over a whole day, in a van, between drops — a form you have to remember to
 * submit is a form that loses half a day's numbers.
 */
export function ShiftSheet(props: Props) {
  const { item, onClose } = props
  const shift = props.shift ?? EMPTY_SHIFT
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function run(body: () => Promise<void>) {
    setBusy(true)
    setError(null)
    void body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  function onPaid(platform: Platform, typed: string) {
    const already = amountOf(shift, platform)
    if (typed.trim() === already.trim()) return
    let pence: number | null
    try {
      pence = penceOf(typed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    if (pence === null) return
    run(() => props.onSetPaid(platform, pence / 100))
  }

  /**
   * One money field, written on blur and only when it changed.
   *
   * Written once because there are now six of them, and six copies of "parse
   * it, compare it, save it" is six places for the comparison to be forgotten
   * — which shows up as a write on every tap out of a field nobody touched.
   */
  function money(key: keyof ShiftPatch, typed: string, held: number | null) {
    const already = held === null ? '' : held.toFixed(2)
    if (typed.trim() === already.trim()) return
    let value: number | null
    try {
      value = penceOf(typed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    run(() => props.onSaveMoney({ [key]: value === null ? null : value / 100 }))
  }

  const worked = minutesWorked(shift)
  const km = kilometres(shift)
  // What this day adds to the year's bill, worked out where it lands rather
  // than as a flat share of it. Early in the year, inside the allowance, that
  // is nothing; later it is a fifth and then more.
  const slice = props.slice
  const sum = takeHome(shift, (profitPence) =>
    slice.figures === null || slice.income === null
      ? null
      : reserveFor(slice.figures, slice.income, slice.beforePence, profitPence),
  )

  return (
    <Sheet title={`Shift · ${item.due ?? ''}`} onClose={onClose}>
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
          <dd>{sum.missing.includes('costs') || sum.missing.includes('kilometres')
            ? '—'
            : `−${pounds(sum.costsPence)}`}</dd>
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
          <dd>
            {sum.missing.includes('rates')
              ? '—'
              : `−${pounds(sum.taxPence + sum.niPence)}`}
          </dd>
        </div>
      </dl>

      {/* Never a silent zero: a missing rate is an unknown reserve, not a
          reserve of nothing, and £0 tax is the lie that costs money. */}
      {sum.missing.includes('rates') && (
        <p className="shift-missing">
          This year&rsquo;s figures are not set, so what this day owes is
          unknown — not nothing. Put them in on <Link to="/hmrc">HMRC</Link>.
        </p>
      )}
      {sum.missing.includes('costs') && (
        <p className="shift-missing">
          No cost per kilometre yet. Write down two full tanks under Money out
          and it works itself out.
        </p>
      )}
      {sum.missing.includes('kilometres') && (
        <p className="shift-missing">
          Both odometer readings are needed before fuel can be worked out.
        </p>
      )}

      {error !== null && <p className="shift-error">{error}</p>}

      <ShiftHours
        shift={shift}
        busy={busy}
        onClockOn={props.onClockOn}
        onClockOff={props.onClockOff}
        onDropSession={props.onDropSession}
        onSetBreak={props.onSetBreak}
        onRun={run}
        onError={setError}
      />

      <section className="shift-block">
        <h3 className="shift-heading">Paid</h3>
        {PLATFORMS.map((platform) => (
          <label key={platform} className={`shift-paid shift-${platform}`}>
            <span className="shift-platform">{PLATFORM_NAMES[platform]}</span>
            <input
              className="shift-amount"
              name={platform}
              inputMode="decimal"
              defaultValue={amountOf(shift, platform)}
              disabled={busy}
              onBlur={(event) => onPaid(platform, event.target.value)}
            />
          </label>
        ))}
        <label className="shift-paid shift-tips">
          <span className="shift-platform">Tips</span>
          <input
            className="shift-amount"
            name="tips"
            inputMode="decimal"
            defaultValue={shift.tips === null ? '' : shift.tips.toFixed(2)}
            disabled={busy}
            onBlur={(event) => {
              try {
                const pence = penceOf(event.target.value)
                run(() => props.onSaveTips(pence === null ? null : pence / 100))
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : String(reason))
              }
            }}
          />
        </label>
        <label className="shift-paid shift-tips">
          <span className="shift-platform">Bonuses</span>
          <input
            className="shift-amount"
            name="bonuses"
            inputMode="decimal"
            defaultValue={shift.bonuses === null ? '' : shift.bonuses.toFixed(2)}
            disabled={busy}
            onBlur={(event) => money('bonuses', event.target.value, shift.bonuses)}
          />
        </label>
      </section>

      <ShiftRoadCosts shift={shift} busy={busy} onSave={money} />

      <section className="shift-block">
        <h3 className="shift-heading">Where it belongs</h3>
        <label className="shift-paid">
          <span className="shift-platform">Area</span>
          <select
            className="shift-amount shift-area"
            name="area"
            value={item.area_id ?? ''}
            disabled={busy}
            onChange={(event) =>
              run(() => props.onSetArea(event.target.value === '' ? null : event.target.value))
            }
          >
            <option value="">—</option>
            {treeOf(props.areas).map(({ area, depth }) => (
              <option key={area.id} value={area.id}>
                {'\u00a0'.repeat(depth * 2)}
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {item.area_id !== null && (
        <ShiftCosts costs={props.costs} onSave={props.onSaveCosts} />
      )}

      <ShiftOdometer
        shift={shift}
        busy={busy}
        onSaveReadings={props.onSaveReadings}
        onSavePersonalKm={props.onSavePersonalKm}
        onRun={run}
        onError={setError}
      />
    </Sheet>
  )
}

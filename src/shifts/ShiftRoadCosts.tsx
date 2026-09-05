import type { Shift, ShiftPatch } from '../repository/items'

type Props = {
  shift: Shift
  busy: boolean
  onSave: (key: keyof ShiftPatch, typed: string, held: number | null) => void
}

/**
 * Parking, tolls, and whatever else the day cost on the road.
 *
 * Apart from Money out on purpose, and the database draws the same line: these
 * are spent inside one shift, never have a receipt worth filing, and belong to
 * that day's own profit rather than to the month's pile of bills.
 */
export function ShiftRoadCosts({ shift, busy, onSave }: Props) {
  return (
    <section className="shift-block">
      <h3 className="shift-heading">What the day cost on the road</h3>
      {/* Apart from Money out on purpose: these are spent inside one shift,
          never have a receipt worth filing, and belong to this day's own
          profit rather than to the month's pile of bills. */}
      {(
        [
          ['parking', 'Parking'],
          ['tolls', 'Tolls'],
          ['other_cost', 'Something else'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="shift-paid">
          <span className="shift-platform">{label}</span>
          <input
            className="shift-amount"
            name={key}
            inputMode="decimal"
            defaultValue={shift[key] === null ? '' : shift[key].toFixed(2)}
            disabled={busy}
            onBlur={(event) => onSave(key, event.target.value, shift[key])}
          />
        </label>
      ))}
    </section>
  )
}

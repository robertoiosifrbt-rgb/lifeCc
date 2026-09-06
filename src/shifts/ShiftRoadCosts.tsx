type Props = {
  parking: string
  tolls: string
  other_cost: string
  busy: boolean
  readOnly: boolean
  onChange: (key: 'parking' | 'tolls' | 'other_cost', typed: string) => void
}

/**
 * Parking, tolls, and whatever else the day cost on the road.
 *
 * Apart from Money out on purpose, and the database draws the same line:
 * these are spent inside one shift, never have a receipt worth filing, and
 * belong to that day's own profit rather than to the month's pile of bills.
 */
export function ShiftRoadCosts({ parking, tolls, other_cost, busy, readOnly, onChange }: Props) {
  const values = { parking, tolls, other_cost }
  return (
    <section className="shift-block">
      <h3 className="shift-heading">What the day cost on the road</h3>
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
            value={values[key]}
            disabled={busy || readOnly}
            onChange={(event) => onChange(key, event.target.value)}
          />
        </label>
      ))}
    </section>
  )
}

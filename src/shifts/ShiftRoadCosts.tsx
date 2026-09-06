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
 * Looks like three plain amounts, same as always — but each one is now a
 * real, shared Expense underneath (see `roadCostPatchOf` in
 * `draftPatches.ts`), the same object Money itself would show, not a number
 * living only on this shift.
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

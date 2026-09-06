type Props = {
  odo_start: string
  odo_end: string
  personal_km: string
  busy: boolean
  readOnly: boolean
  onChange: (key: 'odo_start' | 'odo_end' | 'personal_km', typed: string) => void
}

/**
 * What the odometer said, and how much of it was not work.
 *
 * Kilometres are never stored: they are the difference between two readings,
 * so the two can never disagree with the distance. The personal part is
 * stored, because nothing else knows it — the detour to the shops leaves no
 * trace on a platform's payment, and it is not a cost of earning.
 *
 * Typed here, not saved here: Save draft and Complete Workday are the only
 * two places that write it, so the summary above can show what a reading
 * would mean before it does.
 */
export function ShiftOdometer(props: Props) {
  const { busy, readOnly } = props

  return (
    <section className="shift-block">
      <h3 className="shift-heading">Odometer</h3>
      <div className="shift-odo">
        {(['odo_start', 'odo_end'] as const).map((which) => (
          <label key={which} className="shift-paid">
            <span className="shift-platform">
              {which === 'odo_start' ? 'Out' : 'Back'}
            </span>
            <input
              className="shift-amount"
              name={which}
              inputMode="decimal"
              value={props[which]}
              disabled={busy || readOnly}
              onChange={(event) => props.onChange(which, event.target.value)}
            />
          </label>
        ))}
      </div>

      <label className="shift-paid">
        <span className="shift-platform">Of that, personal</span>
        <input
          className="shift-amount"
          name="personal_km"
          inputMode="decimal"
          value={props.personal_km}
          disabled={busy || readOnly}
          onChange={(event) => props.onChange('personal_km', event.target.value)}
        />
      </label>
    </section>
  )
}

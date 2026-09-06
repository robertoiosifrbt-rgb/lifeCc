import { Link } from 'react-router-dom'

import { currentYearMoney } from '../../repository/items'
import { useScreen } from '../../items/context'
import { pounds } from '../../shifts/money'
import './MoneyScreen.css'

/**
 * The financial home: the year as it stands, and the door into Tax.
 *
 * The sums come from the same `currentYearMoney` helper Home's summary
 * reads — nothing is worked out twice. HMRC becomes "Tax" because it is not
 * a module of its own, it is what Money owes.
 */
export function MoneyScreen() {
  const { data, today } = useScreen()

  // While the snapshot is still loading, `data.items`/`shifts`/`taxYears`
  // are empty — not "the year made nothing". A £0.00 shown here would be
  // exactly the guessed number the rest of the app refuses to show.
  if (data.loading) {
    return (
      <div className="money-hub">
        <p className="money-hub-note">Loading…</p>
      </div>
    )
  }

  const { year, money: soFar } = currentYearMoney({
    items: data.items,
    shifts: data.shifts,
    expenses: data.expenses,
    taxYears: data.taxYears,
    today,
  })

  return (
    <div className="money-hub">
      <p className="money-hub-year">{year.label}</p>

      <dl className="money-hub-sums" aria-label="The tax year so far">
        <div>
          <dt>Made</dt>
          <dd>{pounds(soFar.grossPence)}</dd>
        </div>
        <div>
          <dt>Put aside</dt>
          <dd>{soFar.missingRates ? '—' : pounds(soFar.taxPence + soFar.niPence)}</dd>
        </div>
        <div className="money-hub-left">
          <dt>Left</dt>
          <dd>{soFar.missingRates ? '—' : pounds(soFar.leftPence)}</dd>
        </div>
      </dl>

      {soFar.missingRates && (
        <p className="money-hub-note">
          This year&rsquo;s figures are not set, so what is owed is unknown —
          not nothing.
        </p>
      )}

      <Link className="money-hub-tax" to="/hmrc">
        Tax
      </Link>
    </div>
  )
}

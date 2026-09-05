import { Link } from 'react-router-dom'

import { pounds } from '../../shifts/money'
import type { Period } from '../../repository/items'
import { SOON_DAYS, summarise } from './summary'
import type { Summary as Counts } from './summary'
import type { Entity } from '../../repository/items'
import type { Item } from '../../repository/items'
import './Summary.css'

type Props = {
  items: readonly Item[]
  things: readonly Entity[]
  /** The tax year so far, for the money underneath. */
  year: Period
  today: string
}

function whenIn(inDays: number): string {
  if (inDays < 0) return `${String(-inDays)} days ago`
  if (inDays === 0) return 'today'
  if (inDays === 1) return 'tomorrow'
  return `in ${String(inDays)} days`
}

function Line({
  mark,
  count,
  says,
  bad,
}: {
  mark: string
  count: number
  says: string
  bad?: boolean
}) {
  // A row that counts nothing is not drawn. Four permanent zeroes is a screen
  // you learn to look past, and then you look past the one that is not zero.
  if (count === 0) return null
  return (
    <li className={`brief-line${bad === true ? ' brief-line-bad' : ''}`}>
      <span className="brief-mark" aria-hidden="true">
        {mark}
      </span>
      <span className="brief-count">{count}</span>
      <span className="brief-says">{says}</span>
    </li>
  )
}

/**
 * What is going on right now, at the top of the day.
 *
 * The screen the owner drew, built from rows that already exist. His
 * "Available £1,840" is not here and cannot be: the app has never known a bank
 * balance, and a guessed one would be the most expensive number on screen.
 * What is here instead is the year as it stands — made, owed, left — which is
 * the question the balance was standing in for.
 */
export function Summary({ items, things, year, today }: Props) {
  const counts: Counts = summarise({ items, things, today })
  const soonest = counts.coming.slice(0, 3)

  return (
    <section className="brief" aria-label="What is going on now">
      <ul className="brief-lines">
        <Line
          mark="🔴"
          count={counts.overdue.length}
          says={counts.overdue.length === 1 ? 'thing is late' : 'things are late'}
          bad
        />
        <Line
          mark="🟠"
          count={counts.coming.length}
          says={`landing within ${String(SOON_DAYS)} days`}
        />
        <Line
          mark="📥"
          count={counts.inbox.length}
          says="not sorted yet"
        />
      </ul>

      {soonest.length > 0 && (
        <ul className="brief-coming">
          {soonest.map((one) => (
            <li
              key={`${one.title}-${one.day}`}
              className={`brief-next${one.inDays < 0 ? ' brief-next-bad' : ''}`}
            >
              <span className="brief-what">{one.title}</span>
              <span className="brief-when">{whenIn(one.inDays)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="brief-money" aria-label="The tax year so far">
        <div>
          <dt>Made</dt>
          <dd>{pounds(year.grossPence)}</dd>
        </div>
        <div>
          <dt>Put aside</dt>
          {/* Never a silent zero: with no figures for the year, what is owed is
              unknown, and £0 is the lie that costs money in January. */}
          <dd>
            {year.missingRates ? '—' : pounds(year.taxPence + year.niPence)}
          </dd>
        </div>
        <div className="brief-money-left">
          <dt>Left</dt>
          <dd>{year.missingRates ? '—' : pounds(year.leftPence)}</dd>
        </div>
      </dl>

      {year.missingRates && (
        <p className="brief-missing">
          This year&rsquo;s figures are not set, so what you owe is unknown —
          not nothing. Put them in on <Link to="/hmrc">HMRC</Link>.
        </p>
      )}
    </section>
  )
}

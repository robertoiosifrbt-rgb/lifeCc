import { Link as RouterLink } from 'react-router-dom'

import { monthRange, periodMoney, sliceOfYear } from '../../repository/items'
import type { Expense, Item, Link, Shift, TaxYearRow } from '../../repository/items'
import { hoursAndMinutes, pounds } from '../../shifts/money'
import './MonthMoney.css'

type Props = {
  month: string
  items: Item[]
  shifts: Shift[]
  expenses: Expense[]
  links: Link[]
  taxYears: TaxYearRow[]
}

/**
 * What the month came to.
 *
 * The honest figure, and the one a shift's sheet cannot give: money that
 * actually left the account, not what a day used up. The two are never added
 * together — that would pay for the same fuel twice.
 *
 * Nothing at all is shown for a month with no work in it. An empty month is
 * not a month that earned nothing; it is a month you have not written down,
 * and a row of zeroes says the wrong one of those.
 */
export function MonthMoney({
  month,
  items,
  shifts,
  expenses,
  links,
  taxYears,
}: Props) {
  const range = monthRange(month)
  const sum = periodMoney({
    items,
    shifts,
    expenses,
    links,
    ...range,
    // What this month adds to the year's bill, not a slice of a flat rate.
    ...sliceOfYear({ items, shifts, expenses, links, taxYears, from: range.from }),
  })
  if (sum.shifts === 0 && sum.spentPence === 0) return null

  const reserve = sum.taxPence + sum.niPence

  return (
    <section className="money" aria-label="What the month came to">
      <dl className="money-rows">
        <div className="money-row">
          <dt>Made</dt>
          <dd>{pounds(sum.grossPence)}</dd>
        </div>
        <div className="money-row">
          <dt>Spent</dt>
          <dd>−{pounds(sum.spentPence)}</dd>
        </div>
        <div className="money-row money-row-strong">
          <dt>Profit</dt>
          <dd>{pounds(sum.profitPence)}</dd>
        </div>
        {/* What this month adds to the year's bill. The way in is the year
            itself: the figures behind this number live there, and there is
            nowhere else they could be edited without saying two things. */}
        <div className="money-row">
          <dt>
            <RouterLink className="money-open" to="/hmrc">
              Tax and NI
            </RouterLink>
          </dt>
          <dd>{sum.missingRates ? '—' : `−${pounds(reserve)}`}</dd>
        </div>
        <div className="money-row money-row-left">
          <dt>Left</dt>
          <dd>{sum.missingRates ? '—' : pounds(sum.leftPence)}</dd>
        </div>
      </dl>

      <p className="money-worked">
        {sum.shifts} {sum.shifts === 1 ? 'shift' : 'shifts'} ·{' '}
        {hoursAndMinutes(sum.minutes)} · {sum.km.toFixed(1)} km
      </p>

      {sum.missingRates && (
        <p className="money-note">
          This year&rsquo;s figures are not set, so what is owed on the month is
          unknown — not nothing. Put them in on <RouterLink to="/hmrc">HMRC</RouterLink>.
        </p>
      )}

      {/* A month with work in it and nothing spent is almost always a month
          whose receipts are not written down, not a month that cost nothing.
          Left over is only as true as Spent, and this is the one place that
          can say so before the number is believed. */}
      {sum.spentPence === 0 && sum.shifts > 0 && (
        <p className="money-note">
          Nothing written down as spent. Fuel and the rest go under{' '}
          <strong>Money out</strong> — until they do, Profit is only what came
          in.
        </p>
      )}
    </section>
  )
}

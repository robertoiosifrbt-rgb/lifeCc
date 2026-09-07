import { TaxYearForm } from '../../hmrc/TaxYearForm'
import { useScreen } from '../../items/context'
import {
  figuresOf,
  incomeOf,
  periodMoney,
  taxBill,
  dueDates,
  taxYearOf,
  yearIn,
} from '../../repository/items'
import { pounds } from '../../shifts/money'
import './HmrcScreen.css'

/**
 * The year, and what it owes.
 *
 * Not a reserve. A percentage of profit cannot know that the first slice is
 * untaxed, that Class 4 stops climbing, or that a dividend pays no National
 * Insurance at all — and it has never had anything to say about a wage.
 *
 * It reads every module rather than sitting inside one, because there is a
 * single allowance for the whole person and where it lands changes the answer.
 * Three sums, each right on its own, come to a wrong total.
 */
export function HmrcScreen() {
  const { data, today } = useScreen()
  const year = taxYearOf(today)

  // The trading profit is the app's to know: every shift's takings, less what
  // was actually spent earning them, over the tax year rather than the month.
  const trading = periodMoney({
    items: data.items,
    shifts: data.shifts,
    expenses: data.expenses,
    links: data.links,
    from: year.from,
    to: year.to,
  })

  // The year's own row, or none if this April has not been set up yet. Last
  // year's row is untouched either way, which is the whole reason each year
  // has one.
  const settings = yearIn(data.taxYears, year.label)
  const bill =
    settings === null
      ? null
      : taxBill(figuresOf(settings), incomeOf(settings, trading.profitPence))

  return (
    <section className="hmrc">
      <p className="hmrc-year">
        {year.label} — {year.from} to {year.to}
      </p>

      <dl className="hmrc-sums" aria-label="What the year has brought in">
        <div>
          <dt>Made from work</dt>
          <dd>{pounds(trading.grossPence)}</dd>
        </div>
        <div>
          <dt>Spent on it</dt>
          <dd>{pounds(trading.spentPence)}</dd>
        </div>
        <div>
          <dt>Profit</dt>
          <dd>{pounds(trading.profitPence)}</dd>
        </div>
      </dl>

      {bill === null ? (
        <p className="hmrc-empty">
          No bill yet. It needs this year&rsquo;s figures, below — the
          allowance, the bands and the rates. Until they are in, what is owed is
          unknown, which is not the same as nothing.
        </p>
      ) : (
        <dl className="hmrc-bill" aria-label="What the year owes">
          <div>
            <dt>Income tax</dt>
            <dd>{pounds(bill.incomeTaxPence)}</dd>
          </div>
          <div>
            <dt>Dividend tax</dt>
            <dd>{pounds(bill.dividendTaxPence)}</dd>
          </div>
          <div>
            <dt>Class 4</dt>
            <dd>{pounds(bill.class4Pence)}</dd>
          </div>
          <div className="hmrc-total">
            <dt>Owed for the year</dt>
            <dd>{pounds(bill.totalDuePence)}</dd>
          </div>
          <div className="hmrc-total">
            <dt>To find</dt>
            <dd>{pounds(bill.toFindPence)}</dd>
          </div>
        </dl>
      )}

      {/* When, not only how much. A first good year turns into a bad January
          because the balance and half of the next year fall on the same day,
          and somebody who put aside exactly what they owed is short. */}
      {bill !== null && (
        <dl className="hmrc-when" aria-label="When it is wanted">
          <div className="hmrc-total">
            <dt>{dueDates(year).balancing}</dt>
            <dd>
              {pounds(bill.balancingPence + bill.instalmentPence)}
            </dd>
          </div>
          <div>
            <dt>The year itself</dt>
            <dd>{pounds(bill.balancingPence)}</dd>
          </div>
          {bill.instalmentsAsked && (
            <>
              <div>
                <dt>Towards next year</dt>
                <dd>{pounds(bill.instalmentPence)}</dd>
              </div>
              <div>
                <dt>{dueDates(year).secondInstalment}</dt>
                <dd>{pounds(bill.instalmentPence)}</dd>
              </div>
            </>
          )}
        </dl>
      )}

      {/* Said only when there is something to say. Above the small profits
          threshold the year counts by itself, and a line reading £0.00 would
          make a choice that does not exist look like one that was declined. */}
      {bill !== null && bill.class2OfferedPence > 0 && (
        <p className="hmrc-offer">
          Your profit is under the small profits threshold, so this year does
          not count towards a State Pension on its own. Class 2 is voluntary:{' '}
          <strong>{pounds(bill.class2OfferedPence)}</strong> buys the year. It is
          not part of what is owed above, and HMRC will not ask for it.
        </p>
      )}

      <TaxYearForm
        year={settings}
        label={year.label}
        onSave={(next) => data.saveTaxYear(next)}
      />
    </section>
  )
}

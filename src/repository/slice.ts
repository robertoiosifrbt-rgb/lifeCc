// Where a stretch of work sits inside its tax year.
//
// Every reserve in the app is worked out the same way: what this slice adds to
// the year's bill. That needs three things a screen cannot know on its own —
// the year's figures, the income that is not trading, and the profit the year
// had already made before the slice began. Assembled once, here, so a day, a
// month and a year cannot end up answering differently.

import { figuresOf, incomeOf, yearIn } from './hmrc-year'
import type { TaxYearRow } from './hmrc-year'
import type { Income, TaxFigures } from './hmrc'
import type { Expense } from './expense'
import type { Item } from './item'
import type { Link } from './link'
import { periodMoney } from './period'
import type { Shift } from './shift'
import { taxYearOf } from './taxyear'

/** What `periodMoney` needs to know about the year around a stretch of days. */
export type Slice = {
  figures: TaxFigures | null
  income: Income | null
  beforePence: number
}

/** The day before this one, as 'YYYY-MM-DD'. */
export function dayBefore(day: string): string {
  const at = new Date(`${day}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() - 1)
  return at.toISOString().slice(0, 10)
}

/**
 * The year around a slice that starts on `from`.
 *
 * With no figures for that year the slice comes back unknown rather than
 * free: a screen showing £0.00 of tax is lying in the direction that costs
 * money.
 */
export function sliceOfYear(input: {
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  links: readonly Link[]
  taxYears: readonly TaxYearRow[]
  /** The first day of the slice, which is also the day that names the year. */
  from: string
}): Slice {
  const year = taxYearOf(input.from)
  const settings = yearIn(input.taxYears, year.label)
  if (settings === null) return { figures: null, income: null, beforePence: 0 }

  // What the year had already earned. Its own reserve is not wanted here, only
  // the profit, so the figures are deliberately left out of this call.
  const before =
    input.from <= year.from
      ? 0
      : periodMoney({
          items: input.items,
          shifts: input.shifts,
          expenses: input.expenses,
          links: input.links,
          from: year.from,
          to: dayBefore(input.from),
        }).profitPence

  return {
    figures: figuresOf(settings),
    // The trading profit is not read from here: `beforePence` and the slice
    // carry it, and a year that counted it twice would tax it twice.
    income: incomeOf(settings, 0),
    beforePence: Math.max(0, before),
  }
}

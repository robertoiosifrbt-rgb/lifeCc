// What a stretch of days came to: earned, spent, and what is left.
//
// This is the honest figure, and the shift sheet's is not. A shift reports
// what it used up at the rate the pump has been charging; here the money that
// actually left the account is counted instead. Adding both would count the
// same fuel twice, so nothing here looks at a shift's consumption.

import type { Expense } from './expense'
import type { Item } from './item'
import type { Income, TaxFigures } from './hmrc'
import { figuresOf, incomeOf, yearIn } from './hmrc-year'
import type { TaxYearRow } from './hmrc-year'
import type { Link } from './link'
import { ROAD_COST_FIELDS } from './road-cost'
import { reserveFor } from './reserve'
import { directCostsPence, earnedPence } from './shift'
import type { Shift } from './shift'
import { taxYearOf } from './taxyear'
import type { TaxYear } from './taxyear'

const ROAD_COST_CATEGORIES: readonly Expense['category'][] = Object.values(ROAD_COST_FIELDS)

export type Period = {
  /** Everything the platforms and the tips brought in. */
  grossPence: number
  /**
   * What went out for work: fuel, repairs, insurance, the rest, each counted
   * only for the share of it that was earning — plus the parking and tolls
   * paid inside the shifts themselves.
   */
  spentPence: number
  /** What the tax is worked out on. Can be negative; a bad month is a fact. */
  profitPence: number
  taxPence: number
  niPence: number
  /** What is left after the reserve. */
  leftPence: number

  shifts: number
  minutes: number
  km: number
  /** True when the year's figures are not set, so the reserve is not an answer. */
  missingRates: boolean
}

function inRange(day: string | null, from: string, to: string): boolean {
  // Days are 'YYYY-MM-DD', so comparing them as text compares them as dates.
  return day !== null && day >= from && day <= to
}

function minutesOf(shift: Shift): number {
  let total = 0
  for (const session of shift.sessions) {
    if (session.ended_at === null) continue
    total += (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000
  }
  return Math.round(total)
}

/**
 * The sum over the days from `from` to `to`, both included.
 *
 * A day range rather than a month, because the same question gets asked of a
 * week and of a tax year, and the answer must not be written three times.
 *
 * The percentages come from the settings as they stand, not from what each
 * shift pinned. A shift pins its rates so its own estimate stops moving; a
 * period is not a shift, and what you should be putting aside now is what you
 * have set now.
 */
export function periodMoney(input: {
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  /** Needed only to keep a road-cost Expense from being counted twice — see
   *  below. */
  links: readonly Link[]
  from: string
  to: string
  /** The tax year's figures, or null when it has not been set up. */
  figures?: TaxFigures | null
  /** The wage and dividends of the same year: they decide where profit lands. */
  income?: Income | null
  /** Trading profit of the year before this stretch began. */
  beforePence?: number
}): Period {
  const { items, shifts, expenses, links, from, to } = input
  const figures = input.figures ?? null
  const income = input.income ?? null

  const inside = new Map<string, Item>()
  for (const item of items) {
    if (item.deleted_at === null && inRange(item.due, from, to)) {
      inside.set(item.id, item)
    }
  }

  // `shifts` here already carries a road-cost Expense's amount in place of
  // the legacy column (`withRoadCostExpenses`, applied once for the whole
  // snapshot) — real money, but the same money `directCostsPence` below
  // and the Expense loop after it would otherwise both count. A road-cost
  // category Expense linked `about` an in-range shift is skipped in the
  // Expense loop for exactly that reason: it is already inside `directPence`.
  const roadCostExpenseIds = new Set(
    expenses
      .filter((expense) => (ROAD_COST_CATEGORIES as readonly string[]).includes(expense.category))
      .filter((expense) =>
        links.some((link) => link.kind === 'about' && link.from_id === expense.item_id && inside.has(link.to_id)),
      )
      .map((expense) => expense.item_id),
  )

  let grossPence = 0
  let directPence = 0
  let minutes = 0
  let km = 0
  let worked = 0
  for (const shift of shifts) {
    if (!inside.has(shift.item_id)) continue
    worked += 1
    grossPence += earnedPence(shift)
    // Parking and tolls are spent, not estimated, so they belong in the same
    // column as the receipts below rather than in the fuel estimate this
    // function deliberately ignores.
    directPence += directCostsPence(shift)
    minutes += minutesOf(shift)
    if (shift.odo_start !== null && shift.odo_end !== null) {
      km += shift.odo_end - shift.odo_start
    }
  }

  // Only the working share of each bill. A car insured for a year is insured
  // for the shopping too, and the tax is worked out on what it cost to earn,
  // not on what left the account.
  let spentPence = 0
  for (const expense of expenses) {
    if (!inside.has(expense.item_id)) continue
    if (roadCostExpenseIds.has(expense.item_id)) continue
    spentPence += Math.round((expense.amount * expense.business_pct) / 100 * 100)
  }

  const profitPence = grossPence - spentPence - directPence

  // What this stretch adds to the year's bill, not a percentage of it. Where
  // the profit lands decides what it costs, and only the year knows that.
  const reserve =
    figures === null || income === null
      ? { taxPence: 0, niPence: 0, totalPence: 0 }
      : reserveFor(figures, income, input.beforePence ?? 0, profitPence)

  return {
    grossPence,
    spentPence: spentPence + directPence,
    profitPence,
    taxPence: reserve.taxPence,
    niPence: reserve.niPence,
    leftPence: profitPence - reserve.totalPence,
    shifts: worked,
    minutes,
    km: Math.round(km * 10) / 10,
    missingRates: figures === null || income === null,
  }
}

/**
 * The tax year "now" falls in, and what it has come to so far.
 *
 * Home's summary and Money asked this exact question separately before, each
 * working out the year, finding its settings row and calling `periodMoney`
 * on its own — two places that could answer "what has this year made" with
 * two different sums the day one of them changed and the other did not.
 * This is the one place now; neither screen works it out by hand.
 */
export function currentYearMoney(input: {
  items: readonly Item[]
  shifts: readonly Shift[]
  expenses: readonly Expense[]
  links: readonly Link[]
  taxYears: readonly TaxYearRow[]
  today: string
}): { year: TaxYear; money: Period } {
  const year = taxYearOf(input.today)
  const settings = yearIn(input.taxYears, year.label)
  const money = periodMoney({
    items: input.items,
    shifts: input.shifts,
    expenses: input.expenses,
    links: input.links,
    from: year.from,
    to: year.to,
    figures: settings === null ? null : figuresOf(settings),
    income: settings === null ? null : incomeOf(settings, 0),
  })
  return { year, money }
}

/** The first and last day of a month, as 'YYYY-MM-DD'. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number)
  // Day zero of the next month is the last day of this one, and it handles
  // February without anybody writing down how long February is.
  const last = new Date(Date.UTC(year ?? 0, index ?? 1, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

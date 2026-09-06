// The shape of money going out.
//
// One row per anchor item, like a shift's numbers: an expense happened on a
// day, and the day is the item's.

import { asRecord, optionalDay, optionalNumber, requiredText } from './row'
import type { Fill } from './fuel'

export const CATEGORIES = ['fuel', 'repair', 'insurance', 'parking', 'tolls', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_NAMES: Record<Category, string> = {
  fuel: 'Fuel',
  repair: 'Repair',
  insurance: 'Insurance',
  parking: 'Parking',
  tolls: 'Tolls',
  other: 'Something else',
}

export type Expense = {
  item_id: string
  owner: string
  amount: number
  category: Category
  /** The odometer at the pump. Only a fuel purchase has one. */
  odo: number | null
  /** Whether the tank was filled. Only a fuel purchase has one. */
  full_tank: boolean | null
  /**
   * How much went in. Only a fuel purchase has litres.
   *
   * Without them the app can say what a kilometre costs in money and nothing
   * about what the car is drinking — no l/100km and no MPG, which are the two
   * numbers that show a car has a problem before the bill does.
   */
  litres: number | null
  /**
   * What a bill covers, when it covers a stretch rather than a day.
   *
   * A year of insurance paid in September is not September's cost. Null for
   * the ordinary case: a tank of fuel is spent on the day it is bought.
   */
  covers_from: string | null
  covers_to: string | null
  /**
   * What share of this bill was for work, 0 to 100.
   *
   * A car insured for a year is insured for the shopping too, and only the
   * working part of it is a cost of earning. Counting the whole makes the
   * profit look smaller than it is and the tax bill land short in January.
   */
  business_pct: number
}

export function expenseFromRow(row: unknown): Expense {
  const raw = asRecord(row)

  const category = requiredText(raw, 'category')
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Unknown category: ${category}`)
  }

  const amount = optionalNumber(raw, 'amount')
  if (amount === null) throw new Error('Expense without an amount')
  if (amount < 0) throw new Error(`An expense below nothing: ${amount}`)

  const odo = optionalNumber(raw, 'odo')
  // Normalised once: a missing column and an explicit null are the same
  // absence, and the checks below have to agree about that. Comparing the raw
  // value against null alone treats undefined as present, which refuses every
  // non-fuel expense that simply has no such column.
  const raw_full = raw['full_tank']
  if (raw_full !== null && raw_full !== undefined && typeof raw_full !== 'boolean') {
    throw new Error('full_tank is not a yes or no')
  }
  const full_tank = raw_full ?? null

  // The database says the pump details belong to fuel and nothing else, so a
  // row saying otherwise did not come from there as it stands.
  if (category !== 'fuel' && (odo !== null || full_tank !== null)) {
    throw new Error(`A ${category} expense carrying pump details`)
  }

  // Absent means the whole of it: the column arrived after the rows did, and
  // an expense written against a line of work was meant as a cost of it.
  const share = optionalNumber(raw, 'business_pct')
  const business_pct = share ?? 100
  if (business_pct < 0 || business_pct > 100) {
    throw new Error(`A business share outside 0-100: ${business_pct}`)
  }

  const litres = optionalNumber(raw, 'litres')
  if (litres !== null && litres <= 0) {
    throw new Error(`A fill of nothing or less: ${litres}`)
  }
  if (category !== 'fuel' && litres !== null) {
    throw new Error(`A ${category} expense carrying litres`)
  }

  const covers_from = optionalDay(raw, 'covers_from')
  const covers_to = optionalDay(raw, 'covers_to')
  // The database refuses one without the other, so a row carrying half a
  // stretch did not come from there — and half a stretch cannot be spread.
  if ((covers_from === null) !== (covers_to === null)) {
    throw new Error('A bill that covers a stretch with only one end')
  }
  if (covers_from !== null && covers_to !== null && covers_to < covers_from) {
    throw new Error('A bill whose cover ends before it starts')
  }

  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    amount,
    category: category as Category,
    odo,
    full_tank,
    litres,
    covers_from,
    covers_to,
    business_pct,
  }
}

/**
 * The fill-ups among a set of expenses, as the rate wants them.
 *
 * A fuel purchase with no reading cannot take part: without an odometer it
 * measures no distance. Its money is lost to the rate — which is a reason to
 * write the reading down, not a reason to guess one.
 */
export function fillsOf(expenses: readonly Expense[]): Fill[] {
  const fills: Fill[] = []
  for (const expense of expenses) {
    if (expense.category !== 'fuel' || expense.odo === null) continue
    fills.push({
      pence: Math.round(expense.amount * 100),
      odo: expense.odo,
      full: expense.full_tank === true,
      litres: expense.litres,
    })
  }
  return fills
}

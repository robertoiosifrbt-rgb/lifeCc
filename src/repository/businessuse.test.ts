import { describe, expect, it } from 'vitest'

import { expenseFromRow } from './expense'
import { periodMoney } from './period'
import type { Expense } from './expense'
import type { Item } from './item'
import { kilometres, drivenKilometres } from './shift'
import type { Shift } from './shift'

const stamps = {
  version: 1,
  created_at: '2026-08-01T00:00:00+00:00',
  updated_at: '2026-08-01T00:00:00+00:00',
  deleted_at: null,
}

const shift: Shift = {
  item_id: 's1',
  owner: 'me',
  odo_start: 10000,
  odo_end: 10200,
  tips: null,
  personal_km: null,
  bonuses: null,
  parking: null,
  tolls: null,
  other_cost: null,
  rate_fuel_per_km: null,
  rate_vehicle_per_km: null,
  sessions: [],
  earnings: [],
}

const anchor: Item = {
  id: 'e1',
  owner: 'me',
  kind: 'expense',
  state: 'active',
  title: 'Insurance',
  due: '2026-08-10',
  done_at: null,
  area_id: 'a1',
  waiting_since: null,
  ...stamps,
}

const expense: Expense = {
  item_id: 'e1',
  owner: 'me',
  amount: 600,
  category: 'insurance',
  odo: null,
  full_tank: null,
  litres: null,
  covers_from: null,
  covers_to: null,
  business_pct: 100,
}

describe('the personal part of a day', () => {
  it('counts the whole day when none of it was personal', () => {
    expect(kilometres(shift)).toBe(200)
  })

  it('takes the personal kilometres off the working ones', () => {
    expect(kilometres({ ...shift, personal_km: 40 })).toBe(160)
  })

  it('still reports what the car actually drove', () => {
    expect(drivenKilometres({ ...shift, personal_km: 40 })).toBe(200)
  })

  it('has no answer until both readings are there', () => {
    expect(kilometres({ ...shift, odo_end: null })).toBeNull()
  })
})

describe('the business share of a bill', () => {
  function spent(business_pct: number): number {
    return periodMoney({
      items: [anchor],
      shifts: [],
      expenses: [{ ...expense, business_pct }],
      from: '2026-08-01',
      to: '2026-08-31',
    }).spentPence
  }

  it('counts the whole of a bill that was all for work', () => {
    expect(spent(100)).toBe(60_000)
  })

  it('counts only the working share of a bill that was shared', () => {
    // A year of insurance on a car used seven tenths of the time for work.
    expect(spent(70)).toBe(42_000)
  })

  it('counts nothing at all when none of it was work', () => {
    expect(spent(0)).toBe(0)
  })

  it('reads a row written before the column existed as all of it', () => {
    const row = { item_id: 'e1', owner: 'me', amount: 12, category: 'other' }
    expect(expenseFromRow(row).business_pct).toBe(100)
  })

  it('refuses a share outside nought to a hundred', () => {
    const row = {
      item_id: 'e1',
      owner: 'me',
      amount: 12,
      category: 'other',
      business_pct: 140,
    }
    expect(() => expenseFromRow(row)).toThrow(/outside/)
  })
})

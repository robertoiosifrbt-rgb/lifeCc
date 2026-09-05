import { describe, expect, it } from 'vitest'

import { expenseFromRow, fillsOf } from './expense'

const FUEL = {
  item_id: 'i1',
  owner: 'me',
  amount: '70.00',
  category: 'fuel',
  odo: '120000.0',
  full_tank: true,
}

describe('expenseFromRow', () => {
  it('reads a fill-up, with the amount PostgREST sends as text', () => {
    expect(expenseFromRow(FUEL)).toEqual({
      item_id: 'i1',
      owner: 'me',
      amount: 70,
      category: 'fuel',
      odo: 120000,
      full_tank: true,
      litres: null,
      covers_from: null,
      covers_to: null,
      business_pct: 100,
    })
  })

  it('takes an expense whose row simply has no pump columns', () => {
    // A missing column and an explicit null are the same absence. Treating
    // undefined as present refuses every insurance premium there is.
    expect(
      expenseFromRow({ item_id: 'i2', owner: 'me', amount: '400', category: 'insurance' }),
    ).toMatchObject({ category: 'insurance', odo: null, full_tank: null })
  })

  it('refuses pump details on anything but fuel', () => {
    expect(() =>
      expenseFromRow({ ...FUEL, category: 'insurance', full_tank: null }),
    ).toThrow('pump details')
    expect(() =>
      expenseFromRow({ ...FUEL, category: 'repair', odo: null }),
    ).toThrow('pump details')
  })

  it('refuses a category nobody wrote, and money below nothing', () => {
    expect(() => expenseFromRow({ ...FUEL, category: 'bribe' })).toThrow('bribe')
    expect(() => expenseFromRow({ ...FUEL, amount: '-1' })).toThrow('below nothing')
  })
})

describe('fillsOf', () => {
  it('keeps only fuel that has a reading', () => {
    const fills = fillsOf([
      expenseFromRow(FUEL),
      // Fuel with no reading measures no distance, so it cannot take part.
      expenseFromRow({ ...FUEL, item_id: 'i2', odo: null, full_tank: false }),
      expenseFromRow({ item_id: 'i3', owner: 'me', amount: '400', category: 'repair' }),
    ])
    expect(fills).toEqual([{ pence: 7000, odo: 120000, full: true, litres: null }])
  })
})

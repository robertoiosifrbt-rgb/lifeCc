// Split out of shift.test.ts at the 300-line limit.

import { describe, expect, it } from 'vitest'

import type { Expense } from './expense'
import type { Link } from './link'
import { roadCostExpenseOf, withRoadCostExpenses } from './shift'
import type { Shift } from './shift'

function shift(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: null,
    odo_end: null,
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
    ...over,
  }
}

function expense(over: Partial<Expense> = {}): Expense {
  return {
    item_id: 'e1',
    owner: 'me',
    amount: 4.5,
    category: 'parking',
    odo: null,
    full_tank: null,
    litres: null,
    covers_from: null,
    covers_to: null,
    business_pct: 100,
    ...over,
  }
}

function about(id: string, from_id: string, to_id: string): Link {
  return { id, owner: 'me', from_id, to_id, kind: 'about', created_at: '2026-09-01T00:00:00Z' }
}

describe('roadCostExpenseOf', () => {
  it('none when no Expense is linked', () => {
    expect(roadCostExpenseOf([], [], 'i1', 'parking')).toBeNull()
  })

  it('the Expense an `about` link (from the Expense, to the shift) names', () => {
    const links = [about('l1', 'e1', 'i1')]
    const expenses = [expense()]
    expect(roadCostExpenseOf(links, expenses, 'i1', 'parking')).toEqual(expenses[0])
  })

  it('ignores an Expense of a different category, even if linked', () => {
    const links = [about('l1', 'e1', 'i1')]
    const expenses = [expense({ category: 'tolls' })]
    expect(roadCostExpenseOf(links, expenses, 'i1', 'parking')).toBeNull()
  })

  it('ignores a link belonging to another shift', () => {
    const links = [about('l1', 'e1', 'other-shift')]
    const expenses = [expense()]
    expect(roadCostExpenseOf(links, expenses, 'i1', 'parking')).toBeNull()
  })

  it('ignores a link of a different kind', () => {
    const links = [{ ...about('l1', 'e1', 'i1'), kind: 'uses' as const }]
    const expenses = [expense()]
    expect(roadCostExpenseOf(links, expenses, 'i1', 'parking')).toBeNull()
  })
})

describe('withRoadCostExpenses', () => {
  it('a Workday with no linked Expense keeps its legacy column value untouched', () => {
    const shifts = [shift({ parking: 12 })]
    expect(withRoadCostExpenses(shifts, [], [])).toEqual(shifts)
  })

  it('a linked Expense wins over the legacy column for that field', () => {
    const shifts = [shift({ parking: 12, tolls: 3 })]
    const links = [about('l1', 'e1', 'i1')]
    const expenses = [expense({ item_id: 'e1', category: 'parking', amount: 20 })]
    const result = withRoadCostExpenses(shifts, expenses, links)[0]!
    expect(result.parking).toBe(20)
    // Untouched: only the field with a real linked Expense changes.
    expect(result.tolls).toBe(3)
  })

  it('each field resolves independently, from its own category', () => {
    const shifts = [shift({ parking: 1, tolls: 2, other_cost: 3 })]
    const links = [about('l1', 'e1', 'i1'), about('l2', 'e2', 'i1')]
    const expenses = [
      expense({ item_id: 'e1', category: 'parking', amount: 100 }),
      expense({ item_id: 'e2', category: 'other', amount: 300 }),
    ]
    const result = withRoadCostExpenses(shifts, expenses, links)[0]!
    expect(result.parking).toBe(100)
    expect(result.tolls).toBe(2)
    expect(result.other_cost).toBe(300)
  })

  it('leaves a shift with no matching Expense at all exactly as it was, same reference', () => {
    const shifts = [shift()]
    expect(withRoadCostExpenses(shifts, [], [])[0]).toBe(shifts[0])
  })
})

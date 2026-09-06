import { describe, expect, it } from 'vitest'

import type { CalendarDay } from '../../repository/items'
import type { Item } from '../../repository/items'
import { awayFromToday, monthCells, monthGrid, openingDay } from './month'

const TODAY = '2026-09-04'

function item(id: string): Item {
  return {
    id,
    owner: 'a',
    kind: 'task',
    state: 'active',
    title: `title ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
  area_id: null,
    waiting_since: null,
  }
}

const day = (d: string, planned: Item[], done: Item[]): CalendarDay => ({
  day: d,
  planned,
  done,
})

describe('monthCells', () => {
  it('pads to whole weeks, Monday first', () => {
    // 1 September 2026 is a Tuesday, 30 September a Wednesday.
    const cells = monthCells('2026-09')
    expect(cells.length % 7).toBe(0)
    expect(cells[0]?.day).toBe('2026-08-31')
    expect(cells[cells.length - 1]?.day).toBe('2026-10-04')
  })

  it('pads with real days, not blanks, so the edge is reachable', () => {
    const outside = monthCells('2026-09').filter((cell) => !cell.inMonth)
    expect(outside.every((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell.day))).toBe(true)
  })

  it('holds every day of the month, once', () => {
    const inside = monthCells('2026-09').filter((cell) => cell.inMonth)
    expect(inside.length).toBe(30)
    expect(new Set(inside.map((cell) => cell.day)).size).toBe(30)
  })

  it('needs no padding when the month starts on Monday and ends on Sunday', () => {
    // February 2027: the 1st is a Monday, the 28th a Sunday.
    const cells = monthCells('2027-02')
    expect(cells.length).toBe(28)
    expect(cells.every((cell) => cell.inMonth)).toBe(true)
  })

  it('handles a leap February', () => {
    const inside = monthCells('2028-02').filter((cell) => cell.inMonth)
    expect(inside.length).toBe(29)
  })
})

describe('monthGrid', () => {
  it('counts what a day holds, straight off the days given', () => {
    const weeks = monthGrid('2026-09', [
      day('2026-09-04', [item('a'), item('b')], [item('c')]),
    ])
    const cell = weeks.flat().find((c) => c.day === '2026-09-04')
    expect(cell?.planned).toBe(2)
    expect(cell?.done).toBe(1)
  })

  it('leaves a day with nothing at zero, not undefined', () => {
    const cell = monthGrid('2026-09', []).flat().find((c) => c.day === '2026-09-04')
    expect(cell?.planned).toBe(0)
    expect(cell?.done).toBe(0)
  })

  it('marks the padding days too, so nothing is hidden at the edge', () => {
    const weeks = monthGrid('2026-09', [day('2026-08-31', [item('a')], [])])
    const cell = weeks.flat().find((c) => c.day === '2026-08-31')
    expect(cell?.inMonth).toBe(false)
    expect(cell?.planned).toBe(1)
  })

  it('gives weeks of seven', () => {
    for (const week of monthGrid('2026-09', [])) expect(week.length).toBe(7)
  })
})

describe('openingDay', () => {
  it('opens the current month on today', () => {
    expect(openingDay('2026-09', TODAY)).toBe(TODAY)
  })

  it('opens any other month on its first day', () => {
    expect(openingDay('2026-10', TODAY)).toBe('2026-10-01')
    expect(openingDay('2026-08', TODAY)).toBe('2026-08-01')
  })
})

describe('awayFromToday', () => {
  it('is false sitting on today, in today\'s month', () => {
    expect(awayFromToday('2026-09', TODAY, TODAY)).toBe(false)
  })

  it('is true in another month', () => {
    expect(awayFromToday('2026-10', '2026-10-01', TODAY)).toBe(true)
  })

  it('is true on another day of this month: the day moved, not just the month', () => {
    expect(awayFromToday('2026-09', '2026-09-12', TODAY)).toBe(true)
  })
})

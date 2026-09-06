import { describe, expect, it } from 'vitest'

import type { Item } from '../../repository/items'
import {
  EXPANDED_DAYS,
  oldestCreated,
  oldestDue,
  oldOverdueLabel,
  splitOverdue,
  undatedLabel,
} from './collapse'

const TODAY = '2026-09-04'

function task(id: string, over: Partial<Item> = {}): Item {
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
    ...over,
  }
}

describe('splitOverdue', () => {
  it('leaves something overdue yesterday expanded', () => {
    const { recent, old } = splitOverdue([task('yesterday', { due: '2026-09-03' })], TODAY)
    expect(recent.map((i) => i.id)).toEqual(['yesterday'])
    expect(old).toEqual([])
  })

  it('cuts exactly at seven days', () => {
    const edge = task('edge', { due: '2026-08-28' })
    const beyond = task('beyond', { due: '2026-08-27' })

    const { recent, old } = splitOverdue([edge, beyond], TODAY)

    expect(recent.map((i) => i.id)).toEqual(['edge'])
    expect(old.map((i) => i.id)).toEqual(['beyond'])
    expect(EXPANDED_DAYS).toBe(7)
  })

  it('collapses what is much older', () => {
    const { recent, old } = splitOverdue(
      [task('august', { due: '2026-08-20' }), task('july', { due: '2026-07-01' })],
      TODAY,
    )
    expect(recent).toEqual([])
    expect(old.map((i) => i.id)).toEqual(['august', 'july'])
  })
})

describe('oldestDue', () => {
  it('finds the oldest one', () => {
    expect(
      oldestDue([
        task('a', { due: '2026-08-20' }),
        task('b', { due: '2026-07-01' }),
        task('c', { due: '2026-08-01' }),
      ]),
    ).toBe('2026-07-01')
  })

  it('is null when there is none', () => {
    expect(oldestDue([])).toBeNull()
    expect(oldestDue([task('undated')])).toBeNull()
  })
})

describe('oldestCreated', () => {
  it('takes the day of the oldest created_at, not of due', () => {
    expect(
      oldestCreated([
        task('new', { created_at: '2026-09-01T10:00:00+00:00' }),
        task('old', { created_at: '2026-08-12T23:00:00+00:00' }),
      ]),
    ).toBe('2026-08-12')
  })
})

describe('the collapse labels', () => {
  it('says how many and since when, for overdue', () => {
    const old = Array.from({ length: 12 }, (_, i) =>
      task(`o${i}`, { due: i === 3 ? '2026-08-20' : '2026-08-25' }),
    )
    expect(oldOverdueLabel(old, TODAY)).toBe('12 overdue, the oldest from 20 August')
  })

  it('says how many and since when, for undated', () => {
    const undated = Array.from({ length: 14 }, (_, i) =>
      task(`u${i}`, {
        created_at: i === 7 ? '2026-08-12T09:00:00+00:00' : '2026-09-01T10:00:00+00:00',
      }),
    )
    expect(undatedLabel(undated, TODAY)).toBe('14 things, the oldest from 12 August')
  })

  it('does not invent a date when it has none', () => {
    expect(oldOverdueLabel([], TODAY)).toBe('0 overdue')
    expect(undatedLabel([], TODAY)).toBe('0 things')
  })
})

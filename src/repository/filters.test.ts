import { describe, expect, it } from 'vitest'

import { alive, forCalendar, forToday } from './filters'
import type { Item } from './item'

const TODAY = '2026-09-04'

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: null,
    state: 'inbox',
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

const task = (id: string, over: Partial<Item> = {}) =>
  item(id, { state: 'active', kind: 'task', ...over })

describe('alive', () => {
  it('drops deleted rows, and only those', () => {
    const list = [item('a'), item('b', { deleted_at: '2026-09-03T00:00:00+00:00' })]
    expect(alive(list).map((i) => i.id)).toEqual(['a'])
  })
})

describe('forToday', () => {
  it('shows a captured thing even though it has no date', () => {
    // Without the OR on state, you write "call X" and it appears nowhere.
    const groups = forToday([item('captured')], TODAY)
    expect(groups.inbox.map((i) => i.id)).toEqual(['captured'])
  })

  it('shows an active task with no date, so it cannot evaporate', () => {
    const groups = forToday([task('drill')], TODAY)
    expect(groups.undated.map((i) => i.id)).toEqual(['drill'])
  })

  it('splits into four groups, by date', () => {
    const groups = forToday(
      [
        item('captured'),
        task('today', { due: TODAY }),
        task('yesterday', { due: '2026-09-03' }),
        task('last-month', { due: '2026-08-20' }),
        task('undated'),
      ],
      TODAY,
    )

    expect(groups.inbox.map((i) => i.id)).toEqual(['captured'])
    expect(groups.today.map((i) => i.id)).toEqual(['today'])
    expect(groups.overdue.map((i) => i.id)).toEqual(['last-month', 'yesterday'])
    expect(groups.undated.map((i) => i.id)).toEqual(['undated'])
  })

  it('does not pull into Today what is planned for later', () => {
    const groups = forToday([task('next-week', { due: '2026-09-11' })], TODAY)
    expect(groups).toEqual({ inbox: [], today: [], overdue: [], undated: [] })
  })

  it('does not pull into Today what is finished or deleted', () => {
    const groups = forToday(
      [
        task('finished', { state: 'done', due: TODAY, done_at: TODAY }),
        task('discarded', { due: TODAY, deleted_at: '2026-09-04T08:00:00+00:00' }),
      ],
      TODAY,
    )
    expect(groups.today).toEqual([])
    expect(groups.overdue).toEqual([])
  })

  it('puts the oldest first, in inbox and in undated', () => {
    const groups = forToday(
      [
        item('new', { created_at: '2026-09-03T10:00:00+00:00' }),
        item('old', { created_at: '2026-08-12T10:00:00+00:00' }),
        task('undated-new', { created_at: '2026-09-02T10:00:00+00:00' }),
        task('undated-old', { created_at: '2026-08-14T10:00:00+00:00' }),
      ],
      TODAY,
    )
    expect(groups.inbox.map((i) => i.id)).toEqual(['old', 'new'])
    expect(groups.undated.map((i) => i.id)).toEqual(['undated-old', 'undated-new'])
  })
})

describe('forCalendar', () => {
  it('puts a task due Monday and finished Wednesday in both days', () => {
    const days = forCalendar([
      task('moved', { state: 'done', due: '2026-09-07', done_at: '2026-09-09' }),
    ])

    expect(days.map((d) => d.day)).toEqual(['2026-09-07', '2026-09-09'])
    expect(days[0]?.planned.map((i) => i.id)).toEqual(['moved'])
    expect(days[0]?.done).toEqual([])
    expect(days[1]?.planned).toEqual([])
    expect(days[1]?.done.map((i) => i.id)).toEqual(['moved'])
  })

  it('shows it once, under done, when it was planned and done on one day', () => {
    // Two headings for one row on one day show no difference, only the row
    // twice. Done is what happened, so that is the one that stays.
    const days = forCalendar([
      task('same-day', { state: 'done', due: '2026-09-07', done_at: '2026-09-07' }),
    ])

    expect(days).toHaveLength(1)
    expect(days[0]?.day).toBe('2026-09-07')
    expect(days[0]?.planned).toEqual([])
    expect(days[0]?.done.map((i) => i.id)).toEqual(['same-day'])
  })

  it('shows an undated task, finished, on the day you ticked it', () => {
    // That is why done_at exists: so nothing finished disappears everywhere.
    const days = forCalendar([task('undated', { state: 'done', done_at: '2026-09-09' })])
    expect(days).toHaveLength(1)
    expect(days[0]?.done.map((i) => i.id)).toEqual(['undated'])
  })

  it('does not show the days of deleted rows', () => {
    const days = forCalendar([
      task('discarded', { due: '2026-09-07', deleted_at: '2026-09-08T00:00:00+00:00' }),
    ])
    expect(days).toEqual([])
  })

  it('returns the days in order', () => {
    const days = forCalendar([
      task('c', { due: '2026-09-11' }),
      task('a', { due: '2026-09-05' }),
      task('b', { due: '2026-09-07' }),
    ])
    expect(days.map((d) => d.day)).toEqual(['2026-09-05', '2026-09-07', '2026-09-11'])
  })
})

describe('things stay out of Today', () => {
  it('leaves an entity out of the undated list, where it would sit for ever', () => {
    const car = item('car', { kind: 'entity', state: 'active', due: null })
    const chore = item('chore', { kind: 'task', state: 'active', due: null })
    const groups = forToday([car, chore], TODAY)
    expect(groups.undated.map((one) => one.id)).toEqual(['chore'])
  })
})

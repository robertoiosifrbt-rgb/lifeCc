import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/items'
import { headingFor } from './heading'

function item(over: Partial<Item>): Item {
  return {
    id: 'i1',
    owner: 'a',
    kind: 'task',
    state: 'active',
    title: 'call X',
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

describe('headingFor', () => {
  it('asks the question while the thing is still in the inbox', () => {
    expect(headingFor(item({ state: 'inbox', kind: null }))).toBe('What is this?')
  })

  it('does not call a letter a task', () => {
    expect(headingFor(item({ kind: 'letter' }))).toBe('Letter')
    expect(headingFor(item({ kind: 'letter', state: 'done' }))).toBe(
      'Letter, answered',
    )
  })

  it('names a task a task, open or done', () => {
    expect(headingFor(item({ kind: 'task' }))).toBe('Task')
    expect(headingFor(item({ kind: 'task', state: 'done' }))).toBe('Task, done')
  })
})

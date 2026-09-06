import { describe, expect, it } from 'vitest'

import type { Item } from '../repository/item'
import { journalEntryPath, opensInJournal, tabInfoFor } from './screens'

describe('tabInfoFor', () => {
  it('titles a bar tab with its own label', () => {
    expect(tabInfoFor('/today')).toEqual({ title: 'Home', tabPath: '/today' })
    expect(tabInfoFor('/plan')).toEqual({ title: 'Plan', tabPath: '/plan' })
    expect(tabInfoFor('/areas')).toEqual({ title: 'Areas', tabPath: '/areas' })
    expect(tabInfoFor('/money')).toEqual({ title: 'Money', tabPath: '/money' })
  })

  it('credits Calendar to Plan, so the Plan tab stays lit and titled', () => {
    expect(tabInfoFor('/calendar')).toEqual({ title: 'Plan · Calendar', tabPath: '/plan' })
  })

  it('credits Tax to Money, so the Money tab stays lit and titled', () => {
    expect(tabInfoFor('/hmrc')).toEqual({ title: 'Money · Tax', tabPath: '/money' })
  })

  it('credits Journal to Home, so the Home tab stays lit and titled', () => {
    // Journal is not a fifth bar slot: it reads as one step inside Home.
    expect(tabInfoFor('/journal')).toEqual({ title: 'Home · Journal', tabPath: '/today' })
  })

  it('has nothing to say about a screen that belongs to none of the four', () => {
    // Things is reached from the header, not from a bar tab; an area's own
    // page is a literal route param, never an exact match on ':id'.
    expect(tabInfoFor('/things')).toBeUndefined()
    expect(tabInfoFor('/areas/some-id')).toBeUndefined()
  })

  it('has nothing to say about an unknown URL', () => {
    expect(tabInfoFor('/nowhere')).toBeUndefined()
  })
})

describe('opensInJournal', () => {
  it('is true only for a journal-kind item', () => {
    expect(opensInJournal({ kind: 'journal' })).toBe(true)
  })

  it('is false for every other kind, including no kind at all', () => {
    const kinds: (Item['kind'])[] = ['task', 'letter', 'shift', 'expense', 'entity', null]
    for (const kind of kinds) {
      expect(opensInJournal({ kind })).toBe(false)
    }
  })
})

describe('journalEntryPath', () => {
  it('names the exact entry as a query parameter on /journal', () => {
    expect(journalEntryPath('abc-123')).toBe('/journal?entry=abc-123')
  })
})

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

  it('credits a real area page to Areas, by its static prefix rather than an exact match', () => {
    // The declared route is `/areas/:id`; no real URL ever equals that
    // literally, so the area's own id has to match by prefix instead —
    // without ever hardcoding which area it is.
    expect(tabInfoFor('/areas/some-id')).toEqual({ title: 'Areas', tabPath: '/areas' })
    expect(tabInfoFor('/areas/another-one')).toEqual({ title: 'Areas', tabPath: '/areas' })
  })

  it('titles Directory with its own name, and lights no bar tab for it', () => {
    // Directory is a secondary screen, reached from More — not a fifth tab,
    // so no bar button should read as active for it.
    expect(tabInfoFor('/things')).toEqual({ title: 'Directory', tabPath: '/things' })
  })

  it('titles Settings with its own name, and lights no bar tab for it', () => {
    expect(tabInfoFor('/settings')).toEqual({ title: 'Settings', tabPath: '/settings' })
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

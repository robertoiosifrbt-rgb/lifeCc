import { describe, expect, it } from 'vitest'

import { tabInfoFor } from './screens'

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

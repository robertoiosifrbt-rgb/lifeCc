// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { mount } from './domTestHelpers'
import { ShiftActions } from './ShiftActions'

const baseProps = {
  completed: false,
  dirty: true,
  busy: false,
  blockedByOpenSession: false,
  sessionMessage: null,
  errors: [],
  completionErrors: [],
  onSaveDraft: () => {},
  onComplete: () => {},
  onDelete: () => {},
}

let mounted: ReturnType<typeof mount> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('ShiftActions — rendered', () => {
  it('shows every completion requirement message, and disables Complete for them', () => {
    mounted = mount(
      <ShiftActions
        {...baseProps}
        completionErrors={[
          { field: 'due', message: 'A completed workday needs a date.' },
          { field: 'sessions', message: 'A completed workday needs at least one finished work session.' },
        ]}
      />,
    )
    const text = mounted.container.textContent ?? ''
    expect(text).toContain('A completed workday needs a date.')
    expect(text).toContain('A completed workday needs at least one finished work session.')
    const complete = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(complete?.disabled).toBe(true)
  })

  it('Complete is enabled with no completion errors and nothing else blocking it', () => {
    mounted = mount(<ShiftActions {...baseProps} />)
    const complete = mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')
    expect(complete?.disabled).toBe(false)
  })

  it('shows the session message and disables Complete/Delete when session state blocks them', () => {
    mounted = mount(
      <ShiftActions {...baseProps} blockedByOpenSession={true} sessionMessage="Stop the active session first." />,
    )
    expect(mounted.container.textContent).toContain('Stop the active session first.')
    expect(mounted.container.querySelector<HTMLButtonElement>('button[name="complete-workday"]')?.disabled).toBe(true)
    expect(mounted.container.querySelector<HTMLButtonElement>('button[name="delete-workday"]')?.disabled).toBe(true)
  })

  it('Completed: no Save draft, no Complete Workday button at all — Delete remains', () => {
    mounted = mount(<ShiftActions {...baseProps} completed={true} />)
    expect(mounted.container.querySelector('button[name="save-draft"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="complete-workday"]')).toBeNull()
    expect(mounted.container.querySelector('button[name="delete-workday"]')).not.toBeNull()
  })
})

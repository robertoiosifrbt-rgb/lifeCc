import { describe, expect, it, vi } from 'vitest'

import { fromRow } from '../repository/quick-action'
import type { QuickAction } from '../repository/quick-action'
import { quickActionActions } from './quickActionActions'

function action(id: string, position: number): QuickAction {
  return fromRow({
    id,
    owner: 'a',
    action_key: 'journal.new',
    area_id: null,
    position,
    version: 1,
    created_at: '2026-09-06T07:00:00+00:00',
    updated_at: '2026-09-06T07:00:00+00:00',
    deleted_at: null,
  })
}

// moveQuickAction sits directly on top of positionForMove's two different
// null cases — this proves the caller tells them apart rather than treating
// every refusal the same way a button at either end of the list already is.
describe('moveQuickAction', () => {
  it('resolves quietly at a real boundary — already first, moving up', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const b = action('b', 1)
    const actions = quickActionActions('owner', [a, b], write)

    await expect(actions.moveQuickAction(a, 'up')).resolves.toBeUndefined()
    expect(write).not.toHaveBeenCalled()
  })

  it('resolves quietly at a real boundary — already last, moving down', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const b = action('b', 1)
    const actions = quickActionActions('owner', [a, b], write)

    await expect(actions.moveQuickAction(b, 'down')).resolves.toBeUndefined()
    expect(write).not.toHaveBeenCalled()
  })

  it('rejects visibly, without writing, when an internal rank collision blocks the move', async () => {
    // b and c collide on position 1 — d moving up would need to land
    // strictly between them, and there is no such value. The button for
    // this move is not disabled (only the true first/last positions are),
    // so a silent resolve here would be a tap that looks like it worked
    // and did nothing — exactly what this must not do.
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const b = action('b', 1)
    const c = action('c', 1)
    const d = action('d', 2)
    const actions = quickActionActions('owner', [a, b, c, d], write)

    await expect(actions.moveQuickAction(d, 'up')).rejects.toThrow(/could not reorder/i)
    expect(write).not.toHaveBeenCalled()
  })

  it('calls write, with the single computed position, for an ordinary move', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const b = action('b', 1)
    const c = action('c', 2)
    const actions = quickActionActions('owner', [a, b, c], write)

    await actions.moveQuickAction(b, 'up')
    expect(write).toHaveBeenCalledTimes(1)
  })
})

describe('addQuickAction', () => {
  it('rejects visibly, without writing, when no finite append rank exists', async () => {
    const write = vi.fn(() => Promise.resolve())
    const huge = action('a', 2 ** 53)
    const actions = quickActionActions('owner', [huge], write)

    await expect(actions.addQuickAction('money.expense', null)).rejects.toThrow(
      /could not add/i,
    )
    expect(write).not.toHaveBeenCalled()
  })

  it('calls write for an ordinary add', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const actions = quickActionActions('owner', [a], write)

    await actions.addQuickAction('money.expense', null)
    expect(write).toHaveBeenCalledTimes(1)
  })
})

// The normalizing (trim, blank-to-null) is normalizeLabel's own job and is
// tested there — this only proves setQuickActionLabel is wired to call it
// and to write, for both a real label and a clearing one.
describe('setQuickActionLabel', () => {
  it('calls write for a real custom label', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const actions = quickActionActions('owner', [a], write)

    await actions.setQuickActionLabel(a, 'Uber run')
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('calls write for a blank input too — clearing is still a write, not a silent no-op', async () => {
    const write = vi.fn(() => Promise.resolve())
    const a = action('a', 0)
    const actions = quickActionActions('owner', [a], write)

    await actions.setQuickActionLabel(a, '   ')
    expect(write).toHaveBeenCalledTimes(1)
  })
})

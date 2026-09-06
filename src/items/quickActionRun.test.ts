import { describe, expect, it, vi } from 'vitest'

import { fromRow as itemFromRow } from '../repository/item'
import { runDeliveryAction } from './deliveryQuickAction'
import { runQuickAction } from './quickActionRun'

const EXISTING = itemFromRow({
  id: 'i1',
  owner: 'a',
  kind: 'shift',
  state: 'active',
  title: 'Shift',
  due: '2026-09-06',
  done_at: null,
  version: 1,
  created_at: '2026-09-06T07:00:00+00:00',
  updated_at: '2026-09-06T07:00:00+00:00',
  deleted_at: null,
  area_id: 'area-1',
  waiting_since: null,
})

describe('runQuickAction', () => {
  it('runs the body and calls nothing on success', async () => {
    const onError = vi.fn()
    let ran = false
    await runQuickAction(() => {
      ran = true
      return Promise.resolve()
    }, onError)
    expect(ran).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it("surfaces a rejection's message and does not let it escape", async () => {
    const onError = vi.fn()
    await expect(
      runQuickAction(() => Promise.reject(new Error('network down')), onError),
    ).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledExactlyOnceWith('network down')
  })

  it('formats a non-Error rejection the same way', async () => {
    const onError = vi.fn()
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- proving the non-Error branch on purpose
    await runQuickAction(() => Promise.reject('boom'), onError)
    expect(onError).toHaveBeenCalledExactlyOnceWith('boom')
  })
})

// The exact composition QuickActionsRow's delivery.work button builds for
// `onRun`: runDeliveryAction, then openItem on what it resolves to. Proven
// here with the real runDeliveryAction and a rejecting clockOn, the same way
// a network failure would show up — never opening anything on a failure.
describe('the delivery Quick Action click composition', () => {
  it('surfaces the failure and never calls openItem, on a rejected clockOn', async () => {
    const openItem = vi.fn()
    const onError = vi.fn()
    const fx = {
      startDeliveryWork: vi.fn(),
      clockOn: vi.fn(() => Promise.reject(new Error('could not reach the server'))),
    }

    await runQuickAction(async () => {
      const item = await runDeliveryAction(
        { kind: 'resume', shiftId: EXISTING.id },
        'area-1',
        '2026-09-06',
        EXISTING,
        fx,
      )
      openItem(item)
    }, onError)

    expect(onError).toHaveBeenCalledExactlyOnceWith('could not reach the server')
    expect(openItem).not.toHaveBeenCalled()
  })

  it('opens the resolved item when the same composition succeeds', async () => {
    const openItem = vi.fn()
    const onError = vi.fn()
    const fx = {
      startDeliveryWork: vi.fn(),
      clockOn: vi.fn(() => Promise.resolve(undefined)),
    }

    await runQuickAction(async () => {
      const item = await runDeliveryAction(
        { kind: 'resume', shiftId: EXISTING.id },
        'area-1',
        '2026-09-06',
        EXISTING,
        fx,
      )
      openItem(item)
    }, onError)

    expect(onError).not.toHaveBeenCalled()
    expect(openItem).toHaveBeenCalledExactlyOnceWith(EXISTING)
  })
})

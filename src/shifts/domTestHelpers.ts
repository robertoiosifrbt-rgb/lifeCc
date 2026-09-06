// A small, hand-rolled mount for the handful of component-render tests in
// this directory — no @testing-library/react, so the only new dependency
// this needed was jsdom itself (dev-only, this file and its callers never
// ship). `act` comes straight from `react`; React 19 exports it there.

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'

export function mount(element: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    rerender(next: ReactElement) {
      act(() => {
        root.render(next)
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

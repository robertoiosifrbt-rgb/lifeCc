/**
 * The layout check, at phone width.
 *
 * typecheck checks types, the tests check logic. Neither catches an element
 * pushed off the screen, text under the status bar, or a button too small for
 * a finger. That is why this is a script, not an intention.
 */

/** The minimum tap target, in pixels. */
export const MIN_TAP = 44

/** The simulated safe areas: a phone with a notch. */
export const SAFE = { top: 47, bottom: 34 }

/** The widths that get checked. 320 is the narrowest real phone. */
export const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]

/** What counts as a tap target. */
export const TAPPABLE = 'a, button, input, select, textarea, [role="button"]'

/**
 * Runs inside the page. Returns the problems found, plus what it counted — if
 * it counted nothing, the check went green without checking anything.
 */
export function inspect({ minTap, safe, tappable }) {
  const problems = []
  const width = window.innerWidth
  const height = window.innerHeight

  const visible = (element) => {
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (Number(style.opacity) === 0) return false
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  }

  const name = (element) => {
    const classes =
      typeof element.className === 'string' && element.className !== ''
        ? `.${element.className.trim().split(/\s+/).join('.')}`
        : ''
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes}`
  }

  /**
   * Is the element held in the safe area, unable to be scrolled out of it?
   *
   * Only something held there is a defect; content that can be scrolled up is
   * not. Being inside a fixed container is not enough: a sheet is fixed but
   * its own body scrolls, so a button near the bottom of that scroll can be
   * brought up like any other content. So the walk stops at the first
   * scrollable ancestor and answers no.
   */
  const pinned = (element) => {
    for (let el = element; el instanceof Element; el = el.parentElement) {
      const style = getComputedStyle(el)
      if (el !== element) {
        const scrolls = /auto|scroll/.test(style.overflowY)
        if (scrolls && el.scrollHeight > el.clientHeight + 1) return false
      }
      if (style.position === 'fixed' || style.position === 'sticky') return true
    }
    return false
  }

  /**
   * A visible aria-modal dialog owns the screen while it is open. The covered
   * page can still exist in the DOM — and Playwright may have scrolled it to
   * reach the row that opened the sheet — but that background is not the UI a
   * person can act on now. Measuring it would report false safe-area and tap
   * failures behind the modal instead of checking the sheet itself.
   */
  const modal = [...document.querySelectorAll('[aria-modal="true"]')].find(visible)
  const scope = modal ?? document.body
  const all = [...scope.querySelectorAll('*')].filter(visible)

  // 1. Nothing sticks out sideways. The document-wide check only belongs to
  // the normal page; with a modal open, the covered page is deliberately out
  // of scope. Elements inside the modal are still checked against the viewport
  // one by one below.
  if (modal === undefined && document.documentElement.scrollWidth > width + 1) {
    problems.push({
      kind: 'overflow',
      element: 'document',
      detail: `scrolls sideways: ${document.documentElement.scrollWidth}px > ${width}px`,
    })
  }
  for (const element of all) {
    const box = element.getBoundingClientRect()
    if (box.right > width + 0.5) {
      problems.push({
        kind: 'overflow',
        element: name(element),
        detail: `right edge at ${Math.round(box.right)}px, the screen is ${width}px`,
      })
    }
    if (box.left < -0.5) {
      problems.push({
        kind: 'overflow',
        element: name(element),
        detail: `left edge at ${Math.round(box.left)}px`,
      })
    }
  }

  // 2. No text under the status bar.
  const withText = all.filter((element) =>
    [...element.childNodes].some(
      (node) => node.nodeType === 3 && node.textContent.trim() !== '',
    ),
  )
  for (const element of withText) {
    const box = element.getBoundingClientRect()
    if (box.top < safe.top - 0.5) {
      problems.push({
        kind: 'under-status-bar',
        element: name(element),
        detail: `text starts at ${Math.round(box.top)}px, the status bar takes ${safe.top}px`,
      })
    }
  }

  // 3. No tap target smaller than a finger, and nothing pinned to the bottom
  //    reaching into the home indicator.
  const taps = [...scope.querySelectorAll(tappable)].filter(visible)
  for (const element of taps) {
    const box = element.getBoundingClientRect()
    if (box.width < minTap - 0.5 || box.height < minTap - 0.5) {
      problems.push({
        kind: 'too-small',
        element: name(element),
        detail: `${Math.round(box.width)}×${Math.round(box.height)}px, the minimum is ${minTap}px`,
      })
    }
    if (pinned(element) && box.bottom > height - safe.bottom + 0.5) {
      problems.push({
        kind: 'under-indicator',
        element: name(element),
        detail: `pinned, and ends at ${Math.round(box.bottom)}px, while the bottom indicator takes ${safe.bottom}px`,
      })
    }
  }

  return { problems, counted: { text: withText.length, taps: taps.length } }
}

/** The CSS that simulates the phone's safe areas. */
export function safeAreaCss(safe = SAFE) {
  return `:root {
    --safe-top: ${safe.top}px !important;
    --safe-bottom: ${safe.bottom}px !important;
    --safe-left: 0px !important;
    --safe-right: 0px !important;
  }`
}

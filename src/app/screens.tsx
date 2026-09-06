import type { ReactElement } from 'react'

import type { Item } from '../repository/item'
import { AreaScreen } from '../screens/area/AreaScreen'
import { AreasScreen } from '../screens/areas/AreasScreen'
import { HmrcScreen } from '../screens/hmrc/HmrcScreen'
import { CalendarScreen } from '../screens/calendar/CalendarScreen'
import { JournalScreen } from '../screens/journal/JournalScreen'
import { MoneyScreen } from '../screens/money/MoneyScreen'
import { PlanScreen } from '../screens/plan/PlanScreen'
import { QuickActionsScreen } from '../screens/quickactions/QuickActionsScreen'
import { ThingsScreen } from '../screens/things/ThingsScreen'
import { TodayScreen } from '../screens/today/TodayScreen'

export type Screen = {
  /** The screen's URL. Every screen has one, and can be opened directly. */
  path: string
  /** The label in the navigation bar, or this screen's own name when it has
   *  a `parent` instead of a bar slot. */
  label: string
  element: ReactElement
  /**
   * The bar tab this screen counts as being inside, when it is not one
   * itself — Calendar counts as Plan, Tax (HMRC) counts as Money. The shell
   * uses it to keep that tab lit and the header titled correctly while you
   * are one step inside it, instead of losing the context the moment the
   * URL is no longer the tab's own.
   */
  parent?: string
}

/**
 * A single list of screens. The routes and the navigation bar are generated
 * from it, so they can never end up saying different things.
 *
 * The four labels are the product's mental map: Home / Plan / Areas / Money.
 * Today is the same screen it always was — it is Home now, not a new one.
 */
export const SCREENS: readonly Screen[] = [
  { path: '/today', label: 'Home', element: <TodayScreen /> },
  { path: '/plan', label: 'Plan', element: <PlanScreen /> },
  { path: '/areas', label: 'Areas', element: <AreasScreen /> },
  { path: '/money', label: 'Money', element: <MoneyScreen /> },
]

/**
 * Screens you reach from inside another one, not from the bar.
 *
 * An area is entered from the tree, Calendar from Plan, Tax from Money,
 * Journal from Home, and People/Vehicles from the header — each needs a URL
 * and a route, but no label of its own to go with them.
 */
export const INSIDE: readonly Screen[] = [
  { path: '/areas/:id', label: '', element: <AreaScreen /> },
  { path: '/calendar', label: 'Calendar', element: <CalendarScreen />, parent: '/plan' },
  // HMRC is reached from Money now: it is Tax, a specialised part of Money,
  // not a screen of its own next to the bar.
  { path: '/hmrc', label: 'Tax', element: <HmrcScreen />, parent: '/money' },
  { path: '/things', label: '', element: <ThingsScreen /> },
  // Journal is reached from Home, not from a fifth bar slot: the mental map
  // stays Home / Plan / Areas / Money.
  { path: '/journal', label: 'Journal', element: <JournalScreen />, parent: '/today' },
  // Where Home's Quick Actions are configured — reached from Home, same as
  // Journal, not a bar slot of its own.
  {
    path: '/quick-actions',
    label: 'Quick Actions',
    element: <QuickActionsScreen />,
    parent: '/today',
  },
]

/** Where you land from `/` and from any URL that does not exist. */
export const HOME = '/today'

export type TabInfo = {
  /** What the header should say. */
  title: string
  /** Which bar button counts as current, and should stay lit. */
  tabPath: string
}

/**
 * What a URL means for the shell: the header title, and which of the four
 * bar buttons should stay lit.
 *
 * A screen that is one step inside a tab — Calendar inside Plan, Tax inside
 * Money — borrows that tab's context rather than losing it: the title says
 * "Plan · Calendar", not a generic fallback, and Plan's button stays lit
 * even though the URL is no longer `/plan`. A screen that belongs to none of
 * the four (an area's own page, Things) gets neither, same as before.
 */
export function tabInfoFor(pathname: string): TabInfo | undefined {
  const exact = [...SCREENS, ...INSIDE].find((screen) => screen.path === pathname)
  if (exact === undefined || exact.label === '') return undefined
  if (exact.parent === undefined) return { title: exact.label, tabPath: exact.path }

  const parent = SCREENS.find((screen) => screen.path === exact.parent)
  const title = parent === undefined ? exact.label : `${parent.label} · ${exact.label}`
  return { title, tabPath: exact.parent }
}

/**
 * Whether opening this item means going to the Journal composer, rather than
 * the generic item sheet.
 *
 * A journal anchor is permanently active with no due, done_at or
 * waiting_since — the database refuses all three now — so the sheet's due
 * date, Waiting toggle, Mark done and Delete would either do nothing or be
 * refused outright. Journal has its own composer for exactly this content;
 * the sheet must never be the door to it, however the item was reached
 * (today's list, an area's page, anywhere else that calls openItem).
 */
export function opensInJournal(item: Pick<Item, 'kind'>): boolean {
  return item.kind === 'journal'
}

/** Where opening a journal item leads: its own entry, in the composer. */
export function journalEntryPath(itemId: string): string {
  return `/journal?entry=${itemId}`
}

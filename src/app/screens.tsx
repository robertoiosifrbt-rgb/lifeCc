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
import { SettingsScreen } from '../screens/settings/SettingsScreen'
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
 * and Journal, Directory and Settings from the More sheet — each needs a URL
 * and a route, but no bar slot of its own to go with them.
 */
export const INSIDE: readonly Screen[] = [
  // Labelled and carrying its own parent, same as Calendar and Tax below, so
  // the header reads "Areas" instead of falling back to a generic title —
  // the path/name of the area itself is AreaScreen's own job, not the
  // shell's.
  { path: '/areas/:id', label: '', element: <AreaScreen />, parent: '/areas' },
  { path: '/calendar', label: 'Calendar', element: <CalendarScreen />, parent: '/plan' },
  // HMRC is reached from Money now: it is Tax, a specialised part of Money,
  // not a screen of its own next to the bar.
  { path: '/hmrc', label: 'Tax', element: <HmrcScreen />, parent: '/money' },
  // The user-facing concept is Directory (People/Companies/Vehicles/
  // Properties), never "Things" — only the route and the internal model keep
  // that name, to avoid churn with no product value.
  { path: '/things', label: 'Directory', element: <ThingsScreen /> },
  // Journal is reached from the More sheet, not from a fifth bar slot: the
  // mental map stays Home / Plan / Areas / Money. It still reads as one step
  // inside Home, the same as before.
  { path: '/journal', label: 'Journal', element: <JournalScreen />, parent: '/today' },
  // Where Home's Quick Actions are configured — reached from Home and from
  // Settings, not a bar slot of its own.
  {
    path: '/quick-actions',
    label: 'Quick Actions',
    element: <QuickActionsScreen />,
    parent: '/today',
  },
  // App/account configuration — reached from the More sheet, never from the
  // four primary tabs.
  { path: '/settings', label: 'Settings', element: <SettingsScreen /> },
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
 * The static head of a route carrying a parameter: `/areas/:id` → `/areas/`.
 * A path with no parameter has none.
 */
function paramPrefixOf(path: string): string | null {
  const at = path.indexOf('/:')
  return at === -1 ? null : path.slice(0, at + 1)
}

/**
 * The declared screen a real URL means, whether it matches a path exactly or
 * only through a parameter: `/areas/some-id` matches `/areas/:id` by its
 * static head, the same way `linkedFrom` in scripts/lib/reachable.mjs reads
 * a link to it.
 */
function screenFor(pathname: string): Screen | undefined {
  const all = [...SCREENS, ...INSIDE]
  const exact = all.find((screen) => screen.path === pathname)
  if (exact !== undefined) return exact
  return all.find((screen) => {
    const prefix = paramPrefixOf(screen.path)
    return prefix !== null && pathname !== screen.parent && pathname.startsWith(prefix)
  })
}

/**
 * What a URL means for the shell: the header title, and which of the four
 * bar buttons should stay lit.
 *
 * A screen that is one step inside a tab — Calendar inside Plan, Tax inside
 * Money, an area's own page inside Areas — borrows that tab's context rather
 * than losing it: the title says "Plan · Calendar", not a generic fallback,
 * and the parent's button stays lit even though the URL is no longer the
 * tab's own. A screen that belongs to none of the four (Directory, Settings)
 * gets its own title and no lit tab — it is a secondary screen, not a fifth
 * or sixth one.
 */
export function tabInfoFor(pathname: string): TabInfo | undefined {
  const screen = screenFor(pathname)
  if (screen === undefined) return undefined
  if (screen.label === '' && screen.parent === undefined) return undefined

  if (screen.parent === undefined) return { title: screen.label, tabPath: screen.path }

  const parent = SCREENS.find((one) => one.path === screen.parent)
  if (parent === undefined) return { title: screen.label, tabPath: screen.parent }

  const title = screen.label === '' ? parent.label : `${parent.label} · ${screen.label}`
  return { title, tabPath: screen.parent }
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

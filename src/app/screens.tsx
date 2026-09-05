import type { ReactElement } from 'react'

import { AreaScreen } from '../screens/area/AreaScreen'
import { AreasScreen } from '../screens/areas/AreasScreen'
import { HmrcScreen } from '../screens/hmrc/HmrcScreen'
import { CalendarScreen } from '../screens/calendar/CalendarScreen'
import { ThingsScreen } from '../screens/things/ThingsScreen'
import { TodayScreen } from '../screens/today/TodayScreen'

export type Screen = {
  /** The screen's URL. Every screen has one, and can be opened directly. */
  path: string
  /** The label in the navigation bar. */
  label: string
  element: ReactElement
}

/**
 * A single list of screens. The routes and the navigation bar are generated
 * from it, so they can never end up saying different things.
 */
export const SCREENS: readonly Screen[] = [
  { path: '/today', label: 'Today', element: <TodayScreen /> },
  { path: '/calendar', label: 'Calendar', element: <CalendarScreen /> },
  { path: '/areas', label: 'Areas', element: <AreasScreen /> },
]

/**
 * Screens you reach from inside another one, not from the bar.
 *
 * The bar holds three and no more — a fourth taps into the narrowest phone's
 * scrolling before it shows anything. An area is entered from the tree, so it
 * needs a URL and a route without a label to go with them.
 */
export const INSIDE: readonly Screen[] = [
  { path: '/areas/:id', label: '', element: <AreaScreen /> },
  { path: '/hmrc', label: '', element: <HmrcScreen /> },
  // Things go beside HMRC rather than into the bar, for the measured reason
  // above: a fourth tab clips "Calendar" on a 320px phone.
  { path: '/things', label: '', element: <ThingsScreen /> },
]

/** Where you land from `/` and from any URL that does not exist. */
export const HOME = '/today'

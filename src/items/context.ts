import { useOutletContext } from 'react-router-dom'

import type { Item } from '../repository/items'
import type { ItemsHandle } from './useItems'

/** What every screen inside the shell receives. */
export type ScreenContext = {
  data: ItemsHandle
  /** Opens the item sheet. Not a new screen — the same sheet everywhere. */
  openItem: (item: Item) => void
  /** Today, from the device clock. */
  today: string
  /** The account you are in. Settings is where it is shown. */
  email: string | null
}

export function useScreen(): ScreenContext {
  return useOutletContext<ScreenContext>()
}

import { Link } from 'react-router-dom'

import { Sheet } from '../ui/Sheet'
import './MoreSheet.css'

type Props = { onClose: () => void }

/**
 * The three doors More opens. Not a fifth or sixth primary tab: Journal still
 * belongs semantically to Home, Directory is a secondary cross-cutting
 * entity directory, and Settings is app/account configuration.
 *
 * Each `to` is written literally, not built from a shared list: reachability
 * is checked by scripts/lib/reachable.mjs, which reads the source text for a
 * literal `to="…"` and cannot see a path assembled from a variable.
 */
export function MoreSheet({ onClose }: Props) {
  return (
    <Sheet title="More" onClose={onClose}>
      <nav className="more-list" aria-label="More">
        <Link className="more-link" to="/journal" onClick={onClose}>
          Journal
        </Link>
        <Link className="more-link" to="/things" onClick={onClose}>
          Directory
        </Link>
        <Link className="more-link" to="/settings" onClick={onClose}>
          Settings
        </Link>
      </nav>
    </Sheet>
  )
}

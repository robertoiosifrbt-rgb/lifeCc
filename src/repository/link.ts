// The arrow between two items.
//
// Law 2: links are item ↔ item, never module ↔ module. So this file knows
// nothing about what kind of thing sits on either end — that is the anchor's
// business, and the whole reason one arrow can join a task to a car, to a
// company and to the money that paid for it.

import { asRecord, requiredMoment, requiredText } from './row'

/**
 * The two kinds, both taken from the sentence that asked for the table:
 * the renewal is `about` the car and the company, the £740 `pays` the renewal.
 * A third kind arrives with a third kind of arrow.
 */
export const LINK_KINDS = ['about', 'pays'] as const
export type LinkKind = (typeof LINK_KINDS)[number]

/**
 * How each kind reads from each end, because an arrow says different things
 * depending on which side you are standing on. Without this the screen would
 * show "pays" under the expense and under the task alike, and one of the two
 * would be a lie.
 */
export const LINK_NAMES: Record<LinkKind, { from: string; to: string }> = {
  about: { from: 'About', to: 'Mentioned by' },
  pays: { from: 'Pays for', to: 'Paid by' },
}

export type Link = {
  id: string
  owner: string
  from_id: string
  to_id: string
  kind: LinkKind
  created_at: string
}

export function linkFromRow(row: unknown): Link {
  const raw = asRecord(row)

  const kind = requiredText(raw, 'kind')
  if (!(LINK_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`Unknown kind of link: ${kind}`)
  }

  const from_id = requiredText(raw, 'from_id')
  const to_id = requiredText(raw, 'to_id')
  // The database refuses this, so a row carrying it did not come from there.
  if (from_id === to_id) throw new Error('A link from an item to itself')

  return {
    id: requiredText(raw, 'id'),
    owner: requiredText(raw, 'owner'),
    from_id,
    to_id,
    kind: kind as LinkKind,
    created_at: requiredMoment(raw, 'created_at'),
  }
}

/** One end of an arrow, as the screen standing at the other end sees it. */
export type Neighbour = {
  link: Link
  /** The item at the far end. */
  otherId: string
  /** What the arrow says from here. */
  says: string
}

/**
 * Everything joined to one item, from both directions.
 *
 * Both directions on purpose: an arrow drawn from the expense to the task is
 * the same arrow seen from the task, and a screen that only looked one way
 * would show half the connections and give no hint that the rest exist.
 */
export function neighboursOf(links: readonly Link[], itemId: string): Neighbour[] {
  const found: Neighbour[] = []
  for (const link of links) {
    if (link.from_id === itemId) {
      found.push({ link, otherId: link.to_id, says: LINK_NAMES[link.kind].from })
    } else if (link.to_id === itemId) {
      found.push({ link, otherId: link.from_id, says: LINK_NAMES[link.kind].to })
    }
  }
  return found
}

import { useState } from 'react'

import { LINK_KINDS, LINK_NAMES, neighboursOf } from '../repository/items'
import type { Item, Link, LinkKind } from '../repository/items'
import './JoinedTo.css'

type Props = {
  /** The item you are standing on. Every arrow is read from here. */
  itemId: string
  items: readonly Item[]
  links: readonly Link[]
  busy: boolean
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
  onError: (reason: string) => void
}

/**
 * Everything joined to one item, and the way to join one more.
 *
 * Written once and used from both sheets. Two copies would drift, and the
 * moment they did, the same arrow would read one way from the task and another
 * from the car — which is the exact confusion the arrows exist to remove.
 *
 * The far end can be any item, not only a thing. That is law 2 doing its work:
 * the £740 that pays the renewal is an expense, the renewal is a task, and
 * neither of them knows what the other is.
 */
export function JoinedTo(props: Props) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<LinkKind>('about')
  const [to, setTo] = useState('')

  const neighbours = neighboursOf(props.links, props.itemId)
  const titleOf = (id: string) =>
    props.items.find((item) => item.id === id)?.title ?? 'Something deleted'

  // Nothing deleted, and never itself. An arrow to a row that is gone is one
  // you cannot follow, and one to itself says nothing at all.
  const reachable = props.items
    .filter((item) => item.id !== props.itemId && item.deleted_at === null)
    .sort((one, other) => one.title.localeCompare(other.title))

  function run(body: () => Promise<void>) {
    void body().catch((reason: unknown) => {
      props.onError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <section className="joined">
      <h3 className="joined-heading">Joined to</h3>

      {neighbours.length === 0 ? (
        <p className="joined-none">Nothing yet.</p>
      ) : (
        <ul className="joined-list">
          {neighbours.map(({ link, otherId, says }) => (
            <li key={link.id} className="joined-row">
              <span className="joined-says">{says}</span>
              <span className="joined-other">{titleOf(otherId)}</span>
              <button
                type="button"
                name="unlink"
                className="joined-unlink"
                disabled={props.busy}
                aria-label={`Remove the link to ${titleOf(otherId)}`}
                onClick={() => run(() => props.onUnlink(link.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="joined-form">
          <label className="joined-field">
            <span className="joined-label">This one</span>
            <select
              className="joined-input"
              name="link-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as LinkKind)}
            >
              {LINK_KINDS.map((one) => (
                <option key={one} value={one}>
                  {LINK_NAMES[one].from}
                </option>
              ))}
            </select>
          </label>

          <label className="joined-field">
            <span className="joined-label">That one</span>
            <select
              className="joined-input"
              name="link-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            >
              <option value="">—</option>
              {reachable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <div className="joined-buttons">
            <button
              type="button"
              name="save-link"
              className="joined-save"
              disabled={props.busy || to === ''}
              onClick={() =>
                run(async () => {
                  await props.onLink(to, kind)
                  setAdding(false)
                  setTo('')
                })
              }
            >
              Join them
            </button>
            <button
              type="button"
              name="cancel-link"
              className="joined-cancel"
              onClick={() => setAdding(false)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          name="add-link"
          className="joined-add"
          disabled={props.busy || reachable.length === 0}
          onClick={() => setAdding(true)}
        >
          Join this to something
        </button>
      )}
    </section>
  )
}

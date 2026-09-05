import { useState } from 'react'

import { useScreen } from '../../items/context'
import {
  ENTITY_KINDS,
  ENTITY_KIND_NAMES,
  dueOn,
  localToday,
} from '../../repository/items'
import type { Entity, EntityKind } from '../../repository/items'
import { ThingSheet } from '../../things/ThingSheet'
import './ThingsScreen.css'

/** Vehicles first: they are the ones with dates that cost money when missed. */
const ORDER: readonly EntityKind[] = ['vehicle', 'company', 'person', 'property']

/**
 * The things your life is made of, and the state of each.
 *
 * A list rather than a tree: a car is not under a company, and pretending
 * otherwise would be a shape invented for the screen rather than taken from
 * what these are. What joins them is an arrow, and arrows are on the sheet.
 */
export function ThingsScreen() {
  const { data } = useScreen()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<EntityKind>('vehicle')
  const [name, setName] = useState('')

  const today = localToday(new Date())
  const byId = new Map(data.items.map((item) => [item.id, item]))
  const alive = data.things.filter((thing) => {
    const item = byId.get(thing.item_id)
    return item !== undefined && item.deleted_at === null
  })

  const trimmed = name.trim()
  const openThing = alive.find((thing) => thing.item_id === open) ?? null
  const openItem = openThing === null ? undefined : byId.get(openThing.item_id)

  /** The soonest date this thing owes, as one short line, or nothing. */
  function nextDue(thing: Entity): string | null {
    const [soonest] = dueOn(thing, today)
    if (soonest === undefined) return null
    if (soonest.inDays < 0) return `${soonest.label} ran out ${String(-soonest.inDays)} days ago`
    if (soonest.inDays === 0) return `${soonest.label} today`
    return `${soonest.label} in ${String(soonest.inDays)} days`
  }

  async function save() {
    if (trimmed === '') return
    await data.addThing(kind, trimmed, null)
    setAdding(false)
    setName('')
  }

  return (
    <section className="things">
      {alive.length === 0 && !adding && (
        <p className="things-empty">
          Nothing here yet. A thing is something that exists whether or not you
          do anything about it — your car, your landlord, the company that
          insures you.
        </p>
      )}

      {ORDER.filter((one) => alive.some((thing) => thing.entity_kind === one)).map(
        (one) => (
          <div key={one} className="things-group">
            <h2 className="things-kind">{ENTITY_KIND_NAMES[one]}</h2>
            <ul className="things-list">
              {alive
                .filter((thing) => thing.entity_kind === one)
                .map((thing) => {
                  const due = nextDue(thing)
                  const overdue = due !== null && due.includes('ran out')
                  return (
                    <li key={thing.item_id}>
                      <button
                        type="button"
                        name="open-thing"
                        className="things-row"
                        onClick={() => setOpen(thing.item_id)}
                      >
                        <span className="things-name">
                          {byId.get(thing.item_id)?.title ?? ''}
                        </span>
                        {thing.registration !== null && (
                          <span className="things-reg">{thing.registration}</span>
                        )}
                        {due !== null && (
                          <span
                            className={`things-due${overdue ? ' things-due-past' : ''}`}
                          >
                            {due}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ),
      )}

      {adding ? (
        <form
          className="things-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="things-label" htmlFor="thing-kind">
            What is it?
          </label>
          <select
            id="thing-kind"
            name="kind"
            className="things-input"
            value={kind}
            onChange={(event) => setKind(event.target.value as EntityKind)}
          >
            {ENTITY_KINDS.map((one) => (
              <option key={one} value={one}>
                {ENTITY_KIND_NAMES[one]}
              </option>
            ))}
          </select>

          <label className="things-label" htmlFor="thing-name">
            What is it called?
          </label>
          <input
            id="thing-name"
            name="name"
            className="things-input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />

          <div className="things-form-buttons">
            <button
              type="submit"
              name="save"
              className="things-save"
              disabled={trimmed === ''}
            >
              Add it
            </button>
            <button
              type="button"
              name="cancel"
              className="things-cancel"
              onClick={() => setAdding(false)}
            >
              Not now
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          name="add-thing"
          className="things-add"
          onClick={() => setAdding(true)}
        >
          Add a thing
        </button>
      )}

      {openThing !== null && openItem !== undefined && (
        <ThingSheet
          item={openItem}
          entity={openThing}
          items={data.items}
          links={data.links}
          today={today}
          onSave={(patch) => data.saveThing(openThing, patch)}
          onLink={(to_id, kind) => data.link(openThing.item_id, to_id, kind)}
          onUnlink={(id) => data.unlink(id)}
          onDrop={async () => {
            await data.dropThing(openItem)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

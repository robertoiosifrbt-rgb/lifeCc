import { useState } from 'react'

import {
  ENTITY_KIND_NAMES,
  FUELS,
  FUEL_NAMES,
  VEHICLE_DATES,
  dueOn,
} from '../repository/items'
import type {
  Entity,
  EntityPatch,
  Fuel,
  Item,
  Link,
  LinkKind,
} from '../repository/items'
import { JoinedTo } from './JoinedTo'
import { Sheet } from '../ui/Sheet'
import './ThingSheet.css'

type Props = {
  item: Item
  entity: Entity
  /** Every item, so the far end of an arrow can be named rather than numbered. */
  items: readonly Item[]
  links: readonly Link[]
  today: string
  onSave: (patch: EntityPatch) => Promise<void>
  onLink: (to_id: string, kind: LinkKind) => Promise<void>
  onUnlink: (id: string) => Promise<void>
  onDrop: () => Promise<void>
  onClose: () => void
}

/** Empty means "not known", never zero: an unread odometer is not a new car. */
function numberOf(typed: string): number | null {
  const trimmed = typed.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) throw new Error(`Not a number: ${typed}`)
  return value
}

function textOf(typed: string): string | null {
  const trimmed = typed.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * One thing, open: what is known about it, when it next costs money, and
 * everything joined to it.
 *
 * Writes on blur like the shift sheet does, and for the same reason — you fill
 * a car in from the logbook, a field at a time, and a form you have to remember
 * to submit is a form that loses half of it.
 */
export function ThingSheet(props: Props) {
  const { entity, item, onClose } = props
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function run(body: () => Promise<void>) {
    setBusy(true)
    setError(null)
    void body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  /** Saves one field, and only if the typed value is not what is already there. */
  function save<K extends keyof EntityPatch>(
    key: K,
    read: () => EntityPatch[K],
  ): void {
    let value: EntityPatch[K]
    try {
      value = read()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    if (value === entity[key]) return
    run(() => props.onSave({ [key]: value }))
  }

  const isVehicle = entity.entity_kind === 'vehicle'
  const due = isVehicle ? dueOn(entity, props.today) : []

  return (
    <Sheet title={`${ENTITY_KIND_NAMES[entity.entity_kind]} · ${item.title}`} onClose={onClose}>
      {error !== null && <p className="thing-error">{error}</p>}

      {due.length > 0 && (
        <ul className="thing-due">
          {due.map((one) => (
            <li
              key={one.key}
              className={`thing-due-row${one.inDays < 0 ? ' thing-due-past' : ''}${
                one.inDays >= 0 && one.inDays <= 30 ? ' thing-due-soon' : ''
              }`}
            >
              <span className="thing-due-what">{one.label}</span>
              <span className="thing-due-when">
                {one.day}
                {/* Days, spelled out: "2027-03-14" alone does not tell you
                    whether to worry, and worrying is the whole point of the
                    four dates being on this screen at all. */}
                <em>
                  {one.inDays < 0
                    ? ` ${String(-one.inDays)} days ago`
                    : one.inDays === 0
                      ? ' today'
                      : ` in ${String(one.inDays)} days`}
                </em>
              </span>
            </li>
          ))}
        </ul>
      )}

      {isVehicle && (
        <section className="thing-block">
          <h3 className="thing-heading">The car</h3>
          {(
            [
              ['registration', 'Registration'],
              ['make', 'Make'],
              ['model', 'Model'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="thing-field">
              <span className="thing-label">{label}</span>
              <input
                className="thing-input"
                name={key}
                defaultValue={entity[key] ?? ''}
                disabled={busy}
                onBlur={(event) => save(key, () => textOf(event.target.value))}
              />
            </label>
          ))}

          <label className="thing-field">
            <span className="thing-label">Fuel</span>
            <select
              className="thing-input"
              name="fuel"
              value={entity.fuel ?? ''}
              disabled={busy}
              onChange={(event) =>
                save('fuel', () =>
                  event.target.value === '' ? null : (event.target.value as Fuel),
                )
              }
            >
              <option value="">—</option>
              {FUELS.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {FUEL_NAMES[fuel]}
                </option>
              ))}
            </select>
          </label>

          {(
            [
              ['odo', 'Odometer now'],
              ['oil_changed_at', 'Oil changed at'],
              ['oil_due_at', 'Oil due at'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="thing-field">
              <span className="thing-label">{label}</span>
              <input
                className="thing-input"
                name={key}
                inputMode="decimal"
                defaultValue={entity[key] === null ? '' : String(entity[key])}
                disabled={busy}
                onBlur={(event) => save(key, () => numberOf(event.target.value))}
              />
            </label>
          ))}

          <h3 className="thing-heading">When it next costs money</h3>
          {VEHICLE_DATES.map(({ key, label }) => (
            <label key={key} className="thing-field">
              <span className="thing-label">{label}</span>
              <input
                className="thing-input"
                name={key}
                type="date"
                defaultValue={entity[key] ?? ''}
                disabled={busy}
                onBlur={(event) => save(key, () => textOf(event.target.value))}
              />
            </label>
          ))}
        </section>
      )}

      <JoinedTo
        itemId={item.id}
        items={props.items}
        links={props.links}
        busy={busy}
        onLink={props.onLink}
        onUnlink={props.onUnlink}
        onError={setError}
      />

      <button
        type="button"
        name="drop-thing"
        className="thing-drop"
        disabled={busy}
        onClick={() => run(props.onDrop)}
      >
        Remove this {ENTITY_KIND_NAMES[entity.entity_kind].toLowerCase()}
      </button>
    </Sheet>
  )
}

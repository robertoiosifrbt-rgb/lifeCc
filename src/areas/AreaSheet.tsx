import { useState } from 'react'

import type { Area, AreaPatch } from '../repository/items'
import { settingsPatch, subtreeOf, treeOf } from '../repository/items'
import { Sheet } from '../ui/Sheet'
import './AreaSheet.css'

type Props = {
  area: Area
  /** Every area of the account, to offer as a new parent. */
  areas: readonly Area[]
  /** How many areas hang under this one, at any depth. */
  under: number
  /** Name and/or parent, in the one write a settings save may make. */
  onSave: (patch: AreaPatch) => Promise<void>
  onDrop: () => Promise<void>
  onClose: () => void
}

/**
 * One area, open: its name, and the way out of it.
 *
 * And nothing else. An area is a part of a life — work, health, the house —
 * so whatever a module needs belongs to that module, not here. The running
 * costs of a vehicle sat on this sheet for a day, which meant every area ever
 * created opened by asking what a kilometre costs in it. Health did. The
 * delivery module now keeps them, in the sheet where they are used.
 *
 * The same shape as the item sheet, because it is the same gesture — you
 * tapped a row and it opened. A second pattern for the same movement is a
 * second thing to learn.
 */
export function AreaSheet(props: Props) {
  const { area, areas, under, onSave, onDrop, onClose } = props
  const [name, setName] = useState(area.name)
  const [moveTo, setMoveTo] = useState(area.parent_id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An area cannot become its own parent, nor its own descendant's — the
  // database's cycle check would refuse both anyway, only after a round trip
  // and a raw SQL error where a person expects a picker to already know
  // better.
  const excluded = new Set(subtreeOf(areas, area.id))
  const parentOptions = treeOf(areas).filter((row) => !excluded.has(row.area.id))

  // One patch, whatever changed. Two separate version-checked writes — one
  // for the name, one for the parent — would let either field close the
  // sheet on a value the other one never saw, discarding it. `null` means a
  // blank name makes the whole form unsaveable: a changed parent must not
  // slip through underneath it.
  const patch = settingsPatch(area, name, moveTo === '' ? null : moveTo)
  const changed = patch !== null && Object.keys(patch).length > 0

  async function run(body: () => Promise<void>, close: boolean) {
    setBusy(true)
    setError(null)
    try {
      await body()
      if (close) onClose()
    } catch (reason) {
      // The sheet stays open with what you typed still in it. A sheet that
      // closes on a write that did not happen says it saved when it did not.
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Area" onClose={onClose}>
      <label className="area-field">
        <span className="area-label">Name</span>
        <input
          className="area-input"
          name="name"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="area-field">
        <span className="area-label">Under</span>
        <select
          className="area-input"
          name="parent"
          value={moveTo}
          disabled={busy}
          onChange={(event) => setMoveTo(event.target.value)}
        >
          <option value="">— (root, no parent)</option>
          {parentOptions.map(({ area: option, depth }) => (
            <option key={option.id} value={option.id}>
              {' '.repeat(depth * 2)}
              {option.name}
            </option>
          ))}
        </select>
      </label>

      {error !== null && <p className="area-error">{error}</p>}

      <div className="area-buttons">
        <button
          type="button"
          name="save"
          className="area-save"
          disabled={busy || !changed}
          onClick={() => {
            if (patch === null) return
            void run(() => onSave(patch), true)
          }}
        >
          Save changes
        </button>

        <button
          type="button"
          name="drop"
          className="area-drop"
          disabled={busy}
          onClick={() => void run(onDrop, true)}
        >
          Remove this area
        </button>
      </div>

      {/* Said before it happens, not after. What hangs under an area goes out
          of sight with it, and comes back if the area comes back. */}
      {under > 0 && (
        <p className="area-note">
          Removing it hides {under} {under === 1 ? 'area' : 'areas'} under it as
          well. Nothing is destroyed: put this one back and they return.
        </p>
      )}
    </Sheet>
  )
}

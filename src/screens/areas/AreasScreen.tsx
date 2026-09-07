import { useState } from 'react'
import { ChevronRight, Folder, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useScreen } from '../../items/context'
import { countUnder, subtreeOf, treeOf } from '../../repository/items'
import type { Area } from '../../repository/items'
import './AreasScreen.css'

/** How many living items sit under this area, at any depth — the same
 *  "under" `countUnder` already means for sub-areas, applied to items. */
function itemsUnder(items: readonly { area_id: string | null; deleted_at: string | null }[], areas: readonly Area[], id: string): number {
  const ids = new Set(subtreeOf(areas, id))
  return items.filter((item) => item.deleted_at === null && item.area_id !== null && ids.has(item.area_id)).length
}

/** "3 areas · 5 items", or just "5 items" when there is nothing under it. */
function subtitleFor(subAreas: number, items: number): string {
  const itemsPart = `${items} ${items === 1 ? 'item' : 'items'}`
  if (subAreas === 0) return itemsPart
  return `${subAreas} ${subAreas === 1 ? 'area' : 'areas'} · ${itemsPart}`
}

/** A rotation of decorative tints for a card's icon avatar — position only,
 *  never a stored preference (no such field exists on Area). */
const TINTS = ['tint-1', 'tint-2', 'tint-3', 'tint-4'] as const

/**
 * The tree, and the two things you do to it: add under, or go in.
 *
 * Tapping a name enters the area rather than opening a settings sheet. The
 * tree is how you get somewhere; what an area holds, and what you do to the
 * area itself, are both in the place the name points at.
 *
 * There is no drag and drop and no reordering. Siblings come out in name
 * order, decided in one place, so the list cannot drift into an order nobody
 * chose and nobody can restore.
 */
export function AreasScreen() {
  const { data } = useScreen()
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState('')

  const rows = treeOf(data.areas)
  const adding = addingUnder !== undefined
  const trimmed = name.trim()

  function startAdding(parent: string | null) {
    setAddingUnder(parent)
    setName('')
  }

  function stopAdding() {
    setAddingUnder(undefined)
    setName('')
  }

  async function save() {
    if (trimmed === '' || addingUnder === undefined) return
    await data.addArea(trimmed, addingUnder)
    stopAdding()
  }

  return (
    <section className="areas">
      {rows.length === 0 && !adding && (
        <p className="areas-empty">
          No areas yet. An area is a part of your life — Business, and what sits
          under it.
        </p>
      )}

      <ul className="areas-tree">
        {rows.map(({ area, depth }, index) => (
          <li
            key={area.id}
            className="areas-row"
            style={{ paddingLeft: `calc(${depth} * var(--space-4))` }}
          >
            <Link className="areas-card" to={`/areas/${area.id}`}>
              <span className={`areas-icon ${TINTS[index % TINTS.length]}`}>
                <Folder aria-hidden="true" size={20} strokeWidth={2} />
              </span>
              <span className="areas-card-text">
                <span className="areas-name">{area.name}</span>
                <span className="areas-subtitle">
                  {subtitleFor(countUnder(data.areas, area.id), itemsUnder(data.items, data.areas, area.id))}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={20} className="areas-chevron" />
            </Link>
            <button
              type="button"
              name="add-under"
              className="areas-add-under"
              aria-label={`Add an area under ${area.name}`}
              onClick={() => startAdding(area.id)}
            >
              <Plus aria-hidden="true" size={18} strokeWidth={2.5} />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="areas-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="areas-label" htmlFor="area-new">
            {addingUnder === null
              ? 'A new area'
              : `Under ${data.areas.find((a) => a.id === addingUnder)?.name ?? ''}`}
          </label>
          <input
            id="area-new"
            name="new-area"
            className="areas-input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <div className="areas-form-buttons">
            <button
              type="submit"
              name="save"
              className="areas-save"
              disabled={trimmed === ''}
            >
              Add it
            </button>
            <button
              type="button"
              name="cancel"
              className="areas-cancel"
              onClick={stopAdding}
            >
              Not now
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          name="add-root"
          className="areas-add-root"
          onClick={() => startAdding(null)}
        >
          <Plus aria-hidden="true" size={18} strokeWidth={2.5} />
          Add an area
        </button>
      )}

    </section>
  )
}

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { Item, JournalEntry } from '../../repository/items'
import { findRequestedEntry, searchJournal, treeOf } from '../../repository/items'
import { useScreen } from '../../items/context'
import { JoinedTo } from '../../things/JoinedTo'
import {
  formatMoment,
  localDateTimeInput,
  momentFromLocalInput,
} from '../../ui/dates'
import './JournalScreen.css'

/** Empty means "no title", never a string of spaces. */
function titleOf(typed: string): string | null {
  const trimmed = typed.trim()
  return trimmed === '' ? null : trimmed
}

/** One flat line, for the timeline row — the first ~80 characters. */
function snippetOf(body: string): string {
  const flat = body.trim().replace(/\s+/g, ' ')
  return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat
}

/**
 * Freeform writing, anchored like everything else in Life Core.
 *
 * The composer at the top is always the same form, whether it is making a
 * new entry or holding one already saved — tapping a row in the timeline
 * below loads it back in. Nothing here writes a task, an event or a goal:
 * the body is text, and stays text.
 */
export function JournalScreen() {
  const { data, today } = useScreen()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('entry')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [when, setWhen] = useState(() => localDateTimeInput(new Date()))
  const [areaId, setAreaId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editingEntry =
    editingId === null ? null : data.journal.find((e) => e.item_id === editingId) ?? null
  const editingItem =
    editingId === null ? null : data.items.find((i) => i.id === editingId) ?? null

  function startEdit(entry: JournalEntry, item: Item) {
    setEditingId(entry.item_id)
    setTitle(entry.title ?? '')
    setBody(entry.body)
    setWhen(localDateTimeInput(new Date(entry.journaled_at)))
    setAreaId(item.area_id)
    setError(null)
  }

  function startNew() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setWhen(localDateTimeInput(new Date()))
    setAreaId(null)
    // Clears a `?entry=` request too: staying on the composer after saving,
    // or pressing "New entry", must not have the next snapshot refresh pull
    // the old request straight back in.
    setSearchParams({}, { replace: true })
  }

  // Opened from somewhere other than the timeline — today's list, an area's
  // page — by way of `/journal?entry=<id>`. Adjusted during render rather
  // than in an effect, the way React's own docs recommend for "reset some
  // state when a prop changes": `appliedRequestId` is what tells this render
  // whether the current request has already been handled, so a snapshot
  // refresh while editing does not keep pulling the same request back in
  // over whatever the person has since moved on to.
  const [appliedRequestId, setAppliedRequestId] = useState<string | null>(null)
  if (requestedId !== appliedRequestId) {
    const found = findRequestedEntry(requestedId, data.journal, data.items)
    if (requestedId === null || found.found) setAppliedRequestId(requestedId)
    if (found.found) {
      setEditingId(found.entry.item_id)
      setTitle(found.entry.title ?? '')
      setBody(found.entry.body)
      setWhen(localDateTimeInput(new Date(found.entry.journaled_at)))
      setAreaId(found.item.area_id)
      setError(null)
    }
  }

  async function guarded(body: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await body()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (body.trim() === '') {
      setError('Write something first.')
      return
    }
    void guarded(async () => {
      const journaled_at = momentFromLocalInput(when)
      const patchedTitle = titleOf(title)
      if (editingItem === null || editingEntry === null) {
        await data.addJournal({ title: patchedTitle, body, journaled_at, area_id: areaId })
        startNew()
      } else {
        await data.saveJournal(editingItem, editingEntry, { title: patchedTitle, body, journaled_at }, areaId)
      }
    })
  }

  function discard() {
    if (editingItem === null) return
    void guarded(async () => {
      await data.discardJournal(editingItem)
      startNew()
    })
  }

  // Deleted anchors ride the cache like every other row, for sync — a screen
  // decides what "gone" means for it. Here, off the timeline entirely.
  const results = searchJournal(data.journal, query).filter((entry) => {
    const item = data.items.find((i) => i.id === entry.item_id)
    return item !== undefined && item.deleted_at === null
  })

  return (
    <div className="journal">
      <section className="journal-composer">
        {editingId !== null && <p className="journal-editing">Editing an entry</p>}

        <label className="journal-field">
          <span className="journal-label">Title (optional)</span>
          <input
            className="journal-input"
            name="journal-title"
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="journal-field">
          <span className="journal-label">What&rsquo;s on your mind</span>
          <textarea
            className="journal-textarea"
            name="journal-body"
            value={body}
            rows={5}
            disabled={busy}
            autoFocus
            onChange={(event) => setBody(event.target.value)}
          />
        </label>

        <label className="journal-field">
          <span className="journal-label">When</span>
          <input
            className="journal-input"
            type="datetime-local"
            name="journal-when"
            value={when}
            disabled={busy}
            onChange={(event) => setWhen(event.target.value)}
          />
        </label>

        <label className="journal-field">
          <span className="journal-label">Area (optional)</span>
          <select
            className="journal-input"
            name="journal-area"
            value={areaId ?? ''}
            disabled={busy}
            onChange={(event) =>
              setAreaId(event.target.value === '' ? null : event.target.value)
            }
          >
            <option value="">—</option>
            {treeOf(data.areas).map(({ area, depth }) => (
              <option key={area.id} value={area.id}>
                {' '.repeat(depth * 2)}
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <div className="journal-buttons">
          <button
            type="button"
            name="save-journal"
            className="journal-save"
            disabled={busy || body.trim() === ''}
            onClick={save}
          >
            {editingId === null ? 'Save' : 'Save changes'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              name="delete-journal"
              className="journal-delete"
              disabled={busy}
              onClick={discard}
            >
              Delete
            </button>
          )}
          {editingId !== null && (
            <button
              type="button"
              name="new-journal"
              className="journal-cancel"
              disabled={busy}
              onClick={startNew}
            >
              New entry
            </button>
          )}
        </div>

        {error !== null && (
          <p className="journal-error" role="alert">
            {error}
          </p>
        )}

        {editingItem !== null && (
          <JoinedTo
            itemId={editingItem.id}
            items={data.items}
            links={data.links}
            busy={busy}
            onLink={(to_id, kind) => data.link(editingItem.id, to_id, kind)}
            onUnlink={data.unlink}
            onError={setError}
          />
        )}
      </section>

      <section className="journal-timeline">
        <label className="journal-field">
          <span className="journal-label">Search</span>
          <input
            className="journal-input"
            name="journal-search"
            value={query}
            placeholder="Search title or body"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {data.loading ? (
          <p className="journal-note">Loading…</p>
        ) : results.length === 0 ? (
          <p className="journal-note">
            {query.trim() === '' ? 'Nothing written yet.' : 'Nothing matches.'}
          </p>
        ) : (
          <ul className="journal-list">
            {results.map((entry) => {
              const item = data.items.find((i) => i.id === entry.item_id)
              if (item === undefined) return null
              return (
                <li key={entry.item_id}>
                  <button
                    type="button"
                    name="open-journal"
                    className="journal-row"
                    onClick={() => startEdit(entry, item)}
                  >
                    <span className="journal-row-when">
                      {formatMoment(entry.journaled_at, today)}
                    </span>
                    <span className="journal-row-title">{entry.title ?? item.title}</span>
                    <span className="journal-row-snippet">{snippetOf(entry.body)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

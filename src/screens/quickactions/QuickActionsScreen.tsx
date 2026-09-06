import { useState } from 'react'

import { useScreen } from '../../items/context'
import { QUICK_ACTION_REGISTRY } from '../../items/quickActionRegistry'
import { needsArea, normalizeLabel, orderedOf, pathOf, treeOf } from '../../repository/items'
import type { Area, QuickAction, QuickActionKind } from '../../repository/items'
import './QuickActionsScreen.css'

/** The code-defined default name for an action, ignoring any custom label —
 *  what a cleared label field falls back to. */
function defaultNameFor(action_key: QuickActionKind): string {
  return QUICK_ACTION_REGISTRY.find((d) => d.key === action_key)?.name ?? action_key
}

function labelFor(action: QuickAction, areas: readonly Area[]): string {
  const name = action.label ?? defaultNameFor(action.action_key)
  return action.area_id === null ? name : `${name} — ${pathOf(areas, action.area_id)}`
}

/**
 * What appears on Home, and in what order — configured here, never assumed.
 *
 * Home shows exactly the rows below, in this order. Adding a fourth safe
 * action to the application still shows nobody a button for it until they
 * come here and add it themselves.
 */
export function QuickActionsScreen() {
  const { data } = useScreen()
  const [addingKey, setAddingKey] = useState<QuickActionKind | null>(null)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = orderedOf(data.quickActions)
  const configuredKeys = new Set(configured.map((action) => action.action_key))
  const available = QUICK_ACTION_REGISTRY.filter((d) => !configuredKeys.has(d.key))

  function run(body: () => Promise<void>) {
    setBusy(true)
    setError(null)
    void body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  function startAdding(key: QuickActionKind) {
    setAddingKey(key)
    setAreaId(null)
    setError(null)
  }

  function confirmAdd() {
    if (addingKey === null) return
    if (needsArea(addingKey) && areaId === null) {
      setError('Choose an Area first.')
      return
    }
    run(() => data.addQuickAction(addingKey, needsArea(addingKey) ? areaId : null))
    setAddingKey(null)
  }

  return (
    <section className="quick-actions">
      <p className="quick-actions-intro">Choose what appears on Home, and in what order.</p>

      {configured.length === 0 ? (
        <p className="quick-actions-empty">Nothing configured yet — add one below.</p>
      ) : (
        <ul className="quick-actions-list">
          {configured.map((action, index) => {
            const label = labelFor(action, data.areas)
            const areaOptions = treeOf(data.areas)
            const areaStillLive = areaOptions.some(({ area }) => area.id === action.area_id)
            return (
              <li key={action.id} className="quick-actions-row">
                <span className="quick-actions-name">{label}</span>
                <label className="quick-actions-label-field">
                  <span className="quick-actions-label-label">Label</span>
                  <input
                    type="text"
                    // Remounts only when the stored label actually changes,
                    // so a fresh row's own value replaces what someone was
                    // typing without a live re-render clobbering it mid-edit.
                    key={`${action.id}:${action.label ?? ''}`}
                    defaultValue={action.label ?? ''}
                    placeholder={defaultNameFor(action.action_key)}
                    disabled={busy}
                    aria-label={`Label for ${label}`}
                    onBlur={(event) => {
                      const next = normalizeLabel(event.target.value)
                      if (next === action.label) return
                      run(() => data.setQuickActionLabel(action, event.target.value))
                    }}
                  />
                </label>
                {needsArea(action.action_key) && (
                  <label className="quick-actions-area-field">
                    <span className="quick-actions-area-label">
                      {areaStillLive ? 'Area' : 'Area — the one configured is unavailable'}
                    </span>
                    <select
                      className="quick-actions-area"
                      aria-label={`Area for ${label}`}
                      value={areaStillLive ? action.area_id ?? '' : ''}
                      disabled={busy}
                      onChange={(event) => {
                        if (event.target.value === '') return
                        run(() => data.setQuickActionArea(action, event.target.value))
                      }}
                    >
                      {!areaStillLive && <option value="">Choose an Area</option>}
                      {areaOptions.map(({ area, depth }) => (
                        <option key={area.id} value={area.id}>
                          {' '.repeat(depth * 2)}
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="quick-actions-row-buttons">
                  <button
                    type="button"
                    name="move-up"
                    disabled={busy || index === 0}
                    aria-label={`Move ${label} earlier`}
                    onClick={() => run(() => data.moveQuickAction(action, 'up'))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    name="move-down"
                    disabled={busy || index === configured.length - 1}
                    aria-label={`Move ${label} later`}
                    onClick={() => run(() => data.moveQuickAction(action, 'down'))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    name="remove"
                    className="quick-actions-remove"
                    disabled={busy}
                    onClick={() => run(() => data.removeQuickAction(action))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error !== null && <p className="quick-actions-error">{error}</p>}

      {available.length > 0 && (
        <section className="quick-actions-add">
          <h2 className="quick-actions-heading">Add an action</h2>
          <ul className="quick-actions-list">
            {available.map((descriptor) => (
              <li key={descriptor.key} className="quick-actions-row">
                <span className="quick-actions-name">{descriptor.name}</span>
                {addingKey === descriptor.key ? (
                  <div className="quick-actions-row-buttons">
                    {descriptor.needsArea && (
                      <select
                        className="quick-actions-area"
                        aria-label={`Area for ${descriptor.name}`}
                        value={areaId ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          setAreaId(event.target.value === '' ? null : event.target.value)
                        }
                      >
                        <option value="">Choose an Area</option>
                        {treeOf(data.areas).map(({ area, depth }) => (
                          <option key={area.id} value={area.id}>
                            {' '.repeat(depth * 2)}
                            {area.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      name="confirm-add"
                      disabled={busy || (descriptor.needsArea && areaId === null)}
                      onClick={confirmAdd}
                    >
                      Add it
                    </button>
                    <button
                      type="button"
                      name="cancel-add"
                      disabled={busy}
                      onClick={() => setAddingKey(null)}
                    >
                      Not now
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    name="add"
                    className="quick-actions-add-button"
                    disabled={busy}
                    onClick={() => startAdding(descriptor.key)}
                  >
                    Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {available.length === 0 && (
        <p className="quick-actions-note">Every supported action is already configured.</p>
      )}
    </section>
  )
}

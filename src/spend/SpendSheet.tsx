import { useState } from 'react'

import { CATEGORIES, CATEGORY_NAMES, treeOf } from '../repository/items'
import type { Area, Category, Vehicle } from '../repository/items'
import { penceOf, readingOf } from '../shifts/money'
import { Sheet } from '../ui/Sheet'
import './SpendSheet.css'

type Props = {
  day: string
  areas: Area[]
  vehicles: Vehicle[]
  /** Where the last shift was, so the common case needs no choosing. */
  suggestedArea: string | null
  onSpend: (what: {
    day: string
    area_id: string | null
    title: string
    category: Category
    amount: number
    odo: number | null
    full_tank: boolean | null
    business_pct: number
    vehicle_item_id: string | null
  }) => Promise<void>
  onClose: () => void
}

/**
 * Money out, written down on the day it went out.
 *
 * A fuel purchase asks two more things than the rest — the reading and
 * whether the tank was filled — because those two are what a cost per
 * kilometre can be worked out from. Everything else asks nothing extra: an
 * insurance premium has no odometer, and the database refuses one.
 */
/** A share of a bill that was for work, 0 to 100. */
function businessShare(typed: string): number {
  const trimmed = typed.trim().replace('%', '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`That is not a share of the bill: ${typed}`)
  }
  const share = Number(trimmed)
  if (share < 0 || share > 100) throw new Error(`A share outside 0-100: ${typed}`)
  return share
}

export function SpendSheet({ day, areas, vehicles, suggestedArea, onSpend, onClose }: Props) {
  const [category, setCategory] = useState<Category>('fuel')
  const [amount, setAmount] = useState('')
  const [odo, setOdo] = useState('')
  const [full, setFull] = useState(true)
  const [area, setArea] = useState(suggestedArea ?? '')
  const [vehicle, setVehicle] = useState('')
  // The whole of it, until you say otherwise. What is written against a line
  // of work was meant as a cost of it; the box is there for the year of car
  // insurance that also covers the shopping.
  const [share, setShare] = useState('100')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fuel = category === 'fuel'

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const pence = penceOf(amount)
      if (pence === null) throw new Error('How much was it?')
      await onSpend({
        day,
        area_id: area === '' ? null : area,
        title: CATEGORY_NAMES[category],
        category,
        amount: pence / 100,
        odo: fuel ? readingOf(odo) : null,
        full_tank: fuel ? full : null,
        business_pct: businessShare(share),
        vehicle_item_id: vehicle === '' ? null : vehicle,
      })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={`Money out · ${day}`} onClose={onClose}>
      <div className="spend-kinds">
        {CATEGORIES.map((one) => (
          <button
            key={one}
            type="button"
            name={one}
            className={`spend-kind${one === category ? ' spend-kind-on' : ''}`}
            disabled={busy}
            onClick={() => setCategory(one)}
          >
            {CATEGORY_NAMES[one]}
          </button>
        ))}
      </div>

      <label className="spend-field">
        <span className="spend-label">How much</span>
        <input
          className="spend-input"
          name="amount"
          inputMode="decimal"
          value={amount}
          disabled={busy}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      {fuel && (
        <>
          <label className="spend-field">
            <span className="spend-label">Odometer</span>
            <input
              className="spend-input"
              name="odo"
              inputMode="decimal"
              value={odo}
              disabled={busy}
              onChange={(event) => setOdo(event.target.value)}
            />
          </label>

          <label className="spend-check">
            <input
              type="checkbox"
              name="full"
              checked={full}
              disabled={busy}
              onChange={(event) => setFull(event.target.checked)}
            />
            <span>Filled the tank</span>
          </label>

          {/* Said here because it is the moment it matters: a rate can only be
              worked out between two full tanks, so a splash of £20 counts its
              money but measures nothing on its own. */}
          <p className="spend-note">
            The cost per kilometre comes from one full tank to the next. A
            part-fill still counts what you paid.
          </p>
        </>
      )}

      <label className="spend-field">
        <span className="spend-label">Area</span>
        <select
          className="spend-input spend-area"
          name="area"
          value={area}
          disabled={busy}
          onChange={(event) => setArea(event.target.value)}
        >
          <option value="">—</option>
          {treeOf(areas).map(({ area: one, depth }) => (
            <option key={one.id} value={one.id}>
              {' '.repeat(depth * 2)}
              {one.name}
            </option>
          ))}
        </select>
      </label>

      <label className="spend-field">
        <span className="spend-label">Vehicle</span>
        <select
          className="spend-input"
          name="vehicle"
          value={vehicle}
          disabled={busy}
          onChange={(event) => setVehicle(event.target.value)}
        >
          <option value="">—</option>
          {vehicles.map((one) => (
            <option key={one.itemId} value={one.itemId}>
              {one.name}
            </option>
          ))}
        </select>
      </label>

      {/* Only the working part of a bill is a cost of earning. Counting the
          whole of a year's insurance makes the profit look smaller than it is,
          and the difference turns up in January. */}
      <label className="spend-field">
        <span className="spend-label">For work %</span>
        <input
          className="spend-amount"
          name="business"
          inputMode="decimal"
          value={share}
          disabled={busy}
          onChange={(event) => setShare(event.target.value)}
        />
      </label>

      {error !== null && <p className="spend-error">{error}</p>}

      <button
        type="button"
        name="save"
        className="spend-save"
        disabled={busy || amount.trim() === ''}
        onClick={() => void save()}
      >
        Write it down
      </button>
    </Sheet>
  )
}

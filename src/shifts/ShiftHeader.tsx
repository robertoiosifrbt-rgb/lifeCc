import { treeOf } from '../repository/items'
import type { Area, Vehicle, VehicleLink } from '../repository/items'

type Props = {
  title: string
  due: string
  area_id: string
  areas: Area[]
  vehicles: Vehicle[]
  /** Whichever Vehicle this Workday's own item is linked to right now — none,
   *  one, or ambiguous when more than one is linked. */
  vehicle: VehicleLink
  completed: boolean
  busy: boolean
  onChangeTitle: (typed: string) => void
  onChangeDue: (typed: string) => void
  onChangeArea: (area_id: string) => void
  onChangeVehicle: (vehicleItemId: string | null) => void
}

function vehicleNameOf(vehicles: Vehicle[], vehicle: VehicleLink): string {
  if (vehicle.kind === 'none') return 'No Vehicle'
  if (vehicle.kind === 'ambiguous') return 'Multiple Vehicles linked'
  return vehicles.find((candidate) => candidate.itemId === vehicle.vehicleItemId)?.name ?? 'Unknown Vehicle'
}

/**
 * Title, date, status and Area — editable while the workday is a draft, read
 * only once it is Completed.
 *
 * A date typed here changes the same anchor item's `due`, never a new row: a
 * shift moved to another day is the same shift, found where that day looks
 * for it.
 */
export function ShiftHeader(props: Props) {
  const { completed, busy } = props

  if (completed) {
    const area = props.areas.find((candidate) => candidate.id === props.area_id)
    return (
      <section className="shift-block">
        <p className="shift-header-status">Completed</p>
        <p className="shift-header-title">{props.title}</p>
        <p className="shift-hint">{props.due === '' ? 'No date' : props.due}</p>
        <p className="shift-hint">{area === undefined ? 'No Area' : area.name}</p>
        <p className="shift-hint">{vehicleNameOf(props.vehicles, props.vehicle)}</p>
      </section>
    )
  }

  return (
    <section className="shift-block">
      <p className="shift-header-status">Draft</p>
      <label className="shift-field">
        <span className="shift-label">Title</span>
        <input
          className="shift-input"
          name="title"
          value={props.title}
          disabled={busy}
          onChange={(event) => props.onChangeTitle(event.target.value)}
        />
      </label>
      <label className="shift-field">
        <span className="shift-label">Date</span>
        <input
          className="shift-input"
          type="date"
          name="due"
          value={props.due}
          disabled={busy}
          onChange={(event) => props.onChangeDue(event.target.value)}
        />
      </label>
      <label className="shift-field">
        <span className="shift-label">Area</span>
        <select
          className="shift-input"
          name="area"
          value={props.area_id}
          disabled={busy}
          onChange={(event) => props.onChangeArea(event.target.value)}
        >
          <option value="">—</option>
          {treeOf(props.areas).map(({ area, depth }) => (
            <option key={area.id} value={area.id}>
              {' '.repeat(depth * 2)}
              {area.name}
            </option>
          ))}
        </select>
      </label>
      <label className="shift-field">
        <span className="shift-label">Vehicle used</span>
        <select
          className="shift-input"
          name="vehicle"
          value={props.vehicle.kind === 'one' ? props.vehicle.vehicleItemId : ''}
          disabled={busy}
          onChange={(event) => props.onChangeVehicle(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">—</option>
          {props.vehicles.map((vehicle) => (
            <option key={vehicle.itemId} value={vehicle.itemId}>
              {vehicle.name}
            </option>
          ))}
        </select>
      </label>
      {/* Never guessed between two candidates: picking a Vehicle here
          replaces every link this Workday carries, so the ambiguity is
          always solvable from this one control. */}
      {props.vehicle.kind === 'ambiguous' && (
        <p className="shift-missing">
          More than one Vehicle is linked to this workday. Pick one above to
          replace them.
        </p>
      )}
    </section>
  )
}

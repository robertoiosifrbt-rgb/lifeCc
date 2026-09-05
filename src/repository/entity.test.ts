import { describe, expect, it } from 'vitest'

import { dueOn, entityFromRow } from './entity'

const CAR = {
  item_id: 'car',
  owner: 'a',
  entity_kind: 'vehicle',
  registration: 'AB12 CDE',
  make: 'Vauxhall',
  model: 'Vivaro',
  fuel: 'diesel',
  odo: 148230,
  mot_due: '2027-03-14',
  road_tax_due: null,
  insurance_due: '2026-10-01',
  service_due: null,
  oil_changed_at: null,
  oil_due_at: null,
}

describe('reading a thing', () => {
  it('reads a vehicle whole', () => {
    const car = entityFromRow(CAR)
    expect(car.registration).toBe('AB12 CDE')
    expect(car.fuel).toBe('diesel')
    expect(car.odo).toBe(148230)
  })

  it('refuses a company carrying a car’s columns', () => {
    // The database refuses this too. A row that arrived saying it is a company
    // with an odometer did not come from there as it stands, and letting it in
    // would put a car's dates on a screen that says "Company".
    expect(() =>
      entityFromRow({ ...CAR, entity_kind: 'company' }),
    ).toThrow(/company carrying/)
  })

  it('refuses a kind nobody named', () => {
    expect(() => entityFromRow({ ...CAR, entity_kind: 'spaceship' })).toThrow(
      /Unknown kind of thing/,
    )
  })

  it('refuses a fuel nobody named', () => {
    expect(() => entityFromRow({ ...CAR, fuel: 'coal' })).toThrow(/Unknown fuel/)
  })
})

describe('what a vehicle owes', () => {
  const car = entityFromRow(CAR)

  it('puts the soonest first and counts the days', () => {
    const due = dueOn(car, '2026-09-05')
    expect(due.map((one) => one.key)).toEqual(['insurance_due', 'mot_due'])
    expect(due[0]?.inDays).toBe(26)
  })

  it('counts a date that has passed as negative, not as zero', () => {
    // Clamping at zero would make an MOT that ran out in March read exactly
    // like one due today, and the two are not the same problem.
    const due = dueOn(car, '2026-10-12')
    expect(due[0]?.key).toBe('insurance_due')
    expect(due[0]?.inDays).toBe(-11)
  })

  it('says nothing about the dates nobody has filled in', () => {
    const due = dueOn(car, '2026-09-05')
    expect(due.map((one) => one.key)).not.toContain('service_due')
  })
})

import { describe, expect, it } from 'vitest'

import {
  dayOf,
  formatDay,
  formatMoment,
  formatMonth,
  formatWeekday,
  localDateTimeInput,
  minusDays,
  momentFromLocalInput,
  monthDays,
  monthOf,
  plusDays,
  shiftMonth,
  weekdayIndex,
} from './dates'

const TODAY = '2026-09-04'

describe('formatDay', () => {
  it('writes day and month, without the year, inside the current year', () => {
    expect(formatDay('2026-08-20', TODAY)).toBe('20 August')
    expect(formatDay('2026-01-05', TODAY)).toBe('5 January')
    expect(formatDay('2026-12-31', TODAY)).toBe('31 December')
  })

  it('adds the year when it falls in another one', () => {
    expect(formatDay('2025-08-20', TODAY)).toBe('20 August 2025')
  })

  it('refuses anything that is not a day', () => {
    expect(() => formatDay('2026-08', TODAY)).toThrow('Not a day')
  })
})

describe('formatWeekday', () => {
  it('puts the weekday in front', () => {
    expect(formatWeekday('2026-09-04', TODAY)).toBe('Friday, 4 September')
    expect(formatWeekday('2026-09-05', TODAY)).toBe('Saturday, 5 September')
    expect(formatWeekday('2026-09-07', TODAY)).toBe('Monday, 7 September')
  })
})

describe('minusDays', () => {
  it('crosses the end of a month and of a year', () => {
    expect(minusDays('2026-09-04', 7)).toBe('2026-08-28')
    expect(minusDays('2026-09-01', 1)).toBe('2026-08-31')
    expect(minusDays('2026-01-01', 1)).toBe('2025-12-31')
  })

  it('does not shift by a day because of a timezone', () => {
    expect(minusDays('2026-03-30', 1)).toBe('2026-03-29')
    expect(minusDays('2026-10-26', 1)).toBe('2026-10-25')
    expect(minusDays('2026-09-04', 0)).toBe('2026-09-04')
  })
})

describe('dayOf', () => {
  it('takes the day out of a timestamp', () => {
    expect(dayOf('2026-08-12T10:00:00+00:00')).toBe('2026-08-12')
  })
})

describe('monthOf', () => {
  it('is the month the day falls in', () => {
    expect(monthOf('2026-09-04')).toBe('2026-09')
  })
})

describe('shiftMonth', () => {
  it('steps forward and back', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-09', -1)).toBe('2026-08')
  })

  it('crosses the year in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatMonth', () => {
  it('leaves the year out inside the year you are in', () => {
    expect(formatMonth('2026-09', '2026-09-04')).toBe('September')
    expect(formatMonth('2026-02', '2026-09-04')).toBe('February')
  })

  it('names the year once the grid leaves it', () => {
    expect(formatMonth('2027-02', '2026-09-04')).toBe('February 2027')
    expect(formatMonth('2025-12', '2026-09-04')).toBe('December 2025')
  })
})

describe('monthDays', () => {
  it('runs the whole month, in order', () => {
    const days = monthDays('2026-09')
    expect(days.length).toBe(30)
    expect(days[0]).toBe('2026-09-01')
    expect(days[29]).toBe('2026-09-30')
  })

  it('knows a leap February from a common one', () => {
    expect(monthDays('2028-02').length).toBe(29)
    expect(monthDays('2027-02').length).toBe(28)
  })
})

describe('plusDays', () => {
  it('crosses a month end', () => {
    expect(plusDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('crosses a year end', () => {
    expect(plusDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('weekdayIndex', () => {
  it('starts the week on Monday', () => {
    // 31 August 2026 is a Monday, 6 September a Sunday.
    expect(weekdayIndex('2026-08-31')).toBe(0)
    expect(weekdayIndex('2026-09-06')).toBe(6)
  })
})

describe('localDateTimeInput', () => {
  it('reads the device clock, not UTC', () => {
    expect(localDateTimeInput(new Date(2026, 8, 4, 14, 32))).toBe('2026-09-04T14:32')
  })

  it('pads a single-digit month, day, hour and minute', () => {
    expect(localDateTimeInput(new Date(2026, 0, 5, 9, 3))).toBe('2026-01-05T09:03')
  })
})

describe('momentFromLocalInput', () => {
  it('reads a datetime-local value on the device clock, round-tripping the input', () => {
    const at = new Date(2026, 8, 4, 14, 32)
    expect(momentFromLocalInput(localDateTimeInput(at))).toBe(at.toISOString())
  })

  it('refuses anything that is not a local date and time', () => {
    expect(() => momentFromLocalInput('2026-09-04')).toThrow('Not a local date and time')
    expect(() => momentFromLocalInput('not a moment')).toThrow('Not a local date and time')
  })
})

describe('formatMoment', () => {
  it('writes the day and the time, without the year inside the current one', () => {
    expect(formatMoment('2026-08-20T14:32:00+00:00', TODAY)).toBe('20 August, 14:32')
  })

  it('refuses anything that is not a moment', () => {
    expect(() => formatMoment('not a moment', TODAY)).toThrow('Not a moment')
  })
})

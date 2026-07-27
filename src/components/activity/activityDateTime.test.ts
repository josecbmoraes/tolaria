import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  localDateAndTimeToOffsetIso,
  offsetIsoToLocalDateAndTime,
} from './activityDateTime'

describe('activityDateTime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores the selected wall time with a negative local offset', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(180)

    expect(localDateAndTimeToOffsetIso(new Date(2026, 6, 26), '09:30')).toBe(
      '2026-07-26T09:30:00-03:00',
    )
  })

  it('formats positive offsets including half-hour zones', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330)

    expect(localDateAndTimeToOffsetIso(new Date(2026, 0, 5), '17:04')).toBe(
      '2026-01-05T17:04:00+05:30',
    )
  })

  it('reads stored wall time without converting it to the host timezone', () => {
    const result = offsetIsoToLocalDateAndTime('2026-07-26T09:30:00-03:00')

    expect([
      result.date.getFullYear(),
      result.date.getMonth(),
      result.date.getDate(),
      result.time,
    ]).toEqual([2026, 6, 26, '09:30'])
  })

  it.each([
    [new Date('invalid'), '09:30'],
    [new Date(2026, 6, 26), ''],
    [new Date(2026, 6, 26), '24:00'],
    [new Date(2026, 6, 26), '9:30'],
  ])('rejects invalid calendar or time inputs', (date, time) => {
    expect(() => localDateAndTimeToOffsetIso(date, time)).toThrow('Invalid activity date or time')
  })

  it('rejects an invalid stored timestamp', () => {
    expect(() => offsetIsoToLocalDateAndTime('2026-07-26T09:30:00Z')).toThrow(
      'Invalid activity timestamp',
    )
  })
})

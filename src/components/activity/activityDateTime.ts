const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const OFFSET_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):[0-5]\d(?:\.\d+)?[+-](?:[01]\d|2[0-3]):[0-5]\d$/

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

function validLocalDate(date: Date): boolean {
  return Number.isFinite(date.getTime())
}

export function localDateAndTimeToOffsetIso(date: Date, time: string): string {
  if (!validLocalDate(date) || !TIME_PATTERN.test(time)) {
    throw new Error('Invalid activity date or time')
  }

  const offsetMinutes = date.getTimezoneOffset()
  const offsetSign = offsetMinutes <= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const offsetHours = Math.floor(absoluteOffset / 60)
  const offsetRemainder = absoluteOffset % 60

  return [
    `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`,
    `T${time}:00`,
    `${offsetSign}${padTwo(offsetHours)}:${padTwo(offsetRemainder)}`,
  ].join('')
}

export function offsetIsoToLocalDateAndTime(value: string): { date: Date; time: string } {
  const match = OFFSET_ISO_PATTERN.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid activity timestamp')
  }

  const [, yearText, monthText, dayText, hour, minute] = match
  const year = Number(yearText)
  const month = Number(monthText) - 1
  const day = Number(dayText)
  const date = new Date(year, month, day)

  if (
    !validLocalDate(date)
    || date.getFullYear() !== year
    || date.getMonth() !== month
    || date.getDate() !== day
  ) {
    throw new Error('Invalid activity timestamp')
  }

  return { date, time: `${hour}:${minute}` }
}

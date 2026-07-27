function containsOnlyDigits(value: string, start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 48 || code > 57) return false
  }
  return true
}

function validTime(value: string): boolean {
  if (
    value.length !== 5
    || value.charAt(2) !== ':'
    || !containsOnlyDigits(value, 0, 2)
    || !containsOnlyDigits(value, 3, 5)
  ) return false
  return Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60
}

function offsetIsoParts(value: string): [string, string, string, string, string] | null {
  const offsetStart = Math.max(value.lastIndexOf('+'), value.lastIndexOf('-'))
  const fractional = value.charAt(19) === '.'
  const secondsEnd = fractional ? offsetStart : 19
  if (
    offsetStart < 19
    || value.length !== offsetStart + 6
    || value.charAt(4) !== '-'
    || value.charAt(7) !== '-'
    || value.charAt(10) !== 'T'
    || value.charAt(13) !== ':'
    || value.charAt(16) !== ':'
    || value.charAt(offsetStart + 3) !== ':'
    || !containsOnlyDigits(value, 0, 4)
    || !containsOnlyDigits(value, 5, 7)
    || !containsOnlyDigits(value, 8, 10)
    || !containsOnlyDigits(value, 11, 13)
    || !containsOnlyDigits(value, 14, 16)
    || !containsOnlyDigits(value, 17, 19)
    || (fractional && (secondsEnd <= 20 || !containsOnlyDigits(value, 20, secondsEnd)))
    || !containsOnlyDigits(value, offsetStart + 1, offsetStart + 3)
    || !containsOnlyDigits(value, offsetStart + 4, offsetStart + 6)
  ) return null
  const hour = value.slice(11, 13)
  const minute = value.slice(14, 16)
  if (!validTime(`${hour}:${minute}`)) return null
  return [value.slice(0, 4), value.slice(5, 7), value.slice(8, 10), hour, minute]
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

function validLocalDate(date: Date): boolean {
  return Number.isFinite(date.getTime())
}

export function localDateAndTimeToOffsetIso(date: Date, time: string): string {
  if (!validLocalDate(date) || !validTime(time)) {
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
  const parts = offsetIsoParts(value)
  if (!parts || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid activity timestamp')
  }

  const [yearText, monthText, dayText, hour, minute] = parts
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

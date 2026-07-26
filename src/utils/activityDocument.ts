export type ActivityRecordIssueCode =
  | 'missing-id'
  | 'duplicate-id'
  | 'duplicate-field'
  | 'missing-occurred-at'
  | 'invalid-occurred-at'
  | 'invalid-follow-up-at'
  | 'missing-separator'
  | 'unclosed-fence'

export type ActivityRecordIssue = {
  code: ActivityRecordIssueCode
  messageKey: string
  line: number
}

export type ActivityRecord = {
  key: string
  id: string | null
  type: string
  occurredAt: string | null
  followUpAt: string | null
  content: string
  source: string
  start: number
  end: number
  valid: boolean
  editable: boolean
  issues: ActivityRecordIssue[]
  metadataLines: string[]
}

export type ActivityDocument = {
  section: { headingStart: number; bodyStart: number; end: number } | null
  records: ActivityRecord[]
  issues: ActivityRecordIssue[]
}

type SourceLine = {
  source: string
  text: string
  start: number
  end: number
  number: number
}

type Fence = {
  character: '`' | '~'
  length: number
  info: string
}

type ActivitySection = NonNullable<ActivityDocument['section']>

const ACTIVITY_HEADING = /^ {0,3}##[\t ]+Activity[\t ]*#*[\t ]*$/u
const SECTION_HEADING = /^ {0,3}#{1,2}(?:[\t ]+|$)/u
function containsOnlyDigits(value: string, start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 48 || code > 57) return false
  }
  return true
}

function hasOffsetDateTimeShape(value: string): boolean {
  const includesSeconds = value.length === 25
  if (!includesSeconds && value.length !== 22) return false
  const offsetStart = includesSeconds ? 19 : 16
  const sign = value.charAt(offsetStart)
  return value.charAt(4) === '-'
    && value.charAt(7) === '-'
    && value.charAt(10) === 'T'
    && value.charAt(13) === ':'
    && (!includesSeconds || value.charAt(16) === ':')
    && (sign === '+' || sign === '-')
    && value.charAt(offsetStart + 3) === ':'
    && containsOnlyDigits(value, 0, 4)
    && containsOnlyDigits(value, 5, 7)
    && containsOnlyDigits(value, 8, 10)
    && containsOnlyDigits(value, 11, 13)
    && containsOnlyDigits(value, 14, 16)
    && (!includesSeconds || containsOnlyDigits(value, 17, 19))
    && containsOnlyDigits(value, offsetStart + 1, offsetStart + 3)
    && containsOnlyDigits(value, offsetStart + 4, offsetStart + 6)
}

function splitSourceLines(markdown: string): SourceLine[] {
  const sources = markdown.match(/[^\n]*(?:\n|$)/gu) ?? []
  const lines: SourceLine[] = []
  let offset = 0

  for (const source of sources) {
    if (source === '' && offset === markdown.length) continue
    const endingLength = source.endsWith('\r\n') ? 2 : source.endsWith('\n') ? 1 : 0
    lines.push({
      source,
      text: endingLength === 0 ? source : source.slice(0, -endingLength),
      start: offset,
      end: offset + source.length,
      number: lines.length + 1,
    })
    offset += source.length
  }

  return lines
}

function readFence(line: string): Fence | null {
  const match = /^ {0,3}(`{3,}|~{3,})[\t ]*(.*)$/u.exec(line)
  const delimiter = match?.at(1)
  if (!delimiter) return null
  return {
    character: delimiter.charAt(0) as Fence['character'],
    length: delimiter.length,
    info: match?.at(2) ?? '',
  }
}

function closesFence(line: string, fence: Fence): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[\t ]*$/u.exec(line)
  const delimiter = match?.at(1)
  return Boolean(
    delimiter
    && delimiter.charAt(0) === fence.character
    && delimiter.length >= fence.length,
  )
}

function findClosingFence(lines: SourceLine[], openingIndex: number, fence: Fence): number {
  for (let index = openingIndex + 1; index < lines.length; index += 1) {
    const line = lines.at(index)
    if (line && closesFence(line.text, fence)) return index
  }
  return -1
}

function findActivitySection(lines: SourceLine[], markdownLength: number): ActivitySection | null {
  let activeFence: Fence | null = null
  let section: Omit<ActivitySection, 'end'> | null = null

  for (const line of lines) {
    if (activeFence) {
      if (closesFence(line.text, activeFence)) activeFence = null
      continue
    }

    const opening = readFence(line.text)
    if (opening) {
      activeFence = opening
      continue
    }

    if (!section && ACTIVITY_HEADING.test(line.text)) {
      section = { headingStart: line.start, bodyStart: line.end }
      continue
    }

    if (section && SECTION_HEADING.test(line.text)) {
      return { ...section, end: line.start }
    }
  }

  return section ? { ...section, end: markdownLength } : null
}

function issue(code: ActivityRecordIssueCode, line: number): ActivityRecordIssue {
  return { code, line, messageKey: `editor.activity.errors.${code}` }
}

export function isOffsetDateTime(value: string): boolean {
  return hasOffsetDateTimeShape(value) && Number.isFinite(Date.parse(value))
}

function readMetadata(
  lines: SourceLine[],
  openingIndex: number,
  separatorIndex: number,
): { values: Map<string, string>; metadataLines: string[]; issues: ActivityRecordIssue[] } {
  const values = new Map<string, string>()
  const metadataLines: string[] = []
  const issues: ActivityRecordIssue[] = []

  for (let index = openingIndex + 1; index < separatorIndex; index += 1) {
    const line = lines.at(index)
    if (!line) continue
    metadataLines.push(line.text)
    const colon = line.text.indexOf(':')
    if (colon < 0) continue
    const key = line.text.slice(0, colon).trim()
    const value = line.text.slice(colon + 1).trim()
    if (values.has(key)) issues.push(issue('duplicate-field', line.number))
    else values.set(key, value)
  }

  return { values, metadataLines, issues }
}

function validateMetadata(
  values: Map<string, string>,
  openingLine: number,
  hasSeparator: boolean,
): ActivityRecordIssue[] {
  const issues: ActivityRecordIssue[] = []
  const id = values.get('id')
  const occurredAt = values.get('occurred_at')
  const followUpAt = values.get('follow_up_at')

  if (!id) issues.push(issue('missing-id', openingLine))
  if (!occurredAt) issues.push(issue('missing-occurred-at', openingLine))
  else if (!isOffsetDateTime(occurredAt)) issues.push(issue('invalid-occurred-at', openingLine))
  if (followUpAt && !isOffsetDateTime(followUpAt)) {
    issues.push(issue('invalid-follow-up-at', openingLine))
  }
  if (!hasSeparator) issues.push(issue('missing-separator', openingLine))

  return issues
}

function parseRecord(lines: SourceLine[], openingIndex: number, closingIndex: number): ActivityRecord {
  const opening = lines.at(openingIndex)
  const closing = lines.at(closingIndex)
  if (!opening || !closing) throw new Error('Activity record bounds are invalid')
  let separatorIndex = -1
  for (let index = openingIndex + 1; index < closingIndex; index += 1) {
    if (lines.at(index)?.text === '---') {
      separatorIndex = index
      break
    }
  }

  const headerEnd = separatorIndex < 0 ? closingIndex : separatorIndex
  const metadata = readMetadata(lines, openingIndex, headerEnd)
  const issues = [
    ...metadata.issues,
    ...validateMetadata(metadata.values, opening.number, separatorIndex >= 0),
  ]
  const id = metadata.values.get('id') || null
  const type = metadata.values.get('type') || 'update'
  const valid = issues.length === 0
  const start = opening.start
  const end = closing.end

  return {
    key: valid && id ? id : `offset:${start}`,
    id,
    type,
    occurredAt: metadata.values.get('occurred_at') || null,
    followUpAt: metadata.values.get('follow_up_at') || null,
    content: separatorIndex < 0
      ? ''
      : lines.slice(separatorIndex + 1, closingIndex).map(line => line.source).join(''),
    source: lines.slice(openingIndex, closingIndex + 1).map(line => line.source).join(''),
    start,
    end,
    valid,
    editable: valid && type === 'update',
    issues,
    metadataLines: metadata.metadataLines,
  }
}

function parseSectionRecords(
  lines: SourceLine[],
  section: ActivitySection,
): Pick<ActivityDocument, 'records' | 'issues'> {
  const records: ActivityRecord[] = []
  const issues: ActivityRecordIssue[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines.at(index)
    if (!line || line.start < section.bodyStart || line.start >= section.end) continue
    const fence = readFence(line.text)
    if (!fence) continue
    const closingIndex = findClosingFence(lines, index, fence)
    const closingLine = lines.at(closingIndex)
    if (closingIndex < 0 || !closingLine || closingLine.start >= section.end) {
      if (fence.info.trim() === 'line-record') {
        issues.push(issue('unclosed-fence', line.number))
      }
      break
    }
    if (fence.info.trim() === 'line-record') {
      records.push(parseRecord(lines, index, closingIndex))
    }
    index = closingIndex
  }

  return { records, issues }
}

function markDuplicateIds(records: ActivityRecord[]): ActivityRecord[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    if (record.id) counts.set(record.id, (counts.get(record.id) ?? 0) + 1)
  }

  return records.map(record => {
    if (!record.id || counts.get(record.id) === 1) return record
    return {
      ...record,
      key: `offset:${record.start}`,
      valid: false,
      editable: false,
      issues: [...record.issues, issue('duplicate-id', 1)],
    }
  })
}

export function parseActivityDocument(markdown: string): ActivityDocument {
  const lines = splitSourceLines(markdown)
  const section = findActivitySection(lines, markdown.length)
  if (!section) return { section: null, records: [], issues: [] }
  const parsed = parseSectionRecords(lines, section)
  return { section, issues: parsed.issues, records: markDuplicateIds(parsed.records) }
}

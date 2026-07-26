import { isOffsetDateTime, parseActivityDocument, type ActivityRecord } from './activityDocument'

export type ActivityRecordInput = {
  id: string
  type?: 'update'
  occurredAt: string
  followUpAt?: string | null
  content: string
}

export type ActivityRecordPatch = Omit<ActivityRecordInput, 'id'>
export type ActivityMutationErrorCode = 'invalid-input' | 'not-found' | 'not-editable'

export class ActivityMutationError extends Error {
  readonly code: ActivityMutationErrorCode

  constructor(code: ActivityMutationErrorCode) {
    super(`Activity mutation failed: ${code}`)
    this.name = 'ActivityMutationError'
    this.code = code
  }
}

function newlineFor(markdown: string): '\n' | '\r\n' {
  return markdown.includes('\r\n') ? '\r\n' : '\n'
}

function validDateTime(value: string): boolean {
  return isOffsetDateTime(value)
}

function assertValidInput(input: ActivityRecordInput): void {
  const followUpValid = !input.followUpAt || validDateTime(input.followUpAt)
  if (!input.id.trim() || !validDateTime(input.occurredAt) || !followUpValid) {
    throw new ActivityMutationError('invalid-input')
  }
}

export function serializeActivityRecord(
  input: ActivityRecordInput,
  newline: '\n' | '\r\n',
): string {
  assertValidInput(input)
  const followUp = input.followUpAt ? [`follow_up_at: ${input.followUpAt}`] : []
  return [
    '```line-record',
    `id: ${input.id}`,
    `type: ${input.type ?? 'update'}`,
    `occurred_at: ${input.occurredAt}`,
    ...followUp,
    '---',
    input.content,
    '```',
  ].join(newline)
}

function separatorBefore(markdown: string, newline: '\n' | '\r\n'): string {
  if (markdown.length === 0 || markdown.endsWith(newline + newline)) return ''
  return markdown.endsWith(newline) ? newline : newline + newline
}

function appendWithoutSection(markdown: string, input: ActivityRecordInput): string {
  const newline = newlineFor(markdown)
  const source = serializeActivityRecord(input, newline)
  return `${markdown}${separatorBefore(markdown, newline)}## Activity${newline}${newline}${source}`
}

function appendInsideSection(
  markdown: string,
  sectionEnd: number,
  input: ActivityRecordInput,
): string {
  const newline = newlineFor(markdown)
  const before = markdown.slice(0, sectionEnd)
  const after = markdown.slice(sectionEnd)
  const source = serializeActivityRecord(input, newline)
  const suffix = after ? newline + newline : ''
  return `${before}${separatorBefore(before, newline)}${source}${suffix}${after}`
}

export function appendActivityRecord(markdown: string, input: ActivityRecordInput): string {
  assertValidInput(input)
  const document = parseActivityDocument(markdown)
  return document.section
    ? appendInsideSection(markdown, document.section.end, input)
    : appendWithoutSection(markdown, input)
}

function editableRecord(markdown: string, id: string): ActivityRecord {
  const record = parseActivityDocument(markdown).records.find(candidate => candidate.id === id)
  if (!record) throw new ActivityMutationError('not-found')
  if (!record.editable) throw new ActivityMutationError('not-editable')
  return record
}

function metadataKey(line: string): string | null {
  const colon = line.indexOf(':')
  return colon < 0 ? null : line.slice(0, colon).trim()
}

function patchedMetadata(record: ActivityRecord, patch: ActivityRecordPatch): string[] {
  const result: string[] = []
  let hasType = false
  let hasFollowUp = false

  for (const line of record.metadataLines) {
    const key = metadataKey(line)
    if (key === 'type') {
      result.push('type: update')
      hasType = true
    } else if (key === 'occurred_at') {
      result.push(`occurred_at: ${patch.occurredAt}`)
    } else if (key === 'follow_up_at') {
      if (patch.followUpAt) result.push(`follow_up_at: ${patch.followUpAt}`)
      hasFollowUp = true
    } else {
      result.push(line)
    }
  }

  const idIndex = result.findIndex(line => metadataKey(line) === 'id')
  if (!hasType) result.splice(idIndex + 1, 0, 'type: update')
  if (patch.followUpAt && !hasFollowUp) result.push(`follow_up_at: ${patch.followUpAt}`)
  return result
}

function firstAndLastSourceLines(source: string): { opening: string; closing: string } {
  const lines = source.split(/\r?\n/u)
  const closingIndex = lines.at(-1) === '' ? lines.length - 2 : lines.length - 1
  return { opening: lines.at(0) ?? '```line-record', closing: lines.at(closingIndex) ?? '```' }
}

function normalizeBody(content: string, newline: '\n' | '\r\n'): string {
  const normalized = content.replace(/\r?\n/gu, newline)
  return normalized.endsWith(newline) ? normalized : normalized + newline
}

function updatedRecordSource(record: ActivityRecord, patch: ActivityRecordPatch): string {
  const newline = newlineFor(record.source)
  const { opening, closing } = firstAndLastSourceLines(record.source)
  const trailingNewline = record.source.endsWith(newline) ? newline : ''
  const header = [opening, ...patchedMetadata(record, patch), '---'].join(newline)
  return `${header}${newline}${normalizeBody(patch.content, newline)}${closing}${trailingNewline}`
}

export function updateActivityRecord(
  markdown: string,
  id: string,
  patch: ActivityRecordPatch,
): string {
  assertValidInput({ ...patch, id })
  const record = editableRecord(markdown, id)
  const replacement = updatedRecordSource(record, patch)
  return markdown.slice(0, record.start) + replacement + markdown.slice(record.end)
}

function deletionEnd(markdown: string, record: ActivityRecord): number {
  const newline = newlineFor(markdown)
  return markdown.startsWith(newline, record.end) ? record.end + newline.length : record.end
}

export function deleteActivityRecord(markdown: string, id: string): string {
  const record = editableRecord(markdown, id)
  return markdown.slice(0, record.start) + markdown.slice(deletionEnd(markdown, record))
}

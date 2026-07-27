import { parseActivityDocument, type ActivityRecord } from './activityDocument'
import {
  preProcessDurableMarkdownBlocks,
  type BlockLike,
  type DurableBlockCodec,
  type DurableFencePayloadInput,
} from './durableMarkdownBlocks'

export const LINE_RECORD_BLOCK_TYPE = 'lineRecordBlock'

const TOKEN_PREFIX = '@@TOLARIA_LINE_RECORD:'
const TOKEN_SUFFIX = '@@'

type LineRecordPayload = {
  source: string
  id: string
  recordType: string
  occurredAt: string
  followUpAt: string
  body: string
  valid: string
  editable: string
  errors: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPayload(value: unknown): LineRecordPayload | null {
  if (!isRecord(value)) return null
  const { source, id, recordType, occurredAt, followUpAt, body, valid, editable, errors } = value
  if (
    typeof source !== 'string'
    || typeof id !== 'string'
    || typeof recordType !== 'string'
    || typeof occurredAt !== 'string'
    || typeof followUpAt !== 'string'
    || typeof body !== 'string'
    || typeof valid !== 'string'
    || typeof editable !== 'string'
    || typeof errors !== 'string'
  ) return null
  return { source, id, recordType, occurredAt, followUpAt, body, valid, editable, errors }
}

function payloadFromRecord(record: ActivityRecord): LineRecordPayload {
  return {
    source: record.source,
    id: record.id ?? '',
    recordType: record.type,
    occurredAt: record.occurredAt ?? '',
    followUpAt: record.followUpAt ?? '',
    body: record.content,
    valid: String(record.valid),
    editable: String(record.editable),
    errors: JSON.stringify(record.issues.map(issue => issue.code)),
  }
}

function buildPayload({ lines, start, end }: DurableFencePayloadInput): LineRecordPayload {
  const source = lines.slice(start, end + 1).join('')
  const parsed = parseActivityDocument(`## Activity\n\n${source}`).records.at(0)
  if (!parsed) throw new Error('Unable to parse closed line-record source')
  return payloadFromRecord(parsed)
}

function buildBlock(block: BlockLike, payload: LineRecordPayload): BlockLike {
  return {
    ...block,
    type: LINE_RECORD_BLOCK_TYPE,
    props: { ...(block.props ?? {}), ...payload },
    content: undefined,
    children: [],
  }
}

function isLineRecordBlock(block: BlockLike): boolean {
  return block.type === LINE_RECORD_BLOCK_TYPE && typeof block.props?.source === 'string'
}

export const lineRecordMarkdownCodec: DurableBlockCodec = {
  tokenPrefix: TOKEN_PREFIX,
  tokenSuffix: TOKEN_SUFFIX,
  readFenceMetadata: info => info.trim() === 'line-record' ? {} : null,
  buildPayload,
  decodePayload: readPayload,
  buildBlock: (block, payload) => buildBlock(block, payload as LineRecordPayload),
  isBlock: isLineRecordBlock,
  serializeBlock: block => block.props?.source ?? '',
}

export function preProcessActivityRecordMarkdown(markdown: string): string {
  const section = parseActivityDocument(markdown).section
  if (!section) return markdown
  const before = markdown.slice(0, section.bodyStart)
  const activity = markdown.slice(section.bodyStart, section.end)
  const after = markdown.slice(section.end)
  return before + preProcessDurableMarkdownBlocks({
    markdown: activity,
    codecs: [lineRecordMarkdownCodec],
  }) + after
}

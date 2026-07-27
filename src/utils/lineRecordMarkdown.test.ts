import { describe, expect, it, vi } from 'vitest'
import {
  injectDurableMarkdownBlocks,
  serializeDurableMarkdownBlocks,
} from './durableMarkdownBlocks'
import {
  LINE_RECORD_BLOCK_TYPE,
  lineRecordMarkdownCodec,
  preProcessActivityRecordMarkdown,
} from './lineRecordMarkdown'

function tokenParagraph(markdown: string) {
  const token = markdown.split(/\r?\n/u).find(line => line.includes('@@TOLARIA_LINE_RECORD:'))
  if (!token) throw new Error('Expected preprocessed line-record token')
  return { type: 'paragraph', content: [{ type: 'text', text: token }], children: [] }
}

describe('line record durable Markdown', () => {
  it('converts only line records inside Activity into durable blocks', () => {
    const outside = [
      '```line-record',
      'id: outside',
      '```',
    ].join('\n')
    const source = [
      '```line-record',
      'id: event-1',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Shipped the first slice.',
      '```',
    ].join('\n')
    const markdown = `${outside}\n\n## Activity\n\n${source}\n\n## Decisions\n\n${outside}`

    const preprocessed = preProcessActivityRecordMarkdown(markdown)
    const [block] = injectDurableMarkdownBlocks({
      blocks: [tokenParagraph(preprocessed)],
      codecs: [lineRecordMarkdownCodec],
    }) as Array<{ type: string; props: Record<string, string> }>

    expect(preprocessed.match(/@@TOLARIA_LINE_RECORD:/gu)).toHaveLength(1)
    expect(preprocessed.startsWith(outside)).toBe(true)
    expect(preprocessed.endsWith(outside)).toBe(true)
    expect(block).toMatchObject({
      type: LINE_RECORD_BLOCK_TYPE,
      props: {
        source: `${source}\n`,
        id: 'event-1',
        recordType: 'update',
        occurredAt: '2026-07-26T09:30:00-03:00',
        followUpAt: '',
        body: 'Shipped the first slice.\n',
        valid: 'true',
        editable: 'true',
        errors: '[]',
      },
    })
  })

  it('serializes an unmodified record from its exact source', () => {
    const source = [
      '~~~~line-record  ',
      'id: event-1  ',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Body with CRLF',
      '~~~~',
    ].join('\r\n')
    const preprocessed = preProcessActivityRecordMarkdown(`## Activity\r\n\r\n${source}`)
    const [block] = injectDurableMarkdownBlocks({
      blocks: [tokenParagraph(preprocessed)],
      codecs: [lineRecordMarkdownCodec],
    })
    const editor = { blocksToMarkdownLossy: vi.fn(() => '') }

    expect(serializeDurableMarkdownBlocks({
      blocks: [block],
      codecs: [lineRecordMarkdownCodec],
      serializeOrdinaryBlocks: editor.blocksToMarkdownLossy,
    })).toBe(source)
  })

  it('preserves malformed closed records as warning block payloads', () => {
    const source = '```line-record\ntype: update\nNo separator\n```'
    const preprocessed = preProcessActivityRecordMarkdown(`## Activity\n\n${source}`)
    const [block] = injectDurableMarkdownBlocks({
      blocks: [tokenParagraph(preprocessed)],
      codecs: [lineRecordMarkdownCodec],
    }) as Array<{ type: string; props: Record<string, string> }>

    expect(block.type).toBe(LINE_RECORD_BLOCK_TYPE)
    expect(block.props.source).toBe(source)
    expect(block.props.valid).toBe('false')
    expect(block.props.editable).toBe('false')
    expect(JSON.parse(block.props.errors)).toEqual([
      'missing-id',
      'missing-occurred-at',
      'missing-separator',
    ])
  })
})

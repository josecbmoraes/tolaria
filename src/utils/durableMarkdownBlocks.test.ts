import { describe, expect, it } from 'vitest'
import { preProcessDurableMarkdownBlocks, type DurableBlockCodec } from './durableMarkdownBlocks'

const nestedCodec: DurableBlockCodec = {
  tokenPrefix: '@@TEST:',
  tokenSuffix: '@@',
  readFenceMetadata: info => info.trim() === 'mermaid' ? {} : null,
  buildPayload: ({ lines, start, end }) => ({ source: lines.slice(start, end + 1).join('') }),
  decodePayload: payload => payload,
  buildBlock: block => block,
  isBlock: () => false,
  serializeBlock: () => '',
}

describe('preProcessDurableMarkdownBlocks', () => {
  it('keeps recognized-looking fences inside an unknown outer fence opaque', () => {
    const markdown = [
      '````line-record',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '````',
    ].join('\n')

    expect(preProcessDurableMarkdownBlocks({ markdown, codecs: [nestedCodec] })).toBe(markdown)
  })

  it('keeps the remainder of an unclosed unknown fence opaque', () => {
    const markdown = [
      '~~~line-record',
      '```mermaid',
      'flowchart LR',
      '```',
    ].join('\n')

    expect(preProcessDurableMarkdownBlocks({ markdown, codecs: [nestedCodec] })).toBe(markdown)
  })
})

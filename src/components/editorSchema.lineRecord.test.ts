import { describe, expect, it } from 'vitest'
import { LINE_RECORD_BLOCK_TYPE } from '../utils/lineRecordMarkdown'
import { schema } from './editorSchema'

describe('editor schema line records', () => {
  it('registers a contentless durable line record block', () => {
    const spec = Object.entries(schema.blockSchema)
      .find(([type]) => type === LINE_RECORD_BLOCK_TYPE)
      ?.at(1)

    expect(spec).toBeDefined()
    expect(spec?.content).toBe('none')
    expect(spec?.propSchema).toMatchObject({
      source: { default: '' },
      id: { default: '' },
      recordType: { default: 'update' },
      occurredAt: { default: '' },
      followUpAt: { default: '' },
      body: { default: '' },
      valid: { default: 'false' },
      editable: { default: 'false' },
      errors: { default: '[]' },
    })
  })
})

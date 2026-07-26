import { describe, expect, it } from 'vitest'
import { parseActivityDocument } from './activityDocument'

describe('parseActivityDocument', () => {
  it('parses line records only inside the first Activity section', () => {
    const markdown = [
      'Context stays in the note body.',
      '',
      '```line-record',
      'id: outside',
      '```',
      '',
      '## Activity',
      '',
      '```line-record',
      'id: event-1',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Shipped the first slice.',
      '```',
      '',
      '## Decisions',
      '',
      '```line-record',
      'id: after-section',
      '```',
    ].join('\n')

    const document = parseActivityDocument(markdown)

    expect(document.records.map(record => record.id)).toEqual(['event-1'])
    expect(document.section).toEqual({
      headingStart: markdown.indexOf('## Activity'),
      bodyStart: markdown.indexOf('## Activity') + '## Activity\n'.length,
      end: markdown.indexOf('## Decisions'),
    })
  })

  it('ignores Activity-looking headings inside backtick and tilde fences', () => {
    const markdown = [
      '````markdown',
      '## Activity',
      '```line-record',
      'id: fenced',
      '```',
      '````',
      '',
      '~~~~text',
      '## Activity',
      '~~~~',
      '',
      '## Activity',
      '',
      '```line-record',
      'id: real',
      'occurred_at: 2026-07-26T10:00:00-03:00',
      '---',
      'Visible update',
      '```',
    ].join('\n')

    expect(parseActivityDocument(markdown).records.map(record => record.id)).toEqual(['real'])
  })

  it('defaults a missing type to an editable update and preserves exact CRLF source', () => {
    const source = [
      '~~~line-record',
      'id: event-1',
      'occurred_at: 2026-07-26T10:00:00-03:00',
      'follow_up_at: 2026-07-27T08:15:00-03:00',
      'custom_field: keep me',
      '---',
      'First line',
      '',
      'Second line',
      '~~~',
    ].join('\r\n')
    const markdown = `## Activity\r\n\r\n${source}\r\n`

    const [record] = parseActivityDocument(markdown).records

    expect(record).toMatchObject({
      id: 'event-1',
      type: 'update',
      occurredAt: '2026-07-26T10:00:00-03:00',
      followUpAt: '2026-07-27T08:15:00-03:00',
      content: 'First line\r\n\r\nSecond line\r\n',
      source: `${source}\r\n`,
      valid: true,
      editable: true,
      metadataLines: [
        'id: event-1',
        'occurred_at: 2026-07-26T10:00:00-03:00',
        'follow_up_at: 2026-07-27T08:15:00-03:00',
        'custom_field: keep me',
      ],
    })
  })

  it('preserves a closed malformed record and reports its validation issues', () => {
    const source = [
      '```line-record',
      'type: update',
      'occurred_at: someday',
      'Body without a separator',
      '```',
    ].join('\n')

    const [record] = parseActivityDocument(`## Activity\n\n${source}`).records

    expect(record.source).toBe(source)
    expect(record.valid).toBe(false)
    expect(record.editable).toBe(false)
    expect(record.key).toMatch(/^offset:/)
    expect(record.issues.map(issue => issue.code)).toEqual([
      'missing-id',
      'invalid-occurred-at',
      'missing-separator',
    ])
  })

  it('preserves an unknown record type as valid but read-only', () => {
    const markdown = [
      '## Activity',
      '',
      '```line-record',
      'id: decision-1',
      'type: decision',
      'occurred_at: 2026-07-26T10:00:00-03:00',
      '---',
      'Chose the neutral format.',
      '```',
    ].join('\n')

    expect(parseActivityDocument(markdown).records[0]).toMatchObject({
      id: 'decision-1',
      type: 'decision',
      valid: true,
      editable: false,
    })
  })

  it('leaves an unclosed line record unextracted and reports a document issue', () => {
    const markdown = [
      '## Activity',
      '',
      '```line-record',
      'id: incomplete',
      'occurred_at: 2026-07-26T10:00:00-03:00',
      '---',
      'Never closed',
    ].join('\n')

    const document = parseActivityDocument(markdown)

    expect(document.records).toEqual([])
    expect(document.issues).toMatchObject([{ code: 'unclosed-fence' }])
    expect(markdown).toContain('Never closed')
  })
})

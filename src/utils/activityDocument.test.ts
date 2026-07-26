import { describe, expect, it } from 'vitest'
import { parseActivityDocument } from './activityDocument'
import {
  ActivityMutationError,
  appendActivityRecord,
  deleteActivityRecord,
  updateActivityRecord,
} from './activityDocumentMutations'

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

  it('marks duplicate record IDs invalid instead of targeting them ambiguously', () => {
    const record = (content: string) => [
      '```line-record',
      'id: repeated',
      'occurred_at: 2026-07-26T10:00:00-03:00',
      '---',
      content,
      '```',
    ].join('\n')
    const markdown = `## Activity\n\n${record('First')}\n\n${record('Second')}`

    const records = parseActivityDocument(markdown).records

    expect(records).toHaveLength(2)
    expect(records.every(item => item.valid === false && item.editable === false)).toBe(true)
    expect(records.map(item => item.issues.map(issue => issue.code))).toEqual([
      ['duplicate-id'],
      ['duplicate-id'],
    ])
  })
})

describe('Activity document mutations', () => {
  const input = {
    id: 'new-event',
    occurredAt: '2026-07-26T14:35:00-03:00',
    followUpAt: '2026-07-27T09:00:00-03:00',
    content: 'Published the **Timeline** MVP.',
  }

  it('creates the Activity section at the end of an older note', () => {
    expect(appendActivityRecord('# Project\n\nDurable context.', input)).toBe([
      '# Project',
      '',
      'Durable context.',
      '',
      '## Activity',
      '',
      '```line-record',
      'id: new-event',
      'type: update',
      'occurred_at: 2026-07-26T14:35:00-03:00',
      'follow_up_at: 2026-07-27T09:00:00-03:00',
      '---',
      'Published the **Timeline** MVP.',
      '```',
    ].join('\n'))
  })

  it('appends a new record at the physical end of Activity before the next H2', () => {
    const markdown = [
      '## Activity',
      '',
      'Ordinary Activity context remains.',
      '',
      '## Decisions',
      '',
      'Keep the body durable.',
    ].join('\n')

    const updated = appendActivityRecord(markdown, { ...input, followUpAt: null })

    expect(updated.indexOf('Ordinary Activity context remains.'))
      .toBeLessThan(updated.indexOf('id: new-event'))
    expect(updated.indexOf('id: new-event')).toBeLessThan(updated.indexOf('## Decisions'))
    expect(updated).not.toContain('follow_up_at:')
  })

  it('edits only the selected source while preserving its file order and unknown metadata', () => {
    const firstSource = [
      '```line-record',
      'id: first',
      'type: update',
      'occurred_at: 2026-07-25T09:00:00-03:00',
      '---',
      'First',
      '```',
    ].join('\r\n') + '\r\n'
    const secondSource = [
      '~~~~line-record',
      'id: second',
      'occurred_at: 2026-07-26T09:00:00-03:00',
      'custom_field: preserve this',
      '---',
      'Second',
      '~~~~',
    ].join('\r\n')
    const markdown = `## Activity\r\n\r\n${firstSource}\r\n${secondSource}`
    const secondStart = markdown.indexOf('~~~~line-record')

    const updated = updateActivityRecord(markdown, 'second', {
      type: 'update',
      occurredAt: '2026-07-28T11:45:00-03:00',
      followUpAt: null,
      content: 'Second, revised.',
    })

    expect(updated.slice(0, firstSource.length + '## Activity\r\n\r\n'.length))
      .toBe(`## Activity\r\n\r\n${firstSource}`)
    expect(updated.indexOf('~~~~line-record')).toBe(secondStart)
    expect(updated).toContain('type: update\r\n')
    expect(updated).toContain('custom_field: preserve this\r\n')
    expect(updated).toContain('Second, revised.\r\n~~~~')
  })

  it('deletes only the selected record and its separator whitespace', () => {
    const first = [
      '```line-record',
      'id: first',
      'occurred_at: 2026-07-25T09:00:00-03:00',
      '---',
      'First',
      '```',
    ].join('\n')
    const second = [
      '```line-record',
      'id: second',
      'occurred_at: 2026-07-26T09:00:00-03:00',
      '---',
      'Second',
      '```',
    ].join('\n')
    const markdown = `## Activity\n\n${first}\n\n${second}\n\n## Decisions\n\nKeep me.`

    expect(deleteActivityRecord(markdown, 'second')).toBe(
      `## Activity\n\n${first}\n\n## Decisions\n\nKeep me.`,
    )
  })

  it('refuses structured mutation of malformed and unsupported records', () => {
    const malformed = '## Activity\n\n```line-record\nid: broken\n---\nBody\n```'
    const unsupported = [
      '## Activity',
      '',
      '```line-record',
      'id: decision',
      'type: decision',
      'occurred_at: 2026-07-26T09:00:00-03:00',
      '---',
      'Decision',
      '```',
    ].join('\n')

    try {
      deleteActivityRecord(malformed, 'broken')
      throw new Error('Expected malformed mutation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ActivityMutationError)
      expect(error).toMatchObject({ code: 'not-editable' })
    }

    try {
      updateActivityRecord(unsupported, 'decision', {
        type: 'update',
        occurredAt: input.occurredAt,
        followUpAt: null,
        content: 'Do not coerce me.',
      })
      throw new Error('Expected unsupported mutation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ActivityMutationError)
      expect(error).toMatchObject({ code: 'not-editable' })
    }
  })
})

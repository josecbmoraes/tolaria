import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityTimelineView } from './ActivityTimelineView'

const SOURCE_ORDERED_ACTIVITY = [
  '# Project note',
  '',
  'Durable context remains here.',
  '',
  '## Activity',
  '',
  '```line-record',
  'id: older',
  'type: update',
  'occurred_at: 2026-07-25T09:30:00-03:00',
  '---',
  'Older update',
  '```',
  '',
  '```line-record',
  'id: latest',
  'type: update',
  'occurred_at: 2026-07-26T09:30:00-03:00',
  '---',
  'Latest update',
  '```',
].join('\n')

function renderTimeline(content = SOURCE_ORDERED_ACTIVITY) {
  const onContentChange = vi.fn()
  const onOpenRaw = vi.fn()
  render(
    <ActivityTimelineView
      content={content}
      locale="en"
      pendingEditId={null}
      onPendingEditHandled={vi.fn()}
      onContentChange={onContentChange}
      onOpenRaw={onOpenRaw}
    />,
  )
  return { onContentChange, onOpenRaw }
}

describe('ActivityTimelineView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows valid updates newest first without rewriting source Markdown', () => {
    const { onContentChange } = renderTimeline()

    expect(screen.getAllByTestId('activity-record-card').map(card => card.textContent)).toEqual([
      expect.stringContaining('Latest update'),
      expect.stringContaining('Older update'),
    ])
    expect(onContentChange).not.toHaveBeenCalled()
  })

  it('uses physical source order as the tie-breaker for equal timestamps', () => {
    const tied = SOURCE_ORDERED_ACTIVITY.replace(
      '2026-07-25T09:30:00-03:00',
      '2026-07-26T09:30:00-03:00',
    )

    renderTimeline(tied)

    expect(screen.getAllByTestId('activity-record-card').map(card => card.textContent)).toEqual([
      expect.stringContaining('Older update'),
      expect.stringContaining('Latest update'),
    ])
  })

  it('keeps malformed and unsupported records visible and RAW-only in source order', () => {
    const content = [
      '## Activity',
      '',
      '```line-record',
      'id: malformed',
      '---',
      'Malformed body',
      '```',
      '',
      '```line-record',
      'id: unsupported',
      'type: decision',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Unsupported body',
      '```',
    ].join('\n')
    const { onOpenRaw } = renderTimeline(content)

    expect(screen.getAllByTestId('activity-record-warning').map(card => card.textContent)).toEqual([
      expect.stringContaining('Malformed activity record'),
      expect.stringContaining('Unsupported activity type: decision'),
    ])
    expect(screen.queryByRole('button', { name: 'Edit in timeline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()

    screen.getAllByRole('button', { name: 'Edit in RAW' })[0].click()
    expect(onOpenRaw).toHaveBeenCalledOnce()
  })

  it('signals an unclosed line record without removing its source', () => {
    const content = [
      'Context',
      '',
      '## Activity',
      '',
      '```line-record',
      'id: open',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Still open',
    ].join('\n')
    const { onContentChange } = renderTimeline(content)

    expect(screen.getByTestId('activity-document-warning')).toHaveTextContent(
      'Malformed activity record',
    )
    expect(screen.getByRole('button', { name: 'Edit in RAW' })).toBeInTheDocument()
    expect(onContentChange).not.toHaveBeenCalled()
  })

  it('appends a new update, saves, resets the draft, and restores content focus', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T15:45:00-03:00'))
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(180)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    const onContentChange = vi.fn()
    const onSave = vi.fn()

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId={null}
        onPendingEditHandled={vi.fn()}
        onContentChange={onContentChange}
        onOpenRaw={vi.fn()}
        onSave={onSave}
      />,
    )

    const contentField = screen.getByRole('textbox', { name: 'Update' })
    fireEvent.change(contentField, { target: { value: 'Created update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add update' }))

    expect(onContentChange).toHaveBeenCalledOnce()
    expect(onContentChange.mock.calls[0][0]).toContain([
      '```line-record',
      'id: 00000000-0000-4000-8000-000000000001',
      'type: update',
      'occurred_at: 2026-07-27T15:45:00-03:00',
      '---',
      'Created update',
      '```',
    ].join('\n'))
    expect(onContentChange.mock.calls[0][0].indexOf('id: older')).toBeLessThan(
      onContentChange.mock.calls[0][0].indexOf('id: latest'),
    )
    expect(onSave).toHaveBeenCalledOnce()
    expect(contentField).toHaveValue('')
    expect(contentField).toHaveFocus()
  })

  it('adds an optional follow-up and supports keyboard submission', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T15:45:00-03:00'))
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(180)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002')
    const onContentChange = vi.fn()

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId={null}
        onPendingEditHandled={vi.fn()}
        onContentChange={onContentChange}
        onOpenRaw={vi.fn()}
      />,
    )

    const contentField = screen.getByRole('textbox', { name: 'Update' })
    fireEvent.change(contentField, { target: { value: 'Needs a check-in' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add follow-up' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Follow-up time' }), {
      target: { value: '18:00' },
    })
    fireEvent.keyDown(contentField, { key: 'Enter', metaKey: true })

    expect(onContentChange.mock.calls[0][0]).toContain(
      'follow_up_at: 2026-07-27T18:00:00-03:00',
    )
    expect(screen.getByRole('button', { name: 'Add follow-up' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Follow-up time' })).not.toBeInTheDocument()
  })

  it('edits a selected update without moving it or changing untouched record source', () => {
    const onContentChange = vi.fn()
    const onSave = vi.fn()
    const latestSource = [
      '```line-record',
      'id: latest',
      'type: update',
      'occurred_at: 2026-07-26T09:30:00-03:00',
      '---',
      'Latest update',
      '```',
    ].join('\n')

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId={null}
        onPendingEditHandled={vi.fn()}
        onContentChange={onContentChange}
        onOpenRaw={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit update' })[1])
    const editField = screen.getByRole('textbox', { name: 'Update' })
    expect(editField).toHaveValue('Older update')
    fireEvent.change(editField, { target: { value: 'Older update revised' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const nextContent = onContentChange.mock.calls[0][0] as string
    expect(nextContent).toContain(latestSource)
    expect(nextContent.indexOf('id: older')).toBeLessThan(nextContent.indexOf('id: latest'))
    expect(nextContent).toContain('Older update revised')
    expect(onSave).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a pending supported record once and acknowledges the request', () => {
    const onPendingEditHandled = vi.fn()

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId="latest"
        onPendingEditHandled={onPendingEditHandled}
        onContentChange={vi.fn()}
        onOpenRaw={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('Edit update')
    expect(screen.getByRole('textbox', { name: 'Update' })).toHaveValue('Latest update')
    expect(onPendingEditHandled).toHaveBeenCalledOnce()
  })

  it('deletes only the selected update after confirmation', () => {
    const onContentChange = vi.fn()

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId="older"
        onPendingEditHandled={vi.fn()}
        onContentChange={onContentChange}
        onOpenRaw={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete update' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete this update?')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    const nextContent = onContentChange.mock.calls[0][0] as string
    expect(nextContent).not.toContain('id: older')
    expect(nextContent).toContain('id: latest')
    expect(nextContent).toContain('Latest update')
  })

  it('adds an optional follow-up while editing a supported update', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(180)
    const onContentChange = vi.fn()

    render(
      <ActivityTimelineView
        content={SOURCE_ORDERED_ACTIVITY}
        locale="en"
        pendingEditId="older"
        onPendingEditHandled={vi.fn()}
        onContentChange={onContentChange}
        onOpenRaw={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add follow-up' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Follow-up time' }), {
      target: { value: '18:15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onContentChange.mock.calls[0][0]).toContain(
      'follow_up_at: 2026-07-25T18:15:00-03:00',
    )
  })

  it('shows an intentional empty state while keeping creation available', () => {
    renderTimeline('# Project note\n\nDurable context.')

    expect(screen.getByText('No activity yet')).toBeInTheDocument()
    expect(screen.getByText('Add the first update to start the timeline.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add update' })).toBeDisabled()
  })
})

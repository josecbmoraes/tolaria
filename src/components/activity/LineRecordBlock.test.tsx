import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActivityRecordNavigationProvider } from './ActivityRecordNavigationProvider'
import { LineRecordBlock, type LineRecordBlockProps } from './LineRecordBlock'

const validProps: LineRecordBlockProps['block']['props'] = {
  source: '```line-record\n...\n```',
  id: 'event-1',
  recordType: 'update',
  occurredAt: '2026-07-26T09:30:00-03:00',
  followUpAt: '2026-07-27T10:00:00-03:00',
  body: 'Published the **Timeline** slice.',
  valid: 'true',
  editable: 'true',
  errors: '[]',
}

function renderBlock(
  props: LineRecordBlockProps['block']['props'],
  editInTimeline = vi.fn(),
  openRaw = vi.fn(),
) {
  render(
    <ActivityRecordNavigationProvider value={{ editInTimeline, openRaw, locale: 'en' }}>
      <LineRecordBlock block={{ props }} />
    </ActivityRecordNavigationProvider>,
  )
  return { editInTimeline, openRaw }
}

describe('LineRecordBlock', () => {
  it('renders a compact update with occurrence, Markdown body, follow-up, and Timeline action', () => {
    const { editInTimeline } = renderBlock(validProps)

    expect(screen.getByText((_, element) => (
      element?.tagName === 'P' && element.textContent === 'Published the Timeline slice.'
    ))).toBeInTheDocument()
    expect(screen.getByText('Timeline').tagName).toBe('STRONG')
    expect(screen.getByText('Follow-up')).toBeInTheDocument()
    expect(screen.getByTestId('line-record-occurred-at')).toHaveAttribute(
      'datetime',
      validProps.occurredAt,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit in timeline' }))
    expect(editInTimeline).toHaveBeenCalledWith('event-1')
  })

  it('omits the follow-up row when no follow-up exists', () => {
    renderBlock({ ...validProps, followUpAt: '' })

    expect(screen.queryByText('Follow-up')).not.toBeInTheDocument()
  })

  it('signals malformed metadata and offers repair only in RAW', () => {
    const { editInTimeline, openRaw } = renderBlock({
      ...validProps,
      id: '',
      valid: 'false',
      editable: 'false',
      errors: JSON.stringify(['missing-id', 'missing-separator']),
    })

    expect(screen.getByText('Malformed activity record')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit in timeline' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit in RAW' }))
    expect(openRaw).toHaveBeenCalledOnce()
    expect(editInTimeline).not.toHaveBeenCalled()
  })

  it('keeps unknown types read-only and RAW-only', () => {
    const { openRaw } = renderBlock({
      ...validProps,
      recordType: 'decision',
      editable: 'false',
    })

    expect(screen.getByText('Unsupported activity type: decision')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit in timeline' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit in RAW' }))
    expect(openRaw).toHaveBeenCalledOnce()
  })

  it('treats invalid serialized errors as malformed instead of throwing', () => {
    renderBlock({ ...validProps, errors: '{invalid json' })

    expect(screen.getByText('Malformed activity record')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit in RAW' })).toBeInTheDocument()
  })
})

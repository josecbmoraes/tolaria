import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityTimelineErrorBoundary } from './ActivityTimelineErrorBoundary'

function BrokenTimeline(): never {
  throw new Error('timeline render failed')
}

describe('ActivityTimelineErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps Note and RAW recovery actions available after a render failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReturnToNote = vi.fn()
    const onOpenRaw = vi.fn()

    render(
      <ActivityTimelineErrorBoundary
        locale="en"
        onReturnToNote={onReturnToNote}
        onOpenRaw={onOpenRaw}
      >
        <BrokenTimeline />
      </ActivityTimelineErrorBoundary>,
    )

    expect(screen.getByText('Timeline could not be displayed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to Note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit in RAW' }))
    expect(onReturnToNote).toHaveBeenCalledOnce()
    expect(onOpenRaw).toHaveBeenCalledOnce()
  })
})

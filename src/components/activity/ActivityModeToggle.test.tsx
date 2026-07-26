import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActivityModeToggle } from './ActivityModeToggle'

describe('ActivityModeToggle', () => {
  it('selects Timeline while exposing the current Note mode', () => {
    const onSelect = vi.fn()
    render(<ActivityModeToggle locale="en" mode="note" onSelect={onSelect} />)

    expect(screen.getByRole('radio', { name: 'Note' })).toHaveAttribute('data-state', 'on')
    fireEvent.click(screen.getByRole('radio', { name: 'Timeline' }))
    expect(onSelect).toHaveBeenCalledWith('timeline')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortDropdown } from './SortDropdown'

describe('SortDropdown', () => {
  it('localizes next follow-up and selects it ascending by default', () => {
    const onChange = vi.fn()

    render(
      <SortDropdown
        groupLabel="__list__"
        current="modified"
        direction="desc"
        locale="en"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByTestId('sort-button-__list__'))

    expect(screen.getByTestId('sort-option-next_follow_up')).toHaveTextContent('Next follow-up')

    fireEvent.click(screen.getByTestId('sort-option-next_follow_up'))

    expect(onChange).toHaveBeenCalledWith('__list__', 'next_follow_up', 'asc')
  })
})

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useActivityMode } from './useActivityMode'

function setup(overrides: Partial<Parameters<typeof useActivityMode>[0]> = {}) {
  const args = {
    activePath: 'notes/one.md',
    rawMode: false,
    diffMode: false,
    flushRichContent: vi.fn(() => true),
    exitRawMode: vi.fn(),
    exitDiffMode: vi.fn(),
    ...overrides,
  }
  const hook = renderHook(
    ({ activePath, rawMode, diffMode }) => useActivityMode({
      ...args,
      activePath,
      rawMode,
      diffMode,
    }),
    { initialProps: {
      activePath: args.activePath,
      rawMode: args.rawMode,
      diffMode: args.diffMode,
    } },
  )
  return { ...hook, args }
}

describe('useActivityMode', () => {
  it('flushes rich content before switching from Note to Timeline', () => {
    const { result, args } = setup()

    act(() => result.current.selectMode('timeline'))

    expect(args.flushRichContent).toHaveBeenCalledOnce()
    expect(result.current.mode).toBe('timeline')
    expect(result.current.showTimeline).toBe(true)
    expect(result.current.showNote).toBe(false)
  })

  it('exits RAW before switching to Timeline', () => {
    const { result, args } = setup({ rawMode: true })

    act(() => result.current.selectMode('timeline'))

    expect(args.exitRawMode).toHaveBeenCalledOnce()
    expect(args.flushRichContent).not.toHaveBeenCalled()
  })

  it('exits diff before switching to Timeline', () => {
    const { result, args } = setup({ diffMode: true })

    act(() => result.current.selectMode('timeline'))

    expect(args.exitDiffMode).toHaveBeenCalledOnce()
  })

  it('carries one pending record into Timeline and acknowledges it', () => {
    const { result } = setup()

    act(() => result.current.editInTimeline('record-1'))
    expect(result.current.mode).toBe('timeline')
    expect(result.current.pendingEditId).toBe('record-1')

    act(() => result.current.acknowledgePendingEdit())
    expect(result.current.pendingEditId).toBeNull()
  })

  it('returns to Note before entering RAW', () => {
    const { result } = setup()
    act(() => result.current.selectMode('timeline'))

    act(() => result.current.beforeEnterRaw())

    expect(result.current.mode).toBe('note')
    expect(result.current.pendingEditId).toBeNull()
  })

  it('defaults to Note and clears pending edit when the active path changes', () => {
    const { result, rerender } = setup()
    act(() => result.current.editInTimeline('record-1'))

    rerender({ activePath: 'notes/two.md', rawMode: false, diffMode: false })

    expect(result.current.mode).toBe('note')
    expect(result.current.pendingEditId).toBeNull()
    expect(result.current.showNote).toBe(true)
  })
})

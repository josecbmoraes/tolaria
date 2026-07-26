import { useCallback, useState } from 'react'

export type ActivitySurfaceMode = 'note' | 'timeline'

type ActivityModeState = {
  path: string | null
  mode: ActivitySurfaceMode
  pendingEditId: string | null
}

export function useActivityMode({
  activePath,
  diffMode,
  exitDiffMode,
  exitRawMode,
  flushRichContent,
  rawMode,
}: {
  activePath: string | null
  rawMode: boolean
  diffMode: boolean
  flushRichContent: () => boolean
  exitRawMode: () => void
  exitDiffMode: () => void | Promise<void>
}) {
  const [storedState, setStoredState] = useState<ActivityModeState>({
    path: activePath,
    mode: 'note',
    pendingEditId: null,
  })
  const state = storedState.path === activePath
    ? storedState
    : { path: activePath, mode: 'note' as const, pendingEditId: null }

  const prepareTimeline = useCallback(() => {
    if (rawMode) {
      exitRawMode()
    } else {
      flushRichContent()
    }
    if (diffMode) void exitDiffMode()
  }, [diffMode, exitDiffMode, exitRawMode, flushRichContent, rawMode])

  const selectMode = useCallback((mode: ActivitySurfaceMode) => {
    if (mode === 'timeline') prepareTimeline()
    setStoredState({ path: activePath, mode, pendingEditId: null })
  }, [activePath, prepareTimeline])

  const editInTimeline = useCallback((recordId: string) => {
    prepareTimeline()
    setStoredState({ path: activePath, mode: 'timeline', pendingEditId: recordId })
  }, [activePath, prepareTimeline])

  const beforeEnterRaw = useCallback(() => {
    setStoredState({ path: activePath, mode: 'note', pendingEditId: null })
  }, [activePath])

  const acknowledgePendingEdit = useCallback(() => {
    setStoredState(current => current.path === activePath
      ? { ...current, pendingEditId: null }
      : { path: activePath, mode: 'note', pendingEditId: null })
  }, [activePath])

  const mode: ActivitySurfaceMode = rawMode || diffMode ? 'note' : state.mode
  const showTimeline = mode === 'timeline'

  return {
    mode,
    pendingEditId: state.pendingEditId,
    showTimeline,
    showNote: !showTimeline,
    selectMode,
    editInTimeline,
    openRaw: beforeEnterRaw,
    acknowledgePendingEdit,
    beforeEnterRaw,
  }
}

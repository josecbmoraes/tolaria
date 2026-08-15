import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { useAppViewActions } from './useAppViewActions'

function makeEntry(): VaultEntry {
  return {
    aliases: [],
    archived: false,
    belongsTo: [],
    color: null,
    createdAt: null,
    favorite: false,
    favoriteIndex: null,
    fileSize: 0,
    filename: 'project.md',
    hasH1: true,
    icon: null,
    isA: 'Note',
    listPropertiesDisplay: [],
    modifiedAt: null,
    order: null,
    organized: false,
    outgoingLinks: [],
    path: '/vault/project.md',
    properties: {},
    relatedTo: [],
    relationships: {},
    sidebarLabel: null,
    snippet: '',
    sort: null,
    status: null,
    template: null,
    title: 'Project',
    view: null,
    visible: null,
    wordCount: 0,
  }
}

describe('useAppViewActions', () => {
  it('offers next follow-up among view fields when entries have no custom properties', () => {
    const { result } = renderHook(() => useAppViewActions({
      editingView: null,
      graphDefaultWorkspacePath: '/vault',
      handleSetSelection: vi.fn(),
      multiWorkspaceEnabled: false,
      notes: {
        createTypeEntrySilent: vi.fn(),
        handleCreateType: vi.fn(),
        handleUpdateFrontmatter: vi.fn(),
      },
      onOpenEditView: vi.fn(),
      resolvedPath: '/vault',
      selection: { kind: 'filter', filter: 'all' },
      setToastMessage: vi.fn(),
      vault: {
        markVaultUnavailable: vi.fn(),
        reloadFolders: vi.fn(),
        reloadVault: vi.fn(),
        reloadViews: vi.fn(),
        views: [],
      },
      visibleEntries: [makeEntry()],
    }))

    expect(result.current.availableFields).toContain('next follow-up')
  })
})

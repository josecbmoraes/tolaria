import { expect, test, type Page } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerShortcutCommand } from './testBridge'

const NOTE_TITLE = 'Note B'
const UNTOUCHED_RECORD = [
  '```line-record',
  'id: newer',
  'type: update',
  'occurred_at: 2026-07-26T15:30:00-03:00',
  'custom_meta: keep exactly',
  '---',
  'Newer untouched update.',
  '```',
].join('\n')
const MALFORMED_RECORD = [
  '```line-record',
  'id: malformed',
  '---',
  'Malformed source must survive.',
  '```',
].join('\n')
const INITIAL_MARKDOWN = [
  '---',
  'type: Note',
  '---',
  '',
  '# Note B',
  '',
  'Durable note context remains visible.',
  '',
  '## Activity',
  '',
  '```line-record',
  'id: older',
  'type: update',
  'occurred_at: 2026-07-25T09:15:00-03:00',
  '---',
  'Older update.',
  '```',
  '',
  UNTOUCHED_RECORD,
  '',
  MALFORMED_RECORD,
  '',
].join('\n')

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openFixtureNote(page: Page): Promise<void> {
  await page.locator('[data-testid="note-list-container"]').getByText(NOTE_TITLE, { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function readRawEditor(page: Page): Promise<string> {
  await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
  return page.evaluate(() => {
    type CodeMirrorHost = Element & {
      cmTile?: { view?: { state: { doc: { toString(): string } } } }
    }
    const host = document.querySelector('[data-testid="raw-editor-codemirror"] .cm-content') as CodeMirrorHost | null
    return host?.cmTile?.view?.state.doc.toString() ?? host?.textContent ?? ''
  })
}

async function replaceRawEditor(page: Page, content: string): Promise<void> {
  await page.evaluate((nextContent) => {
    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: { doc: { length: number } }
          dispatch(update: { changes: { from: number; to: number; insert: string } }): void
        }
      }
    }
    const host = document.querySelector('[data-testid="raw-editor-codemirror"] .cm-content') as CodeMirrorHost | null
    const view = host?.cmTile?.view
    if (!view) throw new Error('CodeMirror view is missing')
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: nextContent } })
  }, content)
}

test('Activity records round-trip through Note, Timeline, RAW, and save @smoke', async ({ page }) => {
  await openFixtureNote(page)
  await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
  await replaceRawEditor(page, INITIAL_MARKDOWN)
  await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })

  await expect(page.locator('.bn-editor').getByText('Durable note context remains visible.', { exact: true })).toBeVisible()
  await expect(page.locator('[data-line-record-id="older"]')).toHaveAttribute('contenteditable', 'false')
  await expect(page.locator('[data-line-record-id="newer"]')).toContainText('Newer untouched update.')
  await expect(page.locator('[data-line-record-id="malformed"]')).toContainText('Malformed activity record')
  await expect(page.getByRole('button', { name: 'Delete update' })).toHaveCount(0)

  await page.locator('[data-line-record-id="older"]').getByRole('button', { name: 'Edit in timeline' }).click()
  const editDialog = page.getByRole('dialog')
  await expect(editDialog.getByRole('textbox', { name: 'Update' })).toHaveValue('Older update.')
  await editDialog.getByRole('textbox', { name: 'Update' }).fill('Older update revised.')
  await editDialog.getByRole('button', { name: 'Save' }).click()

  const cards = page.getByTestId('activity-record-card')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Newer untouched update.')
  await expect(cards.nth(1)).toContainText('Older update revised.')
  await expect(page.getByTestId('activity-record-warning')).toContainText('Malformed activity record')

  const composer = page.getByRole('heading', { name: 'New update' }).locator('..')
  await composer.getByRole('textbox', { name: 'Update' }).fill('Appended update.')
  await composer.getByRole('button', { name: 'Add follow-up' }).click()
  await composer.getByRole('button', { name: 'Add update' }).click()
  await expect(cards).toHaveCount(3)

  await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
  const raw = await readRawEditor(page)
  expect(raw).toContain('Durable note context remains visible.')
  expect(raw).toContain('Older update revised.')
  expect(raw).toContain(UNTOUCHED_RECORD)
  expect(raw).toContain(MALFORMED_RECORD)
  expect(raw.indexOf('id: older')).toBeLessThan(raw.indexOf('id: newer'))
  expect(raw.indexOf('id: newer')).toBeLessThan(raw.indexOf('Appended update.'))
  expect(raw).toContain('follow_up_at:')

  await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
  await expect(page.locator('[data-line-record-id="malformed"]')).toContainText('Malformed activity record')
  await expect(page.locator('[data-line-record-id="newer"]')).toContainText('Newer untouched update.')
})

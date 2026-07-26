# Activity Timeline Note Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Note | Timeline` surface for Markdown notes where Activity updates are durable, read-only BlockNote blocks in Note mode and are created, edited, deleted, and visually sorted only in Timeline mode without changing unrelated Markdown.

**Architecture:** Treat `## Activity` as a bounded document region parsed by a pure TypeScript domain module. Inside that region, closed `line-record` fences enter the existing durable Markdown codec pipeline and become a non-editable `lineRecordBlock`; outside it they remain ordinary code fences. Timeline mutations patch the original Markdown by source offsets and feed the result through the editor's existing `onContentChange`/save coordinator, while untouched record sources remain byte-for-byte identical.

**Tech Stack:** React 19, TypeScript, BlockNote 0.46, shadcn/ui, Tailwind CSS, Vitest/Testing Library, Playwright, Lara localization, existing Tolaria save coordinator.

## Global Constraints

- The note body remains the home for context, documentation, and durable knowledge; Activity records occurrences and never replaces or hides the body in Note or RAW mode.
- Persist records only under the first fence-aware `## Activity` section. A matching H1/H2 heading outside a fence ends the section; EOF also ends it.
- Use fenced `line-record` Markdown. Read missing `type` as `update`; write `type: update` for new records. Preserve unknown metadata lines when editing supported records.
- New records append to the physical end of the Activity section. Visual sorting must never rewrite Markdown order. Editing must replace only the selected record span; deleting must remove only that span and its directly associated separator whitespace.
- Store the exact closed fence in `lineRecordBlock.props.source`. If the block is not changed in Timeline mode, serialization must emit this value verbatim, including fence character/length, indentation, whitespace, and line endings.
- A malformed closed `line-record` remains a durable visible warning block and can only be repaired in RAW. An unclosed fence remains ordinary Markdown/source and produces a Timeline warning; it must never be discarded.
- Unknown `type` values remain visible and preserved but read-only in Timeline and Note modes.
- `lineRecordBlock` is not available from slash commands or block-type conversion. It has no rich-editor drag handle, delete menu, direct editing, or selection affordance where BlockNote supports that safely.
- Reuse `MarkdownContent` for record bodies and shadcn components for every interactive control. Use `Calendar + Popover` for dates and shadcn `Input` for time; never add native form elements.
- All user-facing copy originates in `src/lib/locales/en.json`, then is translated to every `lara.yaml` target with `pnpm l10n:translate` and validated with `pnpm l10n:validate`.
- Do not implement Rust scanner extraction, `VaultEntry` changes, global follow-up filters/sorting/classification, or PostHog events in this increment.
- Follow Red → Green → Refactor. Do not weaken existing tests, add suppressions, use `as any`, or lower `.codescene-thresholds`.
- Before editing any code, complete Task 1's CodeScene and Codacy baselines. Before every commit, repeat touched-file checks and the repository safeguard described in Task 1.

### Authorized CodeScene Exception (2026-07-26)

The repository owner explicitly authorized a CodeScene-only exception for this implementation because CodeScene is unavailable: there is no CodeScene MCP tool, installed `cs` CLI, API credential/project ID, or local token. Consequently, no CodeScene check may be described as executed, passed, or approved. This exception applies only to the Activity Timeline implementation covered by this plan. Codacy, TDD, lint, typecheck, tests, coverage, localization, hooks, and every other gate remain mandatory and fail-closed; any failure blocks commit and push. Never use `--no-verify` or another hook bypass. Recheck CodeScene availability before final delivery and, if it becomes available, run the required file, safeguard, change-set, Hotspot, and Average checks before the final push. Record these exact facts in the final release-readiness report.

---

### Task 1: Establish repository quality baselines and freeze the change set

**Files:**

- Read: `.codescene-thresholds`
- Read: `docs/ARCHITECTURE.md`
- Read: `docs/ABSTRACTIONS.md`
- Read: `docs/adr/README.md`
- Read: `docs/adr/0160-editable-markdown-durable-callout-blocks.md`
- Read: `docs/adr/0172-local-codescene-change-safeguards.md`
- Baseline code files: all existing files named in Tasks 3–7 before their first edit
- Baseline new code files: scan after creation and require CodeScene `10.0` or no scorable findings, plus zero Codacy findings

**Interfaces:** None. This is a fail-closed preflight.

- [ ] **Step 1: Confirm the workspace and thresholds**

Run:

```bash
git status --short
git branch --show-current
git log -5 --oneline
cat .codescene-thresholds
```

Expected: only intentional documentation commits/changes are present; `HOTSPOT_THRESHOLD=10.0` and `AVERAGE_THRESHOLD=9.99` or higher. Never lower either value.

- [ ] **Step 2: Record project-wide CodeScene health before feature work**

Use CodeScene MCP first. If it is unavailable, use the repository-approved `cs` CLI or the CodeScene API with `CODESCENE_PAT` and `CODESCENE_PROJECT_ID` to capture current Hotspot and Average Code Health.

Expected: Hotspot and Average meet `.codescene-thresholds`. If either is below the gate, stop feature work, refactor the worst file, verify, and commit that refactor before returning to this plan. For this implementation, every approved access path was confirmed unavailable and the repository owner authorized the exception recorded above. Record CodeScene as unavailable—not passed—and continue enforcing every other gate.

- [ ] **Step 3: Record per-file CodeScene baselines**

Capture scores for these existing files before editing them when CodeScene becomes available:

```text
src/components/Editor.tsx
src/components/SingleEditorView.tsx
src/components/editor-content/EditorContentLayout.tsx
src/components/editor-content/useEditorContentModel.ts
src/components/editorSchema.tsx
src/components/tolariaBlockNoteSideMenu.tsx
src/utils/durableMarkdownBlocks.ts
src/utils/durableMarkdownBlocks.test.ts
src/utils/editorDurableMarkdown.ts
src/utils/editorDurableMarkdown.test.ts
src/lib/locales/en.json
```

If CodeScene becomes available and implementation discovery adds another existing code file, baseline it before the first edit. Record the values in the task work log. Every touched file must improve; a `10.0` file must stay `10.0`. While unavailable, record that no file score was executed or approved.

- [ ] **Step 4: Record per-file Codacy baselines**

For each existing code file above, use Codacy MCP or:

```bash
.codacy/cli.sh analyze <path> --format sarif
```

Expected: a saved count by severity for every file. After edits, findings must decrease, or zero must remain zero; all existing Critical/High findings in a touched file must be fixed. If Codacy cannot run, stop for explicit owner approval.

- [ ] **Step 5: Confirm architectural boundaries**

Verify from the referenced docs and source that:

```text
Timeline Markdown mutations -> EditorProps.onContentChange(path, markdown)
Explicit save / existing debounce -> current app save coordinator
Rich rendering -> editorDurableMarkdown -> BlockNote schema
No Tauri command, VaultEntry field, Rust scanner, or independent filesystem write
```

Expected: no additional architecture decision remains unresolved.

### Task 2: Build the fence-aware Activity document model

**Files:**

- Create: `src/utils/activityDocument.ts`
- Create: `src/utils/activityDocument.test.ts`

**Interfaces:**

```ts
export type ActivityRecordIssue = {
  code: 'missing-id' | 'duplicate-field' | 'missing-occurred-at' | 'invalid-occurred-at' |
    'invalid-follow-up-at' | 'missing-separator' | 'unclosed-fence'
  messageKey: string
  line: number
}

export type ActivityRecord = {
  key: string
  id: string | null
  type: string
  occurredAt: string | null
  followUpAt: string | null
  content: string
  source: string
  start: number
  end: number
  valid: boolean
  editable: boolean
  issues: ActivityRecordIssue[]
  metadataLines: string[]
}

export type ActivityDocument = {
  section: { headingStart: number; bodyStart: number; end: number } | null
  records: ActivityRecord[]
  issues: ActivityRecordIssue[]
}

export type ActivityRecordInput = {
  id: string
  type?: 'update'
  occurredAt: string
  followUpAt?: string | null
  content: string
}

export function parseActivityDocument(markdown: string): ActivityDocument
export function appendActivityRecord(markdown: string, input: ActivityRecordInput): string
export function updateActivityRecord(markdown: string, id: string, patch: Omit<ActivityRecordInput, 'id'>): string
export function deleteActivityRecord(markdown: string, id: string): string
```

- [ ] **Step 1: Write failing section-boundary and parsing tests**

Add focused tests that prove:

```ts
it('parses line-record only inside the first fence-aware Activity section', () => {
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

  expect(parseActivityDocument(markdown).records.map(record => record.id)).toEqual(['event-1'])
})

it('ignores Activity-looking headings inside longer and tilde fences', () => {
  // Include ````, ~~~~, and headings inside their bodies; assert the real H2 wins.
})
```

Run:

```bash
pnpm vitest run src/utils/activityDocument.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the scanner as one deterministic pass**

Implement line splitting that retains line endings and absolute UTF-16 offsets. Track current fence character and opening length so headings inside any Markdown fence are ignored. Match the first outside-fence heading whose trimmed text is exactly `## Activity`, then stop its body at the next outside-fence H1/H2 or EOF.

Within that slice, recognize only closed fences whose info string is exactly `line-record` after whitespace normalization. Retain the complete source from opening through closing fence. For an unclosed matching fence, add `unclosed-fence` to document issues and leave it out of `records`.

- [ ] **Step 3: Write failing tolerant-header tests**

Cover all of these cases:

```text
missing type -> type === "update", valid, editable
unknown type -> valid, preserved, editable === false
missing/duplicate id -> invalid
missing/invalid occurred_at -> invalid
invalid follow_up_at -> invalid
missing --- separator -> invalid
unknown metadata -> preserved in metadataLines
CRLF, tilde fence, four-backtick fence, indentation -> exact source retained
malformed closed record -> returned with valid === false and exact source
unclosed record -> source untouched and document-level warning
```

Run the targeted test and confirm it fails on the first missing behavior.

- [ ] **Step 4: Implement tolerant record parsing**

Parse the metadata header line-by-line up to the first exact `---`. Split only on the first colon. Validate timestamps by requiring a local ISO date-time with an explicit numeric offset, then verify `Date.parse(value)` is finite. Do not parse the body as YAML; everything after `---` and before the closing fence is record Markdown.

Derive identity as `id` for valid unique IDs and `offset:<start>` for malformed records. Mark only `type === 'update' && valid` as editable.

- [ ] **Step 5: Write failing mutation and byte-preservation tests**

Add assertions with a multi-record document:

```ts
expect(appendActivityRecord(withSection, input)).toBe(
  withSectionWithCanonicalFenceAppendedBeforeNextH2,
)
expect(appendActivityRecord(withoutSection, input)).toBe(
  `${withoutSection}\n\n## Activity\n\n${canonicalFence}`,
)
expect(updateActivityRecord(markdown, 'second', patch)).toContain(firstOriginalSource)
expect(updateActivityRecord(markdown, 'second', patch).indexOf(firstOriginalSource))
  .toBe(markdown.indexOf(firstOriginalSource))
expect(deleteActivityRecord(markdown, 'second')).toContain(firstOriginalSource)
```

Also assert visual ordering is not part of any mutation and unknown/malformed records throw a typed non-editable error rather than being changed.

- [ ] **Step 6: Implement span-based mutations**

Use `markdown.slice(0, start) + replacement + markdown.slice(end)`; never reserialize the whole document. New canonical records use:

```ts
function serializeNewActivityRecord(input: ActivityRecordInput, newline: '\n' | '\r\n'): string {
  const followUp = input.followUpAt ? [`follow_up_at: ${input.followUpAt}`] : []
  return [
    '```line-record',
    `id: ${input.id}`,
    `type: ${input.type ?? 'update'}`,
    `occurred_at: ${input.occurredAt}`,
    ...followUp,
    '---',
    input.content,
    '```',
  ].join(newline)
}
```

For edits, retain unknown metadata lines and their order, replace only supported known fields, retain the original fence style and line ending, and keep the record at the same `start`. For append, insert before the next H1/H2 and normalize only the separator newly introduced by the operation. For delete, remove only the target source plus at most its immediately adjacent blank separator.

- [ ] **Step 7: Run focused tests and quality checks**

Run:

```bash
pnpm vitest run src/utils/activityDocument.test.ts
pnpm eslint src/utils/activityDocument.ts src/utils/activityDocument.test.ts
npx tsc --noEmit
```

Expected: PASS. Scan both new files with CodeScene (score `10.0` or no scorable warnings) and Codacy (zero findings).

- [ ] **Step 8: Commit the domain model**

Before committing, run CodeScene touched-file reviews plus the repository pre-commit safeguard and repeat Codacy scans.

```bash
git add src/utils/activityDocument.ts src/utils/activityDocument.test.ts
git commit -m "feat: add durable activity document model"
```

### Task 3: Add the scoped durable `lineRecordBlock` round-trip

**Files:**

- Create: `src/utils/lineRecordMarkdown.ts`
- Create: `src/utils/lineRecordMarkdown.test.ts`
- Modify: `src/utils/durableMarkdownBlocks.ts`
- Modify: `src/utils/durableMarkdownBlocks.test.ts`
- Modify: `src/utils/editorDurableMarkdown.ts`
- Modify: `src/utils/editorDurableMarkdown.test.ts`
- Create: `docs/adr/0173-scoped-durable-activity-records.md`

**Interfaces:**

```ts
export const LINE_RECORD_BLOCK_TYPE = 'lineRecordBlock'
export const lineRecordMarkdownCodec: DurableBlockCodec
export function preProcessActivityRecordMarkdown(markdown: string): string
```

- [ ] **Step 1: Write failing scoped-codec tests**

Prove that preprocessing transforms a closed `line-record` only in the parsed Activity slice, while identical fences before/after the section stay ordinary Markdown. Add a regression case where a four-backtick `line-record` outside Activity contains a three-backtick Mermaid/HTML fence and assert the whole outer code fence stays ordinary and exact. Assert the decoded block props contain:

```ts
{
  source: originalFence,
  id: 'event-1',
  recordType: 'update',
  occurredAt: '2026-07-26T09:30:00-03:00',
  followUpAt: '',
  body: 'Shipped the first slice.\n',
  valid: 'true',
  editable: 'true',
  errors: '[]',
}
```

Use string props because BlockNote prop schemas serialize primitive values predictably.

Run:

```bash
pnpm vitest run src/utils/lineRecordMarkdown.test.ts src/utils/durableMarkdownBlocks.test.ts src/utils/editorDurableMarkdown.test.ts
```

Expected: FAIL because the codec is absent.

- [ ] **Step 2: Implement the scoped wrapper around the generic codec**

Use `parseActivityDocument(markdown).section` to split the document into prefix, Activity slice, and suffix. Call `preProcessDurableMarkdownBlocks` with only `lineRecordMarkdownCodec` on the Activity slice, then concatenate all three exact substrings. The codec payload must carry exact `source` plus parsed display props. `serializeBlock` must return `props.source` without normalization.

Do not add `lineRecordMarkdownCodec` to the globally applied codec list. Instead:

```ts
export function preProcessDurableEditorMarkdown({ markdown }: { markdown: string }): string {
  const withActivityRecords = preProcessActivityRecordMarkdown(markdown)
  const withGlobalDurableBlocks = preProcessDurableMarkdownBlocks({
    markdown: withActivityRecords,
    codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
  })
  return preProcessFileAttachmentMarkdown({ markdown: withGlobalDurableBlocks })
}
```

Include the line-record codec in injection, serialization, and durable-block detection, because its tokens can only have been produced by the scoped preprocessing step.

- [ ] **Step 3: Make unknown outer fences opaque to the generic durable scanner**

Refactor `preProcessDurableMarkdownBlocks` to recognize the syntax of every Markdown fence opening before asking codecs for metadata. When a top-level opening has no matching codec, copy its entire closed span unchanged and advance past its close; do not inspect nested-looking lines. Leave an unclosed unknown fence and all remaining source unchanged. Preserve current behavior for recognized top-level Mermaid, tldraw, HTML, and other durable codecs.

Add regression tests in `durableMarkdownBlocks.test.ts` for backtick and tilde outer fences, longer outer delimiters, and unclosed unknown fences. This is required for `line-record` outside Activity to remain a common code block even when its body contains recognized fence text.

- [ ] **Step 4: Add full-pipeline round-trip tests**

Use a real `BlockNoteEditor` where practical. Cover:

```text
Note parse -> BlockNote blocks -> Markdown equals input exactly
LF and CRLF sources
valid update with and without type/follow_up_at
malformed closed record survives exactly
line-record outside Activity remains a codeBlock
ordinary body, Mermaid, tldraw, HTML, unknown code fences, and headings remain unchanged
```

Expected: exact string equality, not semantic equality.

- [ ] **Step 5: Record the architecture decision**

Create ADR 0173 with status Accepted, context, decision, consequences, and rejected alternative. Record that BlockNote's built-in embed is URL/file oriented and lacks the scoped, structured, byte-preserving Markdown contract, so Tolaria uses a custom non-editable block over the existing durable codec pipeline.

- [ ] **Step 6: Run focused tests and quality checks**

```bash
pnpm vitest run src/utils/lineRecordMarkdown.test.ts src/utils/durableMarkdownBlocks.test.ts src/utils/editorDurableMarkdown.test.ts
pnpm eslint src/utils/lineRecordMarkdown.ts src/utils/lineRecordMarkdown.test.ts src/utils/durableMarkdownBlocks.ts src/utils/durableMarkdownBlocks.test.ts src/utils/editorDurableMarkdown.ts src/utils/editorDurableMarkdown.test.ts
npx tsc --noEmit
```

Expected: PASS. CodeScene: existing touched files improve or stay `10.0`; new files score `10.0`/no warnings. Codacy: findings decrease or remain zero; new files have zero.

- [ ] **Step 7: Commit the durable codec and ADR together**

```bash
git add src/utils/lineRecordMarkdown.ts src/utils/lineRecordMarkdown.test.ts src/utils/durableMarkdownBlocks.ts src/utils/durableMarkdownBlocks.test.ts src/utils/editorDurableMarkdown.ts src/utils/editorDurableMarkdown.test.ts docs/adr/0173-scoped-durable-activity-records.md
git commit -m "feat: round-trip scoped activity records"
```

### Task 4: Render Activity records as protected BlockNote blocks

**Files:**

- Create: `src/components/activity/ActivityRecordNavigationContext.tsx`
- Create: `src/components/activity/LineRecordBlock.tsx`
- Create: `src/components/activity/LineRecordBlock.test.tsx`
- Modify: `src/components/editorSchema.tsx`
- Modify: `src/components/tolariaBlockNoteSideMenu.tsx`
- Modify: `src/components/SingleEditorView.tsx`
- Modify: `src/lib/locales/en.json`

**Interfaces:**

```ts
export type ActivityRecordNavigation = {
  editInTimeline: (recordId: string) => void
  openRaw: () => void
}

export const ActivityRecordNavigationProvider: React.FC<{
  value: ActivityRecordNavigation
  children: React.ReactNode
}>

export function useActivityRecordNavigation(): ActivityRecordNavigation
```

- [ ] **Step 1: Add English source strings and failing renderer tests**

Add keys under `editor.activity`, including `noteMode`, `timelineMode`, `editInTimeline`, `malformedTitle`, `malformedRawOnly`, `unknownType`, `occurredAt`, and `followUpAt`.

Test that a valid block displays formatted occurrence time, Markdown body, optional follow-up, and a shadcn `Button` labeled through localization. Test that clicking invokes `editInTimeline(id)`. Test that malformed and unknown-type blocks show warnings, expose only the localized “Edit in RAW” action, and invoke `openRaw()` without exposing Timeline edit/delete actions.

Run:

```bash
pnpm vitest run src/components/activity/LineRecordBlock.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement the compact read-only renderer**

Use `MarkdownContent` for `body`, `Intl.DateTimeFormat` for display only, and `contentEditable={false}` on the block root. Keep the action visually discreet with `Button variant="ghost" size="sm"`. Parse `errors` defensively; invalid JSON must itself render as malformed rather than throw.

- [ ] **Step 3: Register the BlockNote spec**

In `editorSchema.tsx`, add a `createReactBlockSpec` with:

```ts
{
  type: LINE_RECORD_BLOCK_TYPE,
  propSchema: {
    source: { default: '' },
    id: { default: '' },
    recordType: { default: 'update' },
    occurredAt: { default: '' },
    followUpAt: { default: '' },
    body: { default: '' },
    valid: { default: 'false' },
    editable: { default: 'false' },
    errors: { default: '[]' },
  },
  content: 'none',
}
```

Set `meta: { selectable: false }`, render `LineRecordBlock`, and run before `codeBlock`. Do not add it to slash-menu/block-type definitions.

- [ ] **Step 4: Remove side-menu affordances for protected blocks**

In `TolariaSideMenu`, return `null` when `block?.type === LINE_RECORD_BLOCK_TYPE` before rendering drag or section controls. Keep the existing menu unchanged for every other block.

Add a focused test or extend the existing side-menu test to prove ordinary blocks retain controls and line records do not.

- [ ] **Step 5: Provide navigation context in the rich editor**

Extend `SingleEditorView` with optional `onEditActivityRecord?: (id: string) => void` and `onOpenRaw?: () => void`. Wrap the BlockNote view/controller subtree in `ActivityRecordNavigationProvider`. Default callbacks are no-ops only for isolated tests; production always supplies both.

- [ ] **Step 6: Run focused tests and quality checks**

```bash
pnpm vitest run src/components/activity/LineRecordBlock.test.tsx src/components/SingleEditorView.test.tsx src/components/tolariaBlockNoteSideMenu.test.tsx
pnpm eslint src/components/activity/ActivityRecordNavigationContext.tsx src/components/activity/LineRecordBlock.tsx src/components/activity/LineRecordBlock.test.tsx src/components/editorSchema.tsx src/components/tolariaBlockNoteSideMenu.tsx src/components/SingleEditorView.tsx
npx tsc --noEmit
```

Expected: PASS, followed by required CodeScene/Codacy before/after checks.

- [ ] **Step 7: Commit the protected rich-editor block**

```bash
git add src/components/activity src/components/editorSchema.tsx src/components/tolariaBlockNoteSideMenu.tsx src/components/SingleEditorView.tsx src/lib/locales/en.json
git commit -m "feat: render protected activity record blocks"
```

### Task 5: Build the Timeline surface and structured record form

**Files:**

- Create: `src/components/activity/ActivityTimelineView.tsx`
- Create: `src/components/activity/ActivityTimelineView.test.tsx`
- Create: `src/components/activity/ActivityComposer.tsx`
- Create: `src/components/activity/ActivityRecordDialog.tsx`
- Create: `src/components/activity/ActivityDateTimeField.tsx`
- Create: `src/components/activity/activityDateTime.ts`
- Create: `src/components/activity/activityDateTime.test.ts`
- Modify: `src/lib/locales/en.json`

**Interfaces:**

```ts
export type ActivityTimelineViewProps = {
  content: string
  locale: AppLocale
  pendingEditId: string | null
  onPendingEditHandled: () => void
  onContentChange: (nextContent: string) => void
  onOpenRaw: () => void
  onSave?: () => void
}

export function ActivityTimelineView(props: ActivityTimelineViewProps): JSX.Element

export function localDateAndTimeToOffsetIso(date: Date, time: string): string
export function offsetIsoToLocalDateAndTime(value: string): { date: Date; time: string }
```

- [ ] **Step 1: Write failing date conversion tests**

Freeze the test timezone or construct explicit local dates. Prove that the helper produces `YYYY-MM-DDTHH:mm:ss±HH:mm`, retains local wall time, and correctly formats positive/negative offsets without converting the stored value to UTC.

Run the targeted test; expect module-not-found failure.

- [ ] **Step 2: Implement date/time helpers**

Keep storage and display separate. Use local date parts and `getTimezoneOffset()` to build the numeric offset. Reject missing/invalid calendar or time values before mutation.

- [ ] **Step 3: Write failing Timeline behavior tests**

With Testing Library, prove:

```text
valid supported records display latest occurred_at first while source Markdown stays unchanged
equal timestamps use physical source position as deterministic tie-breaker
new update defaults to now, accepts Markdown body and optional follow-up, then appends physically
successful creation clears content/follow-up, resets occurrence to now, and restores content focus
Cmd/Ctrl+Enter submits a valid creation draft
editing changes the selected record without moving it
deleting removes only the selected record after AlertDialog confirmation
malformed and unknown-type records are source-ordered, warned, and expose only Edit in RAW
an unclosed fence produces a RAW-only warning
pendingEditId opens the matching valid update and is acknowledged once
empty Activity has an intentional empty state and create action
```

Mock time and `crypto.randomUUID()` so tests are deterministic.

- [ ] **Step 4: Implement the shadcn form**

Use an inline `ActivityComposer` at the top of the Timeline for creation, a `Dialog` for editing, and `Button`, `Textarea`, `Calendar`, `Popover`, `Input`, and `AlertDialog` throughout. The form owns a draft and calls the pure mutations from Task 2 only after validation. The composer handles `Cmd/Ctrl+Enter`, then clears body/follow-up, resets occurrence to the injected clock, and restores focus to its content field. On success:

```ts
const next = editingId
  ? updateActivityRecord(content, editingId, input)
  : appendActivityRecord(content, { ...input, id: crypto.randomUUID() })
onContentChange(next)
onSave?.()
```

The explicit `onSave` uses the existing coordinator and is not a filesystem write. Keep form copy in locale JSON. Render record bodies with `MarkdownContent`; never make Timeline cards draggable. Malformed and unsupported cards call `onOpenRaw`; they never enter the structured dialog.

- [ ] **Step 5: Implement visual-only sorting**

Derive a new array:

```ts
const visualRecords = records.filter(record => record.editable).toSorted((left, right) => {
  const timeDelta = Date.parse(right.occurredAt ?? '') - Date.parse(left.occurredAt ?? '')
  return Number.isNaN(timeDelta) || timeDelta === 0 ? left.start - right.start : timeDelta
})
```

Never feed `visualRecords` into a serializer. Render `records.filter(record => !record.editable)` in physical `start` order below a clear warning heading. Every mutation reparses the original `content` and targets the record ID/source span.

- [ ] **Step 6: Run focused tests and quality checks**

```bash
pnpm vitest run src/components/activity/ActivityTimelineView.test.tsx src/components/activity/activityDateTime.test.ts
pnpm eslint src/components/activity/ActivityTimelineView.tsx src/components/activity/ActivityTimelineView.test.tsx src/components/activity/ActivityComposer.tsx src/components/activity/ActivityRecordDialog.tsx src/components/activity/ActivityDateTimeField.tsx src/components/activity/activityDateTime.ts src/components/activity/activityDateTime.test.ts
npx tsc --noEmit
```

Expected: PASS. New files must be CodeScene `10.0`/no warnings and Codacy zero-findings.

- [ ] **Step 7: Commit the Timeline surface**

```bash
git add src/components/activity src/lib/locales/en.json
git commit -m "feat: add structured activity timeline"
```

### Task 6: Wire `Note | Timeline | RAW` transitions into the existing editor

**Files:**

- Create: `src/components/activity/ActivityModeToggle.tsx`
- Create: `src/components/activity/ActivityTimelineErrorBoundary.tsx`
- Create: `src/components/activity/ActivityTimelineErrorBoundary.test.tsx`
- Create: `src/components/activity/useActivityMode.ts`
- Create: `src/components/activity/useActivityMode.test.tsx`
- Modify: `src/components/Editor.tsx`
- Modify: `src/components/editor-content/useEditorContentModel.ts`
- Modify: `src/components/editor-content/EditorContentLayout.tsx`
- Modify: `src/components/SingleEditorView.tsx`
- Modify: `src/components/Editor.test.tsx`
- Modify: `src/lib/locales/en.json`

**Interfaces:**

```ts
export type ActivitySurfaceMode = 'note' | 'timeline'

export function useActivityMode(args: {
  activePath: string | null
  rawMode: boolean
  diffMode: boolean
  flushRichContent: () => boolean
  exitRawMode: () => void
  exitDiffMode: () => void | Promise<void>
}): {
  mode: ActivitySurfaceMode
  pendingEditId: string | null
  showTimeline: boolean
  showNote: boolean
  selectMode: (mode: ActivitySurfaceMode) => void
  editInTimeline: (id: string) => void
  openRaw: () => void
  acknowledgePendingEdit: () => void
  beforeEnterRaw: () => void
}
```

- [ ] **Step 1: Write failing transition tests**

Prove:

```text
Note -> Timeline hides rich editor without changing content
Note -> Timeline calls flushRichContent before parsing Activity
Timeline -> Note restores rich editor
Edit in timeline selects Timeline and carries exactly one pending ID
Timeline requested from RAW calls the existing RAW exit/flush before parsing content
entering RAW from Timeline returns the surface to Note
diff and Timeline are mutually exclusive
switching active note clears pending edit state and defaults to Note
non-Markdown, sheet, deleted preview, and HTML preview never offer Timeline
```

Run hook and Editor tests; expect failure.

- [ ] **Step 2: Implement surface state without changing App persistence**

Own Activity surface state inside `Editor`, keyed/reset by `activeTabPath`. Before selecting Timeline from Note, synchronously call the existing `runtime.flushPendingEditorChange()` so `onContentChange` receives the latest serialized BlockNote document. Selecting Timeline from RAW must call the existing RAW toggle, which flushes `rawLatestContentRef`, before showing Timeline. Extend the existing exclusivity handlers so RAW, diff, and Timeline cannot render simultaneously. Keep `EditorProps` and App save wiring unchanged.

Pass through the editor-content model:

```ts
activityMode: ActivitySurfaceMode
showActivityToggle: boolean
showTimeline: boolean
pendingActivityEditId: string | null
onSelectActivityMode: (mode: ActivitySurfaceMode) => void
onEditActivityRecord: (id: string) => void
onOpenActivityRaw: () => void
onActivityEditHandled: () => void
```

- [ ] **Step 3: Render the toggle and the exclusive canvas**

Place `ActivityModeToggle` in the editor chrome immediately below/adjacent to the breadcrumb, using shadcn `ToggleGroup`. Show it only for editable Markdown notes. In `EditorContentLayout`:

```tsx
{showTimeline ? (
  <ActivityTimelineErrorBoundary onReturnToNote={() => onSelectActivityMode('note')} onOpenRaw={onOpenActivityRaw}>
    <ActivityTimelineView
      content={activeTab.content}
      locale={locale ?? 'en'}
      pendingEditId={pendingActivityEditId}
      onPendingEditHandled={onActivityEditHandled}
      onContentChange={next => onRawContentChange?.(activeTab.entry.path, next)}
      onOpenRaw={onOpenActivityRaw}
      onSave={onSave}
    />
  </ActivityTimelineErrorBoundary>
) : (
  <EditorCanvas ... onEditActivityRecord={onEditActivityRecord} />
)}
```

Do not render Timeline alongside RAW, diff, sheet, file preview, or deleted preview. Add a focused error-boundary test showing that an unexpected Timeline render failure still offers Return to Note and Edit in RAW, so those recovery surfaces remain available.

- [ ] **Step 4: Route “Edit in timeline” through context**

Pass `onEditActivityRecord` and `onOpenActivityRaw` from `EditorContentLayout` to `SingleEditorView`, then into the provider from Task 4. Clicking a valid durable block must leave Note mode, open Timeline, visually locate the same ID, and open the structured edit dialog. Clicking a malformed/unsupported block must enter RAW with the complete source available.

- [ ] **Step 5: Add integration round-trip tests**

In `Editor.test.tsx` or a focused sibling test, cover:

```text
initial Note rendering exposes a read-only line record and preserves body paragraphs
click Edit in timeline -> Timeline edit form for same ID
edit -> onContentChange receives exact body plus only target fence changed
Timeline -> Note reparses updated record
RAW change -> Timeline reads flushed Markdown -> Note serializes exact untouched records
malformed closed record survives all three surfaces
```

Use the real durable preprocessing/serialization functions where possible; avoid mocking away the round-trip boundary.

- [ ] **Step 6: Run focused tests and quality checks**

```bash
pnpm vitest run src/components/activity/useActivityMode.test.tsx src/components/activity/ActivityTimelineErrorBoundary.test.tsx src/components/Editor.test.tsx src/components/SingleEditorView.test.tsx
pnpm eslint src/components/activity/ActivityModeToggle.tsx src/components/activity/ActivityTimelineErrorBoundary.tsx src/components/activity/ActivityTimelineErrorBoundary.test.tsx src/components/activity/useActivityMode.ts src/components/activity/useActivityMode.test.tsx src/components/Editor.tsx src/components/editor-content/useEditorContentModel.ts src/components/editor-content/EditorContentLayout.tsx src/components/SingleEditorView.tsx src/components/Editor.test.tsx
npx tsc --noEmit
```

Expected: PASS plus required CodeScene/Codacy improvement checks.

- [ ] **Step 7: Commit editor integration**

```bash
git add src/components/activity src/components/Editor.tsx src/components/editor-content/useEditorContentModel.ts src/components/editor-content/EditorContentLayout.tsx src/components/SingleEditorView.tsx src/components/Editor.test.tsx src/lib/locales/en.json
git commit -m "feat: switch notes between note and timeline"
```

### Task 7: Complete localization, architecture docs, and core-flow E2E coverage

**Files:**

- Create: `tests/smoke/activity-timeline-note-mode.spec.ts`
- Modify: `src/lib/locales/*.json` via Lara
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ABSTRACTIONS.md`

**Interfaces:** Document these stable boundaries:

```text
activityDocument: fence-aware parsing and span mutations
lineRecordMarkdown: scoped durable BlockNote round-trip adapter
ActivityTimelineView: structured UI over Markdown content
ActivityRecordNavigationContext: rich-block to Timeline navigation only
```

- [ ] **Step 1: Write the failing Playwright flow**

Use `demo-vault-v2` and a disposable test note. Cover the core note save flow:

```text
open/create note with durable body and Activity records
Note: body and compact Activity blocks are visible; block has no rich edit/delete/drag affordance
Edit in timeline: correct record opens
create with occurrence date and optional follow-up: record appends physically
edit: record stays in its original physical position
delete: only chosen record disappears
visual order differs from file order without rewriting RAW
RAW: exact line-record fences and untouched source are present
RAW malformed record: Note/Timeline warn and returning to RAW preserves it exactly
save, switch note/reload, reopen: content persists through existing save flow
```

Run once and expect failure before final wiring/selector adjustments.

- [ ] **Step 2: Translate and validate UI copy**

```bash
pnpm l10n:translate
pnpm l10n:validate
```

Expected: every locale in `lara.yaml` contains the new keys, placeholders and product names remain intact, validation passes. Do not hand-author generated locale changes unless Lara identifies a translation that needs correction.

- [ ] **Step 3: Update architecture documentation**

Add the four boundaries above to `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md`. Explicitly state:

```text
Activity complements the body rather than replacing it.
Markdown remains the only persisted source of truth.
Timeline sorting is derived presentation state.
All mutations enter the existing app save coordinator.
Malformed/unknown records are preserved and RAW-only for repair.
```

- [ ] **Step 4: Run Playwright and native UI QA**

Prefer the Chunk smoke lane if available; otherwise:

```bash
pnpm dev --port 5201
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/activity-timeline-note-mode.spec.ts
```

Then run the native app, focus Tolaria, and verify mouse-first create/edit/delete, Calendar/Popover behavior, Note/Timeline toggle, RAW transition, warning blocks, and keyboard editor behavior around protected blocks. Capture a native screenshot under `/tmp` for the completion record.

- [ ] **Step 5: Verify demo-vault hygiene**

Remove only disposable QA artifacts created by this task and revert only tracked demo files changed solely for QA. Then run:

```bash
git status --short -- demo-vault demo-vault-v2
```

Expected: empty unless the E2E fixture is an intentional committed change.

- [ ] **Step 6: Run docs/tests quality checks and commit**

Run focused tests again, CodeScene/Codacy for the new E2E code, and the repository pre-commit safeguard.

```bash
git add tests/smoke/activity-timeline-note-mode.spec.ts src/lib/locales docs/ARCHITECTURE.md docs/ABSTRACTIONS.md
git commit -m "test: cover activity timeline round trips"
```

### Task 8: Run release gates, review the change set, and deliver to main

**Files:** All files changed by Tasks 2–7; `.codescene-thresholds` only if the official ratchet raises it automatically.

**Interfaces:** No new interfaces. This task verifies the approved acceptance contract end to end.

- [ ] **Step 1: Run frontend static and test gates**

```bash
pnpm lint
npx tsc --noEmit
pnpm test
pnpm test:coverage
pnpm codacy:gate
pnpm l10n:validate
```

Expected: all pass; frontend coverage remains at least 70%.

- [ ] **Step 2: Run Rust gates even though Rust is unchanged**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

Expected: all pass and Rust line coverage is at least 85%.

- [ ] **Step 3: Repeat every touched-file quality comparison**

Recheck CodeScene availability. If it has become available, run the same CodeScene file-level review used for baselines. Always repeat Codacy scans. Expected when each scanner is available:

```text
existing touched CodeScene score > baseline, or remains 10.0
new code file CodeScene score == 10.0, or null with zero warnings
existing touched Codacy findings < baseline, or zero remains zero
new code file Codacy findings == 0 at every severity
```

Fix findings in code, add/adjust tests first where behavior changes, and recommit. Never suppress or waive silently.

- [ ] **Step 4: Run repository-wide CodeScene release gates**

If CodeScene has become available, run the pre-commit safeguard, then `analyze_change_set` with `base_ref=origin/main`. Capture the final project Hotspot and Average scores and verify both meet `.codescene-thresholds`. If remote improvement raises the ratchet and the hook stages `.codescene-thresholds`, commit the higher floor normally before pushing. If it remains unavailable, record that none of these checks ran or passed under the one-task exception; do not present the exception as a successful gate.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` and review the complete diff against the approved specification, especially byte preservation, Activity scoping, malformed handling, unsupported types, UI affordance removal, localization, and absence of excluded second-increment work. Address every confirmed issue with a new Red → Green cycle.

- [ ] **Step 6: Verify the final working tree and commit any review fixes**

```bash
git status --short
git diff --check
git log --oneline origin/main..HEAD
```

Expected: clean tree, no whitespace errors, intentional commits only.

- [ ] **Step 7: Push the verified main branch**

```bash
git push origin main
```

Expected: pre-push full suite passes and push succeeds. Never use `--no-verify`. The task is not complete before this succeeds.

- [ ] **Step 8: Record release-readiness evidence**

Prepare the completion record with implementation summary; Playwright/native QA and screenshot; frontend/Rust coverage; CodeScene before/after per file, safeguard, `origin/main` change set, final Hotspot/Average; Codacy before/after; localization; explicit “PostHog: deferred by approved increment scope”; refactoring; ADR 0173; architecture docs; and demo-vault cleanliness.

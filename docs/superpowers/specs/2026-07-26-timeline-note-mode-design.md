# Activity Timeline Note Mode Design

**Date:** 2026-07-26
**Status:** Approved for implementation
**Product:** Tolaria / Line concept validation

## Purpose

Add a second way to work with an existing Markdown note without changing Tolaria's local-first, files-first architecture. A Markdown note remains the only source of truth. The existing Note mode keeps its current behavior, while Timeline mode provides structured creation, display, editing, and deletion of chronological updates stored in the same file.

Activity is complementary to the note body. It records chronological occurrences; it does not replace, derive, summarize, or assume ownership of the ordinary Markdown body. The body remains the user's surface for context, documentation, and durable knowledge, and keeps all existing editing behavior.

This first increment validates only the Timeline experience inside an open note. It deliberately excludes vault-wide follow-up discovery and analytics.

## Scope

The increment includes:

- a `Note | Timeline` mode switch for ordinary Markdown notes;
- a durable, visible, read-only BlockNote block for each `line-record`;
- creation of an update with an editable occurrence date and time;
- one optional follow-up date and time per update;
- chronological visual sorting without changing file order;
- structured editing and deletion in Timeline mode only;
- immediate persistence through Tolaria's existing save coordination;
- lossless event round-trips among Note, RAW, and Timeline modes;
- tolerant handling of malformed or unsupported `line-record` blocks.

This increment excludes:

- Rust scanner extraction of follow-ups;
- changes to `VaultEntry`;
- vault-wide follow-up filters or sorting;
- global overdue, today, or future classifications;
- PostHog events;
- reminders, notifications, recurrence, follow-up completion, or a Today view;
- databases, services, additional files per note, or automatic migration.

The excluded discovery and analytics features form a separate second increment after the note-level experience is validated.

## BlockNote Embed Spike

The spike inspected the installed BlockNote 0.46.2 implementation rather than assuming a generic embed API exists. BlockNote's built-in “embed” behavior is the URL-backed file/media family: `file`, `audio`, `video`, and `image`. Those blocks use `content: none`, but their schemas are oriented around properties such as URL, filename, caption, preview state, and media dimensions. Their parse and export behavior uses HTML media elements, embeds, figures, and links.

That infrastructure does not provide a generic local-data embed with a caller-owned Markdown parser or byte-preserving fenced-source serializer. Adapting a file/media embed for Line records would still require replacing its props, parser, renderer, external representation, and Markdown round-trip behavior while inheriting unrelated upload and URL semantics.

BlockNote does provide the lower-level custom block primitive needed here: a `content: none` block created through `createReactBlockSpec`, with metadata such as `selectable: false`. Tolaria already combines that primitive with its durable fenced-block codec for Mermaid, tldraw, and HTML.

**Verdict:** keep the planned custom durable block. A built-in embed does not reduce the implementation surface or meet the exact-source requirement. The durable block reuses more of Tolaria's proven infrastructure and has the narrower behavioral contract.

## Existing Architecture Constraints

Tolaria's rich editor serializes the BlockNote document back to Markdown while retaining frontmatter from the current tab. Ordinary HTML comments are not part of the current durable-block pipeline, so comment-delimited events could be lost during a rich-editor save.

The existing durable Markdown abstraction converts recognized fenced blocks to opaque tokens before BlockNote parsing, injects custom BlockNote nodes after parsing, and serializes those nodes back to their retained Markdown source. Mermaid, tldraw, and HTML blocks already use this mechanism. Timeline events will extend the same abstraction rather than introduce a second editor or persistence path.

Timeline writes must pass through the current tab state, autosave coordination, path resolution, and native `save_note_content` command. Timeline code must not issue an unrelated filesystem write that can race with the editor.

## Markdown Representation

### Canonical update record

Each event is a fenced `line-record` block below an explicit, neutral level-two `Activity` heading:

````markdown
## Activity

```line-record
id: 97ea0194-fda7-4bdd-972d-c98dbb58f8b9
type: update
occurred_at: 2026-07-26T14:35:00-03:00
follow_up_at: 2026-07-27T09:00:00-03:00
---
Entrevista realizada com **Petrus**.

Ele demonstrou interesse e possui disponibilidade.
```
````

`id`, `occurred_at`, and the `---` metadata/content separator are required. `type` is optional when reading and defaults to `update`; newly created records write `type: update` explicitly. `follow_up_at` is omitted when absent. The content after the separator is Markdown and may contain multiple lines.

This increment supports structured operations only for `type: update`. A future unknown `type` is retained as an unsupported durable record, displayed read-only, and repairable only through RAW. It is never coerced to `update` or deleted. This reserves the format for future record kinds without expanding the current product scope.

New IDs use `crypto.randomUUID()` through an injectable ID factory so tests remain deterministic and no dependency is added. Occurrence and follow-up values use ISO 8601 with the user's current local UTC offset, for example `2026-07-26T14:35:00-03:00`.

The serializer selects an outer backtick fence longer than any backtick run that would close the event prematurely. This permits event content to contain fenced Markdown code examples while keeping the note valid Markdown.

### Activity section boundary

The parser recognizes the first exact ATX heading `## Activity` that occurs outside a fenced code block. The Activity section continues until the next H1 or H2 heading outside a fence, or until the end of the document.

Only `line-record` fences within that section become durable Line record blocks. A `line-record` fence outside the section remains an ordinary code block. A heading that looks like `## Activity` inside another fence is ignored.

When the first event is created in a note without an Activity section, Tolaria appends two line breaks as needed, the `## Activity` heading, and the record to the end of the document. New records are always appended to the end of the existing Activity section, immediately before its closing H1/H2 boundary when one exists. The UI never inserts a record among ordinary note paragraphs.

### File order

File order is stable:

- creating an event appends its record to the end of the Activity section;
- editing replaces only the source range of the matching ID;
- deleting removes only the source range of the matching ID and its owned separator whitespace;
- visual sorting never rewrites or reorders event blocks;
- editing an event never changes its physical position.

## Timeline Domain Model

```ts
type TimelineEntry = {
  id: string
  type: string
  occurredAt: string
  followUpAt: string | null
  content: string
  source: string
  sourceRange: { start: number; end: number }
}

type MalformedTimelineBlock = {
  source: string
  sourceRange: { start: number; end: number }
  errors: TimelineParseError[]
}

type ParsedTimeline = {
  entries: TimelineEntry[]
  malformed: MalformedTimelineBlock[]
  errors: TimelineParseError[]
}
```

Parsing and mutation live outside React. The module exposes focused operations equivalent to:

```ts
parseTimeline(markdown)
appendTimelineEntry(markdown, entry)
updateTimelineEntry(markdown, entryId, changes)
removeTimelineEntry(markdown, entryId)
serializeTimelineEntry(entry)
```

Mutations identify events by stable ID, then replace source ranges. A missing ID or duplicate valid IDs makes an update or deletion ambiguous, so the operation fails without changing the document.

## Durable BlockNote Block

### Block contract

The custom BlockNote type is `lineRecordBlock`. It has no editable inline content and carries a retained source plus parsed display fields:

```ts
type LineRecordBlockProps = {
  source: string
  id: string
  recordType: string
  occurredAt: string
  followUpAt: string
  content: string
  valid: boolean
  errors: string
}
```

For an unmodified record, `source` is the exact fenced block read from the note, including fence length, metadata spacing, line endings, field order, and final newline. Serializing the rich editor returns that exact source byte for byte. Only a successful structured edit in Timeline mode replaces the target update with canonical source.

### Parsing pipeline

The rich-editor preprocessing sequence is:

1. locate the Activity section with a fence-aware scan;
2. locate each closed `line-record` fence in that section;
3. capture its exact source and best-effort parsed fields;
4. replace the source with an encoded opaque Tolaria token;
5. allow the existing BlockNote Markdown parser to parse the document;
6. replace the token paragraph with a `lineRecordBlock`.

Activity preprocessing is section-aware and runs alongside the existing durable codecs. The Line record codec does not reinterpret arbitrary BlockNote code blocks, which prevents `line-record` fences outside `## Activity` from becoming special nodes.

The serialization sequence recognizes `lineRecordBlock`, returns its retained `source`, and delegates all other blocks to the existing serializers. The rest of the note therefore remains subject to Tolaria's current round-trip guarantees rather than a new Timeline-specific serializer.

### Rich-editor presentation

A valid update block displays:

- localized occurrence date and time;
- rendered event content;
- localized follow-up date and time only when present;
- a discreet shadcn `Button` labeled “Edit in timeline”.

The block is compact, respects normal and wide note widths, supports light and dark themes, and exposes a visible keyboard focus state on its action.

The record body and metadata are read-only. Line record blocks are not offered by the slash menu and do not expose edit, delete, transform, or drag controls. Direct-operation guards are limited to targeted Line record behavior and must not change ordinary BlockNote editing. If a proposed protection mechanism interferes with standard selection, typing, copy, undo, or block navigation, the protection is reduced to the safe custom-block affordances rather than adding a broad transaction filter.

### “Edit in timeline” action

A scoped React context surrounding the rich editor exposes:

```ts
openTimelineEntry(entryId: string): void
```

The durable block consumes this context. Activating its button switches the current editor surface to Timeline mode, selects the matching event, scrolls it into view, opens its edit form, and focuses the content field.

The context is window-local and editor-local. It avoids a global event bus that could cause another Tolaria window to respond.

## Timeline Mode

### Mode state

`Note | Timeline` is session-only UI state and is not persisted into the note. The toggle appears only for ordinary editable Markdown notes. RAW, diff, HTML preview, binary preview, deleted preview, and sheet modes retain their existing behavior.

Switching from Note to Timeline flushes pending rich-editor content before parsing the Timeline view. Switching back to Note causes the active tab content to pass through the normal rich-editor swap and durable-block pipeline. RAW remains available and always shows the complete Markdown representation.

### Composer

The composer contains:

- required multiline Markdown content;
- occurrence date and time initialized to the current local date and time;
- optional follow-up date and time;
- a register button disabled for whitespace-only content.

Date selection reuses shadcn `Calendar` and `Popover`; time input uses the existing shadcn input styling. The layout wraps at narrow supported window widths without clipping controls.

On successful creation, the composer clears content and follow-up, resets occurrence time to the current moment, appends the event to the visible list, and restores focus to the content field. `Cmd/Ctrl+Enter` submits.

On persistence failure, the composer retains all draft values and presents a localized error.

### Timeline list and visual sorting

Entries are grouped by the local calendar date of `occurredAt`. The default display is newest first; the user can switch between newest-first and oldest-first.

Sorting operates on a derived in-memory array. It never changes parsed entries, source ranges, tab content, or physical block order in Markdown.

Each valid update displays occurrence time, rendered content, optional follow-up, Edit, and Delete actions. Empty Activity sections and notes without Activity sections show the localized empty state.

Editing loads the selected event into an edit form. Saving replaces only that event's source range and retains its ID and physical position. `Esc` cancels editing without changing Markdown.

Deletion requires confirmation through the existing shadcn dialog pattern. A confirmed deletion removes only the selected valid update. The `## Activity` heading may remain as an empty section.

## Persistence and Concurrency

Timeline mutation uses one coordinated path:

1. flush pending rich-editor or RAW changes for the active note;
2. parse the latest active-tab content;
3. apply one pure Timeline mutation;
4. update the active tab with the resulting Markdown;
5. route the update through the existing editor save coordinator;
6. immediately flush the pending save for that path;
7. update ordinary derived note metadata through the existing post-save flow.

Timeline code does not call a separate native write path. Existing path resolution, vault containment, rename coordination, watcher bookkeeping, cache refresh, Git dirt, and save error handling remain authoritative.

Each async mutation is bound to the active note path and expected source snapshot. If the active path or source changes before persistence begins, the mutation is rejected instead of overwriting newer content.

## Malformed and Unknown Content

A closed `line-record` fence in the Activity section becomes a durable block even when its metadata or content separator is invalid, or its explicit `type` is unsupported. The parser records errors while retaining the complete source.

In Note mode, a malformed or unsupported block appears as a compact read-only warning with an action to open RAW. In Timeline mode, malformed and unsupported blocks appear in source order with their errors. They cannot be structurally edited or deleted there; RAW is the only repair surface.

An unclosed `line-record` fence is treated as unknown ordinary Markdown because its safe boundary cannot be determined. It is reported by the Timeline parser but is not extracted, normalized, or deleted.

Unknown fences, headings, comments, and ordinary Markdown inside the Activity section are preserved. Timeline mutations operate only on recognized valid `update` record ranges and never rebuild the entire section.

## Error Handling

- Whitespace-only content is rejected before mutation.
- Invalid occurrence or follow-up values prevent structured save and preserve the form.
- Duplicate IDs prevent edit or deletion by ID.
- A missing target ID fails without rewriting the document.
- A stale source snapshot fails rather than overwriting concurrent content.
- Parse errors remain visible until corrected in RAW.
- Persistence errors preserve the composer or edit draft and the pre-save Markdown.
- A Timeline rendering failure must not make Note or RAW mode unavailable.

## Localization and Accessibility

All new user-facing strings originate in `src/lib/locales/en.json`, exist in every checked-in locale catalog, and pass `pnpm l10n:validate`. Lara may optionally provide translations, but unavailable credentials, quota, network, or service must not block this implementation; when no reviewed translation is available, the locale temporarily uses the English source text.

All controls use shadcn components. Labels, descriptions, dialog text, errors, sorting controls, and empty states are accessible by keyboard and screen reader. Focus moves deliberately after creation, edit activation, edit cancellation, deletion confirmation, and mode switching.

## Testing Strategy

Implementation follows red-green-refactor cycles.

### Parser and mutation tests

- note without an Activity section;
- empty Activity section;
- first creation appends the section at document end;
- new events append to the end of an existing section;
- section ending at a later H1 or H2;
- headings inside fences ignored;
- `line-record` outside Activity remains ordinary Markdown;
- missing `type` defaults to `update`;
- newly serialized records include `type: update`;
- unsupported future record type is preserved and remains RAW-only;
- valid event with and without follow-up;
- multiline and formatted Markdown content;
- content containing fenced code with dynamic outer fencing;
- local timestamps with positive and negative offsets;
- several events with stable source ranges;
- edit by ID preserves physical position;
- deletion by ID removes only its owned range;
- duplicate and missing IDs do not mutate content;
- CRLF and original record source preservation;
- malformed closed block preservation;
- unclosed block preservation;
- unknown content inside the section preservation;
- unchanged record sources remain byte-identical after other updates change;
- visual sorting does not alter Markdown.

### Durable round-trip tests

- RAW → Note → RAW;
- Note → Timeline → Note;
- RAW → Timeline → RAW;
- repeated Note/RAW/Timeline switching without edits;
- saving ordinary note text leaves record sources unchanged;
- valid and malformed blocks survive rich-editor serialization;
- existing durable Mermaid, tldraw, and HTML blocks continue to round-trip;
- ordinary `line-record` fences outside Activity remain ordinary code blocks.

### Component and interaction tests

- Note/Timeline toggle visibility and switching;
- valid rich-editor block is read-only;
- no Timeline slash command or block removal controls;
- “Edit in timeline” targets the correct event;
- required-content validation;
- creation with and without follow-up;
- occurrence date editing;
- newest-first and oldest-first visual ordering;
- edit keeps ID and file position;
- `Esc` cancels editing;
- deletion confirmation and cancellation;
- empty state and old note without an Activity section;
- malformed block warning and RAW repair action;
- persistence failure retains draft values;
- focus restoration and `Cmd/Ctrl+Enter`;
- narrow-window wrapping.

### Regression and release verification

- existing rich editor and RAW synchronization tests;
- tab loading, cache, and note-switch tests;
- autosave, immediate save, rename, and persistence tests;
- frontmatter and ordinary note serialization tests;
- full frontend lint, typecheck, unit tests, and coverage;
- Rust tests and coverage even though this increment does not change the scanner;
- focused Playwright note create/save/reopen coverage because note persistence is a core flow;
- native mouse-first QA, keyboard checks, light/dark themes, and a narrow window;
- clean `demo-vault` and `demo-vault-v2` status after QA.

Before implementation edits, CodeScene project gates, touched-file baselines, and Codacy baselines must be recorded as required by the repository workflow. Before each commit and the final push, the repository's CodeScene, Codacy, coverage, localization, and direct-to-main gates apply.

## Expected Code Boundaries

New modules are expected for the Timeline parser/mutations, durable block renderer, scoped mode context, Timeline surface, composer/list/date field, and their tests. Existing durable Markdown registration, editor schema, editor content layout, editor props, app save wiring, localization catalogs, architecture documentation, and abstractions documentation will be modified only where needed to connect those units.

No Rust vault-entry or scanner code, note-list filtering code, or analytics code belongs in this increment.

## Acceptance Criteria

The increment is complete when:

1. An ordinary Markdown note can switch between Note and Timeline.
2. Existing Note behavior remains available; the ordinary body remains the surface for context, documentation, and durable knowledge, while Activity records are visible as compact read-only durable blocks.
3. RAW shows the complete `## Activity` section and fenced sources.
4. A user can create an event with occurrence date/time and optional follow-up.
5. New events append as `type: update` records to the end of the Activity section.
6. A user can visually sort events in either direction without changing Markdown order.
7. A user can edit a valid event without changing its ID or physical position.
8. A user can delete a valid event after confirmation.
9. Creation, editing, and deletion persist through the existing coordinated save path.
10. Closing and reopening the note retains all events.
11. Unmodified record source is preserved byte for byte across Note, RAW, and Timeline round-trips.
12. Malformed and unsupported record blocks are preserved and signaled, and can be repaired only in RAW.
13. Notes without an Activity section continue to open and save normally.
14. No database, backend, scanner field, `VaultEntry` field, global follow-up filter, global follow-up sort, or PostHog event is added.
15. New and existing release gates pass, and the verified work is pushed directly to `origin/main` without bypassing hooks.

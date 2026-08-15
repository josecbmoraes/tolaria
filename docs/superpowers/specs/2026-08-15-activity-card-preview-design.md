# Activity card preview design

## Goal

Prevent Activity metadata from appearing as the note-list preview and remove the redundant `Activity` heading from the Note view.

## Scope

- Snippet extraction excludes the complete `## Activity` section: its heading, ordinary text, and `line-record` fences.
- If no ordinary note content remains after that exclusion, the snippet is an empty string. The note card therefore renders no preview line.
- The Note view hides the `Activity` H2 but keeps the rendered Activity record cards. The Timeline view remains available for browsing and editing those records.

## Design

`extractSnippet` will use the existing Activity document boundary rules to remove the first Activity section before it filters Markdown lines. Its existing empty-snippet behavior supplies the desired card UX without a NoteItem change.

`SingleEditorView` will mark only the Activity heading for Note-view hiding while retaining the existing rendered Activity record cards. The DOM synchronization remains scoped to content changes so it cannot reintroduce the WebKit mutation loop fixed in the preceding change.

## Verification

- Add focused extraction tests for an Activity-only note and for a note with ordinary content after Activity.
- Update the rich-editor rendering test so the Activity H2 is hidden while its records stay visible in Note mode.
- Run focused tests, lint, type checking, and native QA with the `josecbmoraes` vault.

# Activity Note Render Loop — Design

## Problem

The packaged macOS app can leave a white, unresponsive window when opening a
note that contains an `## Activity` section with `line-record` blocks. The
native process stays alive while WebKit consumes a full CPU core in a repeated
`MutationObserver` callback.

The note view must continue to hide the raw Activity section; Timeline remains
the structured way to view and edit those records.

## Chosen approach

Keep the note-view Activity hiding behavior, but constrain its DOM
synchronization so it cannot respond endlessly to mutations caused by the
editor's own rendering work.

The implementation will:

1. Extract the Activity-section visibility calculation into a small,
   testable helper.
2. Apply `data-tolaria-hidden-activity` only when a block's required state
   differs from its current state.
3. Observe only editor content mutations that can change the set or order of
   BlockNote blocks, and coalesce updates to one animation-frame pass.
4. Cancel a pending frame and disconnect the observer when the note view
   unmounts.

## Data flow

`SingleEditorView` receives rendered BlockNote content. The Activity visibility
sync scans direct rendered blocks in document order, marks the `## Activity`
heading and following blocks as hidden, and clears that state at the next H2.
The observer schedules, rather than directly performs, the same idempotent
sync after relevant editor content changes.

The sync changes only the visibility data attribute. Reapplying it to stable
DOM produces no attribute mutations and no extra work.

## Error handling and compatibility

If the editor container is not mounted, the hook is a no-op. The behavior is
limited to the Note surface; RAW and Timeline continue to expose the durable
Activity source and structured records respectively.

## Tests

Add a targeted component/unit regression test using a note containing an
`## Activity` heading and `line-record` fence. It verifies the Activity range
is hidden, subsequent H2 content remains visible, and repeated observer
notifications do not create an unbounded scheduling cycle.

## Verification

Run the focused regression test first (red, then green), then the affected
test suite and applicable frontend checks. Rebuild the macOS bundle and open
the `josecbmoraes` vault to verify that the renderer remains responsive.

## Scope

No vault content, data format, Timeline semantics, or native Tauri behavior
changes. No ADR is needed because this is a localized renderer bug fix.

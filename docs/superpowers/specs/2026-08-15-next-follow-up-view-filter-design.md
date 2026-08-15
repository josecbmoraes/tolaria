# Next Follow-up View Filter Design

## Goal

Expose a derived `nextFollowUpAt` field on every indexed note so saved Views can find and sort notes with pending Activity follow-ups.

## User behavior

Each `line-record` may contain an optional `follow_up_at` timestamp. Its presence means the follow-up is pending. Completing an activity follow-up removes that timestamp from the record; no completed state is added.

For every note, `nextFollowUpAt` is the earliest valid `follow_up_at` among its Activity records. Past timestamps remain eligible so overdue work stays visible. Notes without a valid follow-up have `nextFollowUpAt: null`.

## Architecture

The Rust vault scanner remains the source of indexed note metadata. It will scan only closed `line-record` fences inside the first `## Activity` section and derive the earliest valid `follow_up_at` without changing Markdown source. The scanner returns the nullable field as part of `VaultEntry`; the TypeScript `VaultEntry` mirrors it.

The renderer adds a built-in View field named `Next follow-up`. The existing date comparison operators (`before`, `after`, `equals`, and `not equals`) and empty checks work through the normal View-filter evaluator. Existing View sorting supports the field as a scalar date value. No new persistence layer, background job, notification, or default View file is introduced.

## Edge cases

- Missing Activity sections and records without `follow_up_at` yield `null`.
- Invalid or unclosed records do not produce a value.
- Multiple valid follow-ups choose the chronologically earliest timestamp.
- Removing the selected record's date causes the next earliest date, or `null`, to be indexed after the normal vault refresh.
- Timestamp comparisons preserve the explicit UTC offset stored in Markdown.

## Validation

- Rust tests cover Activity boundaries, invalid records, overdue timestamps, multiple dates, and removal/recalculation.
- TypeScript tests cover View filtering and date sorting with `Next follow-up`.
- The saved-View dialog exposes the field when at least one indexed entry provides it.
- Existing Activity Timeline persistence and Markdown round trips remain byte-preserving outside intentional record edits.

## Scope exclusions

- Per-record completion status.
- Notifications, recurrence, and a built-in default View.
- Filtering individual Activity records as list rows; Views continue to list notes.

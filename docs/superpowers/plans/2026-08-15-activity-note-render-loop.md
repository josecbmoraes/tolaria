# Activity Note Render Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the packaged app's WebKit renderer from entering a CPU-saturating DOM-mutation loop when a note contains an Activity section.

**Architecture:** `SingleEditorView` owns the note-only Activity visibility rule. Extract its DOM scan into an idempotent helper and invoke it from a coalesced observer. The observer watches rendered BlockNote content changes, while the helper writes each visibility attribute only when its value needs to change.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, BlockNote test harness.

## Global Constraints

- Preserve RAW and Timeline access to Activity source; only Note rendering changes.
- Do not change vault files, Activity Markdown syntax, or Tauri native code.
- New behavior must be covered by a focused regression test before production code is written.
- CodeScene is unavailable locally; repository-owner-approved exception expires 2026-08-18. Record the unavailable command/evidence and compensating checks in the final release record.
- All touched user-facing code remains localized-neutral; no UI copy changes are expected.

---

## File structure

- `src/components/SingleEditorView.tsx` — owns idempotent Activity block visibility and observer lifecycle.
- `src/components/SingleEditorView.test.tsx` — verifies the Activity rendering boundary and bounded reaction to child-list mutations using the existing editor harness.
- `docs/ARCHITECTURE.md` — amend only if the implementation changes the documented renderer contract; otherwise document “none” in handoff.

### Task 1: Reproduce and prevent the DOM-mutation loop

**Files:**

- Modify: `src/components/SingleEditorView.tsx:1267-1288`
- Modify: `src/components/SingleEditorView.test.tsx`
- Modify: `src/components/SingleEditorView.testUtils.tsx` only if the existing mocked `BlockNoteViewRaw` cannot expose direct rendered `.bn-block` children.

**Interfaces:**

- Consumes: `<SingleEditorView editor entries onNavigateWikilink />` and the `renderEditorHarness()` helper.
- Produces: `syncActivitySectionVisibility(container: HTMLElement): void`, plus a regression test proving repeated child-list notifications do not create unbounded DOM work.

- [ ] **Step 1: Write the failing regression test**

Add a `SingleEditorView` test which mounts three direct BlockNote blocks in the harness: an H2 labelled `Activity`, a following record block, and a following H2 labelled `Next`. Assert that the heading and record have `data-tolaria-hidden-activity`, while `Next` does not. Trigger two child-list mutations after the attributes settle; observe the container for attribute mutations and assert that no additional records appear.

- [ ] **Step 2: Run test to verify red**

Run:

```bash
pnpm vitest run src/components/SingleEditorView.test.tsx
```

Expected: FAIL because the proposed bounded/idempotent observer contract is not yet guaranteed by the existing implementation.

- [ ] **Step 3: Implement the minimal idempotent synchronization**

In `SingleEditorView.tsx`, extract this ownership boundary:

```tsx
function syncActivitySectionVisibility(container: HTMLElement): void {
  let hidingActivity = false
  for (const block of container.querySelectorAll<HTMLElement>('.bn-block')) {
    const heading = block.querySelector<HTMLElement>('[data-content-type="heading"]')
    const isActivityHeading = heading?.dataset.level === '2' && heading.textContent?.trim() === 'Activity'
    if (heading?.dataset.level === '2') hidingActivity = isActivityHeading
    if (block.hasAttribute('data-tolaria-hidden-activity') !== hidingActivity) {
      block.toggleAttribute('data-tolaria-hidden-activity', hidingActivity)
    }
  }
}
```

Have `useHideActivitySectionInNote` call it once at mount and schedule at most one `requestAnimationFrame` callback for child-list observer notifications. Its cleanup must cancel a pending frame and disconnect the observer. Do not observe attributes and do not change DOM nodes except the visibility attribute.

- [ ] **Step 4: Run test to verify green**

Run:

```bash
pnpm vitest run src/components/SingleEditorView.test.tsx
```

Expected: PASS, including the new Activity boundary and stable-DOM regression.

- [ ] **Step 5: Refactor while green**

Keep the helper and hook local to `SingleEditorView.tsx`. Remove duplicated heading logic, then rerun the focused test.

- [ ] **Step 6: Run changed-file analyzers and commit**

Run the available local Codacy per-file command for both touched TypeScript files and inspect all SARIF findings. Then run:

```bash
pnpm lint
pnpm vitest run src/components/SingleEditorView.test.tsx
git add src/components/SingleEditorView.tsx src/components/SingleEditorView.test.tsx
git commit -m "fix: prevent activity note render loop"
```

Expected: zero new analyzer findings and passing lint/test commands.

### Task 2: Verify the packaged macOS behavior

**Files:**

- No production file changes expected.

**Interfaces:**

- Consumes: the committed Task 1 renderer fix and `/Users/josecarlosmoraes/Documents/josecbmoraes` vault.
- Produces: evidence that the packaged macOS app opens the real Activity note without renderer CPU saturation or a white window.

- [ ] **Step 1: Build the production bundle**

Run:

```bash
pnpm tauri build
```

Expected: Tauri generates a macOS app bundle under `src-tauri/target/release/bundle/macos/`.

- [ ] **Step 2: Launch the newly built app with the registered vault**

Run the generated app, select `josecbmoraes`, and open `Pessoas/felipe-goulart.md`, which includes representative `## Activity` and `line-record` content.

- [ ] **Step 3: Confirm responsiveness**

Use native UI interaction to select that note and a second note. Confirm content remains visible and usable. Sample the WebKit WebContent process for five seconds:

```bash
sample "$(pgrep -f 'com.apple.WebKit.WebContent' | tail -1)" 5 1 -file /tmp/tolaria-webcontent-after.sample
```

Expected: no sustained full-core JavaScript `MutationObserver` stack and no blank app surface.

- [ ] **Step 4: Run release checks appropriate to the touched frontend files**

Run:

```bash
pnpm lint
npx tsc --noEmit
pnpm test
pnpm test:coverage
pnpm l10n:validate
```

Expected: all commands pass. Record localization as “no UI copy changes” and PostHog as “no event needed; this is a rendering bug fix.”

- [ ] **Step 5: Push verified work to main**

Run:

```bash
git push origin main
```

Expected: pre-push succeeds and `origin/main` contains the fix. Record CodeScene's approved temporary exception, Codacy evidence, test results, native QA, and the empty demo-vault status in the release handoff.

## Self-review

- Spec coverage: Task 1 preserves Activity hiding while enforcing idempotence and test coverage; Task 2 verifies the real packaged macOS path.
- Placeholder scan: no “TBD”, “TODO”, or deferred implementation steps.
- Type consistency: the plan keeps the hook private and introduces only `syncActivitySectionVisibility(container: HTMLElement): void`.


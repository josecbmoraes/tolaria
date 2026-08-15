# Activity Card Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Activity metadata out of note-list previews and hide the redundant Activity heading in Note view.

**Architecture:** Extend the existing Markdown snippet extractor to skip the first Activity section before collecting preview text. Refine the existing Note-view Activity DOM synchronizer so it hides only the heading block, retaining the rendered record cards and its content-change-only lifecycle.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, BlockNote.

## Global Constraints

- Empty Activity-only notes must have an empty snippet; no replacement copy is shown.
- Timeline behavior and source Markdown remain unchanged.
- No new user-facing copy or analytics event is needed.
- The existing WebKit render-loop regression must remain prevented.

---

### Task 1: Exclude Activity from note-list snippets

**Files:**
- Modify: `src/utils/wikilinks.ts:434-564`
- Test: `src/utils/wikilinks.test.ts`

**Interfaces:**
- Consumes: `extractSnippet(content: MarkdownSource): MarkdownSource`.
- Produces: an empty snippet for Activity-only content and a preview sourced only from non-Activity note content.

- [ ] **Step 1: Write failing snippet tests**

```ts
it('returns an empty snippet for an Activity-only note', () => {
  expect(extractSnippet('# Felipe\n\n## Activity\n\n```line-record\nid: record-1\ntype: update\nText\n```')).toBe('')
})

it('uses ordinary note text after an Activity section', () => {
  expect(extractSnippet('# Felipe\n\n## Activity\n\n```line-record\nid: record-1\ntype: update\n```\n\n## Notes\n\nUseful context.')).toBe('Useful context.')
})
```

- [ ] **Step 2: Run the focused tests to verify red**

Run: `pnpm vitest run src/utils/wikilinks.test.ts`

Expected: the first test exposes `id:`/`type:` metadata or the fallback `Activity` heading in the snippet.

- [ ] **Step 3: Implement section exclusion**

```ts
function contentWithoutActivitySection(content: MarkdownSource): MarkdownSource {
  // Preserve every non-Activity line and remove the first H2 Activity section
  // through the next H2 boundary, using the existing Markdown fence rules.
}

export function extractSnippet(content: MarkdownSource): MarkdownSource {
  const [, body] = splitFrontmatter(content)
  const withoutH1 = removeH1Line(body)
  const withoutActivity = contentWithoutActivitySection(withoutH1)
  // Continue through the existing snippet and fallback pipeline using withoutActivity.
}
```

- [ ] **Step 4: Run focused tests to verify green**

Run: `pnpm vitest run src/utils/wikilinks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/wikilinks.ts src/utils/wikilinks.test.ts
git commit -m "fix: omit activity metadata from note previews"
```

### Task 2: Hide only the Activity heading in Note view

**Files:**
- Modify: `src/components/SingleEditorView.tsx:1267-1306`
- Test: `src/components/SingleEditorView.test.tsx`

**Interfaces:**
- Consumes: rendered `.bn-block` elements and `currentContent` changes.
- Produces: `data-tolaria-hidden-activity` only on the Activity heading block; record blocks remain visible.

- [ ] **Step 1: Write a failing rich-editor rendering test**

```ts
expect(activityHeading).toHaveAttribute('data-tolaria-hidden-activity')
expect(activityRecord).not.toHaveAttribute('data-tolaria-hidden-activity')
expect(nextHeading).not.toHaveAttribute('data-tolaria-hidden-activity')
```

- [ ] **Step 2: Run the focused test to verify red**

Run: `pnpm vitest run src/components/SingleEditorView.test.tsx`

Expected: FAIL because the current synchronizer marks the heading and every block until the next H2.

- [ ] **Step 3: Implement heading-only visibility**

```ts
for (const block of container.querySelectorAll<HTMLElement>('.bn-block')) {
  const heading = block.querySelector<HTMLElement>('[data-content-type="heading"]')
  const isActivityHeading = heading?.dataset.level === '2' && heading.textContent?.trim() === 'Activity'
  if (block.hasAttribute('data-tolaria-hidden-activity') !== isActivityHeading) {
    block.toggleAttribute('data-tolaria-hidden-activity', isActivityHeading)
  }
}
```

- [ ] **Step 4: Run focused tests to verify green**

Run: `pnpm vitest run src/components/SingleEditorView.test.tsx`

Expected: PASS, including the content-change synchronization regression test.

- [ ] **Step 5: Commit**

```bash
git add src/components/SingleEditorView.tsx src/components/SingleEditorView.test.tsx
git commit -m "fix: hide activity heading in note view"
```

### Task 3: Verify the real vault experience

**Files:**
- No production-file changes expected.

- [ ] **Step 1: Run frontend release checks**

```bash
pnpm lint
npx tsc --noEmit
pnpm test
pnpm test:coverage
pnpm l10n:validate
```

- [ ] **Step 2: Run native QA**

Launch `pnpm tauri dev`, open `Pessoas/felipe-goulart.md` in `josecbmoraes`, and verify the left card has no technical preview while Note view renders Activity cards without an `Activity` heading.

- [ ] **Step 3: Commit and push verified work**

```bash
git push origin main
```

## Self-review

- Spec coverage: Task 1 implements empty card previews and Task 2 hides only the Note-view heading; Task 3 verifies both in the real vault.
- Placeholder scan: no deferred work or undefined interfaces.
- Type consistency: existing `MarkdownSource`, `extractSnippet`, and DOM `HTMLElement` interfaces are retained.


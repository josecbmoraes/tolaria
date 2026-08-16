# Tolaria Logo Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Tolaria brand surface with a graphite rounded-square icon containing one line and three vault-colored dots while preserving the existing native recoloring behavior.

**Architecture:** A single SVG at `src-tauri/icons/icon-source.svg` owns the geometry, gradients, transparency, and default-blue recolorable pixels. Renderer, favicon, and website SVGs are byte-identical copies; Tauri's icon generator derives the native platform family in a temporary directory, and the checked-in runtime/theme files receive deterministic copies of those results. No application code, dependency, product copy, analytics, or architecture behavior changes.

**Tech Stack:** SVG 1.1-compatible markup, Tauri CLI icon generator, macOS `sips`, PNG/ICNS/ICO assets, React/Vite, VitePress, Rust/Tauri tests.

## Global Constraints

- Follow the approved design in `docs/superpowers/specs/2026-08-16-tolaria-logo-refresh-design.md`.
- Keep the tile graphite in every theme; use Tolaria default blue for every recolorable source pixel in the line-and-three-dots mark.
- Preserve the existing `src-tauri/src/app_icon.rs` blue-pixel recoloring contract without modifying application code.
- Keep transparent pixels outside the rounded square, and keep every dot distinguishable at 16, 32, 128, 512, and 1024 px.
- Use only one editable vector master. Delete the obsolete `src-tauri/icons/icon-source-dark.svg` after the canonical source replaces it.
- The user approved a CodeScene-only exception on 2026-08-16, expiring 2026-08-19: CodeScene MCP, `cs` CLI, local token, and API credentials were unavailable after retry. Record the exception as unavailable, never as passed. Do not bypass hooks or weaken `.codescene-thresholds`.
- The exception does not cover Codacy, lint, typecheck, tests, coverage, build, localization, native QA, demo-vault hygiene, commit hooks, or direct push to `origin/main`.
- This is pure artwork/asset work, so the repository's TDD exception for visual changes applies. Existing focused tests and builds still protect asset consumption and native recoloring.
- Localization: no UI copy changes. PostHog: no event because there is no new user action. ADRs and architecture docs: none because the asset pipeline and runtime contracts remain unchanged.
- Never modify `demo-vault/` or `demo-vault-v2/` for this task.

## File Map

**Canonical artwork**

- Create: `src-tauri/icons/icon-source.svg` — the only editable vector master.
- Delete: `src-tauri/icons/icon-source-dark.svg` — obsolete alternate vector source, recoverable from Git history.
- Modify: `src/assets/tolaria-icon.svg` — renderer/welcome-screen copy of the master.
- Modify: `public/favicon.svg` — renderer favicon copy of the master.
- Modify: `site/public/tolaria-icon.svg` — documentation-site vector copy of the master.

**Generated web raster assets**

- Modify: `site/public/landing/tolaria-icon.png` — 1024 px navigation/logo raster.
- Modify: `site/public/landing/favicon.png` — 128 px documentation favicon.

**Generated Tauri/native assets**

- Modify: `src-tauri/icons/icon-source.png`, `icon.png`, `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `256x256.png`, `512x512.png`, `512x512-dark.png`, `icon.icns`, and `icon.ico`.
- Modify: every tracked `src-tauri/icons/Square*Logo.png` and `src-tauri/icons/StoreLogo.png`.
- Modify: every tracked `src-tauri/icons/ios/*.png`.

**Verification-only consumers; do not edit**

- `src/components/WelcomeScreen.tsx` and `src/components/WelcomeScreen.test.tsx` — confirm the renderer still imports the canonical copy.
- `src-tauri/src/app_icon.rs` — confirm runtime decoding and vault-color recoloring still pass.
- `src-tauri/tauri.conf.json` and `site/.vitepress/config.ts` — confirm all referenced generated paths remain valid.

---

### Task 1: Establish the Canonical Vector Mark

**Files:**

- Create: `src-tauri/icons/icon-source.svg`
- Delete: `src-tauri/icons/icon-source-dark.svg`
- Modify: `src/assets/tolaria-icon.svg`
- Modify: `public/favicon.svg`
- Modify: `site/public/tolaria-icon.svg`

**Interfaces:**

- Consumes: the existing runtime convention that blue-dominant opaque pixels are recolorable.
- Produces: one 1024 × 1024 transparent SVG whose exact bytes are copied to the three renderer/web SVG consumers and supplied to the Tauri icon generator in Task 2.

- [ ] **Step 1: Confirm a clean implementation baseline and classify the change manifest**

Run:

```bash
git status --short
git diff --name-only --diff-filter=ACMR "$(git merge-base HEAD origin/main)" --
git ls-files --others --exclude-standard
cat .codescene-thresholds
git status --short -- demo-vault demo-vault-v2
```

Expected: only the two approved planning commits are ahead of `origin/main`; no uncommitted files exist; demo vault output is empty; thresholds remain `HOTSPOT_THRESHOLD=10.0` and `AVERAGE_THRESHOLD=9.99`. Record the active CodeScene exception from Global Constraints.

- [ ] **Step 2: Create the exact canonical SVG**

Use `apply_patch` to create `src-tauri/icons/icon-source.svg` with this complete content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="tile" x1="192" y1="136" x2="832" y2="920" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2B2D31"/>
      <stop offset="0.5" stop-color="#1B1D20"/>
      <stop offset="1" stop-color="#101113"/>
    </linearGradient>
    <linearGradient id="edge" x1="512" y1="96" x2="512" y2="928" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.13"/>
      <stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0.025"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="mark" x1="260" y1="472" x2="808" y2="558" gradientUnits="userSpaceOnUse">
      <stop stop-color="#48A9FF"/>
      <stop offset="1" stop-color="#155DFF"/>
    </linearGradient>
    <linearGradient id="shine" x1="512" y1="480" x2="512" y2="525" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="tile-shadow" x="20" y="20" width="984" height="984" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
    <filter id="mark-shadow" x="130" y="430" width="770" height="175" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="line-clip">
      <rect x="174" y="480" width="342" height="64" rx="32"/>
    </clipPath>
  </defs>
  <g filter="url(#tile-shadow)">
    <rect x="96" y="96" width="832" height="832" rx="190" fill="url(#tile)"/>
    <rect x="97" y="97" width="830" height="830" rx="189" stroke="url(#edge)" stroke-width="2"/>
  </g>
  <g filter="url(#mark-shadow)">
    <rect x="174" y="480" width="342" height="64" rx="32" fill="url(#mark)"/>
    <circle cx="610" cy="512" r="32" fill="url(#mark)"/>
    <circle cx="720" cy="512" r="32" fill="url(#mark)"/>
    <circle cx="830" cy="512" r="32" fill="url(#mark)"/>
    <rect x="174" y="480" width="342" height="31" fill="url(#shine)" clip-path="url(#line-clip)"/>
    <ellipse cx="600" cy="500" rx="13" ry="9" fill="#FFFFFF" fill-opacity="0.34"/>
    <ellipse cx="710" cy="500" rx="13" ry="9" fill="#FFFFFF" fill-opacity="0.34"/>
    <ellipse cx="820" cy="500" rx="13" ry="9" fill="#FFFFFF" fill-opacity="0.34"/>
  </g>
</svg>
```

Expected: the SVG contains no text, external resource, embedded bitmap, or background outside the rounded square.

- [ ] **Step 3: Replace every SVG consumer and remove the obsolete source**

Use `apply_patch` to replace the complete content of `src/assets/tolaria-icon.svg`, `public/favicon.svg`, and `site/public/tolaria-icon.svg` with the canonical SVG from Step 2. Use `apply_patch` to delete `src-tauri/icons/icon-source-dark.svg`.

Expected: one editable source remains, and every SVG consumer is byte-identical.

- [ ] **Step 4: Validate XML, geometry, identity, and consumer tests**

Run:

```bash
xmllint --noout src-tauri/icons/icon-source.svg src/assets/tolaria-icon.svg public/favicon.svg site/public/tolaria-icon.svg
cmp src-tauri/icons/icon-source.svg src/assets/tolaria-icon.svg
cmp src-tauri/icons/icon-source.svg public/favicon.svg
cmp src-tauri/icons/icon-source.svg site/public/tolaria-icon.svg
rg -n 'width="1024" height="1024" viewBox="0 0 1024 1024"' src-tauri/icons/icon-source.svg
rg -n '#48A9FF|#155DFF' src-tauri/icons/icon-source.svg
pnpm exec vitest run src/components/WelcomeScreen.test.tsx
git diff --check
```

Expected: XML and `cmp` commands pass; the 1024-square view box and blue mark colors are present; WelcomeScreen tests pass; no whitespace errors.

- [ ] **Step 5: Inspect the source visually at large and small display sizes**

Run:

```bash
vector_preview_dir=$(mktemp -d /tmp/tolaria-vector-preview.XXXXXX)
pnpm tauri icon src-tauri/icons/icon-source.svg --output "$vector_preview_dir"
sips -z 16 16 "$vector_preview_dir/icon.png" --out "$vector_preview_dir/icon-16.png"
```

Open `$vector_preview_dir/ios/AppIcon-512@2x.png`, `$vector_preview_dir/32x32.png`, and `$vector_preview_dir/icon-16.png` with the local image viewer. Expected: the tile is optically centered, no shadow is clipped, the line and all three dots remain distinguishable, and transparent exterior corners remain transparent. If any check fails, adjust only the SVG geometry/effects and repeat Steps 4–5.

- [ ] **Step 6: Rebuild the Codacy manifest and record that no scorable code is present**

Run:

```bash
git diff --name-only --diff-filter=ACMR "$(git merge-base HEAD origin/main)" --
git ls-files --others --exclude-standard
```

Expected: the implementation paths are SVG assets only; the two docs files are non-executable Markdown. Record “Codacy local file scan: not applicable; manifest contains no code, test, script, or executable configuration file.” If any code-like path appears, stop and perform the full per-file Codacy baseline/parity workflow before continuing.

- [ ] **Step 7: Commit the canonical artwork**

Run:

```bash
git add src-tauri/icons/icon-source.svg src-tauri/icons/icon-source-dark.svg src/assets/tolaria-icon.svg public/favicon.svg site/public/tolaria-icon.svg
git diff --cached --check
git commit -m "feat: refresh Tolaria logo artwork"
```

Expected: the normal pre-commit hook passes. Do not use `--no-verify`. Record CodeScene as unavailable under the approved exception.

---

### Task 2: Regenerate Every Raster and Native Platform Asset

**Files:**

- Modify: all generated web raster and native files listed in File Map.

**Interfaces:**

- Consumes: `src-tauri/icons/icon-source.svg` from Task 1 and the Tauri CLI's default icon output tree.
- Produces: all checked-in PNG, ICNS, and ICO consumers while preserving the existing filenames required by Tauri, VitePress, and `app_icon.rs`.

- [ ] **Step 1: Generate a complete icon family outside the repository**

Run:

```bash
generated_icon_dir=$(mktemp -d /tmp/tolaria-icons.XXXXXX)
pnpm tauri icon src-tauri/icons/icon-source.svg --output "$generated_icon_dir"
find "$generated_icon_dir" -type f | sort
```

Expected: Tauri reports Appx, ICNS, ICO, PNG, iOS, and Android generation without errors. The temporary output contains `icon.png`, `icon.icns`, `icon.ico`, the expected Windows tile set, and the expected iOS set. Android outputs are not copied because Android is not a configured target in `src-tauri/tauri.conf.json`.

- [ ] **Step 2: Copy the Tauri-managed native family into tracked locations**

Run in the same shell that owns `$generated_icon_dir`:

```bash
cp "$generated_icon_dir/32x32.png" src-tauri/icons/32x32.png
cp "$generated_icon_dir/64x64.png" src-tauri/icons/64x64.png
cp "$generated_icon_dir/128x128.png" src-tauri/icons/128x128.png
cp "$generated_icon_dir/128x128@2x.png" src-tauri/icons/128x128@2x.png
cp "$generated_icon_dir/128x128@2x.png" src-tauri/icons/256x256.png
cp "$generated_icon_dir/icon.png" src-tauri/icons/icon.png
cp "$generated_icon_dir/icon.png" src-tauri/icons/512x512.png
cp "$generated_icon_dir/icon.png" src-tauri/icons/512x512-dark.png
cp "$generated_icon_dir/ios/AppIcon-512@2x.png" src-tauri/icons/icon-source.png
cp "$generated_icon_dir/icon.icns" src-tauri/icons/icon.icns
cp "$generated_icon_dir/icon.ico" src-tauri/icons/icon.ico
cp "$generated_icon_dir"/Square*Logo.png src-tauri/icons/
cp "$generated_icon_dir/StoreLogo.png" src-tauri/icons/StoreLogo.png
cp "$generated_icon_dir"/ios/*.png src-tauri/icons/ios/
```

Expected: the light and dark runtime PNGs are deliberately identical graphite-base images; theme switching keeps its binary interface while vault recoloring changes only the blue mark.

- [ ] **Step 3: Copy deterministic web raster sizes**

Run in the same shell:

```bash
cp "$generated_icon_dir/ios/AppIcon-512@2x.png" site/public/landing/tolaria-icon.png
cp "$generated_icon_dir/128x128.png" site/public/landing/favicon.png
```

Expected: website navigation/logo uses 1024 px; the VitePress favicon uses 128 px.

- [ ] **Step 4: Verify dimensions, transparency, theme identity, and generated-file coverage**

Run:

```bash
file src-tauri/icons/*.png src-tauri/icons/icon.icns src-tauri/icons/icon.ico src-tauri/icons/ios/*.png site/public/landing/tolaria-icon.png site/public/landing/favicon.png
cmp src-tauri/icons/512x512.png src-tauri/icons/512x512-dark.png
python3 - <<'PY'
from pathlib import Path
from PIL import Image

expected = {
    Path("src-tauri/icons/icon-source.png"): (1024, 1024),
    Path("src-tauri/icons/icon.png"): (512, 512),
    Path("src-tauri/icons/512x512.png"): (512, 512),
    Path("src-tauri/icons/512x512-dark.png"): (512, 512),
    Path("src-tauri/icons/256x256.png"): (256, 256),
    Path("src-tauri/icons/128x128.png"): (128, 128),
    Path("src-tauri/icons/64x64.png"): (64, 64),
    Path("src-tauri/icons/32x32.png"): (32, 32),
    Path("site/public/landing/tolaria-icon.png"): (1024, 1024),
    Path("site/public/landing/favicon.png"): (128, 128),
}
for path, size in expected.items():
    image = Image.open(path)
    assert image.size == size, (path, image.size, size)
    assert image.mode == "RGBA", (path, image.mode)
    assert image.getpixel((0, 0))[3] == 0, (path, "exterior corner is not transparent")
print(f"validated {len(expected)} representative PNG assets")
PY
git status --short
git diff --stat
```

Expected: all representative dimensions and alpha assertions pass; no unexpected Android or temporary paths are present in Git status; all tracked native families appear modified.

- [ ] **Step 5: Visually compare representative native and web outputs**

Open these files with the local image viewer:

```text
src-tauri/icons/icon-source.png
src-tauri/icons/512x512.png
src-tauri/icons/128x128.png
src-tauri/icons/32x32.png
site/public/landing/tolaria-icon.png
site/public/landing/favicon.png
```

Expected: all use identical geometry; line/dots are horizontally aligned; dots remain separate; tile corners and shadow are not clipped; no old droplet/tree appears.

- [ ] **Step 6: Run focused consumers before the asset commit**

Run:

```bash
pnpm exec vitest run src/components/WelcomeScreen.test.tsx src/lib/appIconTheme.test.ts
cargo test app_icon --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm docs:build
git diff --check
```

Expected: focused frontend and Rust tests pass; renderer and VitePress builds pass; generated assets decode and bundle successfully.

- [ ] **Step 7: Rebuild the Codacy manifest and commit the generated family**

Run:

```bash
git diff --name-only --diff-filter=ACMR "$(git merge-base HEAD origin/main)" --
git ls-files --others --exclude-standard
git add src-tauri/icons site/public/landing/tolaria-icon.png site/public/landing/favicon.png
git diff --cached --check
git commit -m "feat: regenerate Tolaria app icons"
```

Expected: the implementation manifest contains binary/image assets but no code, test, script, or executable configuration files; Codacy per-file scanning remains not applicable. The normal hook passes without bypass. Record CodeScene as unavailable under the approved exception.

---

### Task 3: Release Verification, Native QA, and Direct-to-Main Push

**Files:**

- Verify only: all files committed in Tasks 1–2.
- Modify only if a verification defect is found: the canonical SVG and its derived assets; repeat the affected task and commit a focused fix.

**Interfaces:**

- Consumes: completed vector and native asset commits.
- Produces: release-readiness evidence, native screenshots, a verified `origin/main` push, and post-push dashboard status.

- [ ] **Step 1: Run repository-wide non-coverage gates**

Run:

```bash
pnpm lint
npx tsc --noEmit
pnpm test
pnpm l10n:validate
cargo test --manifest-path src-tauri/Cargo.toml
pnpm build
pnpm docs:build
```

Expected: every command exits zero. Localization evidence reads “no UI copy changes; optional Lara was not used.”

- [ ] **Step 2: Run both mandatory coverage gates**

Run:

```bash
pnpm test:coverage
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

Expected: frontend coverage is at least 70%; Rust line coverage is at least 85%; both commands exit zero.

- [ ] **Step 3: Run the local Codacy safety net and verify the final manifest classification**

Run:

```bash
pnpm codacy:gate
git diff --name-only --diff-filter=ACMR "$(git merge-base HEAD origin/main)" --
git ls-files --others --exclude-standard
```

Expected: the gate exits zero and the final manifest contains docs and image assets only. Record local Codacy findings as `0 Critical + 0 High + 0 Medium + 0 Minor + 0 Info + 0 unclassified` for new/changed code because there is no changed code. If Codacy reports any executable path or analyzer failure, stop and perform the repository's fail-closed per-file workflow.

- [ ] **Step 4: Launch the native application and capture mouse-first visual QA**

Run:

```bash
pnpm tauri dev
```

In a second shell after the app is ready:

```bash
bash ~/.openclaw/skills/tolaria-qa/scripts/focus-app.sh Tolaria
bash ~/.openclaw/skills/tolaria-qa/scripts/screenshot.sh /tmp/tolaria-logo-native.png
```

Use Computer Use if available to open the welcome surface or another in-app brand surface with the mouse, then inspect `/tmp/tolaria-logo-native.png`. Expected: the Dock/app/window icon and renderer branding show the graphite tile and line-plus-three-dots mark; no old droplet/tree remains; the app is usable. This task changes no keyboard behavior, so record “keyboard QA: not applicable.”

- [ ] **Step 5: Verify per-vault accent recoloring in at least two colors**

Using the normal vault switcher UI, select two existing demo-vault registrations with different accent colors, or temporarily change only installation-local vault color settings through the app UI. Capture `/tmp/tolaria-logo-accent-a.png` and `/tmp/tolaria-logo-accent-b.png`, then restore the original installation-local selection.

Expected: graphite tile remains unchanged; line and three dots change together to each vault accent; highlights stay coherent; no vault Markdown is modified. If recoloring fails, stop before editing `src-tauri/src/app_icon.rs`; treat a code change as expanded scope requiring CodeScene/Codacy baselines and repository-owner direction.

- [ ] **Step 6: Confirm repository and fixture cleanliness before push**

Run:

```bash
git status --short
git status --short -- demo-vault demo-vault-v2
git log -4 --oneline --decorate
git diff origin/main...HEAD --check
git diff --name-status origin/main...HEAD
```

Expected: working tree and demo-vault output are empty; history contains the spec, plan, vector, and generated-asset commits only; the name-status list matches File Map.

- [ ] **Step 7: Record the CodeScene pre-push state under the approved exception**

Confirm once more that no CodeScene MCP tool, `cs` CLI, local token, or `CODESCENE_PAT`/`CODESCENE_PROJECT_ID` pair is available. Expected record: file-level before/after, pre-commit safeguard, `origin/main` change-set analysis, Hotspot, and Average checks were unavailable and did not pass; the repository owner approved the task-scoped exception on 2026-08-16 through 2026-08-19. Thresholds were not lowered.

- [ ] **Step 8: Push the verified commits directly to main**

Run:

```bash
git push origin main
```

Expected: the full pre-push hook and push succeed without `--no-verify`. If the hook fails, fix the defect, repeat all affected checks, commit normally, and push again.

- [ ] **Step 9: Verify exact-SHA Codacy dashboard analysis after push**

Capture:

```bash
pushed_sha=$(git rev-parse HEAD)
printf '%s\n' "$pushed_sha"
```

Use the Codacy dashboard MCP to wait until `gh/refactoringhq/tolaria` reports `$pushed_sha` as `lastAnalysedCommit`, re-read the enabled analyzer roster, paginate repository issues to completion, and filter every manifest path.

Expected: the exact pushed SHA is analyzed, analyzer roster has no problem, and all changed docs/assets have no applicable code findings. If the Codacy dashboard MCP remains unavailable after one retry, stop: the existing CodeScene exception does not cover Codacy, so obtain a separate explicit repository-owner exception before declaring the task complete.

- [ ] **Step 10: Produce the final release-readiness record**

Include implementation/UX summary; focused and full QA; native screenshot paths; frontend and Rust coverage percentages; CodeScene exception evidence; local and dashboard Codacy evidence; localization; PostHog reason; refactoring; ADRs; docs; demo-vault cleanliness; commit SHAs; and confirmed `origin/main` push. Explicitly state that the deleted dark SVG is recoverable from Git history and was replaced by the canonical source.

# Line App Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the installed Tolaria application with a production build named Line while preserving the application's existing data identity.

**Architecture:** Update only the Tauri presentation names in the distribution configuration. The bundle identifier remains `club.refactoring.tolaria`, preserving the macOS application-data location and existing vault registration. Build the resulting `Line.app`, move the specifically identified old application to Trash, and install the new bundle into `/Applications`.

**Tech Stack:** Tauri 2, macOS application bundle and DMG packaging.

## Global Constraints

- Keep `identifier` as `club.refactoring.tolaria`.
- Do not modify vault Markdown, preferences, or git repositories.
- Only `/Applications/Tolaria.app` may be removed, using macOS Trash rather than permanent deletion.
- The absent updater private key may prevent updater-artifact signing, but not creation of `Line.app` or its DMG.
- The existing temporary CodeScene exception remains in effect through 2026-08-18.

---

### Task 1: Configure the distributed application name

**Files:**
- Modify: `src-tauri/tauri.conf.json:3,17`

**Interfaces:**
- Consumes: Tauri configuration fields `productName` and `app.windows[0].title`.
- Produces: macOS bundle `Line.app` and the visible window title `Line`.

- [ ] **Step 1: Capture the pre-change identity fields**

Run:

```bash
rg -n 'productName|identifier|"title"' src-tauri/tauri.conf.json
```

Expected: product and title are `Tolaria`; identifier is `club.refactoring.tolaria`.

- [ ] **Step 2: Update only presentation names**

```json
"productName": "Line"
```

```json
"title": "Line"
```

Leave this field unchanged:

```json
"identifier": "club.refactoring.tolaria"
```

- [ ] **Step 3: Validate the configuration and production frontend**

Run:

```bash
npx tsc --noEmit && pnpm build
```

Expected: both commands exit 0.

- [ ] **Step 4: Commit the configuration**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: rename app to Line"
```

### Task 2: Build and install Line safely

**Files:**
- Generates: `src-tauri/target/release/bundle/macos/Line.app`
- Generates: `src-tauri/target/release/bundle/dmg/Line_0.1.0_aarch64.dmg`
- Replaces: `/Applications/Tolaria.app` with `/Applications/Line.app`

**Interfaces:**
- Consumes: the Tauri configuration from Task 1 and the existing `/Applications/Tolaria.app` path.
- Produces: an installed `/Applications/Line.app` using the same internal identifier and user data.

- [ ] **Step 1: Build the production application**

Run:

```bash
pnpm tauri build
```

Expected: `Line.app` and `Line_0.1.0_aarch64.dmg` are created. If the command reports only missing `TAURI_SIGNING_PRIVATE_KEY` after producing these two artifacts, record that updater signing is unavailable.

- [ ] **Step 2: Verify generated artifact names and identity**

Run:

```bash
test -d src-tauri/target/release/bundle/macos/Line.app
test -f src-tauri/target/release/bundle/dmg/Line_0.1.0_aarch64.dmg
plutil -p src-tauri/target/release/bundle/macos/Line.app/Contents/Info.plist | rg 'CFBundleDisplayName|CFBundleIdentifier'
```

Expected: `Line` is the display name and `club.refactoring.tolaria` is still the bundle identifier.

- [ ] **Step 3: Replace only the old application**

Run:

```bash
test -d /Applications/Tolaria.app
mv /Applications/Tolaria.app ~/.Trash/Tolaria.app
cp -R src-tauri/target/release/bundle/macos/Line.app /Applications/Line.app
```

Expected: the old app is recoverable in Trash and the new app is installed.

- [ ] **Step 4: Verify the installed app**

Run:

```bash
test ! -e /Applications/Tolaria.app
test -d /Applications/Line.app
plutil -p /Applications/Line.app/Contents/Info.plist | rg 'CFBundleDisplayName|CFBundleIdentifier'
open -a /Applications/Line.app
```

Expected: `Line.app` exists and starts with the unchanged identifier.

## Self-review

- Spec coverage: Task 1 changes the displayed name while preserving identity; Task 2 creates named artifacts and performs a recoverable replacement limited to the exact application path.
- Placeholder scan: no deferred behavior, undefined target, or unspecified validation.
- Type consistency: the same exact identifier is captured, preserved, and verified across both tasks.

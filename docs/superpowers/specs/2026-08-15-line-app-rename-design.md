# Line App Rename Design

## Goal

Replace the installed `Tolaria.app` with a production build displayed as `Line.app`, without changing the application's bundle identifier, vault location, or stored preferences.

## Scope

- Change the Tauri product name and macOS window title from `Tolaria` to `Line`.
- Build a signed-local distribution artifact named `Line_0.1.0_aarch64.dmg` (updater signing remains separately configured).
- Move only `/Applications/Tolaria.app` to the macOS Trash, then install `/Applications/Line.app` from the newly built app bundle.

## Preservation Rules

- Keep the existing macOS bundle identifier unchanged so the new app continues using the same app data and vault registration.
- Do not alter vault Markdown files, preferences, or git repositories.
- If the current application is not present, continue with installation; do not delete any other application.

## Verification

- Confirm `/Applications/Tolaria.app` is absent and `/Applications/Line.app` exists.
- Confirm the generated DMG has the `Line` filename.
- Launch `Line.app` and confirm its process starts; report any native-window issue explicitly.

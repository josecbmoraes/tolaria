# Tolaria Logo Refresh Design

## Goal

Replace Tolaria's current droplet/tree logo with a distinctive geometric mark inspired by the provided reference: a graphite rounded-square tile containing one horizontal line followed by three dots. Preserve Tolaria's per-vault color identity by tinting the central mark while keeping the tile graphite.

## Visual Direction

- Use a generously rounded square with transparent exterior corners so the icon reads correctly on macOS, Windows, iOS, the web, and inside the app.
- Keep the tile graphite in every theme. Light and dark variants may adjust graphite brightness, edge lighting, and shadow strength without changing the underlying identity.
- Center a horizontal capsule and three circular dots on one optical baseline.
- Render the mark in Tolaria's default blue in the source artwork. The existing native recoloring pipeline may replace that blue with the active vault color.
- Use restrained gradients, highlights, and shadows to suggest the soft dimensional finish of the reference. Avoid photorealistic texture, noise, text, extra symbols, and ornamental detail.
- Preserve generous internal padding so the mark remains calm and recognizable in the macOS Dock.

## Responsive Asset System

Create one deterministic vector master and derive the complete checked-in asset family from it.

- Large assets retain the subtle tile gradient, edge highlight, mark highlight, and soft shadow.
- Small assets simplify effects while preserving the exact silhouette and spacing. At favicon and system-tray sizes, legibility takes priority over material detail.
- The horizontal capsule and all three dots remain visually balanced after rasterization; no dot may disappear or merge at the smallest required size.
- SVG consumers use the same geometry as native raster assets so the website, renderer, installer, and operating-system icons show one identity.

## Integration Scope

Update all canonical Tolaria brand assets and regenerate their derived formats:

- renderer logo and web favicon;
- website and landing-page logo assets;
- Tauri light/dark sources and PNG sizes;
- macOS `.icns`, Windows `.ico`, Microsoft Store tiles, and iOS app-icon sizes.

Keep the current per-vault icon recoloring behavior. The new source mark must remain compatible with the existing blue-pixel detection so no application-code change is necessary unless verification proves the pipeline cannot recolor the mark correctly.

## Verification

- Compare the vector master and representative 1024, 512, 128, 32, and 16 px outputs for centering, padding, clipped shadows, and recognizable dots.
- Verify light and dark native icon variants and at least two vault accent colors.
- Build the frontend and the native app to confirm every referenced asset exists and decodes successfully.
- Launch the native app, inspect the Dock/window icon, and capture a screenshot.
- Confirm the renderer favicon and website logo use the same geometry.
- Confirm `git status --short -- demo-vault demo-vault-v2` is empty.

## Product and Architecture Impact

- Localization: no user-facing copy changes.
- PostHog: no event is needed because the change introduces no user action or behavior.
- ADRs: none; this changes brand artwork without adding a dependency, storage strategy, platform target, core abstraction, or cross-cutting pattern.
- Architecture documentation: no change is expected because the asset pipeline and runtime behavior remain intact.

## Acceptance Criteria

The refresh is complete when every Tolaria surface uses the new line-and-three-dots mark, the native icon still follows vault accent colors, small formats remain legible, all required quality gates pass, the release-readiness evidence is recorded, and the verified commit is pushed directly to `origin/main`.

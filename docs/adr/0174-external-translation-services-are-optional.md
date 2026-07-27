---
type: ADR
id: "0174"
title: "External translation services are optional"
status: active
date: 2026-07-26
supersedes:
  - "0087"
---

## Context

ADR-0087 established versioned JSON catalogs and Lara CLI synchronization. Requiring an external translation request during delivery makes otherwise local builds and releases depend on credentials, account quota, network access, and third-party availability. The checked-in catalogs and Tolaria's app-owned runtime already provide the deterministic inputs needed to validate localization structure without that operational dependency.

## Decision

- `src/lib/locales/en.json` remains the canonical source catalog.
- Every checked-in locale must contain the same flat string keyset as English.
- `pnpm l10n:validate` is the mandatory, fail-closed localization gate for build, commit, CI, and release readiness.
- Lara CLI and any future external translation service are optional authoring aids. Their credentials, quota, network access, availability, and output are never release gates.
- A reviewed translation should be used when available. Otherwise, the English source text is copied temporarily into the affected locale so catalog structure remains complete without inventing a translation.
- Existing locales and unrelated keys are preserved. Optional translation output is reviewed and committed like any other source change.

## Consequences

- Builds and releases remain reproducible from the repository without translation-service access.
- Missing or exhausted external credentials cannot block unrelated engineering work.
- Structural completeness remains enforced locally, while translation quality can improve incrementally through reviewed follow-up changes.
- `pnpm l10n:translate` and `pnpm l10n:translate:force` remain available for maintainers who choose to use Lara.

## Alternatives considered

- **Keep Lara mandatory:** rejected because a third-party quota or outage can block delivery without changing application correctness.
- **Allow missing locale keys:** rejected because structural drift is deterministic and locally preventable with `pnpm l10n:validate`.
- **Invent local translations to satisfy structure:** rejected because unreviewed translated copy can be less trustworthy than an explicit temporary English fallback.

# ADR 0173: Scoped durable Activity records

- Status: Accepted
- Date: 2026-07-26

## Context

Tolaria notes need chronological Activity updates that remain visible but read-only in the rich editor, stay fully editable in RAW, and survive Note/RAW/Timeline round-trips without changing untouched source. Records are valid only below the first fence-aware `## Activity` section; an identical fence elsewhere is ordinary Markdown.

BlockNote's built-in embeds model URL- or file-backed media. They do not provide a caller-owned, section-scoped Markdown parser or a byte-preserving serializer for local structured metadata. Tolaria already has a durable custom-block pipeline for Mermaid, tldraw, and HTML.

## Decision

Represent each closed `line-record` fence inside `## Activity` as a custom `lineRecordBlock` with `content: none`. Its props carry parsed display fields and the exact fenced `source`. Activity preprocessing is scoped before the generic durable codecs run; injection and serialization reuse the common durable-block pipeline.

Unknown outer fences are opaque to the generic durable scanner. This keeps `line-record` fences outside Activity—and any recognized-looking fences inside them—ordinary and unchanged.

Timeline mutations target parsed source spans in the original Markdown and enter the existing editor save coordinator. They do not write files independently or change `VaultEntry` or the Rust scanner.

## Consequences

- Untouched Activity record source, including fence style, whitespace, field order, and line endings, serializes exactly.
- Malformed closed records can become visible warning blocks without being normalized or deleted.
- Unknown record types remain durable and read-only until a future increment supports them.
- Timeline ordering is derived presentation state and cannot reorder Markdown.
- The custom block and section-aware parser are Tolaria-owned code that require focused round-trip tests.

## Rejected alternative

Using a built-in BlockNote embed was rejected because adapting its media semantics would still require replacing its props, parser, renderer, and Markdown serialization, while providing no section scoping or byte-preservation advantage.

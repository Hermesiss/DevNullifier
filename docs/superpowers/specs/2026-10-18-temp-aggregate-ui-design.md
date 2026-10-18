# TEMP aggregate UI — design

Date: 2026-10-18  
Status: approved (approach A; implement without further Q&A)

## Problem

`user-temp` uses `discoverChildren`, so every top-level TEMP entry becomes a Part. Hundreds of random names blow up the System results table.

## Decision

One table row for User TEMP (count + total size). Optional Details dialog for per-entry control. Never delete the TEMP root; only child paths stay on the allowlist/delete path.

## Data

- Scan unchanged: each child sized and allowlisted individually.
- Before IPC return / `system-cache-found` for TEMP: collapse children of `user-temp` into one `ToolCacheItem`:
  - `aggregated: true`
  - `children: { path, label, size }[]`
  - `size` = sum of children
  - `path` / `parentPath` = temp root (display only; not selectable for delete)
- Live `system-cache-found` events: do not stream individual TEMP children; emit the collapsed row once at end (or omit TEMP from stream and rely on final payload). Non-TEMP items keep streaming.

## UI

- Parts column: checkbox (all / none / indeterminate), `N entries · size`, button Details.
- Details dialog: table sorted by size desc, search by name/path, Select all / Deselect, pagination (~50). Closing keeps selection.
- ControlPanel Select all: expands aggregates to all child paths.
- Delete: only selected child paths (existing `delete-folders`).

## Out of scope

Changing TEMP discovery rules, Windows Temp, auto age filters beyond existing cleaner rules.

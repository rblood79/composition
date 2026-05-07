# Pencil Compatibility Notes

This directory is a clean-room compatibility dossier for the locally installed
Pencil desktop app. It is intentionally not a source-code copy, decompile, or
reconstruction of Pencil.

## Boundary

- Do not store extracted Pencil source, minified bundles, or large verbatim
  `.pen` payloads here.
- Store observed behavior, schema contracts, and Composition implementation
  mapping only.
- Use synthetic fixtures for tests and examples.
- When checking the installed app again, record the app version and the exact
  observed behavior instead of copying implementation code.

## Local App Snapshot

Observed local install:

| Field                       | Value                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| App path                    | `/Applications/Pencil.app`                                         |
| Bundle identifier           | `dev.pencil.desktop`                                               |
| Version                     | `1.1.53`                                                           |
| App archive                 | `/Applications/Pencil.app/Contents/Resources/app.asar`             |
| Last local recheck          | 2026-05-01                                                         |
| Measured `app.asar` SHA-256 | `ba0c429743018e820b39d4672e8eb0f9d95312a1549fc2a44476ea76ca600d90` |

GUI automation has not been completed. An earlier attempt failed with macOS
Apple Event authorization error `-10000`; the 2026-05-01 recheck attempted
Computer Use again, but Accessibility/Screen Recording permissions remained
pending. The current notes therefore rely on installed bundle metadata, bundled
`.pen` documents, and static behavior signatures.

## Files

| File                                                                   | Purpose                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [slot-model.md](slot-model.md)                                         | Slot and descendants behavior contract.                                   |
| [ui-ux-analysis.md](ui-ux-analysis.md)                                 | Editor UX, panels, tools, component archetypes, and interaction patterns. |
| [drag-drop-analysis.md](drag-drop-analysis.md)                         | Current installed-app analysis of object move drag/drop behavior.         |
| [format-model.md](format-model.md)                                     | `.pen` document format model and node/property taxonomy.                  |
| [format-ui-associations.md](format-ui-associations.md)                 | How file-format fields drive visible UI/UX behavior.                      |
| [composition-mapping.md](composition-mapping.md)                       | Current Composition parity mapping.                                       |
| [observations.md](observations.md)                                     | Local Pencil app observations and evidence summary.                       |
| [fixtures/slot-fill.synthetic.json](fixtures/slot-fill.synthetic.json) | Non-Pencil synthetic fixture for tests.                                   |

## Current Verdict

For slot insertion, Composition should match Pencil's split model:

1. `slot` is a recommendation/allow-list on a frame-like reusable node.
2. Actual slot fill content is stored on the instance under
   `descendants[slotId].children`.
3. Adding a recommended component to a slot appends a new child instance.
4. Repeating the same recommended component is valid; it creates distinct
   child nodes with the same `ref`.
5. The recommendation list itself should remain set-like and should not need
   duplicate entries.

## Broader Compatibility Priority

Beyond slots, the Pencil behavior worth matching first is:

1. File format as source of truth: node tree + refs + descendants + variables.
2. Direct canvas editing with selection handles, zoom-aware overlays, transient
   drag updates, double-click group entry, `Cmd/Ctrl + click` direct nested
   selection, `Shift + click` multi-selection, and deferred undo/history commit.
3. Component instance semantics: master refs, instance overrides, and guarded
   descendant editing.
4. Dense workbench chrome: left tabs for Layers/Slides/Components/Libraries,
   inspector controls for geometry/style/component metadata, and bottom/right
   task surfaces only when needed.
5. Design-system libraries represented as reusable frame/ref graphs, not as a
   separate opaque component registry.

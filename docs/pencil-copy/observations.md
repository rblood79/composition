# Local Pencil Observations

## Method

The installed app was checked locally from `/Applications/Pencil.app`.
`Info.plist` identified the app as `Pencil`, bundle identifier
`dev.pencil.desktop`, version `1.1.53`.

The app archive at `Contents/Resources/app.asar` contained bundled `.pen`
documents and an editor bundle. The analysis used targeted extraction of
document/schema evidence and static behavior signatures. No extracted source
code is stored in this directory.

## Bundled `.pen` Summary

The bundled documents use `.pen` schema versions `2.6` and `2.8`. The samples
include slot-bearing libraries and examples with reusable components,
component refs, and descendant overrides.

Observed aggregate facts:

| Fact                                             | Observation                                                     |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Slot-bearing bundled documents                   | Present across Halo, Lunaris, Nitro, Shadcn, and welcome files. |
| Slot hosts per library/sample                    | Commonly 11 slot hosts in the checked bundled documents.        |
| Empty slots                                      | Present.                                                        |
| Non-empty slots                                  | Present.                                                        |
| Duplicate entries inside `slot` arrays           | Not observed in bundled samples.                                |
| `descendants[*].children` with multiple children | Observed.                                                       |
| Multiple refs under one slot fill                | Observed.                                                       |
| Same `ref` repeated under one slot fill          | Observed in welcome documents.                                  |

Observed node corpus summary:

| Metric                 | Observation                                                     |
| ---------------------- | --------------------------------------------------------------- |
| Checked `.pen` files   | 12 bundled documents/libraries.                                 |
| Total observed nodes   | 6068 nodes, including nested descendants.                       |
| Dominant node types    | `frame`, `text`, `ref`.                                         |
| Component markers      | 958 reusable nodes and 878 ref nodes.                           |
| Instance override maps | 692 nodes with `descendants`.                                   |
| Slot hosts             | 110 frame nodes with `slot`.                                    |
| Top-level keys         | `version`, `children`, optional `themes`, optional `variables`. |

Frame/layout observations:

| Metric                            | Observation                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Total frame nodes                 | 2586                                                                               |
| Frames with children              | 2431                                                                               |
| Explicit `layout: "vertical"`     | 828                                                                                |
| Explicit `layout: "none"`         | 311                                                                                |
| Omitted layout/default horizontal | 1447                                                                               |
| Frames with flex-like fields      | 1991 frames used at least one of `gap`, `padding`, `alignItems`, `justifyContent`. |

The installed app's behavior signatures map `layout: "horizontal"` to a
horizontal layout direction, `layout: "vertical"` to vertical direction, and
`layout: "none"` to no auto-layout. Frame defaults initialize as horizontal
fit-content containers, so a missing `layout` field on a frame should be read
as default row-like auto-layout, not as a plain inert group.

Observed design-system archetype clusters:

| Cluster           | Signal                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Forms             | Button, input, textarea, select, combobox, checkbox, radio, switch, OTP input, search box. |
| Navigation        | Sidebar, breadcrumb, tabs, pagination, dropdown/menu.                                      |
| Data display      | Card, table, data table, list item, badge, labels.                                         |
| Overlay/feedback  | Dialog, modal, tooltip, alert, progress.                                                   |
| Visual primitives | Icon, avatar, path/vector, divider, marker.                                                |

## High-Signal Slot Cases

Observed examples from bundled Pencil data:

- A page-number slot defines multiple recommendations while previous/next
  button refs nearby use `descendants` for instance-local overrides.
- A sidebar-content slot defines three recommendations, while an instance fills
  that slot with five child refs and repeats one of the recommended refs three
  times.
- A data-table-content slot defines one recommendation, while an instance fills
  that slot with five child refs all pointing to the same recommended ref.

These cases establish that Pencil does not interpret a slot recommendation as
"insert at most once". A recommendation is a candidate source. The actual fill
array can contain repeated child instances.

## Static Behavior Signatures

The installed editor bundle contains behavior signatures consistent with the
data model:

- Frame nodes expose slot state separately from child nodes.
- A frame can be a slot when it belongs to reusable ancestry.
- Slot instances are allowed to accept inserted children even where ordinary
  component instance descendants are guarded.
- The component/slot panel computes available components from the slot
  recommendation list and creates new instances from selected reusable
  components.

These signatures support the same conclusion as the `.pen` data: slot fill is
append-oriented and instance-local.

## Drag And Drop Object Move Recheck

The installed Pencil `1.1.53` app was rechecked from
`/Applications/Pencil.app/Contents/Resources/app.asar` on 2026-05-01. The
current archive's measured SHA-256 was
`ba0c429743018e820b39d4672e8eb0f9d95312a1549fc2a44476ea76ca600d90`.

The editor bundle contains current drag-session signals including
`deferredDropNode`, `deferredDropChildIndex`, `findInsertionIndexInLayout`,
`findDropFrame`, `changeParent`, `animateLayoutChange`, `animateVisualOffset`,
and `renderOnTop`.

The important correction is that object movement is not a simple "no scenegraph
mutation until drop" model. Pencil appears to use transient scenegraph updates
with non-undoable blocks during drag feedback, then collapses the completed
drag into one undoable user action. Layout cross-container drops still use a
deferred target/index before finalization. See
[drag-drop-analysis.md](drag-drop-analysis.md).

## UI/UX Signatures

The installed app and extracted behavior signatures point to a canvas-first
editor with:

- Left sidebar tabs for Layers, Slides, Components, Libraries, and optionally
  Agent.
- Canvas object movement with transient drag feedback, layout insertion index,
  cross-container target search, and one user-level undo/history intent.
- Layer tree selection sync, inline rename, drag reorder, and visibility
  toggles.
- Camera/zoom controls with zoom-to-bounds and zoom-aware overlay sizing.
- Component actions for create, detach, go-to-master, slot enablement, and
  context editing.
- Toast-style feedback for export/error/loading states.
- Preferences for pixel grid, frame names, scroll-wheel zoom, zoom inversion,
  and sidebar behavior.

## Composition Selection Parity Notes

Composition now records the corresponding canvas selection behavior as:

- Double-click enters a group/container context and immediately selects the hit
  child element when one exists under the pointer.
- `Cmd/Ctrl + click` is used for direct nested element selection through the
  current group boundary.
- `Shift + click` is used for add/remove multi-selection, keeping `Cmd/Ctrl`
  available for direct nested selection.
- Cross-page direct selection updates page, editing context, and selected
  element in the same selection commit.

## Limitation

GUI automation was not completed because the local Computer Use bridge was not
available for direct interaction. The 2026-05-01 recheck attempted Computer Use
again, but Accessibility/Screen Recording permissions remained pending. The
current evidence is therefore based on local app metadata, bundled documents,
and static behavior signatures.

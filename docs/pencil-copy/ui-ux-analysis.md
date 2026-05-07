# Pencil UI/UX Analysis

This document summarizes observed Pencil desktop UI/UX behavior without copying
Pencil source code.

## Workbench Model

Pencil is organized as a dense editor, not a marketing-style app shell.

| Area          | Observed role                                                                                          | Composition implication                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Canvas        | Primary editing surface for drawing, selecting, dragging, resizing, zooming, and arranging nodes.      | Keep canvas-first workflows; avoid forcing edits through inspector-only flows. |
| Left sidebar  | Tabbed navigator for document structure and assets.                                                    | Layers, Slides, Components, and Libraries should remain quick-switchable.      |
| Inspector     | Selection-specific controls for component status, slot metadata, context, geometry, style, and export. | Inspector sections should be contextual and compact.                           |
| Toasts        | Low-friction feedback for save/export/error/promise states.                                            | Prefer non-blocking feedback for successful or recoverable actions.            |
| Tool controls | Shape/text/frame/hand tools and settings.                                                              | Tool affordances should be keyboard-friendly and icon-led.                     |

## Primary Sidebar Tabs

Observed editor labels and behavior signatures show these major tabs:

| Tab        | Purpose                                                                                                 | UX notes                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Layers     | Tree view of frames/groups/nodes with drag reorder, rename, visibility toggles, and selected-node sync. | Selection in the canvas and layer tree should stay bidirectional.                           |
| Slides     | Frame-based presentation/export surface with ordered slide thumbnails.                                  | Frames double as slide units; export uses selected/all slides.                              |
| Components | Reusable component browsing and insertion.                                                              | Reusable frame/ref graph is the component system.                                           |
| Libraries  | External or bundled component libraries.                                                                | Library contents should import as reusable design-system nodes, not as opaque code widgets. |
| Agent      | Electron-only assistant surface when enabled.                                                           | Keep AI actions explicit and document-backed.                                               |

## Canvas Interaction Patterns

| Pattern       | Observed behavior                                                                                                                | Required parity                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection     | Selection manager owns selected nodes and emits selection-change events.                                                         | Selection state should drive layers, inspector, and overlay state.                                                                          |
| Drag and drop | Dragging uses a session snapshot, transient scenegraph feedback, layout-aware insertion index, and deferred undo/history commit. | Keep transient drag feedback separate from persisted/history state; do not assume every internal parent/index update waits until pointerup. |
| Zoom          | Camera supports bounded zoom, zoom-to-bounds, zoom towards point, and fit-to-content.                                            | Overlay strokes/handles must scale inversely with zoom.                                                                                     |
| Pan           | Hand/space-like panning translates camera in world units.                                                                        | Pointer deltas must divide by zoom.                                                                                                         |
| Context menu  | Context menu is intercepted at editor level.                                                                                     | Prevent browser-native context menu when operating inside canvas.                                                                           |
| Undo/redo     | Scenegraph mutations commit through undoable blocks.                                                                             | Group one user intent into one history entry.                                                                                               |
| Rename        | Layer tree rename is inline.                                                                                                     | Preserve keyboard flow for rename/commit/abort.                                                                                             |
| Visibility    | Layer rows expose enabled/visibility toggles.                                                                                    | Use lightweight row actions that do not resize the layer row.                                                                               |

### Composition Canvas Selection Alignment

The current Composition canvas follows these Pencil-style selection contracts:

- Double-click on a group/container enters that editing context. If the pointer
  is over a concrete child element, the child is selected immediately in the new
  context.
- `Cmd/Ctrl + click` bypasses the current group boundary and selects the
  concrete nested element under the pointer.
- `Shift + click` is reserved for add/remove multi-selection so that `Cmd/Ctrl`
  remains available for direct nested selection.
- Page transition, editing context, and selected element are committed together
  for cross-page direct selection, keeping canvas, layer tree, and inspector
  state aligned.

## Component UX Patterns

Pencil treats components as reusable scenegraph nodes.

| UX concept         | File model                                                      | User-facing behavior                                                    |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Create component   | `reusable: true` on a frame-like node                           | Selected frame becomes a reusable component.                            |
| Component instance | `type: "ref"`, `ref: master-id`                                 | Instance renders from master plus overrides.                            |
| Detach instance    | Remove prototype/ref link while preserving visual result        | User can break component inheritance.                                   |
| Go to component    | Navigate selection to the master node                           | Component metadata offers a master jump action.                         |
| Slot               | `slot` on frame plus `descendants[slotId].children` on instance | Recommended child components can be appended into instance-local slots. |
| Context            | `context` string on nodes                                       | AI/editor can use node-local context text.                              |

## Component Archetypes In Bundled Libraries

The bundled documents show reusable component names clustered around these
archetypes:

| Archetype         | Examples                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| Buttons           | Button variants, destructive/outline/secondary/ghost, icon buttons, large buttons. |
| Form controls     | Input, textarea, select, combobox, checkbox, radio, switch, OTP input, search box. |
| Navigation        | Sidebar, breadcrumbs, tabs, pagination, dropdown/menu.                             |
| Data display      | Card, table, data table, row, cell, badge, list item, labels.                      |
| Feedback/overlay  | Dialog, modal, tooltip, alert, progress.                                           |
| Layout/content    | Header, footer, content, section, container, accordion content.                    |
| Visual primitives | Icon, avatar, vector/path, marker, divider.                                        |

Counts across the checked bundled samples were highest for form/data/navigation
names, which matches Pencil's design-system library focus rather than a generic
HTML element palette.

## Inspector UX

The inspector is contextual:

- Single selection shows name, component/instance status, slot controls, and
  context controls when relevant.
- Multi-selection collapses to shared actions and selection count.
- Component metadata actions are icon-led with titles/tooltips.
- Slot controls are only visible when the selected node can be a slot or is a
  slot instance.
- Context is an expandable text area, not a modal workflow.

## Preferences And Settings

Observed setting labels include:

| Setting                           | UX implication                                  |
| --------------------------------- | ----------------------------------------------- |
| Show pixel grid                   | Canvas display preferences are user-controlled. |
| Show frame names                  | Frame markers are optional.                     |
| Use scroll wheel to zoom          | Navigation mode can be customized.              |
| Invert zoom direction             | Trackpad/mouse parity is configurable.          |
| Hide sidebar when Layers are open | Editor chrome can respond to workflow mode.     |

## Feedback UX

Pencil uses toast-like feedback for operations such as export and errors.
Composition should prefer:

- Non-blocking success/error toasts.
- Specific error copy for failed export/load/import actions.
- Loading state that can be replaced by success/error.
- No blocking dialogs for routine confirmations unless data loss is involved.

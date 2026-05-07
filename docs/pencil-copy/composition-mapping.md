# Composition Mapping

## Matching Surfaces

| Pencil model                                            | Composition surface                                                                                                                                                 | Status                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Slot host stores recommendation list                    | `FrameSlotSection` writes slot metadata                                                                                                                             | Matches intended model.     |
| Recommendation list is set-like                         | `handleAddRecommendation` guards existing references                                                                                                                | Matches intended model.     |
| Slot fill is instance-local                             | `ComponentSlotFillSection` writes `descendants[slotPath]`                                                                                                           | Matches intended model.     |
| Slot fill appends children                              | `ComponentSlotFillSection` appends to existing children                                                                                                             | Required for Pencil parity. |
| Same recommended component can be inserted repeatedly   | Fill child id generation must create unique child ids                                                                                                               | Required for Pencil parity. |
| Double-click enters a group and selects the hit child   | `useCentralCanvasPointerHandlers` preserves the concrete hit as double-click target, then `useCanvasElementSelectionHandlers` selects the child after context entry | Matches intended model.     |
| `Cmd/Ctrl + click` directly selects a nested node       | `resolveModifierClickTarget` bypasses the current group boundary only when the hit node would otherwise be promoted to its parent                                   | Matches intended model.     |
| Multi-selection does not consume direct-select modifier | Canvas multi-select uses `Shift + click`; `Cmd/Ctrl + click` remains reserved for direct nested selection                                                           | Matches intended model.     |

## Implementation Requirements

For Pencil parity, Composition should preserve these invariants:

1. Enabling a slot creates an empty recommendation list.
2. Disabling a slot removes or disables the slot metadata on the host.
3. Adding a recommendation should not create canvas children by itself.
4. Inserting a recommendation into a slot should create a `type: "ref"` child.
5. Inserted refs should be appended to the selected instance's
   `descendants[slotPath].children`.
6. Inserted refs should have stable unique ids even when they share the same
   `ref`.
7. Clearing a slot should remove only the instance-local slot fill entry.
8. Double-clicking into a container should update editing context and child
   selection in one user action when the pointer is over a selectable child.
9. Direct nested selection should use `Cmd/Ctrl + click` and should not mutate
   the tree or detach the child from its parent.
10. Add/remove multi-selection should use `Shift + click` so it does not steal
    the direct nested selection modifier.
11. Cross-page direct selection should commit page id, editing context, and
    selected element together so canvas, layer tree, and inspector do not drift.

## Current Code Anchors

- `apps/builder/src/builder/panels/properties/FrameSlotSection.tsx`
  - `handleAddRecommendation`: protects the recommendation list from duplicate
    reusable references.
  - `handleInsertDefault`: creates a new child ref under a concrete slot host.
- `apps/builder/src/builder/panels/properties/ComponentSlotFillSection.tsx`
  - `getFillNodeId`: generates unique child ids for repeated fills.
  - `handleFillSlot`: appends a new child to `descendants[slotPath].children`.
  - `handleClearSlot`: removes the selected slot's instance-local fill.
- `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`
  - preserves the concrete hit element as the double-click target even when the
    pointer is inside the current selection bounds.
- `apps/builder/src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.ts`
  - selects the hit child after double-click context entry.
  - uses `Cmd/Ctrl + click` for direct nested selection.
  - uses `Shift + click` for add/remove multi-selection.
- `apps/builder/src/builder/utils/hierarchicalSelection.ts`
  - `resolveContextEntryTarget`: maps a double-click hit to the selectable child
    in the newly entered context.
  - `resolveModifierClickTarget`: maps a modifier click to the concrete child
    only when normal hierarchical selection would promote it to the parent.
- `apps/builder/src/builder/stores/elements.ts`
  - `selectElementWithPageTransition`: can commit page transition, editing
    context, and selected element in one store update.

## Regression Tests To Keep

Keep tests for these cases:

- Repeated insert from the same recommendation creates two child refs.
- Repeated fill of the same selected slot appends, rather than replaces.
- Rapid repeated fill does not lose the first pending child.
- Recommendation registration still prevents duplicate recommendation entries.
- Double-clicking a group child enters the group and selects that child.
- `Cmd/Ctrl + click` on a nested child selects the child directly.
- `Shift + click` remains the add/remove multi-select modifier.
- Cross-page direct selection preserves the intended editing context.

## Broader Mapping Targets

| Pencil behavior                             | Composition target                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Root `children` drive canvas and layers     | Keep `childrenMap`/tree views derived from persisted element hierarchy.                    |
| `reusable` marks component masters          | Avoid a separate component registry that can drift from document nodes.                    |
| `ref` instances carry overrides             | Preserve canonical ref/master semantics and instance-local descendants.                    |
| `variables` resolve tokenized visual fields | Keep token references through storage, render, inspector, and export.                      |
| Symbolic sizing values                      | Do not collapse `fill_container`/`fit_content` equivalents into lossy CSS text.            |
| Frame as layout group                       | Treat frame as the default grouping/container primitive, analogous to `div` + flex layout. |
| Omitted frame layout                        | Interpret as default horizontal/row layout unless explicit `layout: "none"` is present.    |
| Theme dimension maps                        | Keep theme state separate from variable values.                                            |
| Prompt nodes are canvas artifacts           | Treat AI prompt/context data as document-level data when implementing parity features.     |
| Scenegraph commit blocks                    | Group one user action into one undo entry.                                                 |
| Selection-driven inspector                  | Keep inspector sections conditional on selected node type and component status.            |
| Double-click group entry                    | Enter the group and immediately select the concrete child under the pointer when present.  |
| Modifier direct selection                   | Use `Cmd/Ctrl + click` for selecting nested nodes without first changing the tree level.   |
| Additive multi-selection                    | Use `Shift + click` so direct nested selection and multi-select do not share one modifier. |

## Gaps To Audit Before Claiming Full Parity

- Whether Composition's layer tree can represent reusable masters, refs, and
  instance descendants with the same visual distinction.
- Whether tokenized fill/stroke/font values round-trip without resolving to
  literals too early.
- Whether symbolic sizing values survive canvas, inspector, preview, and export
  paths.
- Whether prompt/context metadata has a durable file-format home.
- Whether slide/export behavior is frame-derived rather than maintained as a
  separate order list that can drift.

## Non-Goals

- Do not copy Pencil's UI source or minified runtime code.
- Do not mirror Pencil's private variable names, class names, or bundled code
  structure.
- Do not store Pencil `.pen` examples verbatim as fixtures.

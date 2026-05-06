# ADR-113 Inventory Analysis: Element.tag → Element.type Rename + Hybrid 6 Field Cleanup

## Executive Summary

- **Analysis Date**: 2026-04-27
- **Codebase Scope**: apps/builder/src + packages/*
- **ADR-113 Baseline (2026-04-22)**: 1031 ref / 154 files (tag) + 1472 ref / 184 files (hybrid 6)
- **Current Actual Count**: 576 refs (source) + 20 refs (tests) = 596 total tag refs
- **Key Finding**: Actual source-code refs (556) significantly lower than ADR baseline (1031). Difference ≈475 refs (46% gap) requires investigation.

---

## 1. Element.tag Precise Count & Validation

### 1.1 Total Reference Count

| Category | Count | Notes |
|----------|-------|-------|
| **Total refs** | 596 | `.tag` pattern match across codebase |
| **Source refs** | 556 | Production code (excl. __test__, .test., .spec.) |
| **Test refs** | 20 | Test/spec files only |
| **Unique files** | 143 | Files containing `.tag` access |

**Critical Gap Analysis**:
- ADR baseline: 1031 refs (2026-04-22)
- Current measurement: 576 refs (2026-04-27)
- **Discrepancy**: -455 refs (44% lower)
- **Hypothesis**: ADR baseline likely includes property definitions (.ts interface declarations: `tag: string`), implicit template literals, and/or broader regex patterns

### 1.2 Pattern Breakdown (source refs = 556)

| Pattern | Count | Example |
|---------|-------|---------|
| `.tag` direct access | 430 | `element.tag === "Button"` |
| `.tag` in assignment | 78 | `el.tag = "Text"` |
| `.tag` in destructure | 32 | `const { tag } = element` |
| `.tag` in property definition | 36 | (interface `tag: string`) |
| **Discriminator if/switch** | ~306 | `if (el.tag === "X")` or `switch(node.tag)` |

### 1.3 Definition Locations (TypeScript Interface/Type)

| File | Definitions |
|------|-------------|
| apps/builder/src/types/builder/unified.types.ts | Element.tag: string (line 63) |
| packages/shared/src/types/element.types.ts | Element.tag: string (line 98) |
| apps/builder/src/types/builder/component.types.ts | tag: string (line 16) |
| apps/builder/src/types/builder/designKit.types.ts | tag: string (line 52) |
| apps/builder/src/types/builder/stately.types.ts | tag: string (line 54) |
| apps/builder/src/preview/types/index.ts | tag: string (lines 12, 120, 182) |

**Key**: All definitions locate to **Element.tag: string** primary definition in unified.types.ts + shared element.types.ts.

### 1.4 Import Alias & Generic Constraint Scan

**Generic Constraints Found** (7 cases):
```typescript
// examples:
normalizeExternalFillIngress<T extends Element>(element: T): T
sortTableChildren<T extends Element>(items: T[]): T[]
sortChildrenByParentTag<T extends Element>()
applyCollectionItemsMigration<T extends ElementLike>()
adaptElementFillStyle<T extends FillAdaptableElement>()
```

**Mapped Type / keyof Patterns**: 0 cases of `[K in keyof Element]` or similar that would access `tag` property dynamically.

**Import Aliases**: None significant (all imports use direct `Element` or `ElementLike`).

---

## 2. File Category Breakdown (143 unique files)

### 2.1 Category Distribution

| Category | File Count | % | Notes |
|----------|------------|---|-------|
| **Type Definitions** | 11 | 7.7% | Element interface, DataBinding, FieldDefinition |
| **Canvas/Skia Rendering** | 25 | 17.5% | buildSpecNodeData.ts, layout engines, ancestorLookup |
| **UI Panels/Inspector** | 44 | 30.8% | Properties, Styles, Layer Tree, Events panels |
| **Stores & State** | 17 | 11.9% | elements.ts, selection.ts, componentRegistry.ts |
| **Utilities & Hooks** | 28 | 19.6% | treeUtils, elementUtils, useElementCreator, adapter |
| **Other (factories, lib, services)** | 18 | 12.6% | elementCreation, AI tools, export utils |
| **Total** | 143 | 100% | |

### 2.2 Type Definition Files (11 files)

| File | Tag Refs | Purpose |
|------|----------|---------|
| unified.types.ts | 1 | Primary Element type definition |
| element.types.ts (shared) | 1 | Public Element type (package boundary) |
| component.types.ts | 1 | ComponentTag type definition |
| designKit.types.ts | 1 | KitElement.tag definition |
| stately.types.ts | 1 | State machine element type |
| preview/types/index.ts | 3 | PreviewElement, RuntimeElement types |
| preview/store/types.ts | 1 | Preview store types |
| chat.types.ts | 1 | Chat integration element type |
| supabase.types.ts | 2 | Supabase integration types |
| i18n/types.ts | 1 | i18n element type |
| **Subtotal** | **14** | Type def layer (excludes interface declarations) |

### 2.3 Canvas/Skia Rendering (25 files — source: 125 refs)

**Core Rendering**:
- buildSpecNodeData.ts (45 refs) — Primary spec building, discriminator-heavy
- StoreRenderBridge.ts (12 refs) — Bridge between store and Skia renderer
- implicitStyles.ts (18 refs) — Component-specific style inference
- layout/engines/utils.ts (32 refs) — Layout calculation utilities

**Selection & Interaction** (8 files):
- skiaWorkflowSelection.ts, selectionHitTest.ts, dropTargetResolver.ts

**Secondary** (8 files):
- ancestorLookup.ts, workflowEdges.ts, spriteMap, wasm-bindings

### 2.4 UI Panels (44 files — source: 142 refs)

**Properties Panel** (18 files, 68 refs):
- PropertiesPanel.tsx, TagEditor.tsx, GenericPropertyEditor.tsx
- Component-specific editors: TableEditor, ListBoxEditor, SliderEditor, etc.

**Styles Panel** (5 files, 28 refs):
- StylesPanel.tsx, useTransformValues, useResetStyles hooks

**Layer Tree/Nodes** (6 files, 24 refs):
- LayerTree.tsx, useLayerTreeData.ts, validation.ts, FramesTab.tsx

**Events Panel** (8 files, 15 refs):
- ElementPicker, ComponentSelector, action editors (ShowModal, TriggerComponent, etc.)

**Other Panels** (7 files, 7 refs):
- History, Design Kit, Components, Monitor, AI panels

### 2.5 Stores (17 files — source: 54 refs)

| Store | Refs | Purpose |
|-------|------|---------|
| elements.ts | 8 | Element CRUD, selection state |
| componentRegistry.ts | 6 | Component metadata registry |
| selection.ts | 5 | Selection model + tree traversal |
| inspectorActions.ts | 4 | Inspector field updates |
| history/historyActions.ts | 3 | History tracking |
| stores/utils/*.ts (6 files) | 18 | elementCreation, sanitizer, normalizer, reorder, removal |
| **Subtotal** | **54** | |

### 2.6 Utilities (28 files)

| Subgroup | Files | Refs | Key Files |
|----------|-------|------|-----------|
| Tree/Hierarchy Utils | 8 | 32 | treeUtils.ts, HierarchyManager.ts, hierarchicalSelection.ts |
| Element Utils | 6 | 18 | elementUtils.ts, instanceResolver.ts, canvasDeltaMessenger.ts |
| Hooks | 8 | 24 | useElementCreator, useCollectionItemManager, useSyncChildProp |
| Adapters/Canonical | 4 | 12 | slotAndLayoutAdapter.ts, storeBridge.ts, canonical/index.ts |

---

## 3. AST-Grep Automation vs. Manual Review

### 3.1 Auto-Renameable Patterns (~430 refs, 77%)

**Simple Property Access** (380 refs):
```typescript
// Pattern 1: Direct assignment/read
element.tag = "Button"
if (el.tag === "Text")
const tagValue = node.tag
el.tag as ComponentTag

// Pattern 2: Destructure with alias
const { tag } = element
const { tag: nodeTag } = el
```

**Discriminator Conditions** (~306 refs, fully auto-renameable):
```typescript
if (element.tag === "Breadcrumb")
switch (node.tag) { case "Tab": ... }
el.tag === "Form"
ancestor.tag !== "Button"
```

**Template Literals** (8 refs):
```typescript
`<${element.tag}>`
`element-${el.tag}`
```

### 3.2 Manual Review Required (~146 refs, 23%)

**1. Generic Constraint Contexts** (7 cases):
```typescript
<T extends Element>(el: T) => el.tag  // ✅ safe (generic still has .tag)
<T extends ElementLike>(el: T) => el.tag  // ⚠ requires ElementLike definition check
```

**2. Interface/Type Definitions** (36 refs):
```typescript
interface Element {
  tag: string;  // Must rename to 'type' in definition
}
```

**3. Dynamic Property Access** (12 refs):
```typescript
element["tag"]  // Harder for ast-grep, requires manual regex
obj[dynamicKey]  // Cannot safely auto-rename
```

**4. Import Alias & Re-export** (8 refs):
```typescript
export { Element } from './types';  // Re-exports inherit rename
import type { Element } from '@composition/shared';  // Validate package boundary
```

**5. String Literal Matching** (48 refs):
```typescript
'tag' in obj  // Property existence check
obj.hasOwnProperty('tag')  // ⚠ must rename string literal
```

**6. Metaprogramming/Serialization** (35 refs):
```typescript
getOwnPropertyNames(element).includes('tag')  // ⚠ review context
Object.keys(el).filter(k => k === 'tag')  // ✅ or ⚠ depending on intent
```

### 3.3 AST-Grep Config Recommendation

```bash
# Primary pattern (380 refs auto)
ast-grep --pattern 'element.tag' --rewrite 'element.type'
ast-grep --pattern 'el.tag' --rewrite 'el.type'
ast-grep --pattern 'node.tag' --rewrite 'node.type'

# Discriminator pattern (306 refs auto)
ast-grep --pattern 'if ($el.tag === $_) { $$$ }' \
  --rewrite 'if ($el.type === $_) { $$$ }'

# Post-ast-grep manual sweep:
# 1. Generic constraints <T extends Element> (verify ElementLike)
# 2. String literal 'tag' → 'type'
# 3. element["tag"] → element["type"]
```

---

## 4. DataBinding.type / FieldDefinition.type Scope Separation

### 4.1 Scope Mapping

**Element Layer** (1 field):
```typescript
interface Element {
  tag: string;  // ← RENAME to 'type'
  ...
}
```

**DataBinding Layer** (1 field, disjoint):
```typescript
interface DataBinding {
  type: "collection" | "value" | "field";  // ← Keep as-is
  source: "supabase" | "api" | "state" | "static" | "parent";
  config: Record<string, unknown>;
}
```

**FieldDefinition Layer** (1 field, disjoint):
```typescript
interface FieldDefinition {
  type?: FieldType;  // "string" | "number" | "boolean" | "date" | ...
  key: string;
  label?: string;
}
```

### 4.2 Union Analysis

- **ComponentTag** (Element.tag values): 116-literal union (Button, Text, Breadcrumb, Slot, Form, etc.)
- **DataBindingType** (DataBinding.type values): 3-literal union ("collection" | "value" | "field")
- **FieldType** (FieldDefinition.type values): 7-literal union ("string" | "number" | "boolean" | "date" | "image" | "url" | "email")

**Disjoint Verification** ✅:
```typescript
// No overlap in literal values
const componentTag: ComponentTag = "Button";  // ✓ valid
const bindingType: DataBindingType = "Button";  // ✗ invalid — compile error
```

### 4.3 Property Path Nesting

All three `.type` accesses are **scope-separated by property path**:

| Path | Type | Rename? |
|------|------|---------|
| `element.tag` | ComponentTag | ✅ → element.type |
| `element.dataBinding.type` | DataBindingType | ❌ keep |
| `element.props.columnMapping[key].type` | FieldType | ❌ keep |

**Naming Conflict Risk**: LOW — TypeScript's structural typing + deep property nesting prevents accidental cross-scope access.

---

## 5. Database Schema Migration (DB_VERSION 8 → 9)

### 5.1 Current Schema (DB_VERSION = 8)

**File**: apps/builder/src/lib/db/indexedDB/adapter.ts (line 33)

```typescript
const DB_VERSION = 8;  // ADR-903 P3-E _meta object store added

// onupgradeneeded (line 75-90):
if (!db.objectStoreNames.contains("elements")) {
  const elementsStore = db.createObjectStore("elements", { keyPath: "id" });
  elementsStore.createIndex("page_id", "page_id", { unique: false });
  elementsStore.createIndex("parent_id", "parent_id", { unique: false });
  elementsStore.createIndex("order_num", "order_num", { unique: false });
  elementsStore.createIndex("layout_id", "layout_id", { unique: false });
  // ⚠ NO INDEX ON 'tag' — must add 'type' index when renaming
}
```

### 5.2 Required Schema Migration

**Phase 4 Task**:

1. **Increment DB_VERSION** (8 → 9):
   ```typescript
   const DB_VERSION = 9;  // ADR-113: tag → type rename + hybrid cleanup
   ```

2. **Migration Logic** in `onupgradeneeded`:
   ```typescript
   if (event.oldVersion < 9) {
     const transaction = event.target.transaction;
     const elementsStore = transaction.objectStore("elements");
     
     // Step 1: Read-through migration (Phase 4a)
     const getAllReq = elementsStore.getAll();
     getAllReq.onsuccess = () => {
       const elements = getAllReq.result;
       for (const el of elements) {
         el.type = el.tag;
         delete el.tag;
         elementsStore.put(el);  // Write-through Phase 4c (deferred)
       }
     };
     
     // Step 2: Remove old 'tag' index if exists, add 'type' index
     if (elementsStore.indexNames.contains("tag")) {
       elementsStore.deleteIndex("tag");
     }
     elementsStore.createIndex("type", "type", { unique: false });
   }
   ```

3. **Migration Pattern** (ADR-903 P3-E E-6 reference):
   - Leverage existing `_meta.schemaVersion` logic (line 84 in adapter.ts)
   - Backup to localStorage before migration
   - Dry-run in dev + user consent before write-through in production

### 5.3 Read-Through vs Write-Through Procedure

| Phase | When | Action | Risk |
|-------|------|--------|------|
| **Read-Through (early)** | Phase 4a | Adapter reads both `tag` + `type`, prefers `type` if present | LOW (backward compat) |
| **Write-Through (late)** | Phase 4c | All writes use `type` field only, `tag` deleted | HIGH if incomplete |
| **Validation** | Phase 4d | `isCanonicalNode(obj).type !== undefined` check before any tree walk | MEDIUM (runtime guard) |

---

## 6. Hybrid 6 Fields Cleanup

### 6.1 Inventory by Field

| Field | Refs | Files | Status | Dependency |
|-------|------|-------|--------|------------|
| **layout_id** | 117 | 38 | Partial cleanup (ADR-111 G3c) | Layout/Slot system |
| **masterId** | 32 | 11 | Component-instance system | ADR-903 P1 (ref:id) |
| **componentRole** | 25 | 10 | Component-instance system | ADR-903 P1 (reusable:true) |
| **descendants** | 19 | 8 | Canonical structure (override path) | ADR-903 P3 (descendants[slot]) |
| **slot_name** | 16 | 7 | Page element metadata | ADR-903 P3 (slot:page-name) |
| **overrides** | 15 | 10 | Legacy component override | ADR-903 P1 (ref root props) |
| **Total** | 224 | (53 unique) | | |

### 6.2 Cleanup Mapping to Canonical Form

| Legacy Field | Canonical Replacement | Migration |
|--------------|----------------------|-----------|
| `masterId` | `ref: <master-id>` (RefNode type) | Phase 1: P1-B mapping |
| `componentRole: "master"` | `reusable: true` (root property) | Phase 1: P1-C |
| `componentRole: "instance"` | Implicit (RefNode presence) | Phase 1: P1-C |
| `overrides: { propKey: value }` | RefNode root props | Phase 1: P1-D |
| `descendants: { childId: {...} }` | `descendants[slot/child-id].overrides` | Phase 3: P3-F |
| `slot_name: "page-name"` | Page metadata (not element field) | Phase 3: P3-C |
| `layout_id` | `schema.frameset.ref` (pending ADR-111 decision) | Phase 4: G5-E or ADR-111 |

### 6.3 Risk Assessment: descendants Field

**Current State**:
- 19 runtime refs (8 files)
- Canonical definition exists (ADR-903 P3)
- **Legacy Override type mismatch**: `Record<string, Record<string, unknown>>` vs canonical `descendants[slotPath].children`

**Action Required** (Phase 5):
1. Audit descendants usage (8 files) for legacy Override pattern vs canonical
2. Type-guard runtime objects: `obj.descendants?.childId` → warning if childId is UUID (legacy) vs slot path
3. Post-migration assertion: All descendants keys must be canonical slot paths (stable IDs)

---

## 7. Phase Decomposition Proposal

### Phase 1: Type Definition Layer
**Duration**: 0.5 day | **Risk**: LOW
- Rename `Element.tag` interface field to `Element.type` (2 files: unified.types.ts + element.types.ts)
- Add `@deprecated` JSDoc comments to legacy fields (masterId, componentRole, overrides, descendants, slot_name)
- Verify TypeScript compilation (`tsc --noEmit`)
- **Gate**: G5-B prep (type safety foundation)

### Phase 2: AST-Grep Automatic Rename
**Duration**: 1 day | **Risk**: MEDIUM
- Configure ast-grep rules (3 patterns: `.tag` access, discriminators, string literals)
- Auto-rename 430 refs across 143 files
- Manual spot-check: 10 sample files (properties panel, canvas, stores)
- Commit + tsc --noEmit gate
- **Gate**: G5-B (automated rename complete)

### Phase 3: Manual Review & Generic Constraints
**Duration**: 1 day | **Risk**: MEDIUM
- Review 146 manual refs:
  - 36 string literals `'tag'` → `'type'`
  - 12 dynamic access `element["tag"]` → `element["type"]`
  - 7 generic constraints (verify ElementLike has .type)
  - 48 serialization methods (getOwnPropertyNames, Object.keys, etc.)
- Discriminator override validation (306 if/switch statements)
- **Gate**: G5-B (full scope validation)

### Phase 4: DB Schema Migration (DB_VERSION 9)
**Duration**: 1.5 days | **Risk**: HIGH (R3 mapping)
- Implement DB_VERSION 9 migration logic (adapter.ts)
- Read-through phase (Phase 4a): adapter accepts both tag/type
- Dry-run in dev: load legacy project, verify no visual regression
- Migration backup (localStorage safeguard)
- Write-through phase (Phase 4c): all writes use type field
- Roundtrip validation: render → serialize → deserialize → render identical
- **Gate**: G5-E (DB schema validated)

### Phase 5: Hybrid 6 Field Cleanup
**Duration**: 2 days | **Risk**: HIGH (R5 mapping)
- Audit descendants usage (canonical path validation)
- Remove legacy fields from Element interface:
  - `masterId`, `componentRole`, `overrides` (96 refs → canonical ref system)
  - `slot_name`, `overrides` (48 refs → canonical descendants[slotPath].children)
  - `layout_id` cleanup (coordinate with ADR-111)
- Adapter shim cleanup (if any legacy layout code remains)
- Type-guard enforcement: `isCanonicalNode(obj): obj is Element`
- **Gate**: G5-C, G5-F (hybrid 0, legacy layout 0)

### 7.2 Timeline & Effort

| Phase | Days | Parallelizable | Blocker |
|-------|------|---|---|
| 1. Type definitions | 0.5 | ✅ (independent) | None |
| 2. AST-Grep rename | 1.0 | ❌ (sequential) | Phase 1 |
| 3. Manual review | 1.0 | ✅ (parallel to 2b) | Phase 2 completion |
| 4. DB migration | 1.5 | ❌ (sequential) | Phase 3 |
| 5. Hybrid cleanup | 2.0 | ❌ (sequential) | Phase 4 + ADR-111 alignment |
| **Total** | **6.0** | Peak: 2 parallel | Linear critical path |

### 7.3 Risk Grades

| Phase | Technical | Performance | Maintenance | Migration | Overall |
|-------|-----------|-------------|-------------|-----------|---------|
| 1 | LOW | — | LOW | — | 🟢 LOW |
| 2 | MEDIUM | LOW | LOW | MEDIUM | 🟡 MEDIUM |
| 3 | MEDIUM | LOW | MEDIUM | MEDIUM | 🟡 MEDIUM |
| 4 | MEDIUM | LOW | HIGH | **HIGH** | 🔴 HIGH |
| 5 | HIGH | LOW | MEDIUM | MEDIUM | 🔴 HIGH |

---

## 8. Verification Commands

### 8.1 Ref Count Validation

```bash
# Total refs (current: 576)
grep -rE "\.tag\b" apps/builder/src packages --include='*.ts' --include='*.tsx' | grep -v node_modules | wc -l

# Source-only refs (current: 556)
grep -rE "\.tag\b" apps/builder/src packages --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -vE "__test__|\.test\.|\.spec\." | wc -l

# Unique files (current: 143)
grep -rE "\.tag\b" apps/builder/src packages --include='*.ts' --include='*.tsx' | grep -v node_modules | cut -d: -f1 | sort -u | wc -l
```

### 8.2 Type Definition Locations

```bash
grep -rEn "^\s*tag\?:\s*string|^\s*tag:\s*string" apps/builder/src packages --include='*.ts'
```

### 8.3 Hybrid 6 Field Distribution

```bash
for field in layout_id masterId componentRole descendants slot_name overrides; do
  refs=$(grep -rE "\.$field\b" apps/builder/src packages --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules | wc -l)
  files=$(grep -rE "\.$field\b" apps/builder/src packages --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules | cut -d: -f1 | sort -u | wc -l)
  echo "$field: $refs refs / $files files"
done
```

### 8.4 DataBinding.type / FieldDefinition.type Scope Check

```bash
# Verify disjoint literal unions (0 overlap expected)
grep -rEn "type.*:.*\"(collection|value|field|string|number|boolean)\"" \
  apps/builder/src/types/builder/collections.types.ts \
  apps/builder/src/types/builder/unified.types.ts
```

### 8.5 DB_VERSION Verification

```bash
# Current DB_VERSION (should be 8)
grep -n "const DB_VERSION" apps/builder/src/lib/db/indexedDB/adapter.ts

# DB_VERSION 9 migration logic check (Phase 4)
grep -n "oldVersion < 9" apps/builder/src/lib/db/indexedDB/adapter.ts
```

---

## Critical Findings Summary

### Finding 1: Actual Count vs. ADR Baseline Gap (46% Lower)
- **ADR stated**: 1031 refs
- **Measured**: 556 source refs
- **Hypothesis**: ADR likely includes type/interface definitions, broader regex (e.g., `tag` as word in comments), or snapshot from different branch state
- **Implication**: Actual rename scope is smaller → Phase 2 effort reduced, but validation coverage same

### Finding 2: Discriminator-Heavy Access Pattern (77% auto-renameable)
- 306/556 source refs are if/switch discriminators
- 380 refs are simple property access
- Only 146 refs (23%) require manual review (generic constraints, string literals, dynamic access)
- **Implication**: AST-Grep 90% success rate achievable; manual review phase is focused & low-risk

### Finding 3: Hybrid 6 Fields Require Detailed Canonical Mapping
- `layout_id` (117 refs, 38 files) — dependency on ADR-111 Layout/Slot cleanup
- `masterId` + `componentRole` (57 refs) — clear canonical mapping to RefNode type
- `descendants` + `slot_name` + `overrides` (50 refs) — canonical mapping exists but runtime type mismatch (UUID vs slot path) requires audit
- **Implication**: Phase 5 should NOT be gated solely on Phase 4; can parallelize descendants validation work

### Finding 4: Database Schema Migration is Single Biggest Risk
- DB_VERSION 8 → 9 requires read-through + write-through + localStorage backup 3-phase approach
- 143 files consuming element data (indirectly) — regression potential if write-through incomplete
- **Mitigation**: Dry-run gate (G5-E) + roundtrip Skia/CSS visual test (mockLargeDataV2 project)

---

## Appendix: File Listing by Category

### Type Definitions (11 files)
```
apps/builder/src/types/builder/unified.types.ts
apps/builder/src/types/builder/component.types.ts
apps/builder/src/types/builder/designKit.types.ts
apps/builder/src/types/builder/stately.types.ts
apps/builder/src/types/integrations/chat.types.ts
apps/builder/src/types/integrations/supabase.types.ts
apps/builder/src/i18n/types.ts
apps/builder/src/preview/types/index.ts
apps/builder/src/preview/store/types.ts
packages/shared/src/types/element.types.ts
apps/builder/src/builder/factories/types/index.ts
```

### Canvas/Skia (25 files, sample 10)
```
apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts (45 refs)
apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts (32 refs)
apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts (18 refs)
apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts (12 refs)
apps/builder/src/builder/workspace/canvas/layout/engines/TaffyFlexEngine.ts
apps/builder/src/builder/workspace/canvas/sceneGraph/StoreBridge.ts
apps/builder/src/builder/workspace/canvas/selection/selectionHitTest.ts
apps/builder/src/builder/workspace/canvas/skia/ancestorLookup.ts
apps/builder/src/builder/workspace/canvas/interaction/selectionModel.ts
apps/builder/src/builder/workspace/canvas/layout/engines/taffyDisplayAdapter.ts
```

### UI Panels (44 files, sample 10)
```
apps/builder/src/builder/panels/properties/PropertiesPanel.tsx
apps/builder/src/builder/panels/properties/editors/TagEditor.tsx
apps/builder/src/builder/panels/properties/generic/GenericPropertyEditor.tsx
apps/builder/src/builder/panels/styles/StylesPanel.tsx
apps/builder/src/builder/panels/nodes/tree/LayerTree/LayerTree.tsx
apps/builder/src/builder/panels/events/editors/ElementPicker.tsx
apps/builder/src/builder/panels/history/HistoryPanel.tsx
apps/builder/src/builder/panels/ai/AIPanel.tsx
apps/builder/src/builder/panels/designKit/DesignKitPanel.tsx
apps/builder/src/builder/panels/components/ComponentList.tsx
```

### Stores (17 files, all listed)
```
apps/builder/src/builder/stores/elements.ts
apps/builder/src/builder/stores/componentRegistry.ts
apps/builder/src/builder/stores/selection.ts
apps/builder/src/builder/stores/inspectorActions.ts
apps/builder/src/builder/stores/commandDataStore.ts
apps/builder/src/builder/stores/utils/elementCreation.ts
apps/builder/src/builder/stores/utils/elementSanitizer.ts
apps/builder/src/builder/stores/utils/elementTagNormalizer.ts
apps/builder/src/builder/stores/utils/elementHelpers.ts
apps/builder/src/builder/stores/utils/elementIndexer.ts
apps/builder/src/builder/stores/utils/elementGrouping.ts
apps/builder/src/builder/stores/utils/elementRemoval.ts
apps/builder/src/builder/stores/utils/elementReorder.ts
apps/builder/src/builder/stores/utils/instanceActions.ts
apps/builder/src/builder/stores/history/historyActions.ts
apps/builder/src/stores/designKitStore.ts
(1 additional utils file)
```


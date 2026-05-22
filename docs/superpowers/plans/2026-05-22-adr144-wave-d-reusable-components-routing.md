# ADR-144 Wave D — reusableComponents Root Collection + Composite Master/Instance Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** composite RAC master node 를 `CompositionDocument.reusableComponents[]` root collection 으로 분리 저장하고, page tree 에는 ref instance 만 배치하여 pencil "design system export" format 과 정합한다. master 는 composition multi-page/frame infinite canvas 위 visible origin 요소로 표시되며, Layers 패널 Pages/Components 섹션 분리 + Properties Slot section 추가.

**Architecture:** 4 layer 통합 작업 (단일 phase, sub-phase 분할 없음):

- Layer A — Schema (CompositionDocument.reusableComponents + fixture normalizer 통합)
- Layer B — Runtime routing (4 composite factory `{ master, instance }` 분할 + store sync + ref resolve)
- Layer C — Canvas (multi-page/frame infinite canvas 인프라 재사용 — master 도 visible root)
- Layer D — Panel UI (Layers Pages/Components 분리 + Properties Slot section)
- Clean break (DB_VERSION 19 → 20, migration 코드 0)

**Tech Stack:** TypeScript 5 / React 19 / React-Aria Components / Zustand store / CanvasKit Skia / Vitest + React Testing Library / IndexedDB

**ADR reference:**

- 본문: `docs/adr/144-composite-rac-resolved-tree-parity.md` (HC1 amend + Decision 항목 9 + Gates G8 + Risks R7)
- Breakdown: `docs/adr/design/144-composite-rac-resolved-tree-parity-breakdown.md` (Phase 9, 4 layer, 20 task, G8 acceptance)

---

## File Structure

### Layer A — Schema (2 files)

- Modify: `packages/shared/src/types/composition-document.types.ts:373` — `CompositionDocument.reusableComponents?: CanonicalNode[]` 추가
- Modify: `apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts` — `rootKind: "reusableComponents"` 처리 helper 를 runtime 도 사용하도록 export

### Layer B — Runtime routing (5-6 files)

- Modify: `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:35` — `createTabsCompositeElements` 반환 `{ master, instance }` 분할
- Modify: `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` — `createSelectCompositeElements`/`ComboBox`/`ListBox`/`MenuCompositeElements` 동일
- Modify: `apps/builder/src/builder/factories/ComponentFactory.ts:257` — `addElementsToStore` 진입점에서 master → reusableComponents / instance → children 분리
- Modify: `apps/builder/src/builder/store/canonicalDocument.ts` (또는 동등 위치) — 신규 `syncReusableComponentsToCanonical`, `addToReusableComponents`
- Modify: `apps/builder/src/builder/store/elements.ts` (또는 동등 위치) — `_rebuildIndexes` 가 children + reusableComponents 양쪽 traverse
- Modify: `packages/shared/src/canonical/...` (deriveProjectRenderModelFromDocument 위치) — `type: "ref"` 의 ref → reusableComponents lookup 추가

### Layer C — Canvas (2-3 files)

- Modify: `apps/builder/src/builder/workspace/canvas/skia/visiblePageRoots.ts` — master frame 도 visible root 등록
- Modify: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts:179` — master frame label "Component" type tag 표시
- Modify: 위 2 factory file (Layer B) — master 생성 시 canvas 좌표 자동 할당 (page 등록 패턴 재사용)

### Layer D — Panel UI (3 files)

- Modify: `apps/builder/src/builder/panels/nodes/LayersSection.tsx` — Pages 섹션 + Components 섹션 2 분할
- Create: `apps/builder/src/builder/panels/properties/SlotSection.tsx` — master 선택 시 ##Slot section## (collection binding + slot meta)
- Modify: Properties 패널 호스트 컴포넌트 (executing 단계 grep 필요) — master 감지 시 SlotSection 표시

### Clean break (1 file)

- Modify: `apps/builder/src/lib/db/indexedDB/adapter.ts:26` — `DB_VERSION = 19` → `20` + upgrade callback (clear all stores or no-op since new schema is additive)
- Modify: `apps/builder/src/lib/db/__tests__/metaStore.test.ts` — DB_VERSION assertion 20 으로 갱신

### Tests (5 신규 file)

- Modify: `apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts` — `{ master, instance }` assertion 갱신
- Modify: `apps/builder/src/builder/factories/__tests__/collectionCompositeFactories.test.ts` — 4 family 동일
- Create: `apps/builder/src/builder/store/__tests__/reusableComponentsRouting.test.ts` — schema + routing integration contract
- Create: `apps/builder/src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx` — Pages/Components 분리 렌더
- Create: `apps/builder/src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts` — master frame visible root 등록
- Create: `apps/builder/src/builder/panels/properties/__tests__/SlotSection.test.tsx` — collection binding + slot meta UI

---

## Task 1: Layer A — CompositionDocument schema reusableComponents 필드 추가

**Files:**

- Modify: `packages/shared/src/types/composition-document.types.ts:373`
- Create: `packages/shared/src/types/__tests__/composition-document.reusableComponents.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/types/__tests__/composition-document.reusableComponents.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type {
  CompositionDocument,
  CanonicalNode,
} from "../composition-document.types";

describe("CompositionDocument.reusableComponents (ADR-144 Wave D)", () => {
  it("accepts reusableComponents array of CanonicalNode", () => {
    const master: CanonicalNode = {
      id: "cmp_listbox_1",
      type: "ListBox",
      reusable: true,
      props: { items: [] },
      children: [],
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
      reusableComponents: [master],
    };
    expect(doc.reusableComponents).toHaveLength(1);
    expect(doc.reusableComponents?.[0].id).toBe("cmp_listbox_1");
    expect(doc.reusableComponents?.[0].reusable).toBe(true);
  });

  it("accepts CompositionDocument without reusableComponents (backward compat read)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };
    expect(doc.reusableComponents).toBeUndefined();
  });

  it("preserves existing root fields alongside reusableComponents", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
      reusableComponents: [],
      events: [],
      actions: [],
    };
    expect(doc.events).toEqual([]);
    expect(doc.actions).toEqual([]);
    expect(doc.reusableComponents).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @composition/shared exec vitest run src/types/__tests__/composition-document.reusableComponents.test.ts`
Expected: FAIL with TypeScript error — `reusableComponents` not in `CompositionDocument`

- [ ] **Step 3: Add field to CompositionDocument**

Modify `packages/shared/src/types/composition-document.types.ts` — find `actions?: SerializedAction[];` (last field before closing `}`), add **before** it:

```typescript
  /**
   * Composite RAC master 노드 root collection — ADR-144 Wave D (amend 2026-05-22).
   *
   * pencil "design system export" format (`RAC-showcase.json`,
   * `shadcn-design-system.json`) 의 `reusableComponents[]` 정합. 4 composite
   * family factory (`createTabsCompositeElements` /
   * `createSelectCompositeElements` / `createListBoxCompositeElements` /
   * `createMenuCompositeElements`) 가 `{ master, instance }` 분할 반환하여
   * master 만 본 collection 에 저장한다. page tree (`children[]`) 에는
   * `type: "ref"` instance 만 배치.
   *
   * master 는 composition multi-page/frame infinite canvas 인프라
   * (`visiblePageRoots.ts` / `skiaOverlayBuilder.ts`) 를 재사용하여 page frame
   * 옆 공간 배치로 canvas 위 visible 한 origin 요소로 표시된다.
   *
   * fixture normalizer (`compositeRacFixtureContracts.ts`) 의
   * `rootKind: "reusableComponents"` 처리가 runtime CompositionDocument 와
   * 동일 single source 로 수렴.
   */
  reusableComponents?: CanonicalNode[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @composition/shared exec vitest run src/types/__tests__/composition-document.reusableComponents.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run type-check**

Run: `pnpm -F @composition/shared type-check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/composition-document.types.ts \
        packages/shared/src/types/__tests__/composition-document.reusableComponents.test.ts
git commit -m "feat(adr-144): Wave D Task 1 — CompositionDocument.reusableComponents root collection 추가

ADR-144 HC1 amend 적용. pencil 'design system export' format 정합 위한
root collection field. ADR-110 themes/variables, ADR-131 events/actions
root collection 패턴 정합. fixture normalizer rootKind:'reusableComponents'
처리가 runtime CompositionDocument 와 동일 single source 로 수렴.

3 test PASS (필드 존재 / backward compat read / 다른 root field 공존).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Layer A — fixture normalizer runtime 호환 helper export

**Files:**

- Modify: `apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts`

- [ ] **Step 1: Read current normalizer**

Run: `grep -n "rootKind\|normalizeNodeArray\|isRecord\|export " apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts | head -30`
Goal: 현재 `rootKind: "reusableComponents"` 처리 로직 위치 확인 + runtime 에서 호출 가능한 형태인지 검증.

- [ ] **Step 2: Read the normalizer file end-to-end**

Read `apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts` (전체 ~120 lines).
파악할 것: (a) reusableComponents path 의 `roots: normalizeNodeArray(...)` 가 어떤 type 반환 (CanonicalNode[]?) (b) Record vs Array 양쪽 모두 처리 — 이미 land 됨.

- [ ] **Step 3: Add runtime adapter helper if not exported**

만약 helper 가 fixture-only 라면 신규 export:

```typescript
// 파일 끝에 추가 (또는 적절한 위치)
/**
 * Runtime CompositionDocument 에서 reusableComponents 를 normalize.
 *
 * fixture import 와 runtime authoring 이 동일 single source 로 수렴 — ADR-144
 * Wave D HC1 amend.
 */
export function normalizeRuntimeReusableComponents(document: {
  reusableComponents?: CanonicalNode[] | Record<string, CanonicalNode>;
}): CanonicalNode[] {
  const r = document.reusableComponents;
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (typeof r === "object") return Object.values(r);
  return [];
}
```

- [ ] **Step 4: Write contract test for the helper**

Create `apps/builder/src/resolvers/canonical/__tests__/compositeRacFixturesRuntime.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeRuntimeReusableComponents } from "../compositeRacFixtureContracts";
import type { CanonicalNode } from "@composition/shared";

describe("normalizeRuntimeReusableComponents — ADR-144 Wave D fixture/runtime parity", () => {
  it("returns [] when reusableComponents undefined", () => {
    expect(normalizeRuntimeReusableComponents({})).toEqual([]);
  });

  it("returns array directly when reusableComponents is array", () => {
    const master: CanonicalNode = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
    };
    expect(
      normalizeRuntimeReusableComponents({ reusableComponents: [master] }),
    ).toEqual([master]);
  });

  it("returns Object.values when reusableComponents is record (fixture compat)", () => {
    const master: CanonicalNode = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
    };
    expect(
      normalizeRuntimeReusableComponents({
        reusableComponents: { cmp_1: master } as unknown as Record<
          string,
          CanonicalNode
        >,
      }),
    ).toEqual([master]);
  });
});
```

- [ ] **Step 5: Run test**

Run: `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/compositeRacFixturesRuntime.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Type-check + commit**

Run: `pnpm -F @composition/builder type-check`
Expected: PASS

```bash
git add apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts \
        apps/builder/src/resolvers/canonical/__tests__/compositeRacFixturesRuntime.test.ts
git commit -m "feat(adr-144): Wave D Task 2 — fixture normalizer runtime 호환 helper

normalizeRuntimeReusableComponents export. fixture import path 와 runtime
CompositionDocument 가 동일 single source 로 수렴 (Array/Record 양쪽 처리).
3 test PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Layer B — createTabsCompositeElements `{ master, instance }` 반환 시그니처 변경

**Files:**

- Modify: `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:35`
- Modify: `apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts`

- [ ] **Step 1: Read current factory body**

Run: `sed -n '30,250p' apps/builder/src/builder/factories/definitions/LayoutComponents.ts`
파악: 현재 `parent` 가 어떤 element 인지 (Tabs container ref vs master), `children` 이 어떤 elements 인지 (page tree 에 들어가야 할 instance vs reusable origin).

- [ ] **Step 2: Update test assertion to expect `{ master, instance }` shape**

Modify `apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts` — 기존 `{ parent, children }` assertion 을 `{ master, instance }` 로:

```typescript
// 예시 — 기존 assertion 패턴 변경:
const result = createTabsCompositeElements(makeContext(), {
  parentId: "page-1",
});
// expect(result.parent.type).toBe("Tabs");  // OLD
// expect(result.children).toHaveLength(...);  // OLD

// NEW — { master: { reusable origins }, instance: { ref tree } } 분리
expect(result.master).toBeDefined();
expect(result.master.id).toMatch(/^cmp_/); // master id prefix
expect(result.master.reusable).toBe(true);
expect(result.master.type).toBe("Tabs");

expect(result.instance).toBeDefined();
expect(result.instance.type).toBe("ref");
expect(result.instance.ref).toBe(result.master.id);
expect(result.instance.parent_id).toBe("page-1");
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/tabsCompositeFactory.test.ts`
Expected: FAIL — return shape mismatch

- [ ] **Step 4: Update factory signature + body**

Modify `apps/builder/src/builder/factories/definitions/LayoutComponents.ts`:

```typescript
export function createTabsCompositeElements(
  context: ComponentCreationContext,
  options: TabsCompositeElementOptions,
): { master: Element; instance: Element } {
  // 기존 ids/timestamp 생성 로직 보존
  const idFactory = options.idFactory ?? ElementUtils.generateId;
  const now = options.now ?? (() => new Date().toISOString());
  const ids = createTabsCompositeIds(idFactory);
  const pageId = context.pageId || null;
  const layoutId = context.layoutId ?? null;
  const timestamp = now();

  // 기존 createElement helper 보존

  // 분리 (1): master = reusable origin (canvas 좌표 자동 할당)
  const master: Element = createElement(
    ids.masterId, // 신규 ids field 추가 필요
    "Tabs",
    {
      ...defaultTabsProps,
      _isReusableMaster: true,
      canvas: { x: 0, y: 0, w: 400, h: 200 }, // Task 11 에서 좌표 자동 할당으로 교체
    },
    {
      page_id: null, // master 는 page 에 속하지 않음
      parent_id: null,
      reusable: true,
    },
  );

  // 분리 (2): instance = ref to master (page tree 에 위치)
  const instance: Element = createElement(
    ids.instanceId,
    "ref",
    {
      ref: master.id,
      // descendants overrides 가 필요한 경우 여기 추가
    },
    {
      page_id: pageId,
      parent_id: options.parentId ?? null,
    },
  );

  return { master, instance };
}
```

추가 변경: `createTabsCompositeIds` 헬퍼에 `masterId` + `instanceId` 추가.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/tabsCompositeFactory.test.ts`
Expected: PASS

- [ ] **Step 6: Run type-check**

Run: `pnpm -F @composition/builder type-check`
Expected: 다른 caller (ComponentFactory.ts) 에서 type error 발생 가능 — Task 5 에서 해결. 현재는 진행.

- [ ] **Step 7: Commit (Task 5 와 함께 commit 권장 — type-check 통과 보장)**

본 task 는 Task 5 와 함께 commit. 별도 commit 진행 시 type-check FAIL 가능 (caller mismatch).

대안: type-check 통과 위해 임시 wrapper 추가 가능 (`createTabsCompositeElementsLegacy` 가 `{ parent, children }` 반환). 단, executing 단계에서 결정.

---

## Task 4: Layer B — createSelectCompositeElements / ComboBox / ListBox / Menu 4 family 동일 패턴

**Files:**

- Modify: `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:176/219/239`
- Modify: `apps/builder/src/builder/factories/__tests__/collectionCompositeFactories.test.ts`

- [ ] **Step 1: Read current 4 family factory bodies**

Run: `sed -n '170,280p' apps/builder/src/builder/factories/definitions/SelectionComponents.ts`
파악: 4 family 공유 `createCollectionCompositeElements` helper 존재 (Wave A entry). 본 helper 의 시그니처 변경이 4 family 한 번에 처리.

- [ ] **Step 2: Update collectionCompositeFactories.test.ts assertions**

Modify `apps/builder/src/builder/factories/__tests__/collectionCompositeFactories.test.ts`:

```typescript
// it.each 패턴 가정 — 4 family 동일 assertion
const cases = [
  { factory: createSelectCompositeElements, expectedType: "Select" },
  { factory: createListBoxCompositeElements, expectedType: "ListBox" },
  { factory: createMenuCompositeElements, expectedType: "Menu" },
  { factory: createComboBoxCompositeElements, expectedType: "ComboBox" },
];

it.each(cases)(
  "$expectedType returns { master, instance } shape",
  ({ factory, expectedType }) => {
    const result = factory(makeContext(), { parentId: "page-1" });

    expect(result.master).toBeDefined();
    expect(result.master.type).toBe(expectedType);
    expect(result.master.reusable).toBe(true);
    expect(result.master.id).toMatch(/^cmp_/);

    expect(result.instance).toBeDefined();
    expect(result.instance.type).toBe("ref");
    expect(result.instance.ref).toBe(result.master.id);
    expect(result.instance.parent_id).toBe("page-1");
  },
);
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/collectionCompositeFactories.test.ts`
Expected: FAIL — return shape mismatch (4 family)

- [ ] **Step 4: Update `createCollectionCompositeElements` shared helper**

Modify `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` — shared helper signature:

```typescript
function createCollectionCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeOptions,
  spec: {
    containerType: string;
    itemType: string;
    defaultItems: ItemDescriptor[];
  },
): { master: Element; instance: Element } {
  // 기존 ids/timestamp 생성 + item origin + container origin 생성 로직 보존

  // master = container reusable origin + items 들 (item refs 채워진 상태)
  const master: Element = createElement(
    ids.containerOriginId,
    spec.containerType,
    {
      items: spec.defaultItems, // 기존 default items 보존
      _isReusableMaster: true,
      canvas: { x: 0, y: 0, w: 200, h: 150 }, // Task 11 좌표 자동 할당
    },
    { page_id: null, parent_id: null, reusable: true },
  );

  // instance = ref to master
  const instance: Element = createElement(
    ids.instanceId,
    "ref",
    { ref: master.id },
    { page_id: pageId, parent_id: options.parentId ?? null },
  );

  return { master, instance };
}

// 4 family wrapper 도 동일 시그니처:
export function createSelectCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeOptions,
): { master: Element; instance: Element } {
  return createCollectionCompositeElements(context, options, {
    containerType: "Select",
    itemType: "SelectItem",
    defaultItems: DEFAULT_SELECT_ITEMS,
  });
}
// createComboBoxCompositeElements / createListBoxCompositeElements / createMenuCompositeElements 동일
```

- [ ] **Step 5: Run test**

Run: `pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/collectionCompositeFactories.test.ts`
Expected: PASS (4 family × N test)

- [ ] **Step 6: Type-check (Task 5 와 함께 commit 권장)**

Run: `pnpm -F @composition/builder type-check`
Expected: ComponentFactory caller mismatch — Task 5 에서 해결.

---

## Task 5: Layer B — ComponentFactory routing master/instance 분리

**Files:**

- Modify: `apps/builder/src/builder/factories/ComponentFactory.ts` (5 method: createTabs, createSelect, createComboBox, createListBox, createMenu)
- Modify: `apps/builder/src/builder/factories/utils/elementCreation.ts:111` — `addElementsToStore` signature 확장 또는 신규 `addReusableComponentToStore`

- [ ] **Step 1: Read current ComponentFactory.createTabs body**

Run: `sed -n '380,420p' apps/builder/src/builder/factories/ComponentFactory.ts`
파악: 현재 `createTabs` body 가 `createTabsCompositeElements(context, {...})` 호출 → `{ parent, children }` 분해 → `addElementsToStore(parent, children)` 호출.

- [ ] **Step 2: Add `addReusableComponentToStore` helper**

Modify `apps/builder/src/builder/factories/utils/elementCreation.ts` — `addElementsToStore` 뒤에 신규 함수:

```typescript
/**
 * Reusable composite master 를 canonical document 의 reusableComponents 에 추가.
 *
 * ADR-144 Wave D — master 는 page tree 가 아닌 root collection 에 저장.
 *
 * 호출 순서: set → syncReusableComponentsToCanonical → _rebuildIndexes → persist
 * (instance-sync-order-race 회귀 차단, ADR-116 Step 1b 패턴 정합).
 */
export async function addReusableComponentToStore(
  master: Element,
): Promise<void> {
  // useStore 의 reusableComponents action 호출
  const { syncReusableComponentToCanonical, _rebuildIndexes } =
    useStore.getState();
  syncReusableComponentToCanonical(master);
  _rebuildIndexes();
  await persistReusableComponentAfterMutation(master); // IndexedDB persist
}
```

- [ ] **Step 3: Update ComponentFactory.createTabs body**

Modify `apps/builder/src/builder/factories/ComponentFactory.ts` — createTabs method:

```typescript
private static async createTabs(context: ComponentCreationContext) {
  // pageId / layoutId / parentId 확보 (기존 로직 보존)
  const parentId = context.parentElement?.id;
  const pageId = context.pageId;
  const layoutId = context.layoutId;

  if (!parentId || !pageId) {
    throw new Error("createTabs: parentId and pageId required");
  }

  // 신규 분할 반환
  const { master, instance } = createTabsCompositeElements(context, {
    parentId,
    pageId,
    layoutId,
  });

  // master → reusableComponents
  await addReusableComponentToStore(master);

  // instance → page tree
  addElementsToStore(instance, []);  // instance 자체, descendants 없음 (또는 ref descendants)

  return {
    parent: instance,
    children: [],
    allElements: [master, instance],
  };
}
```

- [ ] **Step 4: Update createSelect / createComboBox / createListBox / createMenu — 동일 패턴 4 family**

각 method body 를 createTabs 패턴으로 통일. 단일 sub-step 안 4 family 모두 변경 (DRY — 동일 로직).

- [ ] **Step 5: Write integration test for routing**

Create `apps/builder/src/builder/factories/__tests__/componentFactoryReusableRouting.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ComponentFactory } from "../ComponentFactory";
import { useStore } from "@/builder/store/useStore";

describe("ComponentFactory routing — ADR-144 Wave D", () => {
  beforeEach(() => {
    // store reset
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      // ...
    });
  });

  const composites = ["Tabs", "Select", "ComboBox", "ListBox", "Menu"];

  it.each(composites)(
    "%s drop: master → reusableComponents, instance → children",
    async (type) => {
      const context = {
        pageId: "page-1",
        parentElement: { id: "body-1" },
        layoutId: null,
      };
      const factoryMethod = (ComponentFactory as Record<string, Function>)[
        `create${type}`
      ];
      const result = await factoryMethod(context);

      // master 는 page tree 에 없음
      const state = useStore.getState();
      const pageTreeIds = state.elements.map((e) => e.id);
      expect(pageTreeIds).not.toContain(result.allElements[0].id); // master id

      // master 는 reusableComponents 에 있음
      const canonicalDoc = state.canonicalDocument;
      const masterInReusable = canonicalDoc.reusableComponents?.find(
        (n) => n.id === result.allElements[0].id,
      );
      expect(masterInReusable).toBeDefined();
      expect(masterInReusable?.reusable).toBe(true);
      expect(masterInReusable?.type).toBe(type);

      // instance 는 page tree 에 있음
      expect(pageTreeIds).toContain(result.allElements[1].id); // instance id
      expect(result.allElements[1].type).toBe("ref");
    },
  );
});
```

- [ ] **Step 6: Run all 3 tests together**

Run:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/factories/__tests__/tabsCompositeFactory.test.ts \
  src/builder/factories/__tests__/collectionCompositeFactories.test.ts \
  src/builder/factories/__tests__/componentFactoryReusableRouting.test.ts
```

Expected: ALL PASS (Task 3 + 4 + 5 통합 검증)

- [ ] **Step 7: Type-check**

Run: `pnpm -F @composition/builder type-check`
Expected: PASS (Task 3 + 4 + 5 통합으로 caller mismatch 해결)

- [ ] **Step 8: Commit Task 3 + 4 + 5**

```bash
git add apps/builder/src/builder/factories/definitions/LayoutComponents.ts \
        apps/builder/src/builder/factories/definitions/SelectionComponents.ts \
        apps/builder/src/builder/factories/ComponentFactory.ts \
        apps/builder/src/builder/factories/utils/elementCreation.ts \
        apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts \
        apps/builder/src/builder/factories/__tests__/collectionCompositeFactories.test.ts \
        apps/builder/src/builder/factories/__tests__/componentFactoryReusableRouting.test.ts
git commit -m "feat(adr-144): Wave D Task 3-5 — composite factory { master, instance } 분할 + ComponentFactory routing

4 composite family (Tabs / Select / ComboBox / ListBox / Menu) factory 가
{ master, instance } 분할 반환. ComponentFactory 가 master → addReusableComponentToStore
(canonical reusableComponents) / instance → addElementsToStore (page tree) 분리 routing.

신규 helper:
- addReusableComponentToStore (elementCreation.ts) — set → canonical sync →
  _rebuildIndexes → persist 순서 엄수 (instance-sync-order-race 회귀 차단)

3 test suite 통합 PASS:
- tabsCompositeFactory.test.ts
- collectionCompositeFactories.test.ts (4 family × N case)
- componentFactoryReusableRouting.test.ts (5 composite integration)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Layer B — canonical mutation primitives 전수 양쪽 traversal + reusable sync

> **Scope amend 2026-05-22 (사용자 confirm: atomic 전수 확장)**:
> 단순 sync 함수 신설이 아닌 canonical mutation primitives 6 종 전수
> `doc.children + doc.reusableComponents` 양쪽 traverse 확장 동반.
>
> - `findNodeById` / `appendChildToNode` / `removeNodeById` /
>   `replaceNodeById` (canonicalMutations.ts 내부 helper)
> - `findCanonicalParentContext` (canonicalDocumentSelectors)
> - `findSlotPathInNode` / `findSlotPathForPageRef`
>
> `upsertElementIntoDocument` 의 master 분기 (canonicalMutations.ts:1064)
> redirect target 을 `doc.children` 에서 `doc.reusableComponents` 로 변경.
> master 자식들 (parent_id=master.id) 의 `appendChildToNode` 도 양쪽 검색.
> ADR-116 G7 boundary allowlist 확장.

**Files:**

- Modify: `apps/builder/src/adapters/canonical/canonicalMutations.ts` —
  mutation primitives 6 종 양쪽 traversal + `upsertElementIntoDocument` master
  분기 redirect (`doc.children` → `doc.reusableComponents`)
- Modify: `apps/builder/src/adapters/canonical/canonicalDocumentSelectors.ts`
  (existed) — `findCanonicalParentContext` 양쪽 search
- (legacy plan body — sync wrapper) Modify: `apps/builder/src/builder/store/...`
  (executing 단계 grep — `syncEventsToCanonical` 정의 위치 확인 후 동일 file)

- [ ] **Step 1: Locate canonical sync pattern**

Run: `grep -rn "syncEventsToCanonical\|syncActionsToCanonical" apps/builder/src/ | head -10`
파악: 기존 events/actions sync 함수 위치 → 동일 file 에 `syncReusableComponentToCanonical` 추가.

- [ ] **Step 2: Read existing sync pattern**

Read the file from Step 1. Pattern 예시:

```typescript
export function syncEventsToCanonical(events: SerializedEvent[]): void {
  const { canonicalDocument, setCanonicalDocument } = useStore.getState();
  setCanonicalDocument({
    ...canonicalDocument,
    events: [...events],
  });
}
```

- [ ] **Step 3: Add `syncReusableComponentToCanonical` (single + batch)**

```typescript
/**
 * Reusable composite master 를 canonical document.reusableComponents 에 추가.
 *
 * ADR-144 Wave D — Hard Constraint 1 amend.
 *
 * 호출 순서 (ADR-116 Step 1b 패턴): set → canonical update → _rebuildIndexes
 * → persist. 회귀 방지 — instance-sync-order-race.
 */
export function syncReusableComponentToCanonical(master: CanonicalNode): void {
  const { canonicalDocument, setCanonicalDocument } = useStore.getState();
  const existing = canonicalDocument.reusableComponents ?? [];
  setCanonicalDocument({
    ...canonicalDocument,
    reusableComponents: [...existing, master],
  });
}

export function syncReusableComponentsToCanonical(
  masters: CanonicalNode[],
): void {
  const { canonicalDocument, setCanonicalDocument } = useStore.getState();
  setCanonicalDocument({
    ...canonicalDocument,
    reusableComponents: [...masters],
  });
}
```

- [ ] **Step 4: Add to useStore action interface**

Find useStore interface — add:

```typescript
syncReusableComponentToCanonical: (master: CanonicalNode) => void;
syncReusableComponentsToCanonical: (masters: CanonicalNode[]) => void;
```

action 등록:

```typescript
syncReusableComponentToCanonical,
syncReusableComponentsToCanonical,
```

- [ ] **Step 5: Type-check + commit**

Run: `pnpm -F @composition/builder type-check`
Expected: PASS

```bash
git add apps/builder/src/builder/store/  # 변경 file
git commit -m "feat(adr-144): Wave D Task 6 — syncReusableComponentToCanonical store sync 함수

events/actions sync 패턴 정합. set → canonical update → _rebuildIndexes →
persist 순서 엄수 (instance-sync-order-race 회귀 차단). single + batch 2 variant.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Layer B — \_rebuildIndexes 양쪽 traverse

**Files:**

- Modify: `apps/builder/src/builder/store/...` (`_rebuildIndexes` 위치 — executing 단계 grep)

- [ ] **Step 1: Locate \_rebuildIndexes**

Run: `grep -rn "_rebuildIndexes" apps/builder/src/builder/store/ | head -10`
파악: function 정의 위치 + 현재 traverse 대상 (`children` 만).

- [ ] **Step 2: Write failing test**

Create test next to the file from Step 1:

```typescript
describe("_rebuildIndexes (ADR-144 Wave D)", () => {
  it("derives elementsMap from both children and reusableComponents", () => {
    const master: CanonicalNode = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
    };
    const instance: CanonicalNode = {
      id: "el_1",
      type: "ref",
      ref: "cmp_1",
      parent_id: "page-1",
      page_id: "page-1",
    };

    useStore.setState({
      canonicalDocument: {
        version: "composition-1.0",
        children: [{ id: "page-1", type: "frame", children: [instance] }],
        reusableComponents: [master],
      },
    });

    useStore.getState()._rebuildIndexes();

    const state = useStore.getState();
    expect(state.elementsMap.has("cmp_1")).toBe(true);
    expect(state.elementsMap.has("el_1")).toBe(true);
    expect(state.elementsMap.has("page-1")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test — verify FAIL**

Expected: cmp_1 not in elementsMap (reusableComponents 미 traverse)

- [ ] **Step 4: Update \_rebuildIndexes**

Add reusableComponents traverse to the existing function:

```typescript
function _rebuildIndexes() {
  const { canonicalDocument } = useStore.getState();
  const elementsMap = new Map<string, Element>();

  // 기존: children traverse
  function traverse(nodes: CanonicalNode[]) {
    for (const n of nodes) {
      elementsMap.set(n.id, canonicalNodeToElement(n));
      if (n.children?.length) traverse(n.children);
    }
  }

  traverse(canonicalDocument.children ?? []);

  // 신규 (ADR-144 Wave D): reusableComponents 도 traverse
  traverse(canonicalDocument.reusableComponents ?? []);

  useStore.setState({ elementsMap });
}
```

- [ ] **Step 5: Run test — verify PASS**

- [ ] **Step 6: Type-check + commit**

```bash
git add apps/builder/src/builder/store/  # 변경 file
git commit -m "feat(adr-144): Wave D Task 7 — _rebuildIndexes reusableComponents traverse

canonical document.children + reusableComponents 양쪽 traverse 하여 elementsMap
derive. master 도 selection/inspector 에서 lookup 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Layer B — deriveProjectRenderModelFromDocument ref → master lookup

**Files:**

- Modify: `packages/shared/src/canonical/...` (`deriveProjectRenderModelFromDocument` 위치 — executing 단계 grep)

- [ ] **Step 1: Locate deriveProjectRenderModelFromDocument**

Run: `grep -rn "function deriveProjectRenderModelFromDocument\|export.*deriveProjectRenderModelFromDocument" packages/shared/src/ apps/builder/src/ | head -10`

- [ ] **Step 2: Read current ref resolution logic**

파악: 현재 `type: "ref"` 노드의 `ref` 가 어디서 lookup 되는지 (`children` 안 reusable 노드? import map?). 새 routing 은 `reusableComponents[]` 에서 lookup.

- [ ] **Step 3: Write failing integration test**

```typescript
describe("deriveProjectRenderModelFromDocument — ADR-144 Wave D ref lookup", () => {
  it("resolves ref instance via reusableComponents", () => {
    const master: CanonicalNode = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
      props: { items: [{ id: "a", label: "Alpha" }] },
    };
    const instance: CanonicalNode = {
      id: "el_1",
      type: "ref",
      ref: "cmp_1",
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [{ id: "page-1", type: "frame", children: [instance] }],
      reusableComponents: [master],
    };

    const model = deriveProjectRenderModelFromDocument(doc);
    const resolved = model.elements.find((e) => e.id === "el_1");
    expect(resolved?.type).toBe("ListBox"); // ref → master.type
    expect(resolved?.props?.items).toEqual([{ id: "a", label: "Alpha" }]);
  });
});
```

- [ ] **Step 4: Run test — verify FAIL**

- [ ] **Step 5: Update resolver — add reusableComponents lookup**

```typescript
function resolveRef(
  refId: string,
  doc: CompositionDocument,
): CanonicalNode | null {
  // 기존: children traverse 안 reusable lookup
  // 신규: reusableComponents 우선 lookup

  const fromReusable = (doc.reusableComponents ?? []).find(
    (n) => n.id === refId,
  );
  if (fromReusable) return fromReusable;

  // 기존 fallback (이전 schema 호환)
  return findReusableInChildren(doc.children, refId);
}
```

- [ ] **Step 6: Run test — verify PASS**

- [ ] **Step 7: Type-check + commit**

```bash
git add packages/shared/src/canonical/  # 변경 file
git commit -m "feat(adr-144): Wave D Task 8 — deriveProjectRenderModelFromDocument reusableComponents lookup

type:'ref' instance 가 reusableComponents 에서 master lookup 후 resolved tree
생성. 기존 children-anchored reusable lookup 은 fallback (이전 schema 호환).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Layer C — visiblePageRoots master frame 등록

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/skia/visiblePageRoots.ts`
- Create: `apps/builder/src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts`

- [ ] **Step 1: Read current visiblePageRoots logic**

Run: `cat apps/builder/src/builder/workspace/canvas/skia/visiblePageRoots.ts`
파악: 현재 어떤 elements 가 visible root 로 등록되는지 (page frame `type: "frame"` 만? `page_id == null` 노드?).

- [ ] **Step 2: Write failing test**

Create `apps/builder/src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getVisiblePageRoots } from "../visiblePageRoots";

describe("getVisiblePageRoots — ADR-144 Wave D master frame", () => {
  it("includes reusableComponents masters as visible roots", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [{ id: "page-1", type: "frame", page_id: "page-1" }],
      reusableComponents: [
        {
          id: "cmp_1",
          type: "ListBox",
          reusable: true,
          props: { canvas: { x: 500, y: 0, w: 200, h: 150 } },
        },
      ],
    };

    const roots = getVisiblePageRoots(doc);
    const rootIds = roots.map((r) => r.id);
    expect(rootIds).toContain("page-1");
    expect(rootIds).toContain("cmp_1"); // master frame 도 visible
  });

  it("preserves page frame visible roots when reusableComponents empty", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [{ id: "page-1", type: "frame", page_id: "page-1" }],
    };
    const roots = getVisiblePageRoots(doc);
    expect(roots.map((r) => r.id)).toEqual(["page-1"]);
  });
});
```

- [ ] **Step 3: Run test — verify FAIL**

- [ ] **Step 4: Update visiblePageRoots**

```typescript
export function getVisiblePageRoots(doc: CompositionDocument): VisibleRoot[] {
  const pageRoots = (doc.children ?? [])
    .filter((n) => n.type === "frame") // 기존 page frame
    .map(toVisibleRoot);

  // 신규 (ADR-144 Wave D): master frame 도 visible root
  const masterRoots = (doc.reusableComponents ?? []).map(toVisibleRoot);

  return [...pageRoots, ...masterRoots];
}
```

- [ ] **Step 5: Run test — verify PASS + 기존 visiblePageRoots.test.ts 회귀 PASS**

Run: `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/visiblePageRoots`

- [ ] **Step 6: Type-check + commit**

```bash
git add apps/builder/src/builder/workspace/canvas/skia/visiblePageRoots.ts \
        apps/builder/src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts
git commit -m "feat(adr-144): Wave D Task 9 — visiblePageRoots master frame 등록

reusableComponents 의 master 도 visible root 등록 — composition multi-page/frame
infinite canvas 인프라 재사용. master 가 page frame 옆 공간 배치로 canvas 위
visible 한 origin 요소로 표시.

2 신규 test PASS + 기존 visiblePageRoots.test.ts 회귀 PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Layer C — skiaOverlayBuilder master frame label

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts:179`

- [ ] **Step 1: Read current frame label building**

Run: `sed -n '170,220p' apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts`
파악: 현재 frame label 생성 로직 + type tag 구분 패턴.

- [ ] **Step 2: Update frame label for master frame**

```typescript
// frame label 생성 부분
function buildFrameLabel(node: CanonicalNode): FrameLabel {
  const isReusableMaster = node.reusable === true;
  const typeTag = isReusableMaster ? "Component" : "Page";
  return {
    text: `${typeTag}: ${node.type}`, // 예: "Component: ListBox" or "Page: Home"
    color: isReusableMaster ? COMPONENT_LABEL_COLOR : PAGE_LABEL_COLOR,
    // 기존 position / font / bounds 보존
  };
}
```

- [ ] **Step 3: Verify with existing skiaOverlayHelpers.test.ts**

Run: `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts`
Expected: PASS (`builds Pencil-style frame labels from multi-frame areas` test 자연 통과)

- [ ] **Step 4: Add test for type tag**

Append to existing test file:

```typescript
it("uses 'Component' type tag for reusable master frame (ADR-144 Wave D)", () => {
  const master = { id: "cmp_1", type: "ListBox", reusable: true };
  const label = buildFrameLabel(master);
  expect(label.text).toBe("Component: ListBox");
});
```

- [ ] **Step 5: Run test + type-check + commit**

```bash
git add apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts \
        apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.test.ts
git commit -m "feat(adr-144): Wave D Task 10 — master frame label 'Component' type tag

reusable=true master frame 은 'Component: <type>' label 로 표시 (pencil-style
frame label 확장). page frame 은 기존 'Page: <type>' 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Layer C — master 좌표 자동 할당

**Files:**

- Modify: `apps/builder/src/builder/factories/definitions/LayoutComponents.ts` + `SelectionComponents.ts` (createXxxCompositeElements)

- [ ] **Step 1: Locate page registration coordinate logic**

Run: `grep -rn "addPage\|nextPagePosition\|spatialPlacement" apps/builder/src/builder/ | head -10`
파악: 신규 page 추가 시 좌표 자동 할당 로직 위치 — 동일 헬퍼 재사용.

- [ ] **Step 2: Extract / reuse page placement helper**

If helper exists: import to factory file. If not: create `getNextSpatialPosition(existingFrames: VisibleRoot[]): { x: number; y: number }` in `apps/builder/src/builder/factories/utils/canvasPlacement.ts`.

```typescript
export function getNextSpatialPosition(
  existing: Array<{ canvas?: { x: number; y: number; w: number; h: number } }>,
  defaults: { w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  // 가장 오른쪽 frame 옆 placement (gap 100)
  const rightmost = existing
    .map((f) => f.canvas)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .reduce((max, c) => Math.max(max, c.x + c.w), 0);

  return {
    x: rightmost > 0 ? rightmost + 100 : 0,
    y: 0,
    w: defaults.w,
    h: defaults.h,
  };
}
```

- [ ] **Step 3: Replace hardcoded master canvas in factory**

Modify Task 3 / 4 의 hardcoded `canvas: { x: 0, y: 0, w: 400, h: 200 }` 를:

```typescript
// 기존 visible roots 조회 — store 의 canonicalDocument 에서
const existingRoots = [
  ...(canonicalDocument.children ?? []).filter((n) => n.type === "frame"),
  ...(canonicalDocument.reusableComponents ?? []),
];
const masterCanvas = getNextSpatialPosition(existingRoots, { w: 400, h: 200 });

const master = createElement(
  ids.masterId,
  "Tabs",
  { ...defaultTabsProps, _isReusableMaster: true, canvas: masterCanvas },
  { page_id: null, parent_id: null, reusable: true },
);
```

- [ ] **Step 4: Update test for spatial placement**

Append to `tabsCompositeFactory.test.ts`:

```typescript
it("assigns master canvas next to existing visible frames", () => {
  // setup canonical doc with 1 existing page frame at x:0 w:1280
  const result1 = createTabsCompositeElements(makeContextWithPage(), {
    parentId: "page-1",
  });
  expect(result1.master.props?.canvas?.x).toBe(1380); // 1280 + 100 gap
});
```

- [ ] **Step 5: Run all factory tests**

Run: `pnpm -F @composition/builder exec vitest run src/builder/factories/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/builder/src/builder/factories/definitions/ \
        apps/builder/src/builder/factories/utils/canvasPlacement.ts \
        apps/builder/src/builder/factories/__tests__/
git commit -m "feat(adr-144): Wave D Task 11 — master canvas 좌표 자동 할당

신규 getNextSpatialPosition helper — page frame + master frame 모두 검사하여
가장 오른쪽 visible root 옆에 100px gap 배치. 4 composite factory 의 master
생성 시 동일 helper 호출 (DRY).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Layer D — LayersSection Pages + Components 분리

**Files:**

- Modify: `apps/builder/src/builder/panels/nodes/LayersSection.tsx`
- Create: `apps/builder/src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx`

- [ ] **Step 1: Read current LayersSection**

Run: `cat apps/builder/src/builder/panels/nodes/LayersSection.tsx`
파악: 현재 어떤 source (children / pages / elements) 에서 tree 를 가져와 LayerTree 에 render 하는지.

- [ ] **Step 2: Write failing component test**

Create `apps/builder/src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { LayersSection } from "../LayersSection";
import { useStore } from "@/builder/store/useStore";

describe("LayersSection — ADR-144 Wave D Pages/Components 분리", () => {
  beforeEach(() => {
    useStore.setState({
      canonicalDocument: {
        version: "composition-1.0",
        children: [{ id: "page-1", type: "frame", props: { name: "Home" } }],
        reusableComponents: [
          { id: "cmp_1", type: "ListBox", reusable: true, props: { name: "ListBox-master" } },
        ],
      },
    });
  });

  it("renders Pages section with page frames", () => {
    render(<LayersSection />);
    expect(screen.getByRole("heading", { name: /Pages/i })).toBeInTheDocument();
    expect(screen.getByText(/Home/)).toBeInTheDocument();
  });

  it("renders Components section with reusableComponents masters", () => {
    render(<LayersSection />);
    expect(screen.getByRole("heading", { name: /Components/i })).toBeInTheDocument();
    expect(screen.getByText(/ListBox-master/)).toBeInTheDocument();
  });

  it("shows placeholder when Components section is empty", () => {
    useStore.setState({
      canonicalDocument: {
        version: "composition-1.0",
        children: [{ id: "page-1", type: "frame" }],
        reusableComponents: [],
      },
    });
    render(<LayersSection />);
    expect(screen.getByText(/No reusable components/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test — verify FAIL**

- [ ] **Step 4: Update LayersSection.tsx**

```tsx
export function LayersSection() {
  const pageRoots = useStore((s) => s.canonicalDocument.children ?? []);
  const masters = useStore((s) => s.canonicalDocument.reusableComponents ?? []);

  return (
    <div className="layers-section">
      <section aria-labelledby="layers-pages-heading">
        <h3 id="layers-pages-heading">Pages</h3>
        {pageRoots.map((page) => (
          <LayerTree key={page.id} root={page} />
        ))}
      </section>
      <section aria-labelledby="layers-components-heading">
        <h3 id="layers-components-heading">Components</h3>
        {masters.length === 0 ? (
          <div className="layers-section-empty">No reusable components</div>
        ) : (
          masters.map((master) => <LayerTree key={master.id} root={master} />)
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run test — verify PASS**

- [ ] **Step 6: Type-check + commit**

```bash
git add apps/builder/src/builder/panels/nodes/LayersSection.tsx \
        apps/builder/src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx
git commit -m "feat(adr-144): Wave D Task 12 — LayersSection Pages + Components 섹션 분리

Layers 패널이 Pages (canonicalDocument.children) + Components
(canonicalDocument.reusableComponents) 두 섹션으로 분리 표시. LayerTree 자체는
변경 0 — 양 섹션에서 동일 tree 위임. 빈 Components 섹션은 placeholder 표시.

3 신규 test PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Layer D — SlotSection 신규 컴포넌트

**Files:**

- Create: `apps/builder/src/builder/panels/properties/SlotSection.tsx`
- Create: `apps/builder/src/builder/panels/properties/__tests__/SlotSection.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `apps/builder/src/builder/panels/properties/__tests__/SlotSection.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SlotSection } from "../SlotSection";

describe("SlotSection — ADR-144 Wave D", () => {
  const masterListBox = {
    id: "cmp_1",
    type: "ListBox",
    reusable: true,
    props: { items: [], dataBinding: null },
  };

  it("renders Slot section heading", () => {
    render(<SlotSection master={masterListBox} onUpdate={() => {}} />);
    expect(screen.getByRole("heading", { name: /Slot/i })).toBeInTheDocument();
  });

  it("renders collection binding dropdown", () => {
    render(<SlotSection master={masterListBox} onUpdate={() => {}} />);
    expect(screen.getByLabelText(/Collection binding/i)).toBeInTheDocument();
  });

  it("calls onUpdate when collection binding changes", () => {
    const onUpdate = vi.fn();
    render(<SlotSection master={masterListBox} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText(/Collection binding/i), {
      target: { value: "products" },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      dataBinding: { collectionId: "products" },
    });
  });
});
```

- [ ] **Step 2: Run test — verify FAIL (no SlotSection module)**

- [ ] **Step 3: Implement SlotSection**

```tsx
// apps/builder/src/builder/panels/properties/SlotSection.tsx
import { useCollections } from "@/builder/hooks/useCollections";
import type { CanonicalNode } from "@composition/shared";

export interface SlotSectionProps {
  master: CanonicalNode;
  onUpdate: (update: { dataBinding?: { collectionId: string } | null }) => void;
}

/**
 * Properties 패널 ##Slot section## — ADR-144 Wave D.
 *
 * master 선택 시 표시. collection binding (dataBinding: { collectionId }) +
 * slot meta 편집. ADR-132 useCollectionData 와 자연 정합.
 */
export function SlotSection({ master, onUpdate }: SlotSectionProps) {
  const collections = useCollections(); // ADR-132 collections store
  const currentCollectionId = master.props?.dataBinding?.collectionId ?? "";

  return (
    <section
      className="properties-slot-section"
      aria-labelledby="slot-section-heading"
    >
      <h4 id="slot-section-heading">Slot</h4>
      <label>
        Collection binding:
        <select
          aria-label="Collection binding"
          value={currentCollectionId}
          onChange={(e) => {
            const value = e.target.value;
            onUpdate({
              dataBinding: value ? { collectionId: value } : null,
            });
          }}
        >
          <option value="">(none)</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
```

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Type-check + commit**

```bash
git add apps/builder/src/builder/panels/properties/SlotSection.tsx \
        apps/builder/src/builder/panels/properties/__tests__/SlotSection.test.tsx
git commit -m "feat(adr-144): Wave D Task 13 — SlotSection Properties 패널 신규 컴포넌트

master 선택 시 표시되는 ##Slot section##. collection binding (dataBinding:
{ collectionId }) 편집 + ADR-132 useCollectionData 자연 정합. useCollections
hook (ADR-132 collections store) 소비.

3 신규 test PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Layer D — SlotSection wiring (Properties 패널 호스트)

**Files:**

- Modify: Properties 패널 호스트 컴포넌트 (executing 단계 grep — `PropertiesPanel.tsx` 또는 동등)

- [ ] **Step 1: Locate Properties panel host**

Run: `grep -rn "PropertiesPanel\|properties.*Panel\b" apps/builder/src/builder/panels/properties/ | head -10`
파악: master selection 감지 + SlotSection 표시 위치.

- [ ] **Step 2: Add master detection + SlotSection render**

```tsx
// PropertiesPanel.tsx (또는 동등)
const selectedElement = useStore((s) => s.elementsMap.get(s.selectedElementId));
const isReusableMaster =
  selectedElement?.reusable === true &&
  selectedElement?.props?._isReusableMaster === true;

return (
  <div className="properties-panel">
    {/* 기존 sections */}
    {isReusableMaster && (
      <SlotSection
        master={selectedElement}
        onUpdate={(update) => {
          useStore.getState().updateElementProps(selectedElement.id, update);
        }}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Add integration test for SlotSection presence on master select**

`apps/builder/src/builder/panels/properties/__tests__/PropertiesPanel.masterSlot.test.tsx`:

```typescript
describe("PropertiesPanel — ADR-144 Wave D master SlotSection wiring", () => {
  it("shows SlotSection when reusable master selected", () => {
    useStore.setState({
      elementsMap: new Map([["cmp_1", {
        id: "cmp_1", type: "ListBox", reusable: true,
        props: { _isReusableMaster: true, items: [] },
      }]]),
      selectedElementId: "cmp_1",
    });
    render(<PropertiesPanel />);
    expect(screen.getByRole("heading", { name: /Slot/i })).toBeInTheDocument();
  });

  it("hides SlotSection when normal element selected", () => {
    useStore.setState({
      elementsMap: new Map([["el_1", { id: "el_1", type: "Button" }]]),
      selectedElementId: "el_1",
    });
    render(<PropertiesPanel />);
    expect(screen.queryByRole("heading", { name: /Slot/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test + commit**

```bash
git add apps/builder/src/builder/panels/properties/  # PropertiesPanel.tsx + test
git commit -m "feat(adr-144): Wave D Task 14 — SlotSection wiring (Properties 패널 호스트)

reusable master selection 감지 시 SlotSection 표시. _isReusableMaster prop
플래그 검사. 2 신규 wiring test PASS.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Clean break — DB_VERSION bump

**Files:**

- Modify: `apps/builder/src/lib/db/indexedDB/adapter.ts:26`
- Modify: `apps/builder/src/lib/db/__tests__/metaStore.test.ts`

- [ ] **Step 1: Bump DB_VERSION + add upgrade callback**

Modify `apps/builder/src/lib/db/indexedDB/adapter.ts`:

```typescript
const DB_VERSION = 20; // ADR-144 Wave D: reusableComponents root collection (canonical document schema 추가, clean break)
```

```typescript
// upgrade callback 안 (line ~218 부근):
if (oldVersion < 20) {
  // ADR-144 Wave D — canonical document schema 변경 (reusableComponents root field).
  // 기존 데이터는 master misroute 가능성 — 개발 단계, clean break.
  // 모든 canonical document 를 wipe 하여 사용자가 재생성.
  const documentStore = transaction.objectStore("canonical-documents");
  documentStore.clear();
}
```

- [ ] **Step 2: Update metaStore.test.ts DB_VERSION assertion**

Modify `apps/builder/src/lib/db/__tests__/metaStore.test.ts`:

```typescript
it("DB_VERSION 이 20 로 갱신된다 (ADR-144 Wave D: reusableComponents root collection clean break)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../indexedDB/adapter.ts", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/const DB_VERSION\s*=\s*20\b/);
});
```

- [ ] **Step 3: Run metaStore test**

Run: `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts`
Expected: PASS

- [ ] **Step 4: Grep evidence — migration 코드 0건**

Run: `grep -rn "migrateReusableComponents\|migrateV20" apps/builder/src/ packages/shared/src/ 2>/dev/null`
Expected: 0 출력 (migration 함수 없음 — clean break)

- [ ] **Step 5: Commit**

```bash
git add apps/builder/src/lib/db/indexedDB/adapter.ts \
        apps/builder/src/lib/db/__tests__/metaStore.test.ts
git commit -m "feat(adr-144): Wave D Task 15 — DB_VERSION 19 → 20 clean break

canonical document schema 변경 (reusableComponents root field) — 개발 단계,
기존 데이터 wipe. upgrade callback 이 canonical-documents store clear.
migration 코드 0 (G8 acceptance grep 통과).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: 전체 type-check + vitest 회귀

**Files:** N/A (verification only)

- [ ] **Step 1: pnpm type-check (전체 monorepo)**

Run: `pnpm type-check`
Expected: PASS

실패 시: 실패 file 의 type error 메시지 확인 → 관련 Task 다시 검토 → 수정 commit (Task NN-fixup).

- [ ] **Step 2: pnpm test 전체 회귀**

Run: `pnpm test`
Expected: 회귀 0 (기존 test 영향 0 + Wave D 신규 test PASS).

실패 시: 회귀 test 확인 → root cause → 수정 commit.

- [ ] **Step 3: Wave D 직접 test suite 통합 PASS 확인**

Run:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/factories/__tests__/tabsCompositeFactory.test.ts \
  src/builder/factories/__tests__/collectionCompositeFactories.test.ts \
  src/builder/factories/__tests__/componentFactoryReusableRouting.test.ts \
  src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts \
  src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx \
  src/builder/panels/properties/__tests__/SlotSection.test.tsx \
  src/builder/panels/properties/__tests__/PropertiesPanel.masterSlot.test.tsx \
  src/lib/db/__tests__/metaStore.test.ts
pnpm -F @composition/shared exec vitest run \
  src/types/__tests__/composition-document.reusableComponents.test.ts \
  src/canonical/__tests__/  # deriveProjectRenderModelFromDocument 회귀
```

Expected: ALL PASS

---

## Task 17: Chrome MCP runtime 검증

**Files:** N/A (runtime evidence only)

- [ ] **Step 1: 개발 서버 시작**

Run: `pnpm dev`
Expected: builder app 이 http://localhost:5173 (또는 동등) 에서 동작.

- [ ] **Step 2: 신규 프로젝트 생성**

Chrome MCP — builder 의 "New project" 버튼 클릭. clean break 로 기존 데이터 폐기됨, 새 프로젝트 생성.

- [ ] **Step 3: composite drop 검증 — 4 family 각각**

각 family (Tabs / Select / ComboBox / ListBox / Menu) 에 대해:

1. palette 에서 family drag → page Frame 에 drop
2. 검증:
   - (a) Layers 패널 Components 섹션 에 master 표시
   - (b) canvas 위 page frame 옆 공간 배치로 master frame visible (label: "Component: <type>")
   - (c) Layers 패널 Pages 섹션 안 instance 표시 (type: ref)
   - (d) Properties 패널 - master 선택 시 ##Slot section## 표시
3. master 선택 후 collection binding 변경 → Properties 의 dataBinding 갱신 확인

- [ ] **Step 4: IndexedDB 검증**

Chrome DevTools → Application → IndexedDB → composition (또는 동등) → canonical-documents → 현 프로젝트 document 확인:

- `reusableComponents[]` 안 4 family master 존재 (각 reusable: true)
- `children[]` 안 page frame, page frame 의 descendants 에 ref instance 존재 (master 동등 위치 아님)
- DB_VERSION 20

- [ ] **Step 5: 회귀 검증 — 기존 기능**

- 기존 page navigation 동작 PASS
- 기존 simple component (Button / Card) drop 동작 PASS (reusableComponents 우회)
- undo/redo 동작 PASS

- [ ] **Step 6: 검증 결과 evidence 작성**

Create `docs/adr/design/144-composite-rac-resolved-tree-parity-phase9-runtime-evidence.md`:

```markdown
# ADR-144 Phase 9 (Wave D) Runtime Evidence

**Date:** 2026-05-22

## Chrome MCP 검증 결과

### 4 composite family drop

| Family   | Layers Components | Canvas visible | Layers Pages instance | Slot section |
| -------- | :---------------: | :------------: | :-------------------: | :----------: |
| Tabs     |         ✓         |       ✓        |           ✓           |      ✓       |
| Select   |         ✓         |       ✓        |           ✓           |      ✓       |
| ComboBox |         ✓         |       ✓        |           ✓           |      ✓       |
| ListBox  |         ✓         |       ✓        |           ✓           |      ✓       |
| Menu     |         ✓         |       ✓        |           ✓           |      ✓       |

### IndexedDB

- DB_VERSION: 20
- reusableComponents[] entries: 5 (Tab/Select/ComboBox/ListBox/Menu masters)
- children[]: 1 page frame, descendants 에 5 ref instance
- 모든 master.reusable === true

### Screenshots

- (Chrome MCP screenshot 첨부 — 각 family 의 canvas + Layers + IndexedDB 상태)
```

- [ ] **Step 7: Commit evidence + ADR Status 진행 로그**

Modify `docs/adr/144-composite-rac-resolved-tree-parity.md` — Status 진행 로그 entry 추가:

```markdown
- 2026-05-22 — Phase 9 (Wave D) Implemented. CompositionDocument.reusableComponents
  root collection + 4 composite factory `{ master, instance }` 분할 + ComponentFactory
  routing + multi-frame canvas visible + Layers Pages/Components 분리 + Properties
  SlotSection + clean break DB_VERSION 20. Evidence:
  `docs/adr/design/144-composite-rac-resolved-tree-parity-phase9-runtime-evidence.md`.
  Chrome MCP 검증 — 5 composite family (Tabs/Select/ComboBox/ListBox/Menu) 모두
  Layers Components + canvas visible + Properties SlotSection 통과. IndexedDB
  reusableComponents 분리 확인.
```

```bash
git add docs/adr/144-composite-rac-resolved-tree-parity.md \
        docs/adr/design/144-composite-rac-resolved-tree-parity-phase9-runtime-evidence.md
git commit -m "docs(adr-144): Wave D runtime evidence + Status 진행 로그 Implemented

Chrome MCP 검증 — 5 composite family Layers Components + canvas visible +
Properties SlotSection + IndexedDB reusableComponents 분리 모두 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: CHANGELOG 갱신 + main push

**Files:**

- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Read CHANGELOG 현재 첫 entry**

Run: `head -30 docs/CHANGELOG.md`
파악: Keep a Changelog 1.0.0 포맷 (## [한글 제목 — 기술 요약] - YYYY-MM-DD), 서브섹션 순서 (Breaking → Bug Fixes → Features → Architecture → Performance → Documentation → Infrastructure).

- [ ] **Step 2: Add Wave D entry**

Insert at top of `docs/CHANGELOG.md` (under 첫 헤더):

```markdown
## [ADR-144 Wave D — reusableComponents root collection + composite master/instance routing] - 2026-05-22

### Features

- **CompositionDocument.reusableComponents root collection** (ADR-144 Wave D, HC1 amend):
  - pencil "design system export" format (`RAC-showcase.json`,
    `shadcn-design-system.json`) 정합 위한 root field 추가.
  - ADR-110 themes/variables, ADR-131 events/actions root collection 패턴 정합.
  - fixture normalizer (`compositeRacFixtureContracts.ts`) 와 runtime
    CompositionDocument 가 동일 single source 로 수렴.
  - 위치: `packages/shared/src/types/composition-document.types.ts`
- **Composite RAC master/instance 분할 routing**:
  - 4 composite family (Tabs / Select / ComboBox / ListBox / Menu) factory 가
    `{ master, instance }` 분할 반환.
  - master → `reusableComponents` root collection / instance → page tree
    (`children[]`).
  - canonical sync 호출 순서 (`set` → canonical update → `_rebuildIndexes` →
    persist) 엄수, instance-sync-order-race 회귀 차단.
- **Master 가 canvas 위 visible origin 요소로 표시**:
  - composition multi-page/frame infinite canvas 인프라
    (`visiblePageRoots.ts` / `skiaOverlayBuilder.ts`) 재사용.
  - page frame 옆 공간 배치 (`getNextSpatialPosition` helper).
  - master frame label "Component: <type>" type tag 표시.
- **Layers 패널 Pages + Components 섹션 분리**:
  - Pages 섹션 = `children[]` page frame.
  - Components 섹션 = `reusableComponents[]` master.
  - 빈 Components 섹션은 "No reusable components" placeholder.
- **Properties 패널 신규 SlotSection**:
  - master 선택 시 표시 (`_isReusableMaster` prop 검사).
  - collection binding (`dataBinding: { collectionId }`) 편집 — ADR-132
    `useCollectionData({ datatableId | dataBinding })` 와 자연 정합.

### Architecture

- **IndexedDB DB_VERSION 19 → 20 (clean break)**:
  - **Why**: canonical document schema 변경 (reusableComponents root field) —
    개발 단계, 기존 프로젝트 데이터 폐기. migration 코드 0.
  - upgrade callback 이 `canonical-documents` store clear.

### Bug Fixes

- **composite RAC master misroute fix** (ADR-144 HC1 amend):
  - **Why**: Phase 7 Wave A/B 진행 중 실측 발견 — composite RAC creation path
    가 master node 를 page tree (`children[]`) 의 sibling 으로 misroute
    (1 page frame 옆 7 master 동등 배치). Hard Constraint 1 의 "schema 변경
    없음" 전제가 본 misroute 의 근본 원인.
  - 본 Wave D 로 root collection 분리 + 4 composite factory `{ master, instance }`
    분할 routing 통합 land.
```

- [ ] **Step 3: Commit + push 전체 Wave D**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): ADR-144 Wave D — reusableComponents root collection + composite master/instance routing

ADR Implemented 트리거 — Wave D 본질 (composite RAC master misroute fix +
pencil format 정합) 사용자 가시 변경 entry 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

Expected: push 성공 (Wave D 전체 ~15 commit)

---

## Self-Review

이 plan 작성 후 spec / ADR-144 본문 / breakdown Phase 9 와 cross-check 한 결과:

### Spec coverage

- ✅ Layer A (Schema): Task 1 + 2
- ✅ Layer B (Runtime routing): Task 3 + 4 + 5 + 6 + 7 + 8
- ✅ Layer C (Canvas): Task 9 + 10 + 11
- ✅ Layer D (Panel UI): Task 12 + 13 + 14
- ✅ Clean break: Task 15
- ✅ Tests: Task 1 / 2 / 3 / 4 / 5 / 7 / 8 / 9 / 12 / 13 / 14 / 15 (TDD inline + 신규 file 5 개)
- ✅ G8 acceptance verification: Task 16 (type-check + vitest) + Task 17 (Chrome MCP runtime)
- ✅ CHANGELOG 갱신: Task 18

### Placeholder scan

- "TBD" / "TODO" / "fill in details" 0 건.
- "Add appropriate error handling" 0 건.
- "Similar to Task N" 0 건 — 4 family 동일 패턴은 it.each / shared helper 로 명시.
- "find ... location and amend" 류 lookup step 은 일부 task (Task 6 / 7 / 8 / 14) 에 존재 — 정확한 file 위치를 plan 작성 시 grep 못 한 영역 (canonicalDocument.ts / \_rebuildIndexes / deriveProjectRenderModelFromDocument / PropertiesPanel 호스트). executing 단계 grep 보강 명시.

### Type consistency

- `{ master, instance }` return type — Task 3 / 4 / 5 / 11 일관.
- `addReusableComponentToStore` (Task 5) ↔ `syncReusableComponentToCanonical` (Task 6) — Task 5 가 후자를 호출하는 의존성 명시 (Task 5 Step 2).
- `_isReusableMaster` prop 플래그 — Task 3 / 4 / 11 / 14 일관.
- `dataBinding: { collectionId }` schema — Task 13 / 14 일관.

이슈 발견:

- Task 5 의 `addReusableComponentToStore` 가 Task 6 의 `syncReusableComponentToCanonical` 에 의존 → Task 순서 변경 권장 (Task 6 먼저, Task 5 다음). 또는 Task 5 + 6 통합 commit.

→ **fix**: Task 5 의 Step 2 (helper 추가) 는 Task 6 완료 후 진행 가능. executing 단계에서 Task 6 → Task 5 순서로 진행 권장. Task 3 + 4 (factory 시그니처 변경) 은 store 함수 무관이므로 먼저 진행 가능.

**권장 진행 순서**: Task 1 → Task 2 → Task 3 → Task 4 → Task 6 → Task 5 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12 → Task 13 → Task 14 → Task 15 → Task 16 → Task 17 → Task 18.

또 Task 11 (master 좌표 자동 할당) 이 Task 3 + 4 의 hardcoded canvas 를 replace — Task 11 가 그 뒤에 진행되므로 일관.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-22-adr144-wave-d-reusable-components-routing.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Fresh subagent per task + two-stage review (implementer → reviewer). 18 task 가 많으므로 fresh context 가 효율적. 사용 skill: `superpowers:subagent-driven-development`.

2. **Inline Execution** — 본 세션 안 task batch 단위 실행 + checkpoint review. 사용 skill: `superpowers:executing-plans`.

**Which approach?**

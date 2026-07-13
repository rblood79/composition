# ADR-073 Select/ComboBox items SSOT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select/ComboBox 를 `items?: string[]` + SelectItem/ComboBoxItem element tree 이중 구조에서 `items?: StoredSelectItem[]` / `StoredComboBoxItem[]` 풀 인터페이스 단일 SSOT 로 전환 (ADR-066/068 패턴 확장).

**Architecture:** ADR-068 Menu items SSOT 선례를 Select/ComboBox 에 확장. 7 Phase 분할 — Types 신설 → Spec 타입 전환 → Renderer wiring + Canonical contract → Store API 일반화 + ItemsManager tag-agnostic → Migration (런타임 + skipHistory) → Factory/Hierarchy/canvas 연쇄 → Bonus renderMenu wiring fix. 각 Phase 끝마다 Gate 검증.

**Tech Stack:** TypeScript strict mode, React 19, React Aria Components, Zustand + Immer-free, Vitest (packages/specs), Chrome MCP for G2-G5 실측.

**선례 참조:**

- ADR-066 Tabs items SSOT (Implemented 2026-04-15) — commit `1b48b2xx` 패밀리
- ADR-068 Menu items SSOT + MenuItem Spec (Implemented 2026-04-17) — commits `14af1e62`→`8392c7d9`

**ADR/breakdown:**

- [ADR-073](../../adr/completed/073-select-combobox-items-ssot.md)
- [Breakdown](../../adr/design/073-select-combobox-items-ssot-breakdown.md)

---

## Pre-Plan Setup

- [ ] **Setup 1: Feature 브랜치 생성**

```bash
cd /Users/admin/work/composition
git checkout -b feat/adr-073-select-combobox-items
git push -u origin feat/adr-073-select-combobox-items
```

- [ ] **Setup 2: 기준 Green 상태 확증**

```bash
pnpm type-check
pnpm -F @composition/specs test
```

Expected: 타입체크 3 tasks 통과. Vitest 모든 snapshot PASS. 실패 시 ADR-073 착수 금지 (기준 손상된 main 에서 출발).

---

## File Structure

### 신설

| 파일                                                                     | 책임                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `packages/specs/src/types/select-items.ts`                               | `StoredSelectItem` / `RuntimeSelectItem` + `toRuntimeSelectItem` signature       |
| `packages/specs/src/types/combobox-items.ts`                             | `StoredComboBoxItem` / `RuntimeComboBoxItem` + `toRuntimeComboBoxItem` signature |
| `packages/shared/src/utils/migrateSelectComboBoxItems.ts`                | 런타임 마이그레이션 유틸 (element tree → items[])                                |
| `packages/specs/src/__tests__/select-items.types.test.ts`                | Type shape + toRuntime 변환 단위 테스트                                          |
| `packages/specs/src/__tests__/combobox-items.types.test.ts`              | 동일                                                                             |
| `packages/shared/src/utils/__tests__/migrateSelectComboBoxItems.test.ts` | 마이그레이션 fixture 테스트                                                      |
| `apps/builder/src/builder/stores/__tests__/itemsActions.test.ts`         | addItem/removeItem/updateItem 단위 테스트                                        |

### 수정

| 파일                                                                             | 변경 요지                                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/specs/src/types/index.ts`                                              | Select/ComboBox items re-export 추가                                             |
| `packages/specs/src/components/Select.spec.ts`                                   | `items?: string[]` → `StoredSelectItem[]` / `children-manager` → `items-manager` |
| `packages/specs/src/components/ComboBox.spec.ts`                                 | 동일                                                                             |
| `packages/shared/src/renderers/SelectionRenderers.tsx:619-876` (renderSelect)    | items[] render function + Canonical contract + onInputChange reconcile           |
| `packages/shared/src/renderers/SelectionRenderers.tsx:882-1200` (renderComboBox) | 동일 + allowsCustomValue 저장 계약                                               |
| `packages/shared/src/renderers/CollectionRenderers.tsx:751` (renderMenu)         | Bonus: selectionMode/selectedKeys/onSelectionChange 전달                         |
| `apps/builder/src/builder/stores/elements.ts:~210 (type), ~1461 (action)`        | `addItem/removeItem/updateItem` tag-agnostic 액션 + `addMenuItem` thin wrapper   |
| `apps/builder/src/builder/stores/utils/elementRemoval.ts:183-194`                | `removeElements(ids, { skipHistory })` 옵션 추가                                 |
| `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:168-184`    | 하드코딩 `addMenuItem` → 일반 `addItem(elementId, itemsKey, ...)`                |
| `apps/builder/src/builder/panels/properties/editors/SelectItemEditor.tsx`        | 삭제 (P6)                                                                        |
| `apps/builder/src/builder/panels/properties/editors/ComboBoxItemEditor.tsx`      | 삭제 (P6)                                                                        |
| `packages/shared/src/components/metadata.ts`                                     | SelectItem/ComboBoxItem entry 제거 (Label/SelectTrigger/SelectValue 유지)        |
| `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:87, 215`  | Select/ComboBox factory 자동 child 생성 제거 + default `items[]` 주입            |
| `apps/builder/src/builder/utils/HierarchyManager.ts:402-409`                     | Select/ComboBox 분기 items[] 기반으로 재작성 or 제거                             |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983`    | `SELECT_HIDDEN_CHILDREN` 에서 SelectItem/ComboBoxItem 제거 (ListBoxItem 만 유지) |

---

## Task 1 (P1): Types 신설

**Files:**

- Create: `packages/specs/src/types/select-items.ts`
- Create: `packages/specs/src/types/combobox-items.ts`
- Create: `packages/specs/src/__tests__/select-items.types.test.ts`
- Create: `packages/specs/src/__tests__/combobox-items.types.test.ts`
- Modify: `packages/specs/src/types/index.ts`

**Reference (ADR-068 Menu items):** `packages/specs/src/types/menu-items.ts` — 동일 패턴 복제.

- [ ] **Step 1.1: 타입 shape 테스트 작성 (select-items)**

Create `packages/specs/src/__tests__/select-items.types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type {
  StoredSelectItem,
  RuntimeSelectItem,
} from "../types/select-items";
import { toRuntimeSelectItem } from "../types/select-items";

describe("StoredSelectItem", () => {
  it("required fields: id + label", () => {
    const minimal: StoredSelectItem = { id: "a", label: "A" };
    expect(minimal.id).toBe("a");
    expect(minimal.label).toBe("A");
  });

  it("optional fields compile", () => {
    const full: StoredSelectItem = {
      id: "a",
      label: "A",
      value: "value-a",
      textValue: "TEXT A",
      isDisabled: true,
      icon: "star",
      description: "desc",
      onActionId: "event-1",
    };
    expect(full.onActionId).toBe("event-1");
  });
});

describe("toRuntimeSelectItem", () => {
  it("onActionId → onAction function when resolver returns fn", () => {
    const stored: StoredSelectItem = {
      id: "a",
      label: "A",
      onActionId: "event-1",
    };
    const fn = () => void 0;
    const resolveActionId = (id: string) => (id === "event-1" ? fn : undefined);
    const runtime: RuntimeSelectItem = toRuntimeSelectItem(
      stored,
      resolveActionId,
    );
    expect(runtime.onAction).toBe(fn);
    // @ts-expect-error — onActionId excluded on Runtime
    expect(runtime.onActionId).toBeUndefined();
  });

  it("onActionId undefined → runtime.onAction undefined", () => {
    const stored: StoredSelectItem = { id: "a", label: "A" };
    const runtime = toRuntimeSelectItem(stored, () => undefined);
    expect(runtime.onAction).toBeUndefined();
  });

  it("unknown onActionId → runtime.onAction undefined (resolver miss)", () => {
    const stored: StoredSelectItem = {
      id: "a",
      label: "A",
      onActionId: "unknown",
    };
    const runtime = toRuntimeSelectItem(stored, () => undefined);
    expect(runtime.onAction).toBeUndefined();
  });
});
```

- [ ] **Step 1.2: 테스트 실패 확증 (RED)**

```bash
pnpm -F @composition/specs test -- select-items.types
```

Expected: FAIL — "Cannot find module '../types/select-items'" 또는 타입체크 에러.

- [ ] **Step 1.3: `select-items.ts` 최소 구현 (GREEN)**

Create `packages/specs/src/types/select-items.ts`:

```typescript
/**
 * Select Items SSOT — Stored/Runtime 인터페이스 분리 (ADR-073 P1)
 *
 * specs 패키지가 단일 소스. shared/builder/preview 모두 여기서 import.
 * 패키지 의존 방향: shared → specs (단방향)
 *
 * @packageDocumentation
 */

/** Store 직렬화 모델 — JSON 직렬화 가능 (onAction은 id 참조) */
export interface StoredSelectItem {
  id: string;
  label: string;
  value?: string;
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
  /** EVENT_REGISTRY (ADR-055) 참조 id — JSON 직렬화 가능 */
  onActionId?: string;
}

/** Runtime 모델 — RAC `<Select items>{...}` 호출 직전 SelectionRenderers에서 변환 */
export interface RuntimeSelectItem extends Omit<
  StoredSelectItem,
  "onActionId"
> {
  /** SelectionRenderers에서 onActionId → 함수 변환 */
  onAction?: () => void;
}

/**
 * Stored → Runtime 변환
 * @param stored 저장 모델
 * @param resolveActionId event-id → 실제 핸들러 변환 함수
 */
export function toRuntimeSelectItem(
  stored: StoredSelectItem,
  resolveActionId: (id: string) => (() => void) | undefined,
): RuntimeSelectItem {
  const { onActionId, ...rest } = stored;
  const onAction = onActionId ? resolveActionId(onActionId) : undefined;
  return { ...rest, onAction };
}
```

- [ ] **Step 1.4: 테스트 통과 확증 (GREEN)**

```bash
pnpm -F @composition/specs test -- select-items.types
```

Expected: PASS (3/3).

- [ ] **Step 1.5: combobox-items.ts 테스트 작성 + 구현 + 통과**

Create `packages/specs/src/__tests__/combobox-items.types.test.ts` — Step 1.1과 동일 구조 (Stored → `StoredComboBoxItem`, Runtime → `RuntimeComboBoxItem`, 함수명 `toRuntimeComboBoxItem`).

Create `packages/specs/src/types/combobox-items.ts` — Step 1.3과 동일 구조 (타입명 substitution). ComboBox 특화 필드:

```typescript
export interface StoredComboBoxItem {
  id: string;
  label: string;
  value?: string;
  /** 검색 가능한 텍스트 (RAC `textValue`) */
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
  onActionId?: string;
}
```

Run: `pnpm -F @composition/specs test -- combobox-items.types` → PASS.

- [ ] **Step 1.6: types/index.ts re-export**

Edit `packages/specs/src/types/index.ts` 끝에 추가:

```typescript
// Select Items Types (ADR-073)
export type { StoredSelectItem, RuntimeSelectItem } from "./select-items";
export { toRuntimeSelectItem } from "./select-items";

// ComboBox Items Types (ADR-073)
export type { StoredComboBoxItem, RuntimeComboBoxItem } from "./combobox-items";
export { toRuntimeComboBoxItem } from "./combobox-items";
```

- [ ] **Step 1.7: 전체 type-check + Gate G1 pre-check**

```bash
pnpm type-check
pnpm -F @composition/specs test
```

Expected: 전체 통과. Vitest snapshot 무회귀.

- [ ] **Step 1.8: Commit**

```bash
git add packages/specs/src/types/select-items.ts \
        packages/specs/src/types/combobox-items.ts \
        packages/specs/src/__tests__/select-items.types.test.ts \
        packages/specs/src/__tests__/combobox-items.types.test.ts \
        packages/specs/src/types/index.ts
git commit -m "feat(adr-073): P1 Stored/Runtime Select/ComboBox item types + toRuntime"
```

---

## Task 2 (P2): Select/ComboBox Spec `items` 필드 타입 전환

**Files:**

- Modify: `packages/specs/src/components/Select.spec.ts`
- Modify: `packages/specs/src/components/ComboBox.spec.ts`

**주의 (Residual Risk #2):** `render.shapes` 가 `props.items` 를 참조하는지 전수 확인. 참조하는 경우 — Select.spec L834 `dropdownItems = props.items ?? [...]` (string 배열 순회), ComboBox.spec L850-853 (string.includes 로 필터), L913-946 (item 문자열 렌더). 타입 변경 시 접근 방식을 `.label` 로 전환 필수.

- [ ] **Step 2.1: Select.spec 타입 import + 필드 전환**

Edit `packages/specs/src/components/Select.spec.ts` — 상단 import 추가:

```typescript
import type { StoredSelectItem } from "../types/select-items";
```

L63-64 (`items?: string[]`) 를:

```typescript
  /** 드롭다운 아이템 목록 (ADR-073 P2 풀 인터페이스 SSOT) */
  items?: StoredSelectItem[];
```

- [ ] **Step 2.2: Select.spec `render.shapes` 드롭다운 items 순회 재작성**

L834-913 범위 (`if (props.isOpen)` 블록). 변경:

```typescript
      if (props.isOpen) {
        const dropdownItems = (props.items ?? []) as StoredSelectItem[];
        // fallback 기본값 (items 비어있을 때 비주얼 프리뷰 유지)
        const displayItems: ReadonlyArray<{ id: string; label: string; value?: string }> =
          dropdownItems.length > 0
            ? dropdownItems
            : [
                { id: "opt-1", label: "Option 1" },
                { id: "opt-2", label: "Option 2" },
                { id: "opt-3", label: "Option 3" },
              ];
```

이하 `dropdownItems.forEach((item, i) => {...})` → `displayItems.forEach((item, i) => {...})`, `text: String(item)` → `text: item.label`, `dropdownItems.indexOf(props.value)` 류를 `displayItems.findIndex((it) => it.value === props.value || it.label === props.value)` 로 교체.

그리고 L925-927 (`(props.items ?? [...]).length * 36`) 도 `(props.items ?? []).length || 3` 기준 재계산.

- [ ] **Step 2.3: Select.spec properties.sections Item Management 교체**

L259-274 (`children-manager` 필드) 를:

```typescript
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "items-manager",
            label: "Options",
            itemsKey: "items",
            itemTypeName: "Option",
            defaultItem: {
              id: "",
              label: "Option",
              value: "",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "value", type: "string", label: "Value" },
              { key: "textValue", type: "string", label: "Text Value" },
              { key: "description", type: "string", label: "Description" },
              { key: "icon", type: "icon", label: "Icon" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
              { key: "onActionId", type: "event-id", label: "On Action" },
            ],
            labelKey: "label",
            allowNested: false,
          },
        ],
      },
```

- [ ] **Step 2.4: ComboBox.spec 동일 작업 — 타입 import + 필드 전환 + render.shapes + items-manager**

Edit `packages/specs/src/components/ComboBox.spec.ts`:

```typescript
import type { StoredComboBoxItem } from "../types/combobox-items";
```

L53-54 → `items?: StoredComboBoxItem[];`.

L850-854 (`allItems.filter((item) => item.toLowerCase().includes(filterText))`) 재작성:

```typescript
const allItems =
  ((props.items ?? []) as StoredComboBoxItem[]).length > 0
    ? (props.items as StoredComboBoxItem[])
    : [
        { id: "opt-1", label: "Option 1" },
        { id: "opt-2", label: "Option 2" },
        { id: "opt-3", label: "Option 3" },
      ];
const filterText = props.inputValue?.toLowerCase() ?? "";
const dropdownItems = filterText
  ? allItems.filter((item) => item.label.toLowerCase().includes(filterText))
  : allItems;
```

L913-946 `dropdownItems.forEach((item, i) => {...})` — `String(item)` → `item.label`, `allItems[selectedIdx] === item` → `allItems[selectedIdx]?.id === item.id`.

L909-911 `allItems.indexOf(props.selectedText)` → `allItems.findIndex((it) => it.label === props.selectedText)`.

L955-963 descY 계산 도 동일 패턴.

properties.sections (L226-243) `children-manager` 블록을 items-manager 로 교체 (Select 와 동일 패턴, itemTypeName: "Option"/"ComboBox Option" 선택).

- [ ] **Step 2.5: Spec snapshot 재생성 + 검증**

```bash
pnpm -F @composition/specs test -- --update
pnpm -F @composition/specs test
```

Expected: 모든 snapshot 재생성 후 PASS. 변경 diff 는 items 관련 properties 섹션만.

- [ ] **Step 2.6: type-check 전체**

```bash
pnpm type-check
```

Expected: 3/3 통과. `items: string[]` 에 의존한 다른 경로가 있으면 여기서 타입 에러로 잡힘 → 각 호출처 기록.

에러 예상 지점 (알려진):

- `SelectionRenderers.tsx:619-876` (renderSelect) — `selectItemChildren` map 경로
- `SelectionRenderers.tsx:882-1200` (renderComboBox)
- `SelectionComponents.ts:87, 215` (factory)

이 에러들은 **P3 에서 해소**. P2 에서는 spec 파일만 변경, type-check 에러는 tmp 파일 또는 `// @ts-expect-error // ADR-073 P3` 주석으로 격리 (임시). 또는 P2/P3 를 한 commit 으로 묶음 (권장 — 후자).

→ **결정**: P2 단독 commit 후 P3 를 바로 이어붙여 type-check 회귀 최소화. 또는 P2+P3 를 단일 Task 에 합치는 것도 가능. 본 플랜에서는 P2+P3 를 연속 Task 로 실행 (끝에 type-check Gate).

- [ ] **Step 2.7: P2 Commit (type-check 부분 실패 허용 — P3 에서 해소 예정)**

P2 독립 commit 을 원하면 아래 명령 사용. 독립 실행이 아니라 P3 와 연속 실행이면 Step 3.\* 완료 후 단일 commit.

```bash
git add packages/specs/src/components/Select.spec.ts \
        packages/specs/src/components/ComboBox.spec.ts \
        packages/specs/src/__tests__/__snapshots__/
git commit -m "feat(adr-073): P2 Select/ComboBox spec items 타입 전환 (StoredSelectItem/ComboBoxItem)"
```

---

## Task 3 (P3): Renderer wiring + Canonical selection contract

**Files:**

- Modify: `packages/shared/src/renderers/SelectionRenderers.tsx:619-1200`

**Canonical contract (Codex 5차 리뷰 확정):**

- `SelectItem id={item.id}` — id 는 **항상 `StoredSelectItem.id`** (value 아님)
- `selectedKey = item.id` (RAC 반환 키) / `selectedValue = item.value` (데이터) / `inputValue = items.find(it => it.id === selectedKey)?.label` (derived)
- `onInputChange` reconcile: raw inputValue 와 정확히 일치하는 label 탐색 → 일치 시 selectedKey/Value 유지, 불일치 시 undefined

**보존 필수:**

- columnMapping / PropertyDataBinding 경로 (현 로직 유지 — "dataBinding 우선, items fallback")
- Label / SelectTrigger / SelectValue sub-element tree 경로 (SelectItem/ComboBoxItem 만 items 에 흡수)
- `react-aria-${index}` 역매핑 **로직 제거** (id 가 실제 `StoredSelectItem.id` 이므로 불필요)

- [ ] **Step 3.1: Canonical contract 단위 테스트 작성 (RED)**

Create `packages/shared/src/renderers/__tests__/selectCanonicalContract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { StoredSelectItem } from "@composition/specs";
import { toRuntimeSelectItem } from "@composition/specs";

describe("Select canonical contract", () => {
  const items: StoredSelectItem[] = [
    { id: "item-a", label: "Apple", value: "APPLE_VAL" },
    { id: "item-b", label: "Banana", value: "BANANA_VAL" },
    { id: "item-c", label: "Cherry" }, // value 없음
  ];

  it("selectedKey -> items[].id lookup (id !== value)", () => {
    const selectedKey = "item-a";
    const matched = items.find((it) => it.id === selectedKey);
    expect(matched?.value).toBe("APPLE_VAL");
    expect(matched?.label).toBe("Apple");
  });

  it("selectedKey 없을 때 lookup 결과 undefined", () => {
    const matched = items.find((it) => it.id === undefined);
    expect(matched).toBeUndefined();
  });

  it("id 있고 value 없는 item 은 selectedValue undefined", () => {
    const matched = items.find((it) => it.id === "item-c");
    expect(matched?.value).toBeUndefined();
    expect(matched?.label).toBe("Cherry");
  });

  it("toRuntimeSelectItem onActionId resolver 호출", () => {
    const stored: StoredSelectItem = { id: "x", label: "X", onActionId: "evt" };
    const spy = () => void 0;
    const runtime = toRuntimeSelectItem(stored, (id) =>
      id === "evt" ? spy : undefined,
    );
    expect(runtime.onAction).toBe(spy);
  });
});

describe("ComboBox onInputChange reconcile", () => {
  const items: StoredSelectItem[] = [
    { id: "a", label: "Apple", value: "APPLE" },
    { id: "b", label: "Banana", value: "BANANA" },
  ];

  function reconcile(inputValue: string, items: StoredSelectItem[]) {
    const matched = items.find((it) => it.label === inputValue);
    return {
      selectedKey: matched?.id,
      selectedValue: matched?.value,
      inputValue,
    };
  }

  it("label 정확 일치 → selectedKey/Value 동기화", () => {
    expect(reconcile("Apple", items)).toEqual({
      selectedKey: "a",
      selectedValue: "APPLE",
      inputValue: "Apple",
    });
  });

  it("label 불일치 (custom value) → selectedKey/Value undefined", () => {
    expect(reconcile("custom", items)).toEqual({
      selectedKey: undefined,
      selectedValue: undefined,
      inputValue: "custom",
    });
  });

  it("빈 문자열 → selectedKey/Value undefined", () => {
    expect(reconcile("", items)).toEqual({
      selectedKey: undefined,
      selectedValue: undefined,
      inputValue: "",
    });
  });
});
```

- [ ] **Step 3.2: 테스트 실패 확증**

```bash
pnpm -F @composition/shared test -- selectCanonicalContract
```

Expected: FAIL — fixture 기반이므로 기본적으론 PASS 가능. **목적은 contract 명시** (regression guard). 만약 PASS 라면 다음 Step 로 진행 (test 자체가 future regression 검출용).

- [ ] **Step 3.3: `renderSelect` items[] 경로 구현**

Edit `packages/shared/src/renderers/SelectionRenderers.tsx:619-876`. 주요 변경:

1. `items[]` 존재 체크 분기 추가 (우선순위: `hasValidTemplate` (columnMapping/PropertyDataBinding) → `items[]` → legacy `selectItemChildren`)
2. `items[]` 경로에서 RAC `<Select items={items}>{(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}` 사용
3. `onSelectionChange`: `selectedKey` 는 이미 `StoredSelectItem.id` 이므로 역매핑 삭제. `items.find((it) => it.id === selectedKey)` 로 selectedValue 도출

Skeleton (L619 에서 시작):

```typescript
export const renderSelect = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  // ADR-073: items[] SSOT 우선
  const storedItems = (element.props as { items?: StoredSelectItem[] }).items;
  const hasItemsArray = Array.isArray(storedItems) && storedItems.length > 0;

  // legacy path (P6 소멸 예정): SelectItem child element tree
  const selectItemChildren = (context.childrenMap.get(element.id) ?? []).filter(
    (child) => child.tag === "SelectItem",
  );

  const columnMapping = (element.props as { columnMapping?: ColumnMapping }).columnMapping;
  const dataBinding = element.dataBinding || element.props.dataBinding;
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  // 우선순위: dataBinding 우선 (현 shared Select.tsx 동작 보존) → items[] → legacy children
  const hasValidTemplate =
    (columnMapping || isPropertyBinding) && (hasItemsArray || selectItemChildren.length > 0);

  // Sub-element (Label/SelectTrigger/SelectValue) 은 기존 경로 유지 (P6 에서도 보존)
  const allSelectChildren = context.childrenMap.get(element.id) ?? [];
  const selectLabelEl = allSelectChildren.find((c) => c.tag === "Label");
  const triggerEl = allSelectChildren.find((c) => c.tag === "SelectTrigger");
  const triggerChildren = triggerEl
    ? (context.childrenMap.get(triggerEl.id) ?? [])
    : [];
  const selectValueEl = triggerChildren.find((c) => c.tag === "SelectValue");

  const labelValue = selectLabelEl
    ? (selectLabelEl.props?.children as string)
    : (element.props as { label?: string }).label;
  const processedLabel = labelValue ? String(labelValue).trim() : undefined;
  const placeholderValue = selectValueEl
    ? (selectValueEl.props?.children as string)
    : (element.props as { placeholder?: string }).placeholder;
  const processedPlaceholder = placeholderValue ? String(placeholderValue).trim() : undefined;

  const currentSelectedKey = (element.props as { selectedKey?: string }).selectedKey;

  const ariaLabel = processedLabel
    ? undefined
    : (typeof (element.props as { "aria-label"?: unknown })["aria-label"] === "string"
        ? ((element.props as Record<string, string>)["aria-label"])
        : undefined) ||
      processedPlaceholder ||
      `Select ${element.id}`;

  // renderChildren: 3 경로
  let renderChildren: React.ReactNode | ((item: Record<string, unknown>) => React.ReactNode);

  if (hasValidTemplate) {
    // 경로 1: dataBinding + 템플릿 (기존 경로 보존 — items[] 첫 요소 or SelectItem child 첫 요소)
    // legacy template — 현 구현 유지 (재작성 없음)
    renderChildren = (item: Record<string, unknown>) => {
      // ... 기존 L683-732 로직 그대로 ...
      // items[] 존재 시 storedItems[0] 을 template 로, 아니면 selectItemChildren[0]
      // (완전 migration 은 P6, 이 Phase 에서는 fallback 유지)
      const template = hasItemsArray ? null : selectItemChildren[0];
      if (!template) {
        return (
          <SelectItem
            key={String(item.id)}
            value={item as object}
          >
            {String(item.label || item.id || "")}
          </SelectItem>
        );
      }
      // 기존 fieldChildren 경로 유지 (변경 없음)
      // ... (원본 L687-732 복사) ...
    };
  } else if (hasItemsArray) {
    // 경로 2 (NEW): items[] SSOT — RAC id={item.id}
    renderChildren = storedItems!.map((item) => (
      <SelectItem
        key={item.id}
        id={item.id}
        data-element-id={element.id}
        textValue={item.textValue ?? item.label}
        isDisabled={Boolean(item.isDisabled)}
      >
        {item.label}
      </SelectItem>
    ));
  } else {
    // 경로 3 (legacy, P6 소멸): SelectItem element tree
    renderChildren = selectItemChildren.map((item, index) => {
      const actualValue = item.props.value || item.props.label || `option-${index + 1}`;
      return (
        <SelectItem
          key={item.id}
          id={String(actualValue)} // legacy fallback
          data-element-id={item.id}
          isDisabled={Boolean(item.props.isDisabled)}
        >
          {String(item.props.label || item.id)}
        </SelectItem>
      );
    });
  }

  return (
    <Select
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={(element.props as { style?: React.CSSProperties }).style}
      className={(element.props as { className?: string }).className}
      size={((element.props as { size?: "xs" | "sm" | "md" | "lg" | "xl" }).size) || "md"}
      iconName={
        (element.props as { iconName?: string }).iconName
          ? String((element.props as { iconName?: string }).iconName)
          : undefined
      }
      label={processedLabel}
      description={/* ... 기존 유지 */}
      errorMessage={/* ... 기존 유지 */}
      placeholder={processedPlaceholder}
      aria-label={ariaLabel}
      defaultSelectedKey={currentSelectedKey ? String(currentSelectedKey) : undefined}
      isDisabled={Boolean((element.props as { isDisabled?: boolean }).isDisabled)}
      isRequired={Boolean((element.props as { isRequired?: boolean }).isRequired)}
      isInvalid={Boolean((element.props as { isInvalid?: boolean }).isInvalid)}
      isQuiet={Boolean((element.props as { isQuiet?: boolean }).isQuiet || false)}
      necessityIndicator={
        (element.props as { necessityIndicator?: "icon" | "label" }).necessityIndicator
      }
      labelPosition={((element.props as { labelPosition?: "top" | "side" }).labelPosition) || "top"}
      name={(element.props as { name?: string }).name}
      autoFocus={Boolean((element.props as { autoFocus?: boolean }).autoFocus)}
      dataBinding={
        (element.dataBinding || element.props.dataBinding) as DataBinding | undefined
      }
      columnMapping={columnMapping}
      onSelectionChange={async (selectedKey) => {
        let actualValue: React.Key | undefined = selectedKey ?? undefined;

        if (hasItemsArray && selectedKey != null) {
          // Canonical: items[].id lookup
          const matched = storedItems!.find((it) => it.id === String(selectedKey));
          actualValue = matched?.value ?? selectedKey;
        } else if (
          selectedKey &&
          typeof selectedKey === "string" &&
          selectedKey.startsWith("react-aria-")
        ) {
          // legacy path (P6 소멸): react-aria-N 역매핑
          const index = parseInt(selectedKey.replace("react-aria-", "")) - 1;
          const selectedItem = selectItemChildren[index];
          if (selectedItem) {
            actualValue = String(
              selectedItem.props.value || selectedItem.props.label || `option-${index + 1}`,
            );
          }
        }

        const updatedProps = {
          ...element.props,
          selectedKey,
          selectedValue: actualValue,
        };

        updateElementProps(element.id, updatedProps);

        // ... 기존 IndexedDB update + postMessage 블록 그대로 유지 (L823-866) ...
      }}
      onOpenChange={/* 기존 L867-872 유지 */}
    >
      {renderChildren}
    </Select>
  );
};
```

**중요 (Residual Risk #5 보존)**: `hasValidTemplate` 분기 dataBinding 우선 순서는 그대로 유지. ADR 본문 "items 우선, dataBinding fallback" 문구는 부정확했고, breakdown 확정은 "dataBinding 우선, items fallback" (현 shared component 동작 보존).

- [ ] **Step 3.4: `renderComboBox` 동일 패턴 구현**

Edit `packages/shared/src/renderers/SelectionRenderers.tsx:882-1200`.

핵심 차이:

- `storedItems: StoredComboBoxItem[]`
- `<ComboBoxItem textValue={item.textValue ?? item.label}>`
- `onInputChange` reconcile 로직 추가 (L1176-1182 교체):

```typescript
      onInputChange={(rawInputValue) => {
        const runtimeItems = storedItems ?? [];
        const matchedItem = runtimeItems.find((it) => it.label === rawInputValue);
        const nextProps = {
          ...element.props,
          inputValue: rawInputValue,
          selectedKey: matchedItem?.id,
          selectedValue: matchedItem?.value,
        };
        updateElementProps(element.id, nextProps);
      }}
```

`onSelectionChange` (L1057-1120): Select 와 동일 패턴 — `hasItemsArray` 분기 시 items.find(it => it.id === selectedKey) 로 value/label 도출, react-aria-N 역매핑은 legacy 경로에만 유지.

`defaultInputValue`: `element.props.inputValue` 그대로 유지 (선택 상태 lookup 은 onInputChange reconcile 로 처리되므로 default 는 raw 유지).

- [ ] **Step 3.5: type-check 전체**

```bash
pnpm type-check
```

Expected: 3/3 통과. P2 에서 임시 격리했던 에러 모두 해소.

- [ ] **Step 3.6: 단위 테스트 + spec snapshot 회귀**

```bash
pnpm -F @composition/shared test -- selectCanonicalContract
pnpm -F @composition/specs test
```

Expected: 모두 PASS.

- [ ] **Step 3.7: Chrome MCP G2 실측 (수동)**

Gate G2 4-step 시나리오 (breakdown 기준):

1. Select element 생성 + `items = [{id:"a",label:"Apple",value:"APPLE"}, ...]` 설정 → dropdown 옵션 표시 확증
2. item A click → `element.props.selectedKey = "a"`, `selectedValue = "APPLE"` 확증 (Inspector)
3. ComboBox: item A 선택 → inputValue = "Apple" 동기화, 이어서 custom 타이핑 → selectedKey/Value undefined reconcile
4. 페이지 새로고침 → selectedKey 복원 + label 복원

실측 후 PASS/FAIL 기록. FAIL 시 breakdown L122-127 참조하여 재조정.

- [ ] **Step 3.8: Commit (P2 + P3 통합)**

```bash
git add packages/specs/src/components/Select.spec.ts \
        packages/specs/src/components/ComboBox.spec.ts \
        packages/specs/src/__tests__/__snapshots__/ \
        packages/shared/src/renderers/SelectionRenderers.tsx \
        packages/shared/src/renderers/__tests__/selectCanonicalContract.test.ts
git commit -m "feat(adr-073): P2+P3 Select/ComboBox items SSOT spec 전환 + renderer wiring + canonical contract"
```

---

## Task 4 (P4): Store API 일반화 + ItemsManager tag-agnostic

**Files:**

- Modify: `apps/builder/src/builder/stores/elements.ts:~210 (type), ~1461 (action)`
- Modify: `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:168-184`
- Create: `apps/builder/src/builder/stores/__tests__/itemsActions.test.ts`

**Scope:** 신규 `addItem/removeItem/updateItem` 추가 + 기존 `addMenuItem` 등을 thin wrapper 로. **Menu 회귀 0**.

- [ ] **Step 4.1: Store API 단위 테스트 작성 (RED)**

Create `apps/builder/src/builder/stores/__tests__/itemsActions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../elements";

describe("Store items actions (ADR-073 P4)", () => {
  let selectId: string;

  beforeEach(async () => {
    // 새 store 인스턴스 — vitest isolate 모드 권장. 또는 clearAll action 추가 사용.
    // Select element 생성
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      // ... 최소 state (createElementsSlice 초기값 참조)
    });
    selectId = "test-select-1";
    useStore.getState().elementsMap.set(selectId, {
      id: selectId,
      tag: "Select",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    } as any);
  });

  it("addItem: items 배열에 신규 item push + id 자동 생성", async () => {
    await useStore.getState().addItem(selectId, "items", { label: "Opt A" });
    const el = useStore.getState().elementsMap.get(selectId)!;
    expect(el.props.items).toHaveLength(1);
    expect(el.props.items[0]).toMatchObject({ label: "Opt A" });
    expect(el.props.items[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("removeItem: id 일치 항목 제거", async () => {
    await useStore
      .getState()
      .addItem(selectId, "items", { id: "fixed-id", label: "X" });
    await useStore.getState().removeItem(selectId, "items", "fixed-id");
    const el = useStore.getState().elementsMap.get(selectId)!;
    expect(el.props.items).toHaveLength(0);
  });

  it("updateItem: 특정 id patch 적용", async () => {
    await useStore
      .getState()
      .addItem(selectId, "items", { id: "x", label: "Old" });
    await useStore
      .getState()
      .updateItem(selectId, "items", "x", { label: "New", value: "V" });
    const el = useStore.getState().elementsMap.get(selectId)!;
    expect(el.props.items[0]).toMatchObject({
      id: "x",
      label: "New",
      value: "V",
    });
  });

  it("addMenuItem: Menu 회귀 0 — 신규 addItem wrapper 로 동작", async () => {
    useStore.getState().elementsMap.set("menu-1", {
      id: "menu-1",
      tag: "Menu",
      parent_id: null,
      page_id: "p1",
      order_num: 0,
      props: { items: [] },
    } as any);
    await useStore.getState().addMenuItem("menu-1", { label: "MI" });
    const menu = useStore.getState().elementsMap.get("menu-1")!;
    expect(menu.props.items).toHaveLength(1);
    expect(menu.props.items[0].label).toBe("MI");
  });

  it("addItem: 존재하지 않는 elementId → no-op (throw 없음)", async () => {
    await expect(
      useStore.getState().addItem("non-existent", "items", { label: "X" }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4.2: 테스트 실패 확증**

```bash
pnpm -F @composition/builder test -- itemsActions
```

Expected: FAIL — `addItem is not a function`.

- [ ] **Step 4.3: Store 일반 액션 구현**

Edit `apps/builder/src/builder/stores/elements.ts`.

L208-225 (타입 인터페이스) — `ElementsState` 에 신규 3 action 추가:

```typescript
// ADR-073: 일반화 items 조작 액션 (Menu/Select/ComboBox 공통)
addItem: (
  elementId: string,
  itemsKey: string,
  item?: Record<string, unknown>,
) => Promise<void>;
removeItem: (elementId: string, itemsKey: string, itemId: string) =>
  Promise<void>;
updateItem: (
  elementId: string,
  itemsKey: string,
  itemId: string,
  patch: Record<string, unknown>,
) => Promise<void>;
```

L1461-1508 (`addMenuItem` 등) — 교체:

```typescript
    // ADR-073: 일반화 액션 (tag-agnostic)
    addItem: async (elementId, itemsKey, item) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray((el.props as Record<string, unknown>)[itemsKey])
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<string, unknown>[])
        : [];
      const newItem = {
        label: "Item",
        ...(item ?? {}),
        id: (item?.id && String(item.id)) || crypto.randomUUID(),
      };
      await get().updateElementProps(elementId, {
        [itemsKey]: [...currentItems, newItem],
      });
    },

    removeItem: async (elementId, itemsKey, itemId) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray((el.props as Record<string, unknown>)[itemsKey])
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<string, unknown>[])
        : [];
      const next = currentItems.filter((it) => it.id !== itemId);
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    updateItem: async (elementId, itemsKey, itemId, patch) => {
      const el = get().elementsMap.get(elementId);
      if (!el) return;
      const currentItems = Array.isArray((el.props as Record<string, unknown>)[itemsKey])
        ? ((el.props as Record<string, unknown>)[itemsKey] as Record<string, unknown>[])
        : [];
      const next = currentItems.map((it) =>
        it.id === itemId ? { ...it, ...patch } : it,
      );
      await get().updateElementProps(elementId, { [itemsKey]: next });
    },

    // ADR-068 → ADR-073: Menu items SSOT 는 일반화 액션의 thin wrapper 로 리팩토링
    addMenuItem: async (menuId, item) => {
      return get().addItem(menuId, "items", item);
    },
    removeMenuItem: async (menuId, itemId) => {
      return get().removeItem(menuId, "items", itemId);
    },
    updateMenuItem: async (menuId, itemId, patch) => {
      return get().updateItem(menuId, "items", itemId, patch);
    },
    reorderMenuItems: async (menuId, fromIndex, toIndex) => {
      // reorder 는 일반화 대상 외 (ADR-073 scope 아님). 현 Menu-전용 유지.
      const menu = get().elementsMap.get(menuId);
      if (!menu || menu.tag !== "Menu") return;
      const items = ((menu.props.items ?? []) as StoredMenuItem[]).slice();
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= items.length ||
        toIndex >= items.length ||
        fromIndex === toIndex
      ) return;
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      await get().updateElementProps(menuId, { items });
    },
```

**참고**: Menu-only early return (`if (!menu || menu.tag !== "Menu")`) 는 제거됨. `addMenuItem` 은 thin wrapper 로 tag 상관없이 위임 (기존 Menu 동작 identical).

- [ ] **Step 4.4: 테스트 통과 확증**

```bash
pnpm -F @composition/builder test -- itemsActions
```

Expected: PASS (5/5).

- [ ] **Step 4.5: ItemsManager tag-agnostic 변환**

Edit `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:168-184`. 교체:

```typescript
const handleAdd = useCallback(() => {
  useStore.getState().addItem(elementId, itemsKey, field.defaultItem);
}, [elementId, itemsKey, field.defaultItem]);

const handleRemove = useCallback(
  (itemId: string) => {
    useStore.getState().removeItem(elementId, itemsKey, itemId);
  },
  [elementId, itemsKey],
);

const handleUpdate = useCallback(
  (itemId: string, patch: Record<string, unknown>) => {
    useStore.getState().updateItem(elementId, itemsKey, itemId, patch);
  },
  [elementId, itemsKey],
);
```

- [ ] **Step 4.6: Menu 회귀 type-check + UI 확증**

```bash
pnpm type-check
pnpm -F @composition/specs test
```

Chrome MCP 수동: Menu element → Items Manager → Add MenuItem → 신규 item 추가 확증 (ADR-068 동작 identical).

- [ ] **Step 4.7: Commit**

```bash
git add apps/builder/src/builder/stores/elements.ts \
        apps/builder/src/builder/stores/__tests__/itemsActions.test.ts \
        apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx
git commit -m "feat(adr-073): P4 store addItem/removeItem/updateItem 일반화 + ItemsManager tag-agnostic"
```

---

## Task 5 (P5): Migration + removeElements skipHistory 옵션

**Files:**

- Modify: `apps/builder/src/builder/stores/utils/elementRemoval.ts:183-194, 317-351`
- Create: `packages/shared/src/utils/migrateSelectComboBoxItems.ts`
- Create: `packages/shared/src/utils/__tests__/migrateSelectComboBoxItems.test.ts`

**근거 (Codex 4차 리뷰):** migration 시 element tree 자식 삭제가 undo 스택에 `"remove"` entry 누적 → stale entries. 해결: `removeElements(ids, { skipHistory: true })` 옵션.

**경로 결정 (Codex OQ):** 런타임 마이그레이션만 수행 (ADR-068 선례). DB SQL migration 은 생략. 필요 시 후속 작업.

- [ ] **Step 5.1: `removeElements({ skipHistory })` 옵션 테스트 작성**

먼저 `elementRemoval.test.ts` 신설 또는 기존 테스트 확장 (현 파일 존재 확인):

```bash
ls apps/builder/src/builder/stores/utils/__tests__/ 2>/dev/null || echo "dir absent"
```

디렉토리 없으면 생성 + 테스트 스켈레톤. 있으면 기존 파일 append.

Create `apps/builder/src/builder/stores/utils/__tests__/elementRemoval.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStore } from "../../elements";
import { historyManager } from "../../history";

describe("removeElements skipHistory option (ADR-073 P5)", () => {
  const addEntrySpy = vi.spyOn(historyManager, "addEntry");

  beforeEach(() => {
    addEntrySpy.mockClear();
    // Select + SelectItem fixtures
    useStore.setState({
      currentPageId: "p1",
      elements: [
        {
          id: "sel-1",
          tag: "Select",
          parent_id: null,
          page_id: "p1",
          order_num: 0,
          props: {},
        },
        {
          id: "si-1",
          tag: "SelectItem",
          parent_id: "sel-1",
          page_id: "p1",
          order_num: 0,
          props: {},
        },
      ],
      // ... elementsMap, childrenMap 재구축 (buildIndexes 호출 또는 수동)
    } as any);
  });

  it("default (skipHistory 미지정) — historyManager.addEntry 호출 됨", async () => {
    await useStore.getState().removeElements(["si-1"]);
    expect(addEntrySpy).toHaveBeenCalled();
  });

  it("skipHistory: true — historyManager.addEntry 호출 안 됨", async () => {
    await useStore.getState().removeElements(["si-1"], { skipHistory: true });
    expect(addEntrySpy).not.toHaveBeenCalled();
  });

  it("skipHistory: true 모드에서도 elementsMap 에서 삭제됨", async () => {
    await useStore.getState().removeElements(["si-1"], { skipHistory: true });
    expect(useStore.getState().elementsMap.get("si-1")).toBeUndefined();
  });
});
```

- [ ] **Step 5.2: 테스트 실패 확증**

```bash
pnpm -F @composition/builder test -- elementRemoval
```

Expected: FAIL — `removeElements` 현 signature 가 option parameter 미지원.

- [ ] **Step 5.3: `executeRemoval` + `createRemoveElementsAction` 옵션 추가**

Edit `apps/builder/src/builder/stores/utils/elementRemoval.ts`.

L165 `executeRemoval` signature 확장:

```typescript
async function executeRemoval(
  set: SetState,
  get: GetState,
  rootElements: Element[],
  allUniqueElements: Element[],
  options: { skipHistory?: boolean } = {},
) {
  // ... L171-180 그대로 ...

  const currentState = get();

  // L184-195 수정: skipHistory 가드
  if (currentState.currentPageId && !options.skipHistory) {
    historyManager.addEntry({
      type: "remove",
      elementId: rootElements[0].id,
      data: {
        element: { ...rootElements[0] },
        childElements: allUniqueElements
          .filter((el) => el.id !== rootElements[0].id)
          .map((child) => ({ ...child })),
      },
    });
  }

  // ... 이하 L197-287 그대로 ...
}
```

`createRemoveElementAction` / `createRemoveElementsAction` signature 확장:

```typescript
export const createRemoveElementAction =
  (set: SetState, get: GetState) =>
  async (elementId: string, options?: { skipHistory?: boolean }) => {
    const state = get();
    const result = collectElementsToRemove(/* ... */);
    if (!result) {
      /* ... */ return;
    }
    await executeRemoval(
      set,
      get,
      [result.rootElement],
      result.allElements,
      options,
    );
  };

export const createRemoveElementsAction =
  (set: SetState, get: GetState) =>
  async (elementIds: string[], options?: { skipHistory?: boolean }) => {
    if (elementIds.length === 0) return;

    if (elementIds.length === 1) {
      const removeElement = createRemoveElementAction(set, get);
      return removeElement(elementIds[0], options);
    }

    const state = get();
    const rootElements: Element[] = [];
    const allElementsMap = new Map<string, Element>();

    for (const id of elementIds) {
      const result = collectElementsToRemove(/* ... */);
      if (!result) continue;
      rootElements.push(result.rootElement);
      for (const el of result.allElements) allElementsMap.set(el.id, el);
    }

    if (rootElements.length === 0) return;
    const allUniqueElements = Array.from(allElementsMap.values());
    await executeRemoval(set, get, rootElements, allUniqueElements, options);
  };
```

Edit `apps/builder/src/builder/stores/elements.ts` 에서 `ElementsState` 타입 동기화:

```typescript
removeElement: (elementId: string, options?: { skipHistory?: boolean }) =>
  Promise<void>;
removeElements: (elementIds: string[], options?: { skipHistory?: boolean }) =>
  Promise<void>;
```

- [ ] **Step 5.4: 테스트 통과 확증**

```bash
pnpm -F @composition/builder test -- elementRemoval
pnpm type-check
```

Expected: 3/3 PASS + type-check 3/3.

- [ ] **Step 5.5: Migration util 테스트 작성**

Create `packages/shared/src/utils/__tests__/migrateSelectComboBoxItems.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { StoredSelectItem } from "@composition/specs";
import {
  selectItemChildrenToItemsArray,
  comboBoxItemChildrenToItemsArray,
} from "../migrateSelectComboBoxItems";

interface TestElement {
  id: string;
  tag: string;
  parent_id: string | null;
  order_num: number;
  props: Record<string, unknown>;
}

describe("selectItemChildrenToItemsArray (ADR-073 P5)", () => {
  it("SelectItem child elements → StoredSelectItem[]", () => {
    const children: TestElement[] = [
      {
        id: "si-1",
        tag: "SelectItem",
        parent_id: "sel-1",
        order_num: 0,
        props: { label: "Apple", value: "APPLE", isDisabled: false },
      },
      {
        id: "si-2",
        tag: "SelectItem",
        parent_id: "sel-1",
        order_num: 1,
        props: { label: "Banana", value: "BANANA", isDisabled: true },
      },
    ];
    const items: StoredSelectItem[] = selectItemChildrenToItemsArray(children);
    expect(items).toEqual([
      { id: "si-1", label: "Apple", value: "APPLE", isDisabled: false },
      { id: "si-2", label: "Banana", value: "BANANA", isDisabled: true },
    ]);
  });

  it("빈 배열 → 빈 배열", () => {
    expect(selectItemChildrenToItemsArray([])).toEqual([]);
  });

  it("order_num 기준 정렬 보존", () => {
    const children: TestElement[] = [
      {
        id: "b",
        tag: "SelectItem",
        parent_id: "sel",
        order_num: 2,
        props: { label: "B" },
      },
      {
        id: "a",
        tag: "SelectItem",
        parent_id: "sel",
        order_num: 0,
        props: { label: "A" },
      },
    ];
    const items = selectItemChildrenToItemsArray(children);
    expect(items.map((it) => it.id)).toEqual(["a", "b"]);
  });

  it("label 누락 시 id 로 fallback", () => {
    const children: TestElement[] = [
      { id: "x", tag: "SelectItem", parent_id: "sel", order_num: 0, props: {} },
    ];
    expect(selectItemChildrenToItemsArray(children)[0]).toMatchObject({
      id: "x",
      label: "x",
    });
  });
});
```

- [ ] **Step 5.6: 테스트 실패 확증**

```bash
pnpm -F @composition/shared test -- migrateSelectComboBoxItems
```

Expected: FAIL — module not found.

- [ ] **Step 5.7: Migration util 구현**

Create `packages/shared/src/utils/migrateSelectComboBoxItems.ts`:

```typescript
/**
 * ADR-073 P5: Select/ComboBox element tree → items[] 런타임 마이그레이션
 *
 * 프로젝트 로드 시 호출되어 legacy SelectItem/ComboBoxItem child element 를
 * Select.items[] / ComboBox.items[] StoredSelectItem[] / StoredComboBoxItem[] 배열로 흡수.
 *
 * 삭제는 `removeElements(childIds, { skipHistory: true })` 로 별도 수행 — undo 스택 보존.
 */

import type { StoredSelectItem, StoredComboBoxItem } from "@composition/specs";

interface ElementLike {
  id: string;
  tag: string;
  parent_id: string | null;
  order_num: number;
  props: Record<string, unknown>;
}

export function selectItemChildrenToItemsArray(
  selectItemChildren: ElementLike[],
): StoredSelectItem[] {
  return [...selectItemChildren]
    .sort((a, b) => a.order_num - b.order_num)
    .map((child) => {
      const p = child.props ?? {};
      return {
        id: child.id,
        label:
          typeof p.label === "string" && p.label.length > 0
            ? p.label
            : child.id,
        value: typeof p.value === "string" ? p.value : undefined,
        textValue: typeof p.textValue === "string" ? p.textValue : undefined,
        isDisabled: Boolean(p.isDisabled) || undefined,
        icon: typeof p.icon === "string" ? p.icon : undefined,
        description:
          typeof p.description === "string" ? p.description : undefined,
      };
    });
}

export function comboBoxItemChildrenToItemsArray(
  comboBoxItemChildren: ElementLike[],
): StoredComboBoxItem[] {
  return [...comboBoxItemChildren]
    .sort((a, b) => a.order_num - b.order_num)
    .map((child) => {
      const p = child.props ?? {};
      return {
        id: child.id,
        label:
          typeof p.label === "string" && p.label.length > 0
            ? p.label
            : child.id,
        value: typeof p.value === "string" ? p.value : undefined,
        textValue: typeof p.textValue === "string" ? p.textValue : undefined,
        isDisabled: Boolean(p.isDisabled) || undefined,
        icon: typeof p.icon === "string" ? p.icon : undefined,
        description:
          typeof p.description === "string" ? p.description : undefined,
      };
    });
}

/**
 * 마이그레이션 후 orphan child 삭제 (`removeElements` 호출 측에서 skipHistory 전달)
 *
 * 호출 측 예:
 *   const orphanIds = selectItemChildren.map(c => c.id);
 *   await store.removeElements(orphanIds, { skipHistory: true });
 */
```

- [ ] **Step 5.8: 테스트 통과 확증**

```bash
pnpm -F @composition/shared test -- migrateSelectComboBoxItems
```

Expected: PASS (4/4 + comboBox 동일 수).

- [ ] **Step 5.9: 프로젝트 로드 훅에 migration 연결 (선택적 — Gate G4 에서 재평가)**

Edit project-load entry point (예: `apps/builder/src/builder/stores/utils/projectLoad.ts` 또는 store init). 정확한 파일 위치 확인:

```bash
grep -rn "migrateMenuItems\|MenuItem children" apps/builder/src --include="*.ts" --include="*.tsx" | head -5
```

ADR-068 선례 참조하여 동일 경로에 추가. 스켈레톤:

```typescript
import {
  selectItemChildrenToItemsArray,
  comboBoxItemChildrenToItemsArray,
} from "@composition/shared/utils/migrateSelectComboBoxItems";

async function migrateSelectComboBoxItemsOnLoad(store) {
  const state = store.getState();
  const orphanIds: string[] = [];

  for (const [id, el] of state.elementsMap) {
    if (
      el.tag === "Select" &&
      !Array.isArray(el.props.items) &&
      el.props.items !== undefined
    ) {
      // items 가 StoredSelectItem[] 이 아닌 경우에만 migrate (legacy string[] or undefined)
    }
    if (el.tag === "Select") {
      const hasLegacyItems =
        Array.isArray(el.props.items) &&
        el.props.items.length > 0 &&
        typeof el.props.items[0] === "string";
      const children = (state.childrenMap.get(id) ?? []).filter(
        (c) => c.tag === "SelectItem",
      );
      if ((hasLegacyItems || children.length > 0) && !el.props.migrated_at) {
        const items =
          children.length > 0
            ? selectItemChildrenToItemsArray(children)
            : (el.props.items as string[]).map((label, i) => ({
                id: `legacy-${id}-${i}`,
                label,
              }));
        await state.updateElementProps(id, { items, migrated_at: Date.now() });
        for (const c of children) orphanIds.push(c.id);
      }
    }
    // 동일하게 ComboBox 처리
  }

  if (orphanIds.length > 0) {
    await state.removeElements(orphanIds, { skipHistory: true });
  }
}
```

**주의**: 정확한 hook 삽입 위치는 ADR-068 선례 migration 코드 확인 후 결정. P5 착수 시 실제 파일 위치 grep 으로 확정.

- [ ] **Step 5.10: type-check + 실측**

```bash
pnpm type-check
pnpm -F @composition/shared test
pnpm -F @composition/builder test
```

Chrome MCP 실측: 저장된 프로젝트 (SelectItem children 포함) 를 로드 → `items[]` 로 변환 확증 + undo 스택에 unexpected `"remove"` entry 없음 확증 (history panel 확인).

- [ ] **Step 5.11: Commit**

```bash
git add apps/builder/src/builder/stores/utils/elementRemoval.ts \
        apps/builder/src/builder/stores/utils/__tests__/elementRemoval.test.ts \
        apps/builder/src/builder/stores/elements.ts \
        packages/shared/src/utils/migrateSelectComboBoxItems.ts \
        packages/shared/src/utils/__tests__/migrateSelectComboBoxItems.test.ts
git commit -m "feat(adr-073): P5 migration util + removeElements skipHistory option"
```

---

## Task 6 (P6): Factory / Hierarchy / Canvas / Metadata 연쇄

**Files:**

- Modify: `apps/builder/src/builder/factories/definitions/SelectionComponents.ts:87, 215` (line 정확 grep 으로 재확인)
- Modify: `apps/builder/src/builder/utils/HierarchyManager.ts:402-409`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983`
- Modify: `packages/shared/src/components/metadata.ts` (SelectItem/ComboBoxItem entry 제거)
- Delete: `apps/builder/src/builder/panels/properties/editors/SelectItemEditor.tsx`
- Delete: `apps/builder/src/builder/panels/properties/editors/ComboBoxItemEditor.tsx`

**주의 (Residual Risk #4):** Menu 회귀 절대 0. 변경 전후 Menu 생성/편집/렌더 동작 identical 확증.

- [ ] **Step 6.1: SelectionComponents.ts factory 현 상태 읽기**

```bash
# Read SelectionComponents.ts lines 70-230
```

L87 (Select factory) + L215 (ComboBox factory) 에서 자동 child element 생성 블록 식별. 각 factory 가 Select/ComboBox element 생성 시 SelectItem child 2~3 개도 동시 생성하는 구조 예상.

- [ ] **Step 6.2: Select factory default items[] 주입으로 교체**

`SelectionComponents.ts` Select factory definition 수정:

```typescript
// BEFORE (L87 근처):
//   children 자동 생성 블록 (SelectItem × 2~3)
// AFTER:
{
  // ... Select factory 기본 props ...
  defaultProps: {
    // 기존 props
    items: [
      { id: crypto.randomUUID(), label: "Option 1", value: "option-1" },
      { id: crypto.randomUUID(), label: "Option 2", value: "option-2" },
      { id: crypto.randomUUID(), label: "Option 3", value: "option-3" },
    ],
  },
  // children 자동 생성 블록 **제거**
}
```

**중요**: Label / SelectTrigger / SelectValue sub-element 는 자동 생성 **유지** (items 만 items[] 로 흡수).

- [ ] **Step 6.3: ComboBox factory 동일 작업 (L215 근처)**

```typescript
defaultProps: {
  items: [
    { id: crypto.randomUUID(), label: "Option 1", value: "option-1" },
    { id: crypto.randomUUID(), label: "Option 2", value: "option-2" },
    { id: crypto.randomUUID(), label: "Option 3", value: "option-3" },
  ],
},
```

ComboBoxWrapper / ComboBoxInput / ComboBoxTrigger / Label sub-element 자동 생성 유지.

- [ ] **Step 6.4: HierarchyManager.ts Select/ComboBox 분기 수정**

Edit `apps/builder/src/builder/utils/HierarchyManager.ts:402-409`. 현 코드:

```typescript
      case "Select":
        return children.filter((child) => child.tag === "SelectItem");
      case "ComboBox":
        return children.filter((child) => child.tag === "ComboBoxItem");
```

items[] 기반 전환 후 SelectItem/ComboBoxItem child 가 element tree 에 **부재**. 대안:

```typescript
      case "Select":
      case "ComboBox":
        // ADR-073: items[] SSOT — SelectItem/ComboBoxItem 은 element tree 에 부재
        // Label/SelectTrigger/SelectValue/ComboBoxWrapper 등 sub-element 는 반환
        return children.filter((child) =>
          ["Label", "SelectTrigger", "SelectValue", "SelectIcon",
           "ComboBoxWrapper", "ComboBoxInput", "ComboBoxTrigger"].includes(child.tag),
        );
```

또는 `return children;` (모든 non-item sub-element 반환).

- [ ] **Step 6.5: canvas/layout utils `SELECT_HIDDEN_CHILDREN` 수정**

Edit `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1978-1983`:

```typescript
// ADR-073: SelectItem/ComboBoxItem 제거 (items[] SSOT 전환). ListBoxItem 은 ADR-074 전 유지.
const SELECT_HIDDEN_CHILDREN = new Set(["ListBoxItem"]);
```

- [ ] **Step 6.6: metadata.ts SelectItem/ComboBoxItem entry 제거**

Edit `packages/shared/src/components/metadata.ts`. SelectItem/ComboBoxItem entry 검색:

```bash
grep -n "SelectItem\|ComboBoxItem" packages/shared/src/components/metadata.ts
```

entry 블록 제거. Label/SelectTrigger/SelectValue/ComboBoxWrapper 등은 **유지**.

- [ ] **Step 6.7: SelectItemEditor / ComboBoxItemEditor 파일 삭제**

```bash
git rm apps/builder/src/builder/panels/properties/editors/SelectItemEditor.tsx
git rm apps/builder/src/builder/panels/properties/editors/ComboBoxItemEditor.tsx
```

이후 import 처 grep + 정리:

```bash
grep -rn "SelectItemEditor\|ComboBoxItemEditor" apps/builder/src --include="*.ts" --include="*.tsx"
```

SpecField.tsx 등 PropertyPanel dispatcher 에서 해당 case 제거.

- [ ] **Step 6.8: type-check + 전체 테스트**

```bash
pnpm type-check
pnpm -F @composition/specs test
pnpm -F @composition/shared test
pnpm -F @composition/builder test
```

Expected: 전체 PASS.

- [ ] **Step 6.9: Chrome MCP Gate G5 실측**

1. **신규 Select 생성** → layer panel 에 Select / Label / SelectTrigger(+SelectValue+SelectIcon) 확인. SelectItem 부재 확증.
2. **element.props.items** 에 default 3 개 주입 확증.
3. **Property Panel ItemsManager** 에서 Add Option → items[] 에 추가 확증.
4. **기존 저장 프로젝트 로드** (SelectItem children 포함) → P5 migration 로 items[] 변환 확증.
5. **Menu 회귀 0** — Menu element 생성 + 편집 + 저장 동작 identical (ADR-068 기준).

- [ ] **Step 6.10: Commit**

```bash
git add apps/builder/src/builder/factories/definitions/SelectionComponents.ts \
        apps/builder/src/builder/utils/HierarchyManager.ts \
        apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts \
        packages/shared/src/components/metadata.ts \
        apps/builder/src/builder/panels/properties/editors/
git commit -m "feat(adr-073): P6 SelectItem/ComboBoxItem element 소멸 (factory/hierarchy/canvas/metadata/editor)"
```

---

## Task 7 (Bonus): renderMenu selectionMode/selectedKeys wiring fix

**Files:**

- Modify: `packages/shared/src/renderers/CollectionRenderers.tsx:751`

**근거:** ADR-070 Negative. renderMenu 가 `element.props.selectionMode / selectedKeys / onSelectionChange` 를 `<MenuButton>`/`<Menu>` 에 미전달 → Inspector 변경이 inner Menu 에 반영 안 됨.

- [ ] **Step 7.1: 현 `renderMenu` 구조 파악**

```bash
sed -n '740,820p' packages/shared/src/renderers/CollectionRenderers.tsx
```

`<MenuButton>` 또는 `<Menu>` wrapper 에 3 props 없는 지 확증.

- [ ] **Step 7.2: 3 props 전달 추가**

Edit `CollectionRenderers.tsx:751` 근처. `<Menu>` 또는 내부 `<MenuPopover>` 에 추가:

```typescript
<Menu
  // 기존 props
  selectionMode={
    (element.props as { selectionMode?: "none" | "single" | "multiple" }).selectionMode || "none"
  }
  selectedKeys={
    (element.props as { selectedKeys?: string[] }).selectedKeys
      ? new Set((element.props as { selectedKeys: string[] }).selectedKeys)
      : undefined
  }
  onSelectionChange={(keys) => {
    const asArray = Array.from(keys) as string[];
    updateElementProps(element.id, {
      ...element.props,
      selectedKeys: asArray,
    });
  }}
>
```

- [ ] **Step 7.3: Chrome MCP Gate G6 실측**

1. Menu element 선택 → Inspector 에서 `selectionMode = "single"` 변경
2. preview 패널에서 Menu 열고 item 클릭 → 선택 상태 반영 확증
3. `element.props.selectedKeys` 에 선택 키 저장 확증 (Inspector 재확인)

- [ ] **Step 7.4: type-check**

```bash
pnpm type-check
```

- [ ] **Step 7.5: Commit**

```bash
git add packages/shared/src/renderers/CollectionRenderers.tsx
git commit -m "fix(adr-073): Bonus renderMenu selectionMode/selectedKeys/onSelectionChange wiring (ADR-070 Negative 해소)"
```

---

## Final Verification

- [ ] **Final.1: 전체 Gate 재확증**

| Gate | 실행 시점  | 조건                                                            | 상태 기록 |
| ---- | ---------- | --------------------------------------------------------------- | --------- |
| G1   | P1~P2 완료 | type-check + specs 테스트 PASS                                  | `_____`   |
| G2   | P3 완료    | Chrome MCP Select/ComboBox 4-step                               | `_____`   |
| G3   | P4 완료    | addItem 단위 테스트 + Menu 회귀 0                               | `_____`   |
| G4   | P5 완료    | migrate util 단위 테스트 + undo 스택 깨끗함                     | `_____`   |
| G5   | P6 완료    | Chrome MCP — SelectItem 부재 + default items 주입 + Menu 회귀 0 | `_____`   |
| G6   | Bonus 완료 | Chrome MCP Menu selectionMode 반영                              | `_____`   |

- [ ] **Final.2: verification-before-completion skill 실행**

```bash
pnpm type-check && pnpm -F @composition/specs test && pnpm -F @composition/shared test && pnpm -F @composition/builder test
```

Expected: 전체 GREEN.

- [ ] **Final.3: ADR-073 Status 갱신 + MEMORY.md entry + README 갱신**

Edit `docs/adr/073-select-combobox-items-ssot.md`:

- `## Status` 섹션 `Proposed — 2026-04-17` → `Implemented — 2026-04-18` (실행 일자 기준)

Edit `docs/adr/README.md`: ADR-073 행 상태/일자 갱신.

memory entry 갱신 (adr073-proposed-session 파일을 adr073-implemented-session 으로 rename 또는 별도 entry 추가).

- [ ] **Final.4: PR 생성 (gh CLI 필요)**

```bash
gh pr create --title "feat(adr-073): Select/ComboBox items SSOT + renderMenu wiring" --body "$(cat <<'EOF'
## Summary
- Select/ComboBox `items?: string[]` + element tree 이중 구조 → `items?: StoredSelectItem[]` / `StoredComboBoxItem[]` 풀 인터페이스 단일 SSOT 전환 (ADR-066/068 패턴 확장)
- Canonical selection contract 고정: `selectedKey = item.id`, `selectedValue = item.value`, `inputValue = items.find(it => it.id === selectedKey)?.label` (derived)
- Store `addItem/removeItem/updateItem` 일반화 + ItemsManager tag-agnostic + `removeElements({ skipHistory })` 옵션
- Bonus: renderMenu selectionMode/selectedKeys/onSelectionChange wiring (ADR-070 Negative 해소)

## Related
- ADR-073 (Proposed 2026-04-17)
- Breakdown: [073-select-combobox-items-ssot-breakdown.md](../../adr/design/073-select-combobox-items-ssot-breakdown.md)
- 선례: ADR-066 (Tabs items SSOT) / ADR-068 (Menu items SSOT)

## Test plan
- [x] type-check 3/3 PASS
- [x] `pnpm -F @composition/specs test` 전체 PASS (snapshot 무회귀)
- [x] `pnpm -F @composition/shared test` 전체 PASS (canonical contract + migration util)
- [x] `pnpm -F @composition/builder test` 전체 PASS (items actions + removeElements skipHistory)
- [x] Chrome MCP G2: Select/ComboBox dropdown + 선택 + placeholder + disabled + allowsCustomValue
- [x] Chrome MCP G5: 신규 Select/ComboBox 생성 → SelectItem 부재 + default items[] 주입 확증
- [x] Chrome MCP G5: 기존 저장 프로젝트 로드 → items[] 자동 migration 확증
- [x] Chrome MCP G5: Menu 회귀 0 (ADR-068 동작 identical)
- [x] Chrome MCP G6: Menu selectionMode/selectedKeys Inspector 반영 확증
- [x] undo 스택 깨끗함 (migration 후 unexpected "remove" entry 없음)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

위 플랜의 spec coverage 자체 검증:

- [x] **Spec coverage**: P1(Types) → ADR-073 Hard Constraint #5 (D2 정렬) / P2(Spec) → Hard Constraint #1,#2 / P3(Renderer + Canonical) → G2 / P4(Store API) → G3 + Codex #1 (Menu-only) 해소 / P5(Migration) → Hard Constraint #4 + Codex #4 (skipHistory) 해소 / P6(연쇄) → Codex #4 (Factory/Hierarchy/canvas) 해소 / P7(Bonus) → ADR-070 Negative. ADR-073 Decision 모든 bullet 커버.
- [x] **Placeholder scan**: 모든 step 에 actual code 또는 command 포함. "TBD" 없음.
- [x] **Type consistency**: `StoredSelectItem.id / label / value / textValue / isDisabled / icon / description / onActionId` 8 필드 전체 Task 동일. `addItem(elementId, itemsKey, item)` 3-arg signature 전체 Task 동일. `removeElements(ids, { skipHistory })` signature P5~P7 동일.
- [x] **Missing task**: Canonical contract 5차 리뷰 reconcile 로직 → P3 포함. Menu-only early return 제거 → P4 포함. Factory default items 주입 → P6 포함. Orphan skipHistory 삭제 → P5 포함. ADR-070 Negative → P7 포함.

**알려진 약점 (사전 플래그)**:

- Step 5.9 migration hook 삽입 위치 — ADR-068 선례 코드 grep 후 P5 착수 시 확정 필요 (플랜이 exact path 미제공)
- Step 6.1 SelectionComponents.ts 실제 L87/215 레이아웃은 P6 착수 시 재확인 (breakdown 은 line 수만 기록)
- Step 7.2 renderMenu 의 `<Menu>` props 전달 지점 — 현 구조 grep 후 확정 (스켈레톤만 제공)
- Vitest test file P4 Step 4.1 의 beforeEach — createElementsSlice 초기 state 복제 로직 필요 (vitest test isolation 미제공 시). 실제 착수 시 기존 `elements.test.ts` 등 참고하여 설정.

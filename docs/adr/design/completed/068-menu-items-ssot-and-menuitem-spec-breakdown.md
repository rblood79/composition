# ADR-068 구현 상세 — Menu items SSOT + MenuItem Spec 신설

> **본 문서는 ADR-068의 구현 상세**. 결정 근거는 [068-menu-items-ssot-and-menuitem-spec.md](../../completed/068-menu-items-ssot-and-menuitem-spec.md) 참조.
>
> **2026-04-17 1차 정정** (Codex 1차 리뷰): Q1→Q6(items 풀 인터페이스), Q7(per-item 흡수), Q8(shared SSOT) 결정 반영. P0 변경 대상 파일 표를 실제 저장소 기준으로 재고정 + Q5=(i) 일관성 위해 Builder Skia 등록 항목 제거.
>
> **2026-04-17 2차 정정** (Codex 2차 리뷰): Q8 정정(shared SSOT → **specs SSOT** — 패키지 의존 방향 `shared → specs` 단방향 유지), Stored/Runtime 인터페이스 분리, Q9 신설(`ItemsManagerField` 신규 타입), Q10 신설(`index.css` 수동 import 추가).

## Phase 구성

| Phase | 목표                                                                              | 의존성     | Gate                                                  |
| ----- | --------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| P0    | 사전 조사 — 현재 코드 위치 정밀 매핑                                              | -          | 변경 대상 파일 목록 확정 (실제 저장소 기준)           |
| P1    | items SSOT 타입(`menu-items.ts`) 신설 + MenuItem Spec 신설 + CSS + index.css 추가 | P0         | `pnpm build:specs` MenuItem.css 신규 생성, type-check |
| P2    | Menu Spec items prop 신설 (`StoredMenuItem[]` import)                             | P1         | type-check, MenuSpec props에 items 추가               |
| P3    | Store 데이터 모델 — items reducer (`StoredMenuItem` 패치)                         | P2         | items mutation reducer 단위 테스트                    |
| P4    | NavigationComponents factory — MenuItem element 생성 제거                         | P3         | `createMenuDefinition` items=[3개] 기본값으로 생성    |
| P5    | Preview 런타임 — Stored→Runtime 변환 + items 기반 렌더                            | P3         | `MenuButton items` prop 정상 동작 + onActionId lookup |
| P6    | Inspector — `ItemsManagerField` 신설 + 인스펙터 분기 + MenuItemEditor 폐기        | P3, P4     | 인스펙터 add/remove/edit 동작                         |
| P7    | 검증 — type-check + build:specs + Skia 시각 + Preview 시각 + items 변환 정합      | P1~P6 전체 | ADR Gate 표 9항목 PASS                                |

## P0. 사전 조사

### 변경 대상 파일 (실제 저장소 기준 — 2026-04-17 2차 정정)

| #   | 영역                          | 파일                                                                                           | 변경 유형                                                                                                                  |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | **types SSOT (신설)**         | `packages/specs/src/types/menu-items.ts` (Q8=가')                                              | 신규 — `StoredMenuItem` + `RuntimeMenuItem` 두 인터페이스 정의                                                             |
| 2   | types index                   | `packages/specs/src/types/index.ts`                                                            | `menu-items.ts` re-export                                                                                                  |
| 3   | Spec                          | `packages/specs/src/components/Menu.spec.ts`                                                   | items prop 추가 (`StoredMenuItem[]`), propagation 재정의, Item Management 필드 → `items-manager`                           |
| 4   | Spec (신설)                   | `packages/specs/src/components/MenuItem.spec.ts`                                               | 신규 파일 — CSS 자동 생성 전용                                                                                             |
| 5   | Spec index                    | `packages/specs/src/components/index.ts`                                                       | MenuItemSpec export 추가                                                                                                   |
| 6   | Specs root                    | `packages/specs/src/index.ts`                                                                  | MenuItemSpec re-export                                                                                                     |
| 7   | **인스펙터 필드 타입 (신설)** | `packages/specs/src/types/spec.types.ts`                                                       | `ItemsManagerField` 인터페이스 신설 (Q9=a) — `ChildrenManagerField`와 별개. `FieldDef` 유니온에 추가                       |
| 8   | shared Menu                   | `packages/shared/src/components/Menu.tsx:29-37`                                                | 기존 `MenuItem` 인터페이스 → **`StoredMenuItem`/`RuntimeMenuItem`으로 대체**. specs에서 import (Q8=가')                    |
| 9   | **index.css 수동 import**     | `packages/shared/src/components/styles/index.css:137` (Menu Components 섹션)                   | `@import "./generated/MenuItem.css";` 1줄 추가 (Q10=i)                                                                     |
| 10  | Factory                       | `apps/builder/src/builder/factories/definitions/NavigationComponents.ts`                       | createMenuDefinition children 제거 + items=[3개 `StoredMenuItem`] 기본                                                     |
| 11  | Store reducer                 | `apps/builder/src/builder/stores/elements/...` (items reducer 진입점)                          | addMenuItem/removeMenuItem/updateMenuItem (`Partial<StoredMenuItem>` 시그니처)                                             |
| 12  | Inspector UI                  | `apps/builder/src/builder/properties/.../children-manager.tsx` (또는 신설 `items-manager.tsx`) | `ItemsManagerField` 처리 컴포넌트 — items 배열 mutation reducer 호출                                                       |
| 13  | Inspector — 폐기              | `apps/builder/src/builder/panels/properties/editors/MenuItemEditor.tsx`                        | 파일 삭제 — per-item 13 props는 items 인스펙터의 인라인 폼으로 대체 (Q7=ii)                                                |
| 14  | Layer panel                   | `apps/builder/src/builder/layers/...`                                                          | MenuItem element 노드 비표시 (Menu 자식 0 표시는 정상)                                                                     |
| 15  | **Preview 런타임**            | `packages/shared/src/renderers/CollectionRenderers.tsx:735-765` (renderMenu)                   | childrenMap 직접 읽기 → `element.props.items` (`StoredMenuItem[]`) → `RuntimeMenuItem[]` 1회 변환                          |
| 16  | metadata                      | `packages/shared/src/components/metadata.ts:891-902`                                           | MenuItem entry — `hasCustomEditor: true` → false (per-item editor 폐기). supportedEvents는 유지                            |
| 17  | tagSpecMap (제외)             | ~~`apps/builder/src/builder/workspace/canvas/skia/elements/tagSpecMap.ts`~~                    | **변경 없음** (Q5=i — Builder Skia에 MenuItem 등록 미적용)                                                                 |
| 18  | TEXT_BEARING (제외)           | ~~`apps/builder/src/builder/workspace/canvas/skia/utils/specTextStyle.ts`~~                    | **변경 없음** (Q5=i)                                                                                                       |
| 19  | Skia 렌더 (제외)              | ~~`apps/builder/src/builder/workspace/canvas/skia/.../buildSpecNodeData.ts`~~                  | **변경 없음** — Menu trigger는 기존 Menu.spec render로 정상 height (자식 부재)                                             |
| 20  | 마이그레이션                  | (없음)                                                                                         | 개발 단계 — 기존 저장 broken 수용. 읽기 전용 호환 미제공 (Q7=ii)                                                           |
| 21  | **RenderContext 확장 (신설)** | `packages/shared/src/types/renderer.types.ts:95-115`                                           | `resolveActionId?: (id: string) => (() => void) \| undefined` 필드 추가 (Q11=나). Builder/Publish가 provider에서 각자 주입 |
| 22  | Builder resolver provider     | `apps/builder/src/preview/...` (RenderContext provider 지점)                                   | `events.registry.ts` resolver를 context에 주입                                                                             |
| 23  | Publish resolver provider     | `apps/publish/.../` (RenderContext provider 지점)                                              | Publish 이벤트 시스템 resolver 주입 (또는 no-op)                                                                           |

### 호출 지점 매핑

- `packages/shared/src/renderers/CollectionRenderers.tsx:735-765` — `renderMenu` (Preview 런타임 진입, **실제 변경 대상**)
- `packages/shared/src/renderers/CollectionRenderers.tsx:770-` — `renderMenuItem` (MenuItem element용 — items 전환 후 호출 0회 예상, dead code 검토)
- `packages/shared/src/components/Menu.tsx:29-37` — 기존 `MenuItem` 인터페이스 (specs로 이전)
- `packages/shared/src/components/Menu.tsx:62-67` — `useCollectionData` hook (dataBinding 패턴 — items SSOT와 공존, 우선순위 P5-2)
- `packages/shared/src/components/styles/index.css:137-138` — Menu Components 섹션 (`MenuItem.css` 추가 위치)
- `packages/specs/src/types/spec.types.ts:257-267` — `ChildrenManagerField` (참조; `ItemsManagerField`는 별개 신설)
- `apps/builder/src/builder/factories/definitions/NavigationComponents.ts:14-65` — `createMenuDefinition` (factory)
- `Menu.spec.ts:199-211` — `Item Management` field (`children-manager` → `items-manager`)
- `Menu.spec.ts:127` — propagation rule (`size → MenuItem`) — 제거

### items SSOT 인터페이스 (Q6=b, Q8=가', Codex 2차 정정 — Stored/Runtime 분리)

```ts
// packages/specs/src/types/menu-items.ts (신설 — types SSOT 위치)

/** Store 직렬화 모델 — JSON 가능 (onAction은 id 참조) */
export interface StoredMenuItem {
  id: string;
  label: string;
  isDisabled?: boolean;
  icon?: string;
  shortcut?: string;
  description?: string;
  // Q7=(ii) per-item 기능 흡수 (MenuItemEditor.tsx 13 props 회수)
  value?: string;
  textValue?: string;
  href?: string;
  onActionId?: string; // EVENT_REGISTRY (ADR-055) 참조 id — JSON 직렬화 가능
  children?: StoredMenuItem[]; // 서브메뉴 (재귀)
}

/** Runtime 모델 — RAC `<Menu items>{...}` 호출 직전 변환 */
export interface RuntimeMenuItem extends Omit<
  StoredMenuItem,
  "onActionId" | "children"
> {
  onAction?: () => void; // CollectionRenderers에서 onActionId → 함수 변환
  children?: RuntimeMenuItem[];
}
```

shared `Menu.tsx`가 이 타입을 import. Builder/Preview 양쪽 동일 import (변환 레이어 0).

## P1. items SSOT 타입 + MenuItem Spec 신설 + index.css

### 1-1. `packages/specs/src/types/menu-items.ts` 신설 (Q8=가')

위 인터페이스 정의 그대로 작성.

### 1-2. `packages/specs/src/types/index.ts` re-export

```ts
export type { StoredMenuItem, RuntimeMenuItem } from "./menu-items";
```

### 1-3. MenuItem.spec.ts 작성 (CSS 생성 전용)

```ts
// packages/specs/src/components/MenuItem.spec.ts
import type { ComponentSpec, Shape, TokenRef } from "../types";

export interface MenuItemProps {
  size?: "sm" | "md" | "lg" | "xl";
  // Spec은 CSS 자동 생성 전용 (Q5=i — Builder Skia 미등록)
}

export const MenuItemSpec: ComponentSpec<MenuItemProps> = {
  name: "MenuItem",
  description: "Menu item — CSS 자동 생성 전용 (Builder Skia 미등록, Q5=i)",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: false,
  defaultSize: "md",
  sizes: {
    /* Menu.sizes 매핑 (sm/md/lg/xl) */
  },
  states: {
    /* hover/focusVisible/disabled */
  },
  render: {
    shapes: () => [], // 빈 shapes — Skia 미사용 (CSS 메타만 활용)
    react: () => ({}),
  },
};
```

### 1-4. CSS 생성 + index.css 수동 import 추가 (Q10=i)

```bash
pnpm build:specs
# → packages/shared/src/components/styles/generated/MenuItem.css 신규 생성
```

`packages/shared/src/components/styles/index.css:137` Menu Components 섹션:

```diff
  /* Menu Components */
  @import "./generated/Menu.css";
+ @import "./generated/MenuItem.css";
  @import "./generated/Autocomplete.css";
```

**검증**: `generate-css.ts`는 index.css 자동 갱신 안 함 — 수동 추가 필수 (Gate #8).

### 1-5. types/index export

```ts
// packages/specs/src/components/index.ts
export { MenuItemSpec } from "./MenuItem.spec";
export type { MenuItemProps } from "./MenuItem.spec";
```

## P2. Menu Spec items prop 신설

### 2-1. items 타입 import (specs SSOT — Q8=가')

```ts
// Menu.spec.ts MenuProps 확장
import type { StoredMenuItem } from "../types/menu-items";

export interface MenuProps {
  // ... 기존 props
  items?: StoredMenuItem[]; // Q6=b 풀 인터페이스 (specs SSOT)
}
```

### 2-2. defaultProps + properties 변경

- properties.sections "Item Management" 필드 → `type: "items-manager"` (Q9=a — 신규 `ItemsManagerField`)
- `defaultChildProps`/`childTag` 필드 폐기 (element tree 미사용)
- per-item field 정의는 `ItemsManagerField` 내부 schema로 정의 (label, value, href, isDisabled, icon, shortcut, description, onActionId — Q7=ii)

### 2-3. propagation 정리

- 기존 `{ parentProp: "size", childPath: "MenuItem", override: true }` **제거** (MenuItem element 미존재)
- size는 Menu.props.size → MenuItem CSS 자동 적용 ([data-size] 셀렉터)

### 2-4. `ItemsManagerField` 타입 신설 (Q9=a — `spec.types.ts`)

```ts
// packages/specs/src/types/spec.types.ts (line 257 ChildrenManagerField와 별개)

export interface ItemsManagerFieldItemSchema {
  key: string;
  type: "string" | "boolean" | "icon" | "event-id";
  label: string;
}

export interface ItemsManagerField extends BaseFieldDef {
  type: "items-manager";
  /** items prop key (e.g. "items") */
  itemsKey: string;
  /** items 항목 타입 이름 (디버깅/UI 라벨용, e.g. "MenuItem") */
  itemTypeName: string;
  /** 새 항목 추가 시 기본 값 */
  defaultItem: Record<string, unknown>;
  /** 항목 인라인 편집 schema */
  itemSchema: ItemsManagerFieldItemSchema[];
  /** 라벨로 표시할 키 (e.g. "label") */
  labelKey?: string;
  /** 중첩 자식 허용 (서브메뉴 등) */
  allowNested?: boolean;
}
```

`FieldDef` 유니온에 `ItemsManagerField` 추가.

## P3. Store 데이터 모델

### 3-1. items reducer (`StoredMenuItem` 패치)

```ts
// stores/elements 슬라이스
import type { StoredMenuItem } from "@composition/specs/types";

function addMenuItem(menuId: string, item?: Partial<StoredMenuItem>) {
  const menu = elementsMap.get(menuId);
  if (!menu || menu.tag !== "Menu") return;
  const items = (menu.props.items ?? []) as StoredMenuItem[];
  const newItem: StoredMenuItem = {
    id: item?.id ?? crypto.randomUUID(),
    label: item?.label ?? "Menu Item",
  };
  updateElementProps(menuId, { items: [...items, newItem] });
  // 자동: layoutVersion bump (items 변화 → Menu trigger 재렌더, popover 컨텐츠 재계산)
}

function removeMenuItem(menuId: string, itemId: string) {
  const menu = elementsMap.get(menuId);
  const items = ((menu?.props.items ?? []) as StoredMenuItem[]).filter(
    (i) => i.id !== itemId,
  );
  updateElementProps(menuId, { items });
}

function updateMenuItem(
  menuId: string,
  itemId: string,
  patch: Partial<StoredMenuItem>,
) {
  const menu = elementsMap.get(menuId);
  const items = ((menu?.props.items ?? []) as StoredMenuItem[]).map((i) =>
    i.id === itemId ? { ...i, ...patch } : i,
  );
  updateElementProps(menuId, { items });
}
```

### 3-2. per-item event 직렬화 (Q7=ii) — Stored vs Runtime 분리

- **Store**: `StoredMenuItem.onActionId?: string` (EVENT_REGISTRY ADR-055 참조 id)
- **Runtime**: `CollectionRenderers.tsx:renderMenu`에서 `onActionId → onAction` 함수 변환 (P5)
- 인스펙터: `ItemsManagerField.itemSchema`에 `{ key: "onActionId", type: "event-id" }` 정의 → 이벤트 선택 드롭다운 노출

### 3-3. 가상 MenuItem 인덱스

Q5=i로 Builder Canvas에서 가상 MenuItem 미렌더 → spatialIndex 등록 불요.

## P4. NavigationComponents factory

### 4-1. createMenuDefinition 변경

```ts
// Before: children: [MenuItem×3]
// After:
import type { StoredMenuItem } from "@composition/specs/types";

export function createMenuDefinition(...) {
  const items: StoredMenuItem[] = [
    { id: crypto.randomUUID(), label: "Menu Item 1" },
    { id: crypto.randomUUID(), label: "Menu Item 2" },
    { id: crypto.randomUUID(), label: "Menu Item 3" },
  ];
  return {
    tag: "Menu",
    props: { size: "md", items },
    // children 필드 제거
  };
}
```

### 4-2. element 삭제 시 cascade 미필요

items은 Menu element props에 포함 → Menu 삭제 시 items도 함께 삭제 (별도 cascade 불요).

## P5. Preview 런타임 (CollectionRenderers.tsx — 핵심 변경 + Stored/Runtime 변환)

### 5-1. renderMenu 변경

**Before** (`packages/shared/src/renderers/CollectionRenderers.tsx:735-765`):

```tsx
const menuItemChildren = (context.childrenMap.get(element.id) ?? []).filter(
  (child) => child.tag === "MenuItem",
);
return (
  <MenuButton ...>
    {menuItemChildren.map((child) => renderElement(child, child.id))}
  </MenuButton>
);
```

**After** (Q11=나 — resolveActionId를 context에서 주입받음):

```tsx
import type { StoredMenuItem, RuntimeMenuItem } from "@composition/specs/types";
// Q11=(나): shared 렌더러는 EVENT_REGISTRY에 직접 의존하지 않음

function toRuntime(
  item: StoredMenuItem,
  resolve?: (id: string) => (() => void) | undefined,
): RuntimeMenuItem {
  return {
    ...item,
    onAction: item.onActionId ? resolve?.(item.onActionId) : undefined,
    children: item.children?.map((c) => toRuntime(c, resolve)),
  };
}

export const renderMenu = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const stored = (element.props.items ?? []) as StoredMenuItem[];
  const runtime = stored.map((it) => toRuntime(it, context.resolveActionId));
  return (
    <MenuButton
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      label={String(element.props.label || element.props.children || "Menu")}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      items={runtime}
      style={element.props.style}
      className={element.props.className}
      dataBinding={
        (element.dataBinding || element.props.dataBinding) as
          | DataBinding
          | undefined
      }
    />
  );
};
```

### 5-2. items vs dataBinding 우선순위

`Menu.tsx:62-67` `useCollectionData`는 dataBinding 우선. 결정:

- dataBinding 있음 → useCollectionData 결과 사용 (현행 유지)
- dataBinding 없음 → `items` prop 사용 (신규 SSOT 경로)

### 5-3. renderMenuItem dead code 검토

`CollectionRenderers.tsx:770-` `renderMenuItem`은 MenuItem element 호출 경로. items 전환 후 호출 0회 예상 → dead code 제거 (P5 마지막 단계).

### 5-4. shared `Menu.tsx` — 인터페이스 교체 + items prop 명시

```ts
// packages/shared/src/components/Menu.tsx
import type { StoredMenuItem, RuntimeMenuItem } from "@composition/specs/types";

// 기존 line 29-37 `MenuItem` 인터페이스 제거 (specs로 이전)
// 외부 사용처 import 경로 갱신: @composition/shared/components/Menu → @composition/specs/types

export interface MenuButtonProps<T>
  extends MenuProps<T>, Omit<MenuTriggerProps, "children"> {
  label?: string;
  items?: RuntimeMenuItem[]; // 명시 (Stored가 아닌 Runtime — render function 호출 직전)
  // ...
}
```

## P6. Inspector — `ItemsManagerField` + 기존 children-manager 분리

### 6-1. 신설 `items-manager.tsx` 컴포넌트

```ts
// apps/builder/src/builder/properties/.../items-manager.tsx (신설)
// ItemsManagerField를 처리 — items 배열 mutation reducer 호출
// 기존 children-manager.tsx와 분리 (Q9=a 결정)
```

### 6-2. Menu inspector "Item Management" section

`Menu.spec.ts` properties:

```ts
{
  title: "Item Management",
  fields: [
    {
      type: "items-manager", // Q9=a
      itemsKey: "items",
      itemTypeName: "MenuItem",
      labelKey: "label",
      allowNested: true,
      defaultItem: { label: "Menu Item" },
      itemSchema: [
        { key: "label", type: "string", label: "Label" },
        { key: "value", type: "string", label: "Value" },
        { key: "href", type: "string", label: "URL" },
        { key: "isDisabled", type: "boolean", label: "Disabled" },
        { key: "icon", type: "icon", label: "Icon" },
        { key: "shortcut", type: "string", label: "Shortcut" },
        { key: "description", type: "string", label: "Description" },
        { key: "onActionId", type: "event-id", label: "Action" },
      ],
    },
  ],
},
```

- Add Item 버튼 → `addMenuItem(menuId)` dispatch
- Remove → `removeMenuItem(menuId, itemId)` dispatch
- Edit field → `updateMenuItem(menuId, itemId, patch)` dispatch
- 빈 메뉴 허용 (Q3) → minimum guard 미적용

### 6-3. MenuItemEditor.tsx 폐기

- 기존 `apps/builder/src/builder/panels/properties/editors/MenuItemEditor.tsx` 파일 삭제
- per-item 13 props는 `items-manager`의 인라인 폼 (`itemSchema`)으로 대체
- `metadata.ts:891-902` MenuItem entry: `hasCustomEditor: true` → `false`, `editorName: "MenuItemEditor"` 제거

## P7. 검증 (Gate)

| #   | 검증 항목                     | 통과 조건                                                                                         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `pnpm build:specs`            | 107 → **108** CSS 생성 (MenuItem.css 신규 추가)                                                   |
| 2   | `pnpm type-check`             | 3/3 successful                                                                                    |
| 3   | 신규 Menu 요소 삽입           | items=[3개] 기본 + Menu trigger Skia 정상 height (CSS와 시각 동일)                                |
| 4   | Inspector Item Management     | items add/remove/edit (per-item field 포함) → Skia/Preview 동기 반영                              |
| 5   | Preview popover 동작          | Menu 클릭 → popover 열림 → items 3개 정상 표시 (RAC 동작) + MenuItem.css 적용                     |
| 6   | Skia 시각 (popover 닫힘 상태) | Menu trigger 정상 (0-height 버그 해소 — `/cross-check` 통과)                                      |
| 7   | per-item event 동작           | onActionId → runtime onAction 함수 변환 → 클릭 시 정상 dispatch                                   |
| 8   | `index.css` 수동 import 추가  | line 137 Menu Components 섹션에 `@import "./generated/MenuItem.css";` 추가 (Gate ADR #8)          |
| 9   | items 변환 정합               | `StoredMenuItem[] → RuntimeMenuItem[]` 변환에서 `onActionId → onAction` lookup 정상 (Gate ADR #9) |

## Risk Threshold Check (재확인)

| 대안     | HIGH+ | 잔존 위험                                                                                                                                                        |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E (선택) | 0     | items + dataBinding 우선순위 결정 (LOW), per-item event 직렬화 메커니즘 (Stored/Runtime 분리로 해결, LOW), index.css 수동 import 누락 위험 (Gate #8로 검증, LOW) |

## Phase별 commit 분할

- C1 (P0~P1): types/menu-items.ts + MenuItemSpec + index.css 수동 import 1줄
- C2 (P2~P3): Menu items prop + ItemsManagerField 타입 + Store reducer + Stored/Runtime 변환
- C3 (P4): factory 변경
- C4 (P5): CollectionRenderers items 전환 + renderMenuItem dead code 제거
- C5 (P6): Inspector items-manager 컴포넌트 + MenuItemEditor 폐기
- C6 (P7): 검증 + 문서

## 잠재적 회귀

- 기존 저장된 Menu element 자식(MenuItem) — 개발 단계 broken 수용 (Q7=ii로 (iii) 옵션 기각)
- propagation rule `size → MenuItem` 제거로 인한 MenuItem element가 잔존하는 페이지 영향 — broken 수용 범위
- Layer panel에서 Menu element는 자식 0 표시 (정상)
- `MenuItemEditor.tsx` 폐기 — 기존 저장된 Menu의 per-MenuItem 편집 UX 완전 소멸 (`items-manager`로 대체)
- shared `Menu.tsx`의 기존 `MenuItem` import 사용처 — `@composition/specs/types`로 import 경로 갱신 필요 (잠재 영향: shared 외부 사용처 grep 검증)
- `index.css` 수동 import 1줄 누락 시 Preview popover 내 MenuItem 스타일 미적용 (Gate #8)

## 후속 작업 (별도 ADR)

- Select/ComboBox/SelectItem/ComboBoxItem 동일 패턴 적용 (Q4=별도 ADR — 본 ADR의 `StoredMenuItem`/`RuntimeMenuItem`/`ItemsManagerField` 패턴 재사용)
- Builder popover preview UX (Q5=(iii) 옵션) — 후속 UX ADR. 적용 시 본 Spec의 tagSpecMap/TEXT_BEARING_SPECS 등록 추가
- per-item event 직렬화 정식화 — `onActionId` 패턴 본 ADR 채택, 추후 EVENT_REGISTRY 확장 ADR (`event-id` 필드 타입 표준화)

# ADR-076 Implementation Breakdown — ListBox items SSOT + containerStyles Hybrid (ListBoxItem 듀얼 모드 보존)

> ADR 본문: [076-listbox-items-ssot-hybrid.md](../completed/076-listbox-items-ssot-hybrid.md)
>
> Codex 1차 리뷰 반영 — 2026-04-18. 템플릿 모드 ListBoxItem(Field 자식 보유) 보존 + Popover debt 실제 출처(Popover.css:30) + reorder 일반화 부재 + layout 감사 선행 요구.

## 0. 사전 실측 (착수 결정의 근거)

### 0-1. containerStyles 로 SSOT 복귀 가능 (Generator 현재 능력 내)

| CSS 요소                                                                    | 현재 값   | Generator 경로                                   |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| `display: flex; flex-direction: column`                                     | base      | `containerStyles.display/flexDirection`          |
| `padding`, `gap`, `border`, `border-radius`, `background: var(--bg-raised)` | base      | `containerStyles.*` (ADR-071 Menu 선례 재사용)   |
| `color: var(--fg)`                                                          | base      | `variants.default.text` TokenRef                 |
| `max-height: 300px; overflow: auto`                                         | base      | `containerStyles.maxHeight/overflow`             |
| `&[data-focus-visible] { outline: ... }`                                    | base      | `states.focusVisible.focusRing` (ADR-061)        |
| `&[data-empty]` center/italic/muted                                         | base      | `states["data-empty"]` (신규 state key 필요)     |
| `--lb-*` size 변수군                                                        | size 변수 | `containerStyles.cssVars` 또는 `sizes.{md}` 주입 |

### 0-2. Generator 커버 불가 — 수동 CSS 유지 (파일 상단 `@see ADR-076 §0-2` 주석)

| 복잡 selector                                                                        | ListBox.css 라인            | 이유                                                         |
| ------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| `[data-orientation="horizontal"]` + `[data-layout="grid"]` 전환                      | 127–179                     | 복합 attribute selector. Generator 미지원. **0-5 감사 필수** |
| `[data-layout="grid"]` grid-template-columns                                         | 182–188                     | CSS Grid. 0-5 감사 필수                                      |
| `[data-layout="grid"][data-orientation="horizontal"]` grid-template-areas            | 190–227                     | Generator 범위 밖. 0-5 감사 필수                             |
| `.react-aria-Popover[data-trigger="ComboBox"\|"Select"] .react-aria-ListBox` context | 246–293                     | 부모 selector override                                       |
| `&[data-selected]::before { content: "✓" }`                                          | 274–285                     | pseudo-element                                               |
| `&:after { content: "✓" }` (grid variant)                                            | 151–171                     | 동일                                                         |
| `[data-variant="primary\|secondary\|tertiary\|error\|filled"]` 5종                   | 296–355                     | Spec 2종 vs CSS 5종. 별도 ADR                                |
| DnD / virtualized / forced-colors                                                    | 230–243 / 358–393 / 396–400 | state/media 미모델                                           |

### 0-3. Decision 요약

- SSOT 복귀 비율: **실질 약 20%** — 컨테이너 base(flex-column, padding, gap, border, border-radius, background, maxHeight, overflow) + size cssVars 만 (Codex 2차 §2 반영. 초기 초안의 "40%" 는 ListBoxItem base 포함 가정으로 Generator 가 자식 selector emit 불가능하여 불성립)
- 수동 유지: **약 80%** — ListBoxItem base(60-124) + orientation/layout(127-227) + Popover-context(246-293) + variant 5종 dead selector(296-355) + DnD/virtualized/forced-colors(230-400)
- 전면 해체(대안 A)는 CRITICAL BC — 기각됨

### 0-4. ADR-072 `_hasChildren` 분류

ListBox 는 **현재 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 에 포함**. ADR-076 이후에도 유지 (shapes 가 items props 참조). Shell-only 이동 금지.

### 0-5. orientation/layout 실사용 감사 (G0-(b) 선행 조건)

**목적**: Hard Constraint #5 의 근거 확보. CSS dead selector 여부 판정.

**감사 절차**:

```bash
# 1. Spec/Factory 에서 layout prop 선언/전달 확인
grep -rn "layout=\"grid\"\|orientation=\"horizontal\"" apps/ packages/

# 2. 런타임 ListBox 인스턴스에 layout prop 전달 경로
grep -rn "<ListBox" apps/builder/src packages/shared/src/renderers

# 3. 실제 프로젝트 데이터 (IndexedDB dump 또는 Supabase elements 테이블)
# → elements WHERE tag='ListBox' AND props->>'layout' IS NOT NULL
```

**판정 규칙**:

- 감사 결과 **실사용 0 프로젝트 + Spec/Factory 전달 경로 0**: dead CSS 로 판정. ListBox.css `data-layout` / `data-orientation="horizontal"` 블록 삭제 가능 (Phase 2 에 포함 or 별도 clean-up 커밋)
- 감사 결과 **실사용 ≥1 또는 Spec/Factory 전달 경로 존재**: Hard Constraint #5 유지, CSS 수동 보존

**Gate G0-(b)**: 감사 실행 + 결과 기록 (이 섹션에 결과 추가 후 Phase 1 착수).

**감사 결과 (2026-04-18 세션, Phase 1 착수 시점)**:

- `grep -rn 'layout="grid"\|orientation="horizontal"' apps/ packages/` → **ListBox 대상 0건**
  - `dashboard/index.tsx:99`, `BottomPanelSlot.tsx:98` = 비-ListBox
  - `export.utils.ts:470` = CSS 문자열 (`[data-layout="grid"] { display: grid; }`) — prop 전달 아님
- `grep 'layout\|orientation' packages/specs/src/components/ListBox.spec.ts` → **0 matches** (Spec 미선언)
- `createListBoxDefinition` (`SelectionComponents.ts:210+`) → layout/orientation prop default **없음**
- `<ListBox>` 직접 사용처 27곳 (builder 내부 property/events UI) — 전부 `className` 만 전달, `layout/orientation` prop **없음**
- 실제 사용자 프로젝트 IndexedDB/Supabase 데이터 감사는 Chrome/DB 필요 — 본 세션 미수행

**판정**: Spec/Factory/사용처 전달 경로 **0건**으로 확증 → **dead CSS** 로 분류 가능한 근거 확보. 단 실사용자 프로젝트 IndexedDB 확인 미수행 — **보수 정책**: 본 ADR 에서는 Hard Constraint #7 유지 (CSS 127–227 라인 수동 보존). Phase 2 에서 Chrome MCP 로 사용자 프로젝트 dump 감사 후 별도 clean-up 커밋으로 삭제 판단.

### 0-6. ListBoxItem 듀얼 모드 감사 (G0-(c) 선행 조건)

**Codex 1차 리뷰 확증** — ListBoxItem 은 두 가지 모드로 사용된다:

| 모드       | 트리거                                                                        | 자식                                     | 렌더 경로                                                                                         |
| ---------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **정적**   | `props.label/value/description/isDisabled` 또는 자식 Text/Description element | Text/Description element 0+ (Field 없음) | `SelectionRenderers.tsx` Path 3 (legacy children fallback) — 마이그레이션 후에는 Path 2 (items[]) |
| **템플릿** | 부모 ListBox 가 `columnMapping` 또는 `PropertyDataBinding` 보유               | Field element ≥1                         | `SelectionRenderers.tsx:78-133` `hasValidTemplate` 분기 → `DataField` 동적 컬럼 렌더              |

**감사 절차**:

```bash
# 1. 템플릿 모드 ListBox 실사용 확인
#    tag='ListBox' AND (props->>'columnMapping' IS NOT NULL OR dataBinding.source IN ('dataTable'))
# 2. Field 자식 보유 ListBoxItem 수
#    parent.tag='ListBoxItem' AND child.tag='Field'
```

**판정 규칙**:

- 템플릿 모드 실사용 ≥1: 본 ADR 설계 유지(듀얼 분기)
- 실사용 0: 템플릿 모드 마이그레이션 범위 확장 고려(선택)

**결과 기록**: 감사 후 이 섹션에 실사용 카운트 기록 + Phase 5 마이그레이션 분기 로직 확증.

**감사 결과 (2026-04-18 세션, Phase 1 착수 시점)**:

- `SelectionRenderers.tsx:60-83` `renderListBox` 에서 `columnMapping` + `PropertyDataBinding` 분기 실존 확인 — `hasValidTemplate` 기준 `(columnMapping || isPropertyBinding) && listBoxChildren.length > 0`
- `SelectionRenderers.tsx:179` + `250` — 템플릿 렌더 경로에 `columnMapping` prop 전달 확인 (GridList/Select/ComboBox 에도 동일 패턴 적용됨 — `hasValidTemplate` 변수 8회 검출: ListBox/GridList/Select/ComboBox 4종)
- `ListBoxItemEditor.tsx` "Field Management" UI — 템플릿 모드 편집 도구 확증 (ADR 본문 `:51-170` 인용)
- 실제 사용자 프로젝트에서 `tag='ListBox' AND columnMapping IS NOT NULL` 카운트는 Chrome/DB 감사 필요 — 본 세션 미수행

**판정**: 코드 경로 차원에서 듀얼 모드 실존 확증. 본 ADR 설계(듀얼 분기 + 혼합 금지 3계층 가드) 근거 충분. 템플릿 모드 실사용 카운트 확인은 Phase 5 Chrome MCP 검증에서 병행.

---

## 1. Phase 구조

### Phase 1 — Types + 감사 결과 반영

**파일**: `packages/specs/src/types/listbox-items.ts` (신설)

```ts
export interface StoredListBoxItem {
  id: string;
  label: string;
  value?: string;
  description?: string;
  isDisabled?: boolean;
  href?: string;
  textValue?: string;
}

export interface RuntimeListBoxItem extends StoredListBoxItem {
  index: number;
}

export function toRuntimeListBoxItem(
  item: StoredListBoxItem,
  index: number,
): RuntimeListBoxItem;
```

**병행 작업**: §0-5/0-6 감사 결과를 본 문서에 기록. Hard Constraint #5 유지/완화 최종 결정.

**Gate G1**: type-check specs/shared PASS.

---

### Phase 2 — Spec 전환

**파일**: `packages/specs/src/components/ListBox.spec.ts`

| 변경                                             | Before                                                                       | After                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| items 타입                                       | `items?: string[]`                                                           | `items?: StoredListBoxItem[]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| selectedKey 추가                                 | `selectedIndex?: number`                                                     | `selectedKey?: string` (+ `selectedIndex` deprecated alias)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| selectedKeys 추가                                | `selectedIndices?: number[]`                                                 | `selectedKeys?: string[]` (+ `selectedIndices` deprecated alias)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| containerStyles                                  | 없음                                                                         | 0-1 표 기반 신설 (ADR-071 Menu 패턴)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| cssEmitMode                                      | `skipCSSGeneration: true`                                                    | `skipCSSGeneration: false` + 수동 CSS complex selector 보존                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| render.shapes `items`                            | `items.map` 문자열                                                           | `(items ?? []).map((item) => item.label)` + `item.isDisabled` 반영                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Item Management editor                           | `type: "children-manager"` + `childTag: "ListBoxItem"` + `defaultChildProps` | **`type: "items-manager"`** (ItemsManagerField discriminant, Codex 3차 §1 정정 — Menu/Select/ComboBox 선례 `packages/specs/src/components/Menu.spec.ts:285` / `Select.spec.ts:265` / `ComboBox.spec.ts:232` 와 정합) + `itemsKey: "items"` + `itemTypeName: "ListBoxItem"` + `defaultItem: {label:"New Item"}` + `labelKey: "label"` + `itemSchema: [{key:"label", type:"string", label:"Label"}, {key:"value", type:"string", label:"Value"}, {key:"description", type:"string", label:"Description"}, {key:"isDisabled", type:"boolean", label:"Disabled"}]` |
| `propagation.rules { childPath: "ListBoxItem" }` | variant 전파                                                                 | **삭제** — 정적 모드 shapes 가 부모 variant 직접 참조. 템플릿 모드는 영향 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**containerStyles 예시**:

```ts
containerStyles: {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  padding: "{spacing.xs}",
  border: "1px solid {color.border}",
  borderRadius: "{radius.lg}",
  background: "{color.raised}",
  color: "{color.neutral}",
  outline: "none",
  maxHeight: 300,
  overflow: "auto",
  gap: "{spacing.2xs}",
  cssVars: {
    "--lb-padding": "{spacing.xs}",
    "--lb-gap": "{spacing.2xs}",
    "--lb-header-size": "{typography.text-sm}",
    "--lb-item-min-height": "20px",
    "--lb-item-size": "{typography.text-sm}",
    "--lb-desc-size": "{typography.text-xs}",
  },
},
```

**ListBox.css 수정** (Codex 2차 리뷰 반영 — 삭제 범위 축소):

- **1-58 라인 (`.react-aria-ListBox` 컨테이너 base) 삭제** → Generator containerStyles 가 대체 emit
- **60-124 라인 (`.react-aria-ListBoxItem` 기본 스타일) 유지** — Codex 2차 확증: `ListBoxItem.spec.ts` 부재로 Generator 대체 경로 없음. Generator `containerStyles` 는 컨테이너 자기 자신만 emit 하며 자식 selector 는 미지원. 템플릿 모드 렌더 경로(`SelectionRenderers.tsx:91` `<ListBoxItem>`) 도 동일 스타일 필요. 삭제 시 padding/border-radius/flex/font-size/hover/selected/focus-visible 전부 소실 → 시각 회귀
- **127 이후 complex selector 유지** (§0-2 표)
- 파일 상단 주석: `/* @see ADR-076 §0-2 — 수동 유지 selector: ListBoxItem base(60-124), orientation/layout(127-227), Popover context(246-293), variant 5종(296-355), DnD/virtualized/forced-colors(230-400) */`

**SSOT 복귀 비율 실질 약 20%**: 컨테이너 base + size cssVars 만. ListBoxItem base / complex selector / variant dead selector 전부 수동 유지. ADR-071 Menu 선례와 비교: Menu 는 `MenuItem.spec.ts` 가 존재해 아이템 base 까지 Generator 가 emit 가능 → Menu 는 더 높은 복귀 비율 달성. ListBox 는 `ListBoxItem.spec.ts` 부재로 본 ADR scope 의 한계(약 20%).

**0-5 감사 결과 반영**:

- dead CSS 확증 시: 127-227 라인도 삭제
- 실사용 확증 시: 127-227 라인 유지

**Gate G2**: `pnpm build:specs` PASS + Chrome MCP base 시각 동일 + shell-only-tags.test.ts ListBox 케이스 유지.

---

### Phase 3 — SelectionRenderers wiring (Path 1 템플릿 영구 유지)

**파일**: `packages/shared/src/renderers/SelectionRenderers.tsx:48` `renderListBox`

> Codex 3차 §2 정정 — Path 번호 정본: **Path 1 = 템플릿(영구 유지)**, Path 2 = items(canonical), Path 3 = 정적 children(legacy fallback). 이전 문서의 "Path 3 영구 유지" 표기는 오류 — 실제 코드 경로와 불일치.

**3-path routing — Path 1 은 템플릿 렌더 영구 유지**:

```ts
function renderListBox(element, context) {
  const props = element.properties;
  const listBoxChildren = (context.childrenMap.get(element.id) ?? []).filter(
    (c) => c.tag === "ListBoxItem",
  );

  // Path 1: 템플릿 모드 — columnMapping / PropertyDataBinding + ListBoxItem(Field 자식 보유) 존재
  //         ADR-076 이후에도 legacy element tree 유지. Codex 2차 반영: "부모 단위 원자적"
  //         migration(§Phase 5)으로 정적과 혼합 불가 보장 → 같은 부모에는 `items[]` 존재 안 함
  const columnMapping = props.columnMapping;
  const dataBinding = element.dataBinding || props.dataBinding;
  const isPropertyBinding = /* source+name check */;
  const hasValidTemplate =
    (columnMapping || isPropertyBinding) && listBoxChildren.length > 0;
  if (hasValidTemplate) {
    return renderTemplateMode(element, listBoxChildren, context);
  }

  // Path 2: items[] canonical — 정적 모드 (ADR-076)
  if (Array.isArray(props.items) && props.items.length > 0) {
    return renderFromItems(props.items, props, context);
  }

  // Path 3: 정적 children fallback — 마이그레이션 미적용(legacy) 프로젝트 대비
  //         ListBoxItem 자식을 그대로 렌더 (props.label / Text,Description 자식 경로)
  return renderFromStaticChildren(element, listBoxChildren, context);
}
```

**혼합 모드 방지 (Path 1 과 Path 2 상호 배타)**:

Codex 2차 리뷰 §3 확증 — Path 1 조건 `(columnMapping || isPropertyBinding) && listBoxChildren.length > 0` 은 `props.items` 존재 여부와 무관하게 활성화됨. 혼합 상태에서는 Path 1 이 선택되어 items[] 가 렌더에서 무시된다.

**집행 수단 (Phase 5 + Phase 6 가드 조합)**:

1. **Migration 부모 단위 원자성** — Phase 5: 자식 중 하나라도 Field 보유 → 부모 전체 템플릿 유지 (items[] 주입 금지). 전부 정적 → 전부 items[] 흡수 (ListBoxItem subtree 전부 orphan). 이중 상태 원천 봉쇄
2. **Factory 분리** — Phase 6: `createListBoxDefinition` default 는 items[] 생성만. 템플릿 모드는 별도 Factory 경로 또는 `columnMapping` 연동 시 ListBoxItem 템플릿 하나만 생성 (자식 Field 포함)
3. **Editor 가드 — 구현 지점 명시** (Codex 3차 §3 정정): 현재 `apps/builder/src/builder/panels/properties/generic/GenericPropertyEditor.tsx:45-53` 의 `evaluateVisibility` 는 `currentProps` + `parentTag` 만 인자로 받아 **subtree(Field 자식 유무)를 관찰할 수 없다** → Spec `visibleWhen` 선언만으로 ItemsManager 자동 비활성 불가. 3가지 옵션 중 택일:
   추가로 `registry.ts:124-135` 는 spec 등록 컴포넌트에 대해 GenericPropertyEditor 를 early return → `metadata.editorName` 연결만으로는 custom editor 에 도달 불가 (Codex 5차 §1). 아래 3옵션 모두 이 제약 위에서 평가:
   - **옵션 A**: `evaluateVisibility` 시그니처에 `elementId` 추가 → `store.elementsMap`/`childrenMap` lookup 으로 `hasFieldChild(elementId)` 판정 지원. `ItemsManagerField.visibleWhen` 을 선언식 확장 (예: `{ kind: "no-child-with-tag", tag: "Field" }`). SpecField 렌더 레이어에서 동일 방식 평가. 장기적 일반화 가치 — 다른 items SSOT 컴포넌트에도 재사용 가능
   - **옵션 B (채택)**: `registry.ts` 에 `getCustomPreEditor(type)` pre-generic hook 추가 (`getHybridAfterSections` 선례 대칭) + `propertySpec` 분기 진입 전 체크. `ListBoxPropertyEditor.tsx` 신설 — GenericPropertyEditor 래핑 + Field 자식 감지 후 ItemsManager 섹션 filter. `metadata.ts` 의 `editorName` 연결은 **보조적** 일관성 기록 (registry pre-hook 이 실제 로드 경로). **metadata.editorName 단독 연결만으로는 로드 되지 않음** — 반드시 registry.ts 수정 동반 필요
   - **옵션 C**: `ItemsManagerField` 에 `hideWhenChildrenTag?: string[]` 선언식 필드 추가 (예: `["Field"]`) + `SpecField` 렌더 시점에 store 조회로 판정. 타입 시스템 진화 없이 런타임만으로 해결
   - **선택 기준**: 옵션 A 는 장기 일반화 가치(다른 컴포넌트 재사용), 옵션 B 는 ListBox 로컬 해결(변경 범위 최소 — `registry.ts` + 1 파일 신설), 옵션 C 는 선언식 필드 추가 후 런타임
   - **본 ADR scope**: **옵션 B 채택** — 변경 범위 최소 + `ListBoxItemEditor.tsx:51-170` 듀얼 분기 패턴 재사용 가능 + 기존 hybrid 패턴 대칭 확장. 구현 상세는 Phase 6 (§Phase 6 — Factory / Layer Tree / Editor wiring) 참조. 옵션 A/C 는 별도 ADR(Generic editor 확장)
4. **런타임 방어 로그** — `renderListBox` 진입 시 `hasValidTemplate && props.items?.length > 0` 이면 console.warn + Path 1 우선 (BC 보수적)

**Canonical contract (정적 모드 한정)**:

- `selectedKey = item.id`
- `onSelectionChange(key)` → `addItem/updateItem` store action
- 역매핑: RAC `Selection` → `id → item` lookup
- `selectedIndex` 전달 시 `items[idx].id` 변환 + console.warn (BC)

**Gate G3**: builder itemsActions 단위 테스트(ListBox 케이스 3건 — add/remove/update) + `listBoxCanonicalContract.test.ts` 신설 + Chrome MCP `data-selected` 확인 + **템플릿 모드 회귀 테스트** + **혼합 감지 warning 테스트**.

---

### Phase 4 — Store API (재사용 + reorder out-of-scope 명시)

**재사용 (작업 0)**:

`apps/builder/src/builder/stores/elements.ts:1502-1556` `addItem/removeItem/updateItem` 는 tag-agnostic. ListBox 에서 `addItem(listBoxId, "items", {label:"X"})` 시그니처로 그대로 사용.

**추가 테스트**: `itemsActions.test.ts` 에 ListBox add/remove/update 3건 추가 (Select 케이스 복제 후 tag="ListBox").

**reorder — Out of Scope**:

`elements.ts:1576` `reorderMenuItems` 는 `menu.tag !== "Menu"` 가드로 Menu 전용. ListBox reorder 가 필요하면 `reorderItem(id, key, from, to)` 일반화 작업이 선행 필요 → **본 ADR scope 밖**. ItemsManager UI 에서 ListBox reorder 비활성 (drag handle 숨김) 또는 `reorderMenuItems` 일반화는 별도 ADR.

**Gate G3 (공유)**: itemsActions.test.ts ListBox 3건 PASS (reorder 제외).

---

### Phase 5 — Migration (부모 단위 원자적 판정 + 자식 subtree 직렬화)

**CRITICAL — Codex 1차+2차 리뷰 반영**:

1. **부모 단위 원자적 판정 (혼합 모드 금지)** — Codex 2차 §3: 같은 부모 아래 정적 + 템플릿 ListBoxItem 이 공존하면 Path 1 `hasValidTemplate` 가 선택되어 `items[]` 가 무시됨. 따라서 migration 은 **부모 단위** 로 판단:
   - 자식 ListBoxItem 중 **한 개라도 Field 자식 보유 → 부모 전체 skip** (템플릿 모드로 전용)
   - 자식 ListBoxItem **전부 Field 자식 없음 → 전부 items[] 흡수** (정적 모드로 전용)
   - 이중 상태(흡수 불가 잔존) 원천 봉쇄

2. **자식 subtree 직렬화 (Text/Description 복원)** — Codex 2차 §1: 기본 ListBoxItem 은 `props.label` 이 비어있고 Text/Description 자식으로 내용 보유 (`SelectionComponents.ts:236-263` factory default + `SelectionRenderers.tsx:300-303` 자식 우선 렌더 분기). migration 은:
   - `props.label` 우선
   - 부재 시 자식 중 Text element(또는 `slot` 없음 또는 `slot="title"`) 의 `props.children` 추출
   - `description` 은 `props.description` 또는 자식 `Description` element(`slot="description"`) 의 `props.children`
   - ListBoxItem 자체 + 하위 Text/Description/기타 자식 **전부 orphanIds 에 포함** — hydrate 후 store/IDB 에 고아 노드 잔존 방지

**구현 — 오케스트레이터 일반화 (옵션 A 권장)**:

`packages/shared/src/utils/migrateSelectComboBoxItems.ts` → `migrateCollectionItems.ts` 리네임 + `applyCollectionItemsMigration` 신설. Select/ComboBox/ListBox 3종 공통 오케스트레이터.

**분기 로직 (의사코드)**:

```ts
// 1) 부모별 ListBoxItem 자식 수집
const listBoxChildrenByParent = new Map<string, T[]>();
for (const el of elements) {
  if (el.tag !== "ListBoxItem" || !el.parent_id) continue;
  const arr = listBoxChildrenByParent.get(el.parent_id) ?? [];
  arr.push(el);
  listBoxChildrenByParent.set(el.parent_id, arr);
}

// 2) 부모 단위 원자적 판정
for (const [parentId, lbiChildren] of listBoxChildrenByParent) {
  const parent = elements.find((el) => el.id === parentId);
  if (!parent || parent.tag !== "ListBox") continue;

  // ListBoxItem 중 한 개라도 Field 자식 보유 → 부모 전체 템플릿 모드
  const anyTemplate = lbiChildren.some((lbi) =>
    elements.some((el) => el.parent_id === lbi.id && el.tag === "Field"),
  );
  if (anyTemplate) continue; // element tree 전체 유지

  // 3) 정적 모드 부모 — 자식 subtree 직렬화
  const items: StoredListBoxItem[] = [];
  for (const lbi of lbiChildren) {
    const subChildren = elements.filter((el) => el.parent_id === lbi.id);
    const textChild = subChildren.find(
      (el) => el.tag === "Text" && !(el.props as { slot?: string }).slot,
    );
    const descChild = subChildren.find(
      (el) =>
        el.tag === "Description" ||
        (el.tag === "Text" &&
          (el.props as { slot?: string }).slot === "description"),
    );
    items.push({
      id: lbi.id,
      label:
        String(lbi.props.label ?? "") ||
        String((textChild?.props as { children?: string })?.children ?? ""),
      value: lbi.props.value as string | undefined,
      description:
        (lbi.props.description as string | undefined) ??
        (descChild?.props as { children?: string })?.children,
      isDisabled: Boolean(lbi.props.isDisabled),
      textValue: lbi.props.textValue as string | undefined,
    });

    // orphan: ListBoxItem 자신 + 모든 자식 subtree
    orphanIds.push(lbi.id);
    for (const sub of subChildren) orphanIds.push(sub.id);
    // (재귀 필요 시 DFS) — Text/Description 아래 또 자식이 있으면 전부 포함
  }

  // 4) 부모 props.items 병합 + selectedIndex → selectedKey 변환
  const nextProps = {
    ...parent.props,
    items,
    selectedKey:
      typeof parent.props.selectedIndex === "number"
        ? items[parent.props.selectedIndex]?.id
        : undefined,
    selectedKeys: Array.isArray(parent.props.selectedIndices)
      ? (parent.props.selectedIndices as number[])
          .map((i) => items[i]?.id)
          .filter(Boolean)
      : undefined,
  };
  // migratedElements 에 parent 교체, 자식들은 제외
}
```

**`initializeProject` 교체** (`apps/builder/src/builder/hooks/usePageManager.ts:535`):

```ts
const { migratedElements, orphanIds } =
  applyCollectionItemsMigration(rawMerged);
```

**구현 옵션 B — 병렬 함수**: 부모 단위 판정을 ListBox 전용 `applyListBoxItemsMigration` 에 내장 후 순차 호출. 옵션 A 대비 단일 책임.

**선택**: **옵션 A 권장** — 3종 공통 로직 단일 위치.

**마이그레이션 Idempotency**:

- ListBox 에 `props.items` 이미 존재 + 자식 ListBoxItem 0 → no-op
- 재실행 시 정적 ListBoxItem 자식 이미 제거된 상태 → listBoxChildrenByParent 해당 부모 미수록 → skip

**Factory/UI 가드 (혼합 모드 금지 정책 집행)**:

- `createListBoxDefinition` (`SelectionComponents.ts`) 에서 default 생성 시 **items[] 로 생성** (정적 모드). ListBoxItem element 자동 생성 제거
- `columnMapping` 연동 워크플로는 부모 ListBox 를 별도 Factory 경로 또는 explicit API 로 생성 + ListBoxItem 템플릿 + Field 자식 주입
- Editor/Layer Panel 에서 **정적 모드 ListBox 에 ListBoxItem element 수동 추가 금지** (ItemsManager UI 만 허용). 템플릿 모드 ListBox 는 Field element 추가만 허용
- `HierarchyManager.getSpecialComponentChildren` 에서 혼합 상태 감지 시 warning log

**Gate G4 (확장)**:

1. 정적 ListBoxItem 프로젝트(label + Text/Description 자식) 로드 → items[] 에 `{label, description}` 정확히 복원 + ListBoxItem + Text + Description **전부** orphanIds → IDB deleteMany 성공 → reload no-op
2. 템플릿 ListBoxItem 프로젝트(Field 자식 보유) 로드 → Field subtree 무변 + items[] 주입 안 됨
3. **혼합 상태 프로젝트 (정적 + 템플릿 공존) 로드 → 부모 전체 skip + console.warn 출력 + 사용자 가이드 UI** (manual 분리 필요)
4. `selectedIndex` 저장된 프로젝트 → `selectedKey = items[idx].id` 자동 변환

**Gate G4**: Chrome MCP —

1. 정적 ListBox 프로젝트 로드 시 items[] 자동 전환
2. **템플릿 ListBox 프로젝트 로드 시 Field subtree 무변 + 동적 컬럼 렌더 정상**
3. 브라우저 reload 후 재전환 no-op
4. Field 자식 수 before == after

---

### Phase 6 — Factory / Layer Tree / Editor wiring (Codex 5차 반영 — 실제 수정 대상 정정)

| 파일                                                                                                       | 작업                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` `createListBoxDefinition`          | 자동 ListBoxItem child 제거 + `items: [{id, label: "Item 1"}, ...]` default 주입. **단, 기존 템플릿 모드 생성 워크플로(`columnMapping` 연동) 유지**                                                                                                                                                                                  |
| **`apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts:213-218`** (Codex 5차 §2 정정) | **실제 레이어 패널 virtual children 경로**. ListBox case `childrenAs<ListItem>(props.children)` → `(props.items as StoredListBoxItem[])` 로 변경. `makeNode("listbox", index, item.label \|\| "Item " + (i+1), item)`. 템플릿 모드 부모는 props.items 가 비어있으므로 실제 ListBoxItem element 자식이 기본 childrenMap 경로로 표시됨 |
| `apps/builder/src/builder/utils/HierarchyManager.ts` `getSpecialComponentChildren` Case "ListBox"          | **호출 지점 부재 확인 (Codex 5차 §2)** — 현재 동 함수 호출처가 apps/builder 내 grep 0건. dead code 가능성 높음. 정책: (a) 기존 로직 유지 + 주석으로 "useLayerTreeData 가 실경로" 명시, 또는 (b) `HierarchyManager.ts` 해당 case 삭제. 본 ADR 은 (a) 최소 영향                                                                        |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` `SELECT_HIDDEN_CHILDREN`               | ListBoxItem 제거 검토 — 템플릿 모드 영향 확인 후 결정. 템플릿 모드에서 ListBoxItem 이 layout 계산 대상이면 유지                                                                                                                                                                                                                      |

**유지 대상 (Codex 1차 리뷰 반영)**:

- `packages/shared/src/components/metadata.ts:907-913` ListBoxItem 엔트리 — **유지** (템플릿 모드 편집 필요)
- `apps/builder/src/builder/panels/properties/editors/ListBoxItemEditor.tsx` — **유지**. Field Management UI + Static Item Properties 듀얼 분기 본래 설계 그대로
- `ListBoxItem.spec.ts` — 존재 안 함 (해체 대상 아님, 확인 완료)

**신설 대상 — Editor wiring (Codex 3차 + 5차 §1 통합 정정)**:

`metadata.editorName` 연결만으로는 **ListBoxPropertyEditor 가 로드되지 않는다**. 근거: `apps/builder/src/builder/inspector/editors/registry.ts:124-135` `getEditor()` 는 spec 등록 컴포넌트(`getPropertyEditorSpec(type)` = ListBoxSpec)에 대해 GenericPropertyEditor 를 **즉시 반환하고 early return**. metadata custom editor(line 137+)는 spec 미등록 컴포넌트만 도달 → ListBox 는 이미 `specRegistry.ts:143` 등록됨.

3가지 구현 옵션:

- **옵션 A — registry 우선순위 역전**: `getEditor()` 에서 `metadata.hasCustomEditor` 를 먼저 검사 후 spec fallback. 영향 범위: 다른 spec 등록 컴포넌트의 렌더 순서 변경 가능성 → **HIGH risk**
- **옵션 B — pre-generic hook 확장** (권장): `getHybridAfterSections(type)` 선례를 따라 `getCustomPreEditor(type)` 도입. registry.ts 에서 spec 기반 반환 직전에 `getCustomPreEditor("ListBox")` 체크 → ListBoxPropertyEditor 반환. ListBoxPropertyEditor 는 내부에서 GenericPropertyEditor 를 spec 주입으로 래핑 + Field 자식 감지 시 ItemsManager 섹션만 filter. 기존 hybrid 패턴(after-sections)과 대칭적 확장
- **옵션 C — ListBox 만 spec registry 에서 제거**: specRegistry 에서 ListBox 를 삭제 + metadata.editorName=ListBoxPropertyEditor 로 이관. GenericPropertyEditor 의 spec 기반 섹션 재사용 불가 → Property UI 전체 재작성 비용

**본 ADR 채택: 옵션 B**.

변경 지점:

- **`apps/builder/src/builder/inspector/editors/registry.ts`** — `getCustomPreEditor(type)` 신규 helper 추가 + `getEditor()` 의 `propertySpec` 분기 진입 전 pre-editor 체크 로직 삽입. 해당 helper 는 `ListBox` → `() => import("../../panels/properties/editors/ListBoxPropertyEditor")` 반환
- **`apps/builder/src/builder/panels/properties/editors/ListBoxPropertyEditor.tsx`** (신설) — 시그니처 `(props: ComponentEditorProps)` → 내부에서 `useStore(state => state.childrenMap.get(props.elementId) ?? [])` 로 Field 자식 보유 여부 감지. 결과에 따라 (a) 템플릿 모드: GenericPropertyEditor 를 렌더하되 `ListBoxSpec` 의 "Item Management" 섹션을 filter 한 사본을 주입 + "동적 컬럼 모드 — items 편집은 Field 자식 편집으로 대체" 안내 메시지 / (b) 정적 모드: GenericPropertyEditor 그대로 위임 (스펙 전체 섹션 표시)
- **`packages/shared/src/components/metadata.ts`** ListBox 엔트리 `editorName: "ListBoxPropertyEditor"` 추가 — 옵션 B 에서는 **필수 아님** (registry.ts pre-editor 가 선행) 이나 일관성 위해 함께 기록

**Gate G5** (Codex 5차 반영 확장):

- type-check 3/3 + 신규 ListBox 드롭 default items 주입 + `columnMapping` 연동 ListBox 드롭 시 ListBoxItem 템플릿 자동 생성
- **레이어 패널에 items[i].label 표시** (`useLayerTreeData.ts` 경로 실제 적용 확인, Codex 5차 §2)
- 템플릿 모드 부모는 실제 ListBoxItem element 자식이 기본 childrenMap 경로로 표시됨 — 혼합 표시 확인
- **ListBoxPropertyEditor 가 registry pre-editor 경로로 로드됨** (Codex 5차 §1) + 템플릿 모드에서 "Item Management" 섹션 filter + 정적 모드에서 전체 섹션 표시
- `HierarchyManager.getSpecialComponentChildren` 호출처 grep 0건 재확인 — 변경 영향 없음

---

### Phase 7 — Popover 실측 결과: Skip

**Codex 1차 리뷰 확증**:

- `packages/shared/src/components/Popover.tsx:13-86` — `PopoverProps` 에 `variant` prop **없음**. `data-size` 만 emit
- `packages/shared/src/components/styles/Popover.css:30` — 기본 `.react-aria-Popover { background: var(--bg-raised); }` **이미 정합**
- `Popover.css:142-184` `[data-variant="primary|...|filled"]` 5종 — DOM 에 data-variant 가 emit 되지 않으므로 **dead selector**
- `packages/shared/src/components/Select.tsx:391` / `ComboBox.tsx:307` / `LayoutRenderers.tsx:652` — Popover 에 variant 전달 경로 **없음**. size 만 전달
- `Popover.spec.ts` `variants.accent|neutral|surface` 는 **Skia-only** 렌더 팔레트 (DOM 과 분리)

**결론**: ADR-070 Addendum 1 "Menu = ListBox 색상 정합" 은 **이미 Popover.css base 에서 `{color.raised}` 로 달성** 되어 있다. Popover.spec 교정은 DOM 경로에 영향 없음.

**Phase 7 = Skip**. 다음 항목은 별도 ADR 로 분리:

- Popover.tsx 에 variant prop 추가 + data-variant emit 배선 → 별도 ADR (D2 Props 확장)
- Popover.spec Skia 팔레트 재조정 (`surface.background: {color.layer-2}` → `{color.raised}`) → 별도 ADR (Skia-only)
- `Popover.css:142-184` 5종 variant dead selector 정리 → 별도 ADR

**Gate G6**: Phase 7 skip 결정 기록 + ADR 본문 Gates G6 업데이트.

**Phase 7 종결 기록 (2026-04-18 세션, G6 PASS)**:

- `packages/shared/src/components/styles/Popover.css:30` — `background: var(--bg-raised);` **재확증**. ADR-070 Addendum 1 목표 정합 상태 변경 없음
- Popover.tsx:13-86 variant prop 부재 재확인 (grep 0건)
- Phase 7 = **Skip 확정**. 별도 ADR 3건 (variant 배선 / Skia 팔레트 / dead selector) 은 후속 대기
- G6 실패 시 대안 "재조사" 는 불필요 — 실측으로 skip 근거 확보 완료

### Phase 8 — 종결 검증 기록 (G7)

**G7 검증 결과 (2026-04-18 세션)**:

- **간접 입증 (코드/테스트 경로)**:
  - `pnpm type-check` 3/3 × 5회 누적 PASS (P1~P6 각 phase 별)
  - `pnpm build:specs` 108 CSS files emit PASS — ListBox.css generated 60 라인 컨테이너 base 확인
  - 단위 테스트 101/101 PASS:
    - `listBoxCanonicalContract.test.ts` 14/14 — selectedKey 역매핑 + legacy 변환 + 부모 원자성 경로 판정
    - `migrateCollectionItems.test.ts` 14/14 — ListBox 정적/템플릿/혼합 + selectedIndex 변환 + Idempotency + 3종 공존
    - `migrateSelectComboBoxItems.test.ts` 12/12 (BC 회귀 0)
    - `itemsActions.test.ts` 8/8 (ListBox 3건 포함, tag-agnostic 재사용 확증)
    - `shell-only-tags.test.ts` 53/53 — ListBox SYNTHETIC_CHILD_PROP_MERGE_TAGS 유지 불변 확증 (breakdown §0-4)
- **직접 시각 검증은 Chrome MCP background 모드 제약으로 본 세션 미수행**. 후속 Addendum 또는 별도 세션에서 수행:
  - [ ] 정적 ListBox 드롭 → items[] default 3개 + 레이어 패널 items[i].label 표시
  - [ ] 프로퍼티 에디터 → ItemsManager 섹션 표시 (정적 모드)
  - [ ] 템플릿 ListBox (columnMapping 연동) 드롭 → Field 자식 + Item Management 섹션 filter 확인
  - [ ] legacy ListBoxItem 프로젝트 로드 → items[] 자동 복원 + orphan cleanup + reload no-op
  - [ ] Chrome MCP base 시각 — Generator containerStyles 와 이전 수동 base 동일
- **선례 비교**: ADR-066 (Tabs) / ADR-068 (Menu) / ADR-073 (Select+ComboBox) 모두 G2 시각 검증은 간접 입증(단위 테스트) 으로 종결. ADR-076 도 동일 표준 적용. parallel-verify skill 형식 종결은 사용자 지시 시 후속 세션

---

## 2. Gate 요약

| Gate | Phase   | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                             |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | 착수 전 | §0-1/0-2 완료 + §0-5 layout 감사 + §0-6 듀얼 모드 감사                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 감사 재실행                                                              |
| G1   | P1      | type-check specs/shared PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Types 역행                                                               |
| G2   | P2      | `pnpm build:specs` PASS + Chrome MCP base 시각 동일 + shell-only-tags 유지                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | containerStyles 조정                                                     |
| G3   | P3/P4   | SelectionRenderers 3-path (**Path 1 템플릿 영구 유지**, Path 2 items canonical, Path 3 legacy fallback) + canonical contract 테스트 + 템플릿 회귀 테스트 + 혼합 감지 warning 테스트 + itemsActions ListBox 3건 PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 재설계                                                                   |
| G4   | P5      | 정적 ListBox → items[] 변환 + **템플릿 ListBox Field subtree 무변** + reload no-op                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | migration 분기 수정                                                      |
| G5   | P6      | (a) 신규 ListBox 드롭 default items 주입 + `columnMapping` 연동 ListBox 드롭 시 ListBoxItem 템플릿 자동 생성 / (b) **`useLayerTreeData.ts:213-218` 경로에서 items[i].label 표시** (Codex 5차 §2) + 템플릿 모드 부모는 실제 ListBoxItem element 자식이 기본 childrenMap 경로로 표시 (혼합 표시 확인) / (c) **`registry.ts` `getCustomPreEditor` hook 추가 + `ListBoxPropertyEditor.tsx` pre-editor 경로로 로드 확인** (Codex 5차 §1) + 템플릿 모드에서 "Item Management" 섹션 filter + 정적 모드에서 전체 섹션 표시 / (d) `HierarchyManager.getSpecialComponentChildren` 호출처 grep 0건 재확인 (변경 영향 없음) / (e) `ListBoxItemEditor.tsx` + `metadata.ts:907-913` ListBoxItem 엔트리 유지 | 옵션 A (registry 우선순위 역전) 또는 옵션 C (spec 선언식 필드) 로 재검토 |
| G6   | P7      | Phase 7 skip 확정 (이미 정합)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 재조사                                                                   |
| G7   | 종결    | `/cross-check` ListBox 5-layer + parallel-verify ListBox family                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 개별 path 수정                                                           |

---

## 3. 작업 순서 (commit boundary)

1. §0-5/0-6 감사 + 결과 기록 — G0
2. `types/listbox-items.ts` 신설 — G1
3. `ListBox.spec.ts` containerStyles + items + editor field + propagation 삭제 — G2
4. `ListBox.css` complex selector 만 유지 + 상단 주석 — G2
5. `SelectionRenderers.renderListBox` Path 2 신설(Path 1 템플릿 / Path 3 정적 fallback 은 유지) + 테스트 — G3
6. `itemsActions.test.ts` ListBox 3건 추가 — G3
7. Migration 옵션 A 구현 + usePageManager 교체 — G4
8. Factory/Hierarchy/SELECT_HIDDEN_CHILDREN 정리 (Editor/metadata 는 유지) — G5
9. Phase 7 skip 결정 문서화 — G6
10. cross-check + parallel-verify + type-check — G7

---

## 4. 롤백 전략

- Phase 2 이후 commit 은 독립 revert 가능
- Migration idempotent (items 이미 존재 + 자식 0 → no-op)
- 듀얼 분기 로직 실패 시 migration 전체 비활성 가능 (ADR-073 패턴)
- 오케스트레이터 일반화 롤백: 리네임 원복 + `applySelectComboBoxMigration` 복원

---

## 5. Out of Scope

- ListBoxItem 템플릿 모드 `columnMapping`/`PropertyDataBinding` 구조의 items[] 직렬화 (대안 A — CRITICAL 위험)
- `reorderItem` 일반화 (ListBox reorder 요구 시 별도 ADR)
- Popover.tsx variant prop 배선 (별도 ADR)
- Popover.spec Skia 팔레트 재조정 (별도 ADR)
- `Popover.css` dead variant selector 정리 (별도 ADR)
- GridList items SSOT 전환 (별도 ADR)
- variant prop 5종 확장 (별도 ADR)
- DnD / virtualized 상태 Spec 모델링 (별도 ADR)

---

## 6. 참조

- ADR-066 (Tabs items SSOT) — 원조 패턴 (migration 불필요 선례)
- ADR-068 (Menu items SSOT) — items[] + Stored/Runtime 분리 + MenuItem spec 병행 신설 선례
- ADR-070 Addendum 1 — "Menu = ListBox 색상 정합" 사용자 지시. 실제 해결 위치: `Popover.css:30` base
- ADR-071 (Generator containerStyles) — 인프라 제공자, Menu reference consumer
- ADR-072 (`_hasChildren` 컨벤션) — ListBox 가 SYNTHETIC_CHILD_PROP_MERGE_TAGS 유지 근거
- ADR-073 (Select/ComboBox items SSOT) — 1:1 참조 구조, `applySelectComboBoxMigration` 오케스트레이터, tag-agnostic store API, canonical contract 모델
- Codex 1차 리뷰 (2026-04-18) — ListBoxItem 듀얼 모드 확증, Popover variant prop 부재 확증, reorder 일반화 부재, layout 감사 선행 요구

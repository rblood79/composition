# Compositional Architecture — 합성 컴포넌트 구성 (현행)

> **정본 분리**: 원칙은 `.claude/rules/` 가 정본이다 — 3-Domain 분할은 [ssot-hierarchy.md](../../../rules/ssot-hierarchy.md), `_hasChildren` 3-branch / container pipeline 은 [canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5/§2.6, canonical mutation 순서는 [state-management.md](../../../rules/state-management.md). 본 문서는 **구현 상세와 파일 경로**만 다룬다.
>
> **역사적 맥락 (1구획)**: 과거 이 문서는 컴포넌트별 `*.spec.ts` (100+ 파일) + ElementSprite/PixiJS 시대의 작성 지침이었다. ADR-100 (Unified Skia Engine, PixiJS 제거) 과 ADR-912 (catalog cutover, spec ~40종 물리 삭제) 이후 그 체계는 소멸했다. `ElementSprite.tsx` / `SPEC_RENDERS_ALL_TAGS` / `UI_SELECT_CHILD_TAGS` / 컴포넌트별 spec 등록은 현행 코드에 존재하지 않는다.

## 1. 3층 구조 — 합성 컴포넌트가 구성되는 방식

합성 컴포넌트(Select, Card, Checkbox 등 자식 트리를 갖는 컴포넌트)는 세 층이 분담한다:

| 층                            | 담당                                        | 위치                                                                                                                                           |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **구조 (canonical document)** | 부모-자식 트리, `children` 배열 순서가 SSOT | `packages/shared/src/types/composition-document.types.ts` (`CanonicalNode`)                                                                    |
| **초기 생성 (factory)**       | palette drop 시 자식 Element 자동 생성      | `apps/builder/src/builder/factories/definitions/*.ts`                                                                                          |
| **시각 (catalog)**            | 색상/크기/변형/구조 CSS — D3 SSOT           | `packages/shared/src/catalog/generated/componentRulesTable.ts` (`COMPONENT_RULES_TABLE`) + `packages/shared/src/catalog/bindings/*.binding.ts` |

Element 의 태그 필드는 **`type`** 이다 (`tag` 아님 — `CanvasSceneNode.type`, `element.type`).

### 시각 SSOT = catalog

- `COMPONENT_RULES_TABLE` 은 **직접 편집 정본** (ADR-912 1A-(a)). generate-rules 생성기는 삭제됐고, 컴포넌트 시각 규칙(variants/sizes/fill) 변경은 이 파일을 직접 편집한다.
- 소비자 3곳이 단일 source 파생: DOM generated CSS (`packages/specs/scripts/generate-css.ts` 가 table 을 읽어 `packages/shared/src/components/styles/generated/` 로 출력), Skia runtime (`resolveComponentRule`), Properties/Style Panel (`specPresetResolver.ts`).
- cutover 게이트: `packages/shared/src/catalog/cutover.ts` 의 `isCatalogCutover(type)` — `componentCatalog.ts` 의 `cutover === "catalog"` entry 에서 파생된 단일 게이트 (구 `isCatalogSkiaCutover` 는 삭제됨).
- binding: `catalog/bindings/{Component}.binding.ts` 의 `PrimitiveBinding` (`packages/shared/src/catalog/types.ts:69`) — `source.kind`(internal renderer 등), `props.accepts`(D2 편집 계약 — Property Panel 필드 정의), `skiaPrimitive`(비-box 시각의 escape 키), `toRacProps`.

### Skia 렌더 경로 (builder)

`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` 가 단일 진입점 (ADR-900 Phase 8, 구 ElementSprite 대체):

```
진입 게이트: if (!spec && !isCatalogCutover(type)) return null
  ├─ catalog cutover type → buildCatalogShapesOrPrimitive()
  │    ├─ binding.skiaPrimitive "replace" → 전용 draw module 이 shape 생성
  │    └─ 없으면 buildCatalogShapes() — 보편 box+text (variant 색상은
  │       resolveSkiaVisualRule = COMPONENT_RULES_TABLE 파생, size 는
  │       resolveSkiaRule(type).sizes[size] → ruleSizeToSizeSpec)
  └─ 비-cutover (Group/frame/Slot 3종만) → spec.render.shapes() fallback
```

DOM(Preview) 경로와 Skia 경로는 catalog 의 **대등한 symmetric consumer** — 어느 쪽도 기준이 아니다 (정본: ssot-hierarchy.md D3).

## 2. 대표 사례 — Select (factory 자식 자동 생성)

`apps/builder/src/builder/factories/definitions/SelectionComponents.ts:18` `createSelectDefinition`:

```typescript
return {
  type: "Select",
  parent: {
    type: "Select",
    props: {
      label: "Select",
      placeholder: "Choose an option...",
      items, // StoredSelectItem[] — 옵션은 자식 Element 가 아닌 데이터 prop
      style: { width: "100%", gap: 6 },
    },
    parent_id: parentId,
  },
  children: [
    {
      type: "Label",
      props: {
        children: "Select",
        style: { width: "fit-content", fontWeight: 600 },
      },
    },
    {
      type: "SelectTrigger",
      props: {
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
      },
      children: [
        {
          type: "SelectValue",
          props: {
            placeholder: "Choose an option...",
            style: { flex: 1, textAlign: "left" },
          },
        },
        {
          type: "SelectIcon",
          props: {
            children: "",
            style: { width: 18, height: 18, flexShrink: 0 },
          },
        },
      ],
    },
  ],
};
```

- **옵션(SelectItem)은 자식 Element 로 생성하지 않는다** — `items: StoredSelectItem[]` prop 으로 직렬화 (ADR-073 P6). 시각 sub-element(Label / SelectTrigger / SelectValue / SelectIcon)만 자식 트리.
- ComboBox 는 동일 자식 구조를 공유한다 — 구 `ComboBoxWrapper/Input/Trigger` synthetic type 은 Select family 공용 type 으로 retype 됨 (ADR-912 R1, `BUILDER_ALIAS_MAP` 해체 대상이었음).
- 타입 계약: `factories/types/index.ts` — `ComponentDefinition { type, parent, children: ChildDefinition[] }`, `ChildDefinition` 은 재귀적 (`children?: ChildDefinition[]`).
- 등록: `factories/ComponentFactory.ts` 가 definitions/{Data,DateColor,Display,Form,Group,Layout,Navigation,Overlay,Selection,Table}Components.ts 의 creator 를 조립.
- 생성 진입 분기: `factories/constants.ts:28` `COMPLEX_COMPONENT_TAGS` — palette drop 시 `useElementCreator` 의 complex creator 경로 게이트. ADR-914 entry universe (`factories/entryUniverse.ts`) 의 `creation.mode === "complex"` facet 과 양방향 1:1 (`entryUniverseContract.test.ts` 검증).
- 생성 시 canonical 반영 순서(canonical 1차 → set → rebuild → persist)는 [state-management.md](../../../rules/state-management.md) §Canonical sync 호출 순서 정본.

## 3. D1/D3 경계 — 잔존 spec 3종이 남는 이유

`packages/specs/src/components/` 에 남은 spec 은 **Frame / Group / Slot 3개뿐** (`BASE_TAG_SPEC_MAP` = `{ Group: GroupSpec, frame: FrameSpec, Slot: SlotSpec }`, `packages/specs/src/runtime/tagToElement.ts`). catalog 미등록 native 3종으로, `buildSpecNodeData` 에서 유일하게 `spec.render.shapes` fallback 에 도달한다.

| Spec            | Domain | 잔존 이유                                                                                                                |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `Group.spec.ts` | **D1** | RAC ARIA semantic (`role="group"`) — catalog 로 흡수 시 D1 침범                                                          |
| `Frame.spec.ts` | **D3** | ADR-130 canonical layout container (lowercase `frame`) — ARIA role 없음, skipCSSGeneration, RAC Group 과 의도적으로 분리 |
| `Slot.spec.ts`  | —      | 플레이스홀더 컨테이너 (frame projection 의 metadata-only native)                                                         |

builder 측 `TAG_SPEC_MAP` (`apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`) = `BUILDER_ALIAS_MAP` + `BASE_TAG_SPEC_MAP` 병합, `getSpecForTag(type)` 로 조회. 경계 원칙(D1 RAC 절대 권위 / D3 catalog SSOT)은 [ssot-hierarchy.md](../../../rules/ssot-hierarchy.md) 정본.

## 4. 생존 주입 메커니즘 (레이아웃/렌더 보조)

catalog 는 시각값만 담으므로, 트리 밖 시각 요소·부모→자식 값 전달은 다음 메커니즘이 담당한다:

### implicitStyles — indicator 공간 확보 (Checkbox/Radio/Switch)

`apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:2204-2235`:

- indicator 는 catalog skiaPrimitive 로 그려지며 Taffy 트리 밖 → Label 자식에 `marginLeft = indicatorWidth + userGap` 주입 (사용자 `marginLeft` 있으면 보존).
- `indicatorWidth` = `PHANTOM_INDICATOR_CONFIGS[containerTag].widths[size]` (`engines/utils.ts:196` — checkbox/radio 16/20/24, switch 32/36/44), gap 은 `phantomIndicatorGap()` = catalog `sizes.*.gap` read-through (부재 시 switch 10, 그 외 8).
- `parentStyle.gap` 은 `parseFloat(String(...))` 로 파싱 — 스타일 패널이 string 저장하므로 숫자 체크 금지.

### Synthetic Label (하위 호환)

같은 파일 `:2238-2279` — `SYNTHETIC_LABEL_TAGS` (radio/checkbox/switch/toggle/progressbar/... — `:471`) 의 자식이 0개이고 `props.children`/`label` 텍스트가 있으면 합성 Label 노드를 생성해 레이아웃에 투입 (indicator 태그면 위와 동일한 marginLeft 계산).

### buildSpecNodeData 의 부모→자식 전파 resolver 군

Skia 렌더 시점에 부모 props 를 자식 specProps 로 투영한다 (Store 는 갱신하지 않음 — Inspector 편집 경로와 상보, [child-composition.md](child-composition.md) §3 참조):

- `applyParentPropagationProps` — propagationRegistry 규칙 일괄 적용
- `resolveParentDelegatedSize` — size delegation (0-3 level 조상 탐색)
- `resolveProgressProps` / `resolveSliderProps` — value → Track/Value 전파
- `resolveIconDelegation` — SelectIcon iconName (기본 `chevron-down`, DOM 과 정합)
- `resolveButtonChildColor` — `.button-base > * { color: inherit }` 의 Skia 대칭
- Tab `_isSelected` / Radio `isSelected` / TreeItem `_treeLevel` 등 상태 투영

### Container dimension 주입

`CONTAINER_DIMENSION_TAGS` (buildSpecNodeData.ts:96) 등록 태그에 `_containerWidth`/`_containerHeight` 주입 — spec-free escape (DateInput, CalendarHeader, TagList 등)가 Taffy 결과 폭 기준으로 우측/중앙 좌표를 잡기 위함. 원칙은 canvas-rendering.md §2 정본.

## 5. 신규 합성 컴포넌트 추가 시 개요 체크리스트

1. **catalog**: `COMPONENT_RULES_TABLE` 에 entry (variants/sizes/structure) + `bindings/{Name}.binding.ts` (accepts D2 계약) + `componentCatalog.ts` 등록 (`cutover: "catalog"`)
2. **factory**: `definitions/*.ts` 에 `create{Name}Definition` (자식 트리) + `ComponentFactory.ts` 등록 + 자식 자동 생성 컴포넌트면 `COMPLEX_COMPONENT_TAGS` 추가
3. **3-branch 판정**: shell-only / synthetic-merge / plain — 판정 알고리즘은 canvas-rendering.md §2.5 정본, 구현 상세는 [child-composition.md](child-composition.md)
4. **prop 전파**: 부모 편집 → 자식 반영 필요 시 `propagationRegistry.ts` 에 규칙 등록 (Inspector + Skia 양 경로가 같은 registry 소비)
5. **container style pipeline**: collection/self-render 컨테이너면 canvas-rendering.md §2.6 체크리스트 준수
6. 검증: `pnpm type-check` + `/cross-check` (CSS↔Skia 시각 대칭)

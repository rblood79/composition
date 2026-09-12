# ADR-906 Breakdown: Collection spacing 런타임 계약

## 목표

- Collection/self-render 컴포넌트의 root `padding/gap` 편집값이 Preview CSS와 Builder Skia에서 같은 의미로 반영되도록 계약을 고정한다.
- `render.shapes()`와 `calculateContentHeight()`의 spacing metric source를 공유한다.
- GridList를 1차 적용 대상으로 삼고, TagGroup/TagList/Table을 동일 패턴 후보로 audit한다.

## 용어

| 용어            | 의미                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| root spacing    | collection root의 `props.style.padding*` / `props.style.gap`. 카드/칩/행 묶음의 inset 및 item 간격      |
| item spacing    | `GridListItem`, `Tag`, `Cell` 등 item 내부 content padding/gap                                          |
| self-render     | 자식 element 없이 `props.items` 등을 읽어 Spec `render.shapes()`가 직접 시각을 그리는 경로              |
| metric resolver | style/default/spec size를 받아 layout height와 paint 좌표에 동일하게 쓰는 숫자 metric을 반환하는 helper |

## 현재 문제 인벤토리

| 컴포넌트         | Preview root style                   | CSS selector 계약                              | Skia metric source                                      | 판정               |
| ---------------- | ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------- | ------------------ |
| ListBox          | `style={element.props.style}` 전달   | 기존 동작 유지                                 | `ListBox.spec.ts`가 `props.style.padding/gap` 우선 소비 | 기준 선례          |
| GridList         | 누락                                 | CSS는 `[data-layout]` 기대, component는 미전달 | height는 `style`, shapes는 `size.gap`/card metric       | Phase 1 대상       |
| TagGroup/TagList | TagGroup root style 전달 누락        | 수동 CSS mirror 유지                           | TagList chip gap은 `chipSize.gap` 고정                  | Phase 2 audit 대상 |
| Table            | renderer/component `style` 계약 약함 | Table root div 중심                            | cell padding은 size preset 중심                         | Phase 3 audit 대상 |

## Phase Plan

### Phase 0 — Contract + Helper Boundary

- `GridList` spacing resolver 위치를 결정한다.
- resolver는 builder-only import를 가져오지 않는다.
- 최소 반환 필드:
  - `paddingTop`
  - `paddingRight`
  - `paddingBottom`
  - `paddingLeft`
  - `gap`
  - `borderWidth`
  - `fontSize`
  - `numCols`
  - `cardPaddingX`
  - `cardPaddingY`
  - `cardBorderRadius`
  - `descGap`

권장 위치:

- `packages/specs/src/components/GridList.spec.ts` 내부 export 또는 `packages/specs/src/primitives/gridListMetrics.ts`
- spec-local export 채택 시 `packages/specs/src/index.ts` root barrel 에 re-export 필수 (`package.json:exports` 가 `./components` subpath 를 노출하지 않음). Builder 소비처는 `@composition/specs` root 경로로만 import (direct subpath import 금지).
- `apps/builder/.../utils.ts`는 specs helper를 import해 height 계산에 사용한다.

#### Phase 0 N_edited 실측 (R2 baseline 분기 gate)

ADR R2 상세의 edited baseline 분기 판정을 위해 `N_edited` 를 Phase 1 착수 전 측정한다.

정의: `tag = 'GridList'` AND (`props.style.padding` 또는 `props.style.paddingTop|Right|Bottom|Left` 또는 `props.style.gap` 또는 `props.style.rowGap|columnGap` 이 정의된) element 인스턴스 수.

측정 경로 (둘 중 하나 또는 병행):

- **Cloud 쿼리**: `elements` 테이블의 `tag`/`props` JSONB 컬럼 기준. 예시 SQL —
  ```sql
  SELECT COUNT(*) AS n_edited
  FROM elements
  WHERE tag = 'GridList'
    AND (
      props->'style' ? 'padding'
      OR props->'style' ? 'paddingTop' OR props->'style' ? 'paddingRight'
      OR props->'style' ? 'paddingBottom' OR props->'style' ? 'paddingLeft'
      OR props->'style' ? 'gap'
      OR props->'style' ? 'rowGap' OR props->'style' ? 'columnGap'
    );
  ```
  (`elements.tag` 및 `elements.props JSONB` 스키마는 `docs/reference/schemas/CLOUD.md` 참조.)
- **Export 파일 scan**: 로컬 또는 CI 에서 export 된 프로젝트 JSON (`packages/shared/src/schemas/project.schema.ts` → `elements: Element[]`) 을 순회하여 동일 조건 카운트.

기록 위치: 본 breakdown 의 `### N_edited 측정 결과` 섹션을 추가하거나, ADR-906 Addendum 으로 기록.

분기 판정:

- `N_edited = 0` → (a) unedited baseline 만 fixture test 로 고정. G3 통과 조건은 `padding* = 0, gap = 12` 일 때 `main` 과 byte-equal.
- `N_edited > 0` → (a) + (b) 양쪽 baseline. 편집된 인스턴스 샘플 k개 (최대 5개) 를 fixture 로 뽑아 Phase 1 파이프라인이 `style.padding/gap` 을 DOM/Skia 양쪽에 정확히 반영하는지 렌더 동일성으로 검증. 이는 Hard Constraint 1 "Preview root style 계약" 의 실증.

통과 조건: `N_edited` 수치가 기록되고, 분기 (a)/(b) 중 해당하는 fixture baseline 이 명시된 test 파일에 고정.

### Phase 1 — GridList Root Spacing Fix

Preview:

- `packages/shared/src/renderers/SelectionRenderers.tsx`
  - `<GridList>`에 `style={element.props.style as React.CSSProperties | undefined}` 전달.
- `packages/shared/src/components/GridList.tsx`
  - `data-layout` 수동 추가 불필요 — RAC가 내부 root `<div>`에 `data-layout={layout}`을 auto-emit한다 (`react-aria-components@1.15.1` `dist/GridList.mjs:198`). composition 쪽 변경 없이 `GridList.css`의 `[data-layout="grid"]` selector가 매칭된다.
  - 기존 `style={gridListStyle}` 유지.

Skia:

- `packages/specs/src/components/GridList.spec.ts`
  - `gap`을 resolver에서 읽는다.
  - `cellX`, `cellY`, section header 좌표에 root padding offset을 반영한다.
  - `cellWidth = (contentWidth - gap * (numCols - 1)) / numCols`로 계산한다.
  - `contentWidth = totalWidth - paddingLeft - paddingRight - borderWidth * 2`로 계산한다.
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
  - GridList height branch가 같은 resolver를 사용한다.
  - stack/grid/section 공식은 shapes의 row 계산과 동일하게 유지한다.

Baseline:

- `props.style`이 없으면 기존 default visual과 동일해야 한다.
- `gap` default는 기존 `12`를 유지한다.
- root padding default는 기존 `0`을 유지한다.

### Phase 2 — TagGroup / TagList Audit

Preview:

- `renderTagGroup`이 root `style`을 전달하는지 확인하고 누락 시 추가한다.
- `TagGroup.tsx`의 wrapper `<div style={{ position: "relative" }}>`와 `AriaTagGroup` 중 실제 시각 root가 어디인지 고정한다.

Skia:

- TagGroup root gap과 TagList chip gap을 분리한다.
- `TagList.spec.ts` chip spacing은 item spacing으로 유지한다.
- root `gap`이 Label ↔ TagList 간격인지, TagList row/chip gap까지 제어하는지 결정한다.

출력:

- TagGroup/TagList spacing 소유권 표.
- 필요 시 후속 ADR 또는 ADR-906 addendum.

### Phase 3 — Table Audit

Preview:

- `TableProps`에 `style?: React.CSSProperties`를 추가할지 판단한다.
- renderer가 `element.props.style`을 Table root에 전달할지, wrapper div에 적용할지 결정한다.

Skia:

- Table root padding과 cell padding을 분리한다.
- `Table.spec.ts`의 `size.paddingX/Y`는 cell spacing으로 유지할지 root spacing으로 분리할지 결정한다.

출력 (G4b 통과 산출물):

- **(1) Root ↔ Cell padding 소유권 분리 판정표** — 아래 표를 Phase 3 결과로 기록한다.

  | spacing 속성       | 현재 source                                                                                               | 제안 소유권 | 근거                                                                                                                                                               |
  | ------------------ | --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Table root padding | (없음 — `TableProps` 에 `style` 미노출, renderer 가 root 에 style 미전달, Table root div 가 style 미수신) | Root        | `packages/shared/src/components/Table.tsx:86-144`, `packages/shared/src/renderers/TableRenderer.tsx:343-427`, `packages/shared/src/components/Table.tsx:1264-1284` |
  | Table root gap     | (없음)                                                                                                    | Root        | 동일                                                                                                                                                               |
  | Cell padding (X/Y) | `Table.spec.ts` 의 `size.paddingX`/`size.paddingY` (size preset 중심)                                     | Cell        | `packages/specs/src/components/Table.spec.ts:156-168,231-246,280-297`                                                                                              |
  | Cell gap           | (Cell 내부 horizontal gap 은 Table 구조상 row/col grid 로 대체, 별도 gap prop 없음)                       | N/A         | Table 의 layout 이 grid/row 기반이므로 cell 내부 gap 은 "cell content gap" 이며 root gap 과 혼동 없음                                                              |

- **(2) GridList 패턴 이식 가능성 판정 기준** — 아래 네 가지를 Phase 3 에서 실측하고 O/X 로 기록한다.
  1. **Preview root style hook point**: `<Table>` 또는 wrapper `<div>` 중 어느 DOM 계층이 `element.props.style` 을 받을 자리인가? GridList 의 `<GridList style={...}>` 단일 전달과 동일 구조가 가능한가?
  2. **Skia metric resolver 공유 가능성**: Table 의 Skia 렌더가 `render.shapes()` 를 쓰는지, 별도 `TableRenderer` 경로를 타는지 확인. GridList 의 "resolver 를 `render.shapes()` 와 `calculateContentHeight()` 가 공유" 패턴이 Table 에 동일 적용되는가?
  3. **Cell padding 분리 안전성**: `size.paddingX/paddingY` 를 cell spacing 에 고정했을 때 root padding 추가가 기존 cell 좌표를 파괴하지 않는가? (fixture test 1개 최소)
  4. **BC 영향**: 저장된 Table 인스턴스 중 `props.style.padding/gap` 보유율 (Table 전용 `N_edited_table`) 을 측정. GridList `N_edited` 와 동일 query 형식.

- **(3) 최종 판정 3분기** (수치 기준 고정 — 4개 항목 (1)~(4) 중 O 개수 기준, 분기는 상호 배타적이며 망라적):
  - **4/4 O** → **Phase 3 에서 직접 구현** (GridList 패턴 이식).
  - **2/4 또는 3/4 O** → **부분 이식 + 후속 ADR 로 잔여 이관** (Phase 3 에 O 항목만 반영, X 항목은 후속 ADR 분리).
  - **0/4 또는 1/4 O** → **Table 단독 후속 ADR 로 전체 이관** (R4 scope 폭증 위험 실현).

## 파일 영향 초안

### Phase 1 직접 수정 후보

- `packages/shared/src/renderers/SelectionRenderers.tsx`
- `packages/shared/src/components/GridList.tsx`
- `packages/specs/src/components/GridList.spec.ts`
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

### Phase 1 테스트 후보

- `packages/specs/src/components/__tests__/GridList.spacing.test.ts` 또는 기존 specs test 위치
- `apps/builder/src/builder/workspace/canvas/layout/engines/__tests__/gridListSpacing.test.ts`
- Preview renderer smoke test가 있으면 `SelectionRenderers` root style 전달 회귀 추가

### Phase 2/3 audit 후보

- `packages/shared/src/renderers/CollectionRenderers.tsx`
- `packages/shared/src/components/TagGroup.tsx`
- `packages/specs/src/components/TagList.spec.ts`
- `packages/shared/src/renderers/TableRenderer.tsx`
- `packages/shared/src/components/Table.tsx`
- `packages/specs/src/components/Table.spec.ts`

## 검증 체크리스트

- [ ] Phase 0: `N_edited` (GridList `props.style.padding/gap` 보유 인스턴스 수) 가 Cloud 쿼리 또는 export scan 으로 측정되고, breakdown 또는 ADR Addendum 에 기록된다.
- [ ] Phase 0: `N_edited` 에 따라 fixture baseline (a) unedited / (b) edited 분기가 test 파일에 고정된다.
- [ ] Phase 0: spec-local export 채택 시 `packages/specs/src/index.ts` root barrel re-export 및 `@composition/specs` root 경로 소비가 확인된다 (direct subpath import 0건).
- [ ] Phase 1: GridList Preview root DOM에 inline `padding/gap`이 전달된다.
- [ ] Phase 1: GridList grid mode에서 RAC auto-emit `data-layout="grid"` selector가 적용된다.
- [ ] Phase 1: GridList Skia `render.shapes()`와 `calculateContentHeight()`가 같은 spacing resolver를 사용한다.
- [ ] Phase 1: `props.style` 부재 GridList unedited baseline이 유지된다 (현 `main` 과 byte-equal).
- [ ] Phase 1: `N_edited > 0` 일 때 편집된 인스턴스 샘플 k개 (최대 5) 에서 `style.padding/gap` 이 DOM/Skia 양쪽에 정확히 반영된다.
- [ ] 공통: root `padding/gap`과 item 내부 `padding/gap` 소유권이 문서화된다.
- [ ] 공통: ListBox behavior/test가 변하지 않는다.
- [ ] Phase 2: TagGroup/TagList audit 결과가 표로 남는다 (root gap ↔ chip gap 소유권 분리 포함).
- [ ] Phase 3: Table audit 결과가 표로 남고, root padding ↔ cell padding 분리 판정과 GridList 패턴 이식 가능성 판정 기준이 breakdown 에 기록된다.

## 오픈 이슈

1. GridList item 내부 padding을 Style Panel에서 제어해야 하는지 여부.
2. TagGroup root gap이 Label ↔ TagList 간격만 의미해야 하는지, chip/row gap까지 의미해야 하는지.
3. Table root spacing을 Table wrapper, virtualizer, native table 중 어느 DOM 계층에 적용할지.
4. 공통 `parseCSSSpacing` helper를 specs primitive로 둘지, builder/shared 각 runtime에 둘지.

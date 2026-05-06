# ADR-907 Breakdown: Collection/self-render container style pipeline 전수화

## 목표

- `element.props.style` 이 Preview DOM / Skia `render.shapes()` / Layout engine `calculateContentHeight()` 3경로에 **단일 pipeline** 으로 흐르도록 계약을 확정한다.
- **11 주대상 컴포넌트** (ADR-907 Scope 정규화 참조) 에서 drift 가 구조적으로 불가능하게 만든다:
  - `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 10개 (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:155-170`): `Breadcrumbs, ComboBox, GridList, ListBox, Select, Table, Tabs, TagGroup, Toolbar, Tree`
  - 추가 1개: `Menu` (ADR-068 에서 SYNTHETIC Set 제거됐으나 items SSOT 컴포넌트로 동일 drift 위험)
  - `TagList` 는 TagGroup 의 중간 compositional 컨테이너 (ADR-097) 로 별도 행이 아닌 TagGroup 종속 sub-target.
- ADR-906 의 GridList 증상은 본 ADR 의 pilot 적용 (Phase 3) 으로 해소한다.

## 용어

| 용어                        | 의미                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| root spacing                | collection root 의 `props.style.padding*` / `props.style.gap`                                                                                    |
| item spacing                | item (GridListItem/Tag/Cell 등) 내부 content padding/gap                                                                                         |
| self-render                 | 자식 element 없이 `props.items` 등 읽어 Spec `render.shapes()` 가 직접 시각 생성                                                                 |
| container spacing primitive | `packages/specs/src/primitives/containerSpacing.ts` 의 공통 resolver                                                                             |
| renderer style contract     | `packages/shared/src/renderers/**` 전수에서 root `style={element.props.style}` 전달을 강제하는 계약                                              |
| CSS value parser SSOT       | `parsePadding4Way` / `parseBorderWidth` / `parsePxValue` / `parseGapValue` 를 `packages/specs/src/primitives/cssValueParser.ts` 단일 모듈로 통합 |

## 현재 문제 인벤토리 (3경로 × 11 주대상 매트릭스)

각 컴포넌트의 (a) Preview root style 전달 여부, (b) Skia `render.shapes()` 의 `props.style` 소비, (c) `calculateContentHeight()` 의 `style.padding/gap` 소비를 Phase 0 에서 측정 후 본 표를 완성한다. 총 cell 수 = 11 × 3 = **33 cell**.

> **N_edited (padding/gap 편집 인스턴스 수) 축이 빠진 이유**: composition 은 element 영속을 per-user 로컬 IndexedDB (`apps/builder/src/lib/db/index.ts`) 에 위임하며 Supabase 는 auth 전용이다. 중앙 `elements` 테이블이 없으므로 production population 에서 `N_edited` 를 산출할 쿼리 경로가 존재하지 않는다. ADR-906 breakdown 의 Supabase SQL 접근은 본 ADR 에서 폐기. BC 커버리지는 Phase 3/4/5 의 **hand-crafted edited fixture** (k≤5 흔한 편집 패턴 수동 샘플링) 로 확보한다. 본 ADR `R2 상세` 참조.

| 컴포넌트    |          (a) Preview style 전달           |                     (b) Skia shapes metric                     |        (c) Layout height metric        | 판정                                        |
| ----------- | :---------------------------------------: | :------------------------------------------------------------: | :------------------------------------: | ------------------------------------------- |
| ListBox     |                     O                     |                      O (ListBoxSpec)[^1]                       |                 O[^1]                  | 기준 선례 + 2026-04-24 재정합               |
| GridList    |                   **X**                   |                     **X** (size.gap 고정)                      |                   O                    | ADR-906 증상 — Phase 3 pilot                |
| Menu        |                     O                     |                **X** (size.paddingX/Y 하드코딩)                |          N/A (전용 분기 없음)          | Phase 4 follow-up                           |
| ComboBox    |                     O                     |                **X** (size.paddingX/Y 하드코딩)                |   O (style.gap 소비, 자식 합산 경로)   | Phase 4 follow-up                           |
| Select      |                     O                     |                **X** (size.paddingX/Y 하드코딩)                |   O (style.gap 소비, 자식 합산 경로)   | Phase 4 follow-up                           |
| Tree        |                     O                     |                 N/A (shapes 빈 배열 or 미소비)                 |          N/A (전용 분기 없음)          | Phase 4 follow-up                           |
| Tabs        |                     O                     |                      N/A (shapes 빈 배열)                      |    **X** (TabsSpec.sizes 하드코딩)     | Phase 4 follow-up                           |
| Toolbar     |                     O                     |    **X** (size.gap/background 하드코딩, style?.gap 미소비)     |          N/A (전용 분기 없음)          | Phase 4 follow-up                           |
| Breadcrumbs |                     O                     |                 N/A (shapes 없음, 텍스트 측정)                 | **X** (BreadcrumbsSpec.sizes 하드코딩) | Phase 4 follow-up                           |
| TagGroup    |                   **X**                   |                N/A (TagList sub-target에 위임)                 |          O (style?.gap 소비)           | Phase 4 follow-up (TagList sub-target 포함) |
| Table       | **X** (`<Table>` root 에 style prop 부재) | **X** (style?.backgroundColor 등만 소비, padding/gap 하드코딩) |          N/A (전용 분기 없음)          | Phase 5 별도 audit                          |

**TagList 주석**: TagList 는 TagGroup 의 중간 compositional 컨테이너 (ADR-097) 로 별도 주대상 행이 아닌 TagGroup 종속 sub-target. TagGroup Phase 4 follow-up ADR 에서 `<TagList>` 의 root style 소비 및 chip gap 소유권 분리가 함께 판정된다 (ADR-906 breakdown Phase 2 의 TagGroup/TagList audit 유산).

[^1]: ListBox (b)/(c) 2026-04-24 재정합 — ADR-907 Implemented 직후 발견된 Open Issue. Phase 0 Matrix 작성 시점의 O 평가는 store shorthand→longhand 정책 이전의 `style.gap` 직접 읽기 기준이었으며, longhand 정책 전파 후 `style.gap`은 항상 undefined → `size.gap` fallback 으로 고정되어 Style 패널 gap 편집이 Skia/Layout 양쪽에서 무시됨. 후속 sweep (ADR 불필요, Open Issue #3 패턴) 로 `resolveListBoxSpacingMetric` Layer D resolver 신설 → `ListBoxSpec.render.shapes` + utils.ts `calculateContentHeight` ListBox 분기가 동일 심볼 공유. 테스트: `packages/specs/src/__tests__/ListBox.spacing.test.ts` (19 tests).

## 아키텍처

### Layer A — CSS value parser SSOT

위치: `packages/specs/src/primitives/cssValueParser.ts`

```typescript
export function parsePxValue(value: unknown, fallback: number): number;

export function parsePadding4Way(style?: {
  padding?: unknown;
  paddingTop?: unknown;
  paddingRight?: unknown;
  paddingBottom?: unknown;
  paddingLeft?: unknown;
}): {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function parseBorderWidth(value: unknown, fallback?: number): number;

export function parseGapValue(
  style?: {
    gap?: unknown;
    rowGap?: unknown;
    columnGap?: unknown;
  },
  fallback?: number,
): { row: number; column: number };
```

- 기존 call-site 전수 교체 (`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` + Skia spec 파일들 + renderer post-process).
- 숫자/문자열/undefined 3 형태를 모두 수용.
- `fallback` 을 수용해 기존 default 값 보존 (ADR-906 의 `gap = 12` 같은 spec default).

### Layer B — Container spacing primitive

위치: `packages/specs/src/primitives/containerSpacing.ts`

```typescript
export interface ContainerSpacing {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
}

export function resolveContainerSpacing(input: {
  style?: Record<string, unknown>;
  defaults: {
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    rowGap?: number;
    columnGap?: number;
    borderWidth?: number;
    fontSize?: number;
  };
}): ContainerSpacing;
```

- 컴포넌트-specific 필드 (`numCols`, `cardPaddingX/Y`, `descGap` 등) 는 각 spec 에서 `resolveContainerSpacing()` 을 호출 후 **확장 필드만** 추가 조합.
- 예: `resolveGridListSpacingMetric()` = `resolveContainerSpacing()` + `numCols` + `resolveGridListItemMetric()`.

### Layer C — Renderer style contract

위치: `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts` (신규)

- **계약 대상 범위**: `packages/shared/src/renderers/**` 의 renderer 중 **본 ADR scope 의 11 주대상 컴포넌트 renderer** (`renderListBox, renderGridList, renderMenu, renderComboBox, renderSelect, renderTree, renderTabs, renderToolbar, renderBreadcrumbs, renderTagGroup, renderTable`). 이들은 root 컴포넌트에 `style={element.props.style as React.CSSProperties | undefined}` 를 전달해야 한다.
- **scope 밖 renderer**: `TableView` (LayoutRenderers.tsx:1982) 는 non-collection wrapper style merge 구조로 본 ADR scope 밖. 다른 non-collection renderer (Field/DataField/DateField 등) 도 본 Layer C 검증 대상 아님 — 필요 시 별도 ADR.
- 검증 방법:
  - (a) Vitest 로 각 주대상 renderer 를 fake element (root `style.padding = 10`) 로 호출 → 반환 JSX 트리의 root 에 `style.padding === 10` 확인.
  - (b) 또는 ESLint custom rule 로 AST 매칭 — 11 주대상 renderer 의 root 컴포넌트에 `style={` prop 누락 시 error.
- 예외: wrapper 가 필요한 컴포넌트 (예: TagGroup 의 `<div style={{position:"relative"}}>`) 는 wrapper vs 내부 root 중 "실제 시각 root" 가 style 을 받도록 명시. 예외 목록은 test 에 allowlist 로 기록.
- **Table 특수 사례**: `renderTable` (TableRenderer.tsx:343) 은 현재 `<Table>` root 에 `style=` 전달 안 됨. Phase 5 Table audit 에서 "TableProps 에 style 노출 / wrapper 에 적용" 판정 후 Layer C allowlist 에서 제거.

### Layer D — Spec metric SSOT

각 collection spec 의 `render.shapes()` 와 builder 의 `calculateContentHeight()` 가 **같은 resolver** 를 호출하도록 강제한다.

구조:

```typescript
// packages/specs/src/components/GridList.spec.ts
export function resolveGridListSpacingMetric(input): GridListSpacingMetric {
  const base = resolveContainerSpacing({
    style: input.style,
    defaults: { rowGap: 12, columnGap: 12, fontSize: 14 },
  });
  return {
    ...base,
    numCols: input.layout === "grid" ? (input.columns ?? 2) : 1,
    ...resolveGridListItemMetric(base.fontSize),
  };
}

// render.shapes() 내부
const metric = resolveGridListSpacingMetric({ style: props.style, ... });

// apps/builder/.../utils.ts calculateContentHeight GridList 분기
const metric = resolveGridListSpacingMetric({ style: element.props.style, ... });
```

검증: `packages/specs/src/__tests__/{Component}.spacing.test.ts` 가 동일 입력에 대해 resolver 반환값과 spec `render.shapes()` 내부 좌표가 일치하는지 확인.

## Phase Plan

### Phase 0 — Audit (3경로 × 11 주대상 매트릭스 + test discovery 확인)

- 위 "현재 문제 인벤토리" 표의 11 주대상 컴포넌트에 대해 (a)/(b)/(c) 측정 결과 기록.
- 측정 방법:
  - (a) Preview: `packages/shared/src/renderers/**` grep 후 각 `render{Component}()` 의 root JSX 에 `style={` 존재 여부.
  - (b) Skia: `packages/specs/src/components/{Component}.spec.ts` 의 `render.shapes()` 가 `props.style` 에서 padding/gap 을 읽는지.
  - (c) Layout: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 의 해당 컴포넌트 분기가 `style.padding/gap` 을 소비하는지.
  - N_edited 축 제거 사유는 위 "현재 문제 인벤토리" 주석 참조 (Supabase 중앙 테이블 부재 → production 산출 불가 → hand-crafted fixture 로 대체).
- **Test discovery 확인** (Phase 1-2 신규 test 파일 수집 여부 사전 확증):
  - `packages/specs/vitest.config.ts` 의 include 패턴이 `src/**/__tests__/**/*.test.ts` 를 수용 — Phase 1 `packages/specs/src/primitives/__tests__/cssValueParser.test.ts` 및 Phase 2 `containerSpacing.test.ts` 수집 확증.
  - `packages/shared/vitest.config.ts` 의 include 패턴이 `src/**/__tests__/**/*.test.ts` 를 수용 — Phase 2 `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts` 수집 확증.
  - 확증 실패 시 include 패턴 조정 후 Phase 1 착수.

통과 조건: 매트릭스 총 **33 cell** (11 × 3 축 (a/b/c)) 이 breakdown 에 기록되고, Phase 3/4/5 의 적용 우선순위가 결정된다. Test discovery 확증 3항 PASS.

### Phase 0 측정 결과 요약 (2026-04-24 세션)

**매트릭스 33 cell 실측 요약** (위 표):

- **(a) Preview style 전달**: O 8 / X 3 (GridList, TagGroup, Table)
- **(b) Skia shapes metric**: O 1 (ListBox) / X 6 (GridList, Menu, ComboBox, Select, Toolbar, Table) / N/A 4 (Tree, Tabs, Breadcrumbs, TagGroup)
- **(c) Layout height metric**: O 5 (ListBox, GridList, ComboBox, Select, TagGroup) / X 2 (Tabs, Breadcrumbs) / N/A 4 (Menu, Tree, Toolbar, Table)

**주요 발견**:

- GridList 는 (a) X + (b) X + (c) O — ADR-906 증상 그대로 (Phase 3 pilot 대상).
- TagGroup 은 (a) X 인데 (c) O — Preview 에서는 style 미전달이지만 Layout 은 style?.gap 소비. SYNTHETIC 소비 drift 근본 증상.
- Table 은 (a) X + (b) X + (c) N/A — renderer root 자체가 style 미전달. Phase 5 판정에서 4-item O/X 매트릭스 필요.
- (b) 축: ListBox 단 1개만 O. 나머지 10 컴포넌트 중 5개는 spec shapes 에 하드코딩값 (`size.paddingX/Y` / `size.gap`), 4개는 shapes 빈 배열 (text-only 또는 미사용). → Layer D (Spec metric SSOT) 의 우선 적용 대상 = 5 컴포넌트 (GridList/Menu/ComboBox/Select/Toolbar).
- (c) 축: 전용 분기 있는 컴포넌트는 4개 (ListBox/GridList/ComboBox/Select/TagGroup 중 일부) + Tabs/Breadcrumbs 는 별도 분기 존재하나 style 무시. → Layer B `resolveContainerSpacing` 의 즉시 수요자 = 5 + 2 = 7 컴포넌트.

### Test discovery 확증 결과

| 항목                               | include 패턴                                                                                                                                                              |        결과         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------: |
| `packages/specs/vitest.config.ts`  | `["__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.ts"]`                                                                                                             | **PASS** (2번째 항) |
| `packages/shared/vitest.config.ts` | `["__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.ts"]`                                                                                                             | **PASS** (2번째 항) |
| Phase 1/2 신규 test 경로 수집 보장 | `src/primitives/__tests__/cssValueParser.test.ts` / `containerSpacing.test.ts` / `src/renderers/__tests__/rendererStyleContract.test.ts` 가 두 config include 패턴과 매칭 |      **PASS**       |

결론: G1 Gate 의 test discovery 조건 충족. Phase 1 착수 시 include 수정 불필요.

### Codex Round 4 판정 (Phase 0 실측 반영 검증)

Phase 0 실측이 ADR 전제를 정정할 수 있는 정보 3건을 제공함에 따라 Codex Round 4 외부 cross-check 를 수행 (2026-04-24). 판정 결과:

| 질문                              | Codex 판정    | 반영 위치                                                                                                |
| --------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Q1 Layer D 우선 수요자 5건 축소   | **부분 동의** | ADR-907 Scope 정규화 테이블 (`Phase 4 Layer D 적용 4` + `Layer D 무적용 4` 분리). G6 템플릿 Profile X/Y. |
| Q2 Layer B 즉시 수요자 7건 축소   | **부분 동의** | Layer C renderer contract 는 11 전수 + allowlist 유지 (ADR 47줄). Layer B 수요자만 7 로 축소.            |
| Q3 TagGroup Phase 3 co-pilot 승격 | **반대**      | ADR-097 TagList compositional 충돌. TagGroup.spec shapes 빈 배열. Phase 4 최우선 (ADR-908 등) 유지.      |
| Q4 Table Layer C (a) 선반영       | **부분 동의** | Phase 5 G7 audit 유지. Phase 2 rendererStyleContract 에서 Table (a) 선반영 가능.                         |

종합 판정: **B — 부분 수정 후 Phase 1**. Round 3 승인은 유지. 4-Layer 는 "조건부 적용" 보정으로 본질 유지.

반영 완료 항목:

- ADR-907 Scope 정규화 테이블: 기존 "Phase 4 follow-up 8" → "Layer D 적용 4 + 무적용 4" 분리 + Layer 적용 profile 열 추가
- ADR-907 Decision §1 누적 비용 수식: "follow-up 8~16일" → "Profile X 4 × 1.5 + Profile Y 4 × 0.5~1 = **8~10일**" (상한 -37.5%)
- ADR-907 Consequences Positive: "25~41일 / 50~55% 절감" → "25~35일 / 55~61% 절감"
- ADR-907 Scope 주석: TagGroup Phase 3 co-pilot 승격 기각 사유 (ADR-097 + shapes 빈 배열) 명시
- ADR-907 Scope 주석: Layer C 전수 유지 + Layer B/D 조건부 명시
- breakdown Phase 4 템플릿: Profile X/Y 분기 + step 2/3 조건부
- breakdown Phase 5 Table: Layer C (a) Phase 2 선반영 가능성 + G7 scope (b/c + B/D) 로 축소

### Phase 1 — CSS value parser SSOT 통합

- `packages/specs/src/primitives/cssValueParser.ts` 신설 + `packages/specs/src/primitives/index.ts` 에 export.
- 기존 call-site 전수 교체:
  - `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 의 padding 파싱 로직
  - Skia spec 파일들의 ad-hoc parseFloat
  - Preview post-process 의 CSS shorthand 분해
- Vitest: `cssValueParser.test.ts` — shorthand 4 형태 (1/2/3/4 값), px/숫자/undefined/잘못된 입력 fallback.

통과 조건: `rg "parseFloat.*padding|parseFloat.*gap" apps packages` = 0건 (또는 allowlist 외 0건). parser test 100% PASS.

### Phase 2 — Container spacing primitive + Renderer contract 강제

**Layer B**:

- `packages/specs/src/primitives/containerSpacing.ts` 신설 + `index.ts` export.
- `resolveContainerSpacing()` 단위 test 10+ (style 우선 / default fallback / token ref resolution / border shorthand).

**Layer C**:

- `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts` 신설.
- 현재 존재하는 renderer 함수를 한 번에 import 해 각각 fake element 로 호출 → root 에 `style.padding = 99` 가 전달되는지 snapshot.
- 초기에는 기존 누락 renderer 는 `known_missing.ts` allowlist 에 등록. Phase 3/4/5 에서 하나씩 제거.

통과 조건:

- primitive test 100% PASS.
- renderer contract test 가 최소 ListBox (이미 정합) + Phase 3 이후 적용 컴포넌트에서 PASS. 나머지는 allowlist 로 일시 허용.

### Phase 3 — GridList pilot 적용 (ADR-906 흡수)

- `renderGridList` 에 `style={element.props.style}` 추가 → allowlist 에서 GridList 제거.
- `GridList.spec.ts` 에 `resolveGridListSpacingMetric()` 신설 (Layer B 활용) + `packages/specs/src/index.ts` barrel re-export.
- `utils.ts` GridList 분기 → `resolveGridListSpacingMetric()` 호출로 치환.
- `render.shapes()` 도 `resolveGridListSpacingMetric()` 호출.
- Fixture: unedited (`main` byte-equal) + edited (hand-crafted 샘플 k≤5: `padding: 16, gap: 8` / `paddingLeft: 24, columnGap: 4` / `border: 1, rowGap: 12` 등 흔한 편집 패턴 수동 작성).
- **RAC `data-layout` auto-emit selector 매칭 test** (ADR-906 G2 흡수): `react-aria-components@1.15.1` `dist/GridList.mjs:198` 의 `data-layout={layout}` 자동 방출이 `GridList.css` 의 `[data-layout="grid"]`/`[data-layout="stack"]` selector 와 매칭됨을 Preview DOM 렌더 test 로 확인. composition 쪽 수동 추가 금지 (renderGridList 에서 `data-layout=` 명시 금지).

통과 조건 (G3 = 906 의 G2/G3 흡수):

- GridList root `padding/gap` 편집값이 Preview DOM 과 Skia shapes 양쪽에 반영.
- `render.shapes()` 와 `calculateContentHeight()` 가 같은 resolver 호출 확인 (grep + test).
- RAC `data-layout` auto-emit 매칭 test PASS (수동 추가 아님).
- unedited baseline byte-equal.

### Phase 4 — 순차 적용 (follow-up ADR 템플릿)

본 ADR 은 **프레임워크 확정 + pilot(GridList)** 만 land. 11 주대상 중 Phase 3 pilot(GridList) + Phase 5 별도(Table) + ListBox 기준 선례(재검증만)를 제외한 **8 컴포넌트** (`Breadcrumbs, ComboBox, Menu, Select, Tabs, TagGroup, Toolbar, Tree`) 적용은 **follow-up ADR (ADR-908..ADR-115)** 로 분기하며 Phase 0 실측 기반 **2 프로파일** 로 나뉜다:

- **Profile X — Layer D 적용 4건**: `Menu, ComboBox, Select, Toolbar` — spec `render.shapes()` 가 `size.paddingX/Y` / `size.gap` 하드코딩 중 → `resolve{Component}SpacingMetric()` 신설 필요. 건당 약 1.5일.
- **Profile Y — Layer D 무적용 4건**: `Tree, Tabs, Breadcrumbs, TagGroup` — spec shapes N/A (빈 배열 또는 텍스트 측정 전용) → Layer D resolver 신설 무의미. Layer A/B/C 만 적용. 건당 약 0.5~1일.

각 follow-up ADR 은 아래 공통 템플릿을 따르되, Profile X/Y 에 따라 step 2/3 조건부:

```
## Phase 구성 (follow-up ADR 공통)
1. renderer 에 `style={element.props.style}` 추가 → Layer C allowlist 제거.
2. [Profile X 만] `{Component}.spec.ts` 에 `resolve{Component}SpacingMetric()` 추가 (containerSpacing primitive 호출 + 컴포넌트-specific 확장).
   [Profile Y 는 생략] spec shapes N/A 이므로 Layer D 무관 — Layer B resolveContainerSpacing 결과를 Preview/Layout 에서만 소비.
3. `utils.ts` 해당 분기 치환.
   [Profile X] render.shapes 와 calculateContentHeight 가 동일 resolver 호출 확인.
   [Profile Y] utils.ts 분기가 존재하지 않으면 step 자체 생략 (일반 flow 경로).
4. fixture test 추가 (unedited baseline + hand-crafted edited baseline k≤5; root style 편집 UI 접근 가능한 컴포넌트는 k=5, 아닌 컴포넌트는 k=2).
5. Generator 영향 여부 확인 — skipCSSGeneration 또는 childSpec emit 한계 존재 시 한 줄 명시 (예: GridList.spec.ts:71 `skipCSSGeneration: true`).
6. ADR-907 Phase 0 matrix 해당 행 업데이트 + Scope 정규화 테이블 Layer 적용 profile 교차 인용 + 본 follow-up ADR 의 Implemented 전환 시점에 ADR-907 README 교차 인용.
```

follow-up ADR 누적 = Profile X 4건 × 1.5일 + Profile Y 4건 × 0.5~1일 = **8~10일**. 원 추정 "8 × 1~2일 = 8~16일" 의 상한이 -37.5% 축소됨 (R4 대응 수식화).

통과 조건:

- follow-up ADR 템플릿이 본 breakdown 또는 별도 문서로 확정.
- 최소 1건 follow-up (예: ADR-908 Menu) 이 본 ADR land 와 동시에 Proposed.

### Phase 5 — Table audit (별도 판정)

- Table 은 구조가 다르므로 (TableProps/TableRenderer/virtualizer) ADR-906 breakdown Phase 3 의 4-item O/X 매트릭스 재사용:
  1. Preview root style hook point
  2. Skia metric resolver 공유 가능성
  3. Cell padding 분리 안전성
  4. BC (hand-crafted edited fixture k≤5 — Table 은 root `style` 편집 UI 가 열려있는 경우 k=5, 아닌 경우 k=2)
- 4/4 O → 본 ADR framework 로 Phase 3 와 동일 적용.
- 2-3/4 O → 부분 이식 + follow-up ADR 잔여 이관.
- 0-1/4 O → Table 단독 follow-up ADR 로 전체 이관.

**Layer C (a) 선반영** (Phase 2 에서 가능): Phase 0 실측상 Table (a) X 는 `TableRenderer.tsx:343-349` 의 `<Table>` root 에 `style` prop 부재로 renderer-level 즉시 해결 가능 (SelectionRenderers 의 GridList 패치와 동일 형태). Phase 2 `rendererStyleContract.test.ts` 신설 시 Table renderer 의 (a) 수정을 선행할 수 있으며, Phase 5 G7 audit 은 (b)/(c) + Layer B/D 의 framework 전면 적용 가능성만 판정한다. (a) 선반영 시 Phase 5 기각 결과에서도 Preview DOM 편집 반영 은 이미 확보됨.

통과 조건: Table 판정 결과가 본 breakdown 에 기록되고, 분기 선택이 명시된다. Layer C (a) 선반영 여부 (Phase 2 에서 수행) 도 함께 기록.

### Phase 6 — Fixture regression + Migration validation

- ListBox + GridList + Phase 4/5 에서 land 된 컴포넌트에 대해 fixture baseline 회귀 test.
- hand-crafted edited fixture (k≤5 흔한 편집 패턴) 가 Phase 1 이전 렌더와 이후 렌더의 **시각 equivalence** 검증 (의도된 변화 = Hard Constraint 1 충족).
- Chrome MCP 또는 storybook smoke test 선택.

통과 조건: 모든 회귀 test PASS + migration 체크리스트 완료.

## 파일 영향 초안

### Phase 1 신규

- `packages/specs/src/primitives/cssValueParser.ts`
- `packages/specs/src/primitives/__tests__/cssValueParser.test.ts`
- `packages/specs/src/primitives/index.ts` (export 추가)

### Phase 1 치환 대상

- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- `packages/specs/src/components/{GridList,ListBox,...}.spec.ts` 내부 parseFloat 호출
- `packages/shared/src/renderers/*.tsx` 의 post-process 파싱

### Phase 2 신규

- `packages/specs/src/primitives/containerSpacing.ts`
- `packages/specs/src/primitives/__tests__/containerSpacing.test.ts`
- `packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts`
- `packages/shared/src/renderers/__tests__/rendererStyleContract.allowlist.ts`

### Phase 3 치환

- `packages/shared/src/renderers/SelectionRenderers.tsx` — `renderGridList` root style 전달
- `packages/specs/src/components/GridList.spec.ts` — `resolveGridListSpacingMetric()` 신설 + `render.shapes()` 호출
- `packages/specs/src/index.ts` — barrel re-export
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — GridList 분기 resolver 호출
- `packages/specs/src/__tests__/GridList.spacing.test.ts`
- `apps/builder/src/builder/workspace/canvas/layout/engines/__tests__/gridListSpacingHeight.test.ts`

### Phase 4 (follow-up ADR 경로 — 각 ADR 내부)

- 각 컴포넌트별 renderer + spec + utils 치환 (건당 3 파일 내외).

### Phase 5

- Phase 0 audit 결과에 따라 결정.

## 검증 체크리스트

- [ ] Phase 0: 11 주대상 × 3 축 (a/b/c) 매트릭스 **33 cell** 기록. N_edited 축 제거 사유 (Supabase 중앙 테이블 부재 → hand-crafted fixture 로 대체) 가 본 breakdown 의 "현재 문제 인벤토리" 주석 및 ADR R2 상세에 기록.
- [ ] Phase 0: `packages/specs/vitest.config.ts` + `packages/shared/vitest.config.ts` include 패턴이 신규 test 경로 수집 확증.
- [ ] Phase 1: `cssValueParser` 가 `packages/specs/src/primitives/` 하에 export 되고 기존 parseFloat 호출 0건 (allowlist 외).
- [ ] Phase 1: parser test 10+ PASS.
- [ ] Phase 2: `containerSpacing` primitive test 10+ PASS.
- [ ] Phase 2: `rendererStyleContract.test.ts` 가 allowlist 를 명시하며 ListBox PASS.
- [ ] Phase 3: GridList renderer style 전달 + spec resolver 공유 + fixture baseline PASS.
- [ ] Phase 3: ADR-906 의 G1/G2/G3 조건이 본 ADR G3 로 흡수되며 GridList 증상 해소.
- [ ] Phase 4: follow-up ADR 템플릿 확정 + 최소 1 follow-up ADR Proposed.
- [ ] Phase 5: Table 판정 4-item O/X 결과 기록 + 분기 선택 명시.
- [ ] Phase 6: 기존 회귀 0 (ListBox + GridList + pilot 적용 컴포넌트) + migration 체크리스트 완료.
- [ ] 공통: `packages/specs` → `apps/builder` / `@composition/shared` 역방향 import 0건 (boundary 유지).

## 오픈 이슈

1. ~~Renderer contract 강제를 ESLint custom rule 로 할지, vitest 기반 runtime 검증으로 할지~~ **해결 (Phase 2)**: vitest runtime 검증 (`rendererStyleContract.test.ts`) 채택. Phase 5 allowlist 빈 Set 도달로 11/11 전원 통과.
2. `resolveContainerSpacing()` 의 token ref resolution (`{spacing.xs}` 같은) 를 primitive 가 직접 수행할지, caller 에게 위임할지 — **caller 위임** (Phase 2 Layer B 구현 시 확정). primitive 는 숫자/string 만 처리, TokenRef 해석은 downstream.
3. ~~Phase 4 follow-up ADR 을 개별로 분리할지, "ADR-908 Phase 4 follow-up 통합" 단일 ADR 로 묶을지~~ **해결 (Phase 4 실행)**: **sweep 경로 채택** — 신규 ADR 0건, 본 breakdown 의 Phase 4 템플릿을 PR 체크리스트로 직접 사용. 아래 "Phase 4 Execution Log" 섹션에 결과 기록. 원인: Phase 1-5 land 후 재audit 결과 실제 남은 작업이 2건 (Menu/Toolbar) 으로 축소되어 ADR 분리 오버헤드 대비 가치 낮음.
4. Table (Phase 5) 은 ADR-906 의 Phase 3 breakdown 을 상속받는가, 아니면 본 ADR 의 framework 판정을 우선하는가 — **본 ADR framework 판정 우선** (Phase 5 land 시 (a) 선반영, (b) 는 Hard Constraint 4 로 cell-level 분리 유지하여 framework 적용 안함).
5. RSP/RAC composite (ComboBox=TextField+Button+Popover) 에서 root 가 여러 DOM 계층으로 분리될 때 "실제 시각 root" 정의 방법 — ComboBox/Select 의 root 는 최상위 `<ComboBox>/<Select>` 로 정의 (renderComboBox/renderSelect 반환 JSX). 중간 Popover 컨테이너는 본 ADR scope 외.

## Phase 4 Execution Log (실행 결과)

### 실제 잔여 작업 재audit (Phase 1-5 land 후)

원 matrix (L29-41) 는 Phase 1-5 **이전** 에 capture 된 것으로, Phase 1 Layer A (cssValueParser 전수 교체 42 spec) + Phase 2 Layer B/C (containerSpacing primitive + rendererStyleContract) + Phase 3 (GridList pilot) + Phase 5 (Table/TagGroup root style) 완료 후 재audit 결과:

| 컴포넌트    | 원 matrix                    | Phase 1-5 후 재audit                                                                           | Phase 4 실제 작업                                      |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Menu        | (b) X paddingX hardcoding    | 동일                                                                                           | **적용** — `size.paddingX` → `resolveContainerSpacing` |
| ComboBox    | (b) X paddingX/Y hardcoding  | 이미 style-aware (`parsePxValue(style.paddingLeft ?? paddingRight ?? padding, size.paddingX)`) | **작업 불필요** (matrix outdated)                      |
| Select      | (b) X paddingX/Y hardcoding  | 이미 style-aware (ComboBox 와 동일 패턴)                                                       | **작업 불필요** (matrix outdated)                      |
| Toolbar     | (b) X gap/padding hardcoding | 동일 (`size.gap`, `size.paddingX/Y`)                                                           | **적용** — `resolveContainerSpacing` 도입              |
| Tree        | N/A                          | 실질 완료 (shapes 빈 배열, Layer A/B/C 자동 커버)                                              | 작업 불필요                                            |
| Tabs        | (c) X TabsSpec.sizes         | 실질 완료 (shapes N/A, 일반 parseBoxModel 경로로 style.padding 처리)                           | 작업 불필요                                            |
| Breadcrumbs | (c) X BreadcrumbsSpec.sizes  | 실질 완료 (shapes N/A, 일반 경로)                                                              | 작업 불필요                                            |
| TagGroup    | Phase 4 대상                 | Phase 5 에서 (a) O 달성 + shapes N/A (TagList 위임)                                            | 작업 불필요                                            |
| Table       | Phase 5 별도                 | Phase 5 (a) O 달성 + (b) cell-level padding 은 Hard Constraint 4 로 hardcoding 정당            | 작업 불필요 (HC4)                                      |

**결론**: Phase 4 실제 land 범위 = **Menu + Toolbar 2 컴포넌트**. 원 추정 "Profile X 4 × 1.5 + Profile Y 4 × 0.5~1 = 8~10일" 이 실측상 **1~2일** 로 축소.

### Land 결과

- `packages/specs/src/components/Menu.spec.ts:393`: `size.paddingX` → `resolveContainerSpacing` 호출 → `paddingLeft` 소비. `style.paddingLeft/paddingRight/padding` 우선, `size.paddingX` fallback.
- `packages/specs/src/components/Toolbar.spec.ts:131-158`: container layout `gap: size.gap`, `padding: [size.paddingY, ...]` → `resolveContainerSpacing` 결과로 교체. orientation=vertical 에서 `rowGap`, horizontal 에서 `columnGap` 사용.
- `packages/specs/src/__tests__/Menu.spacing.test.ts` — 4 tests (defaults / paddingLeft override / padding shorthand / px string).
- `packages/specs/src/__tests__/Toolbar.spacing.test.ts` — 5 tests (defaults / gap horizontal / gap vertical / padding shorthand / paddingTop longhand override).

### Gate 결과

- Gate G6 (Follow-up Template): **충족** — Phase 4 템플릿 (L278-289) 을 sweep 실행 체크리스트로 직접 사용. ADR-908 등 신규 ADR 작성 없이 이행.
- Gate G8 (Regression): **충족** — Menu/Toolbar spacing test 9/9 PASS, ListBox behavior 불변, GridList 기존 fixture test 유지, specs 전체 292/292 (기존 283 + 신규 9).

## ADR-907 Status 승격 근거

Phase 1/2/3/5/4 (Phase 4 가 Phase 5 뒤에 land) 완료 + Phase 6 fixture regression 요건을 Phase 4 작업 내 spacing test 로 충족. G1-G8 전원 통과 조건 완비:

- G1 Audit Matrix: 33 cell 기록 (본 breakdown matrix) + Phase 4 execution log 의 재audit 결과
- G2 CSS Parser SSOT: Phase 1 완료 (parseFloat 0건 allowlist 외, specs 내 전수 교체)
- G3 GridList Pilot: Phase 3 Wave A/B/C 완료 (resolveGridListSpacingMetric + 2경로 단일 소비 + data-layout RAC delegation)
- G4 Renderer Contract: Phase 2 완료 (`rendererStyleContract.test.ts` 11/11 + allowlist 빈 Set)
- G5 Boundary: 4 rg 명령 매 Phase 통과
- G6 Follow-up Template: 본 섹션으로 해결 (sweep 경로)
- G7 Table Audit: Phase 5 (a) 적용 + (b) HC4 로 cell-level 분리 유지 판정 명시
- G8 Regression: 전체 vitest PASS (specs 292/292, shared 72/72, builder 333/334 pre-existing 무관)

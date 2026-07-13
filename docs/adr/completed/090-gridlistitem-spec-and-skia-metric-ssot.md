# ADR-090: GridListItem.spec 신설 + Skia card metric SSOT + implicitStyles 분기 리프팅

## Status

Implemented — 2026-04-21

## Implementation

- **Phase 1** — `packages/specs/src/components/GridListItem.spec.ts` 신설. `skipCSSGeneration: true`, `containerStyles: { display: "flex", flexDirection: "column" }`, `sizes.md` (paddingX:16, paddingY:12, gap:2, fontSize/lineHeight/borderRadius TokenRef, fontWeight:600), `states` (hover/focusVisible/disabled). `export function resolveGridListItemMetric(fontSize)` 신설 — fontSize>14/>12/else 3분기 카드 metric 캡슐화.
- **Phase 2** — `packages/specs/src/components/GridList.spec.ts` — `childSpecs: [GridListItemSpec]` 배선. `packages/specs/src/components/index.ts` — `GridListItemSpec`/`resolveGridListItemMetric`/`GridListItemProps` export.
- **Phase 3** — `GridList.render.shapes` — `cardPaddingX/Y`/`cardBorderRadius`/`descGap` 하드코딩 4줄 제거 → `resolveGridListItemMetric(fontSize)` destructure 1줄로 교체.
- **Phase 4** — `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:758-773` 분기 재구성. `display/flexDirection` 은 containerStyles 로 리프팅 (resolveContainerStylesFallback 자동 주입). `padding/gap/borderWidth` 는 **Taffy shorthand 미지원** 제약으로 containerStyles 대신 `GridListItemSpec.sizes.md` 의 paddingX/paddingY/gap 필드 참조로 전환 (하드코딩 `12/16/2/1` 제거). `minWidth: 0` + `injectCollectionItemFontStyles` 호출은 runtime 결정 로직으로 유지.
- **Phase 5 검증**:
  - type-check 3/3 PASS
  - specs 166/166 PASS (snapshot 변동 0 — 두 spec 모두 skipCSSGeneration=true)
  - builder 217/217 PASS
  - `rg 'cardPaddingX|cardPaddingY|cardBorderRadius|descGap' GridList.spec.ts` = 0건 (resolver 경유 참조만 9곳)
  - `rg 'paddingTop: parentStyle.paddingTop \?\? 12' implicitStyles.ts` = 0건
  - GridList.css 무변경 (수동 CSS 유지 — 후속 ADR 대기)

### 설계 조정 (Decision 대비 실측 반영)

Decision 단계에서는 `containerStyles.padding/gap/borderWidth` 를 전부 리프팅할 계획이었으나, `fullTreeLayout.ts:286-296`/`:457-463` 확인 결과 **Taffy 엔진은 paddingTop/Right/Bottom/Left 개별 키만 파싱**, `padding: "12px 16px"` shorthand 미지원. ADR-085 gridTemplateAreas(string) 선례와 달리 padding shorthand 는 분해 필요. 해결: containerStyles 는 layout primitive(display/flexDirection) 만 담당, numeric metric(paddingX/Y/gap) 은 sizes.md 에 SSOT 유지 + implicitStyles 분기가 paddingTop/Right/Bottom/Left 로 분해 주입. 결과적으로 **분기 완전 해체는 불가하지만 하드코딩 0건** 달성.

## Context

본 ADR 은 [ADR-087 후속 ADR 후보 #4](087-implicitstyles-residual-branches-categorized-sweep.md#후속-adr-후보) 가 예고한 **GridListItem spec 신설** 작업이다. ADR-078 (ListBoxItem spec + Generator 자식 selector emit 확장) 의 패턴을 1:1 재사용한다.

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. GridListItem card metric 이 현재 **3곳에 산재**:

1. `GridList.render.shapes` (Skia) — `cardPaddingX/Y`, `cardBorderRadius`, `descGap` fontSize-based 분기 하드코딩 (`GridList.spec.ts:224-227`)
2. `implicitStyles.ts:758-773` `gridlistitem` 분기 (Taffy layout) — `padding: 12/16`, `gap: 2`, `borderWidth: 1` 하드코딩
3. 수동 `GridList.css:38-90` — `padding: var(--spacing-md) var(--spacing-lg)`, `gap: var(--spacing-2xs)`, `border: 1px` 선언

3 경로가 각자 독립 소스 → SSOT 원칙 위반. ADR-078 의 `ListBoxItem` 구조적 해결 패턴이 선례.

### 잔존 debt 현황

**`GridList.spec.ts:224-227` fontSize-based 카드 metric 하드코딩**:

```ts
const cardPaddingX = fontSize > 14 ? 20 : fontSize > 12 ? 16 : 12;
const cardPaddingY = fontSize > 14 ? 16 : fontSize > 12 ? 12 : 10;
const cardBorderRadius = fontSize > 14 ? 12 : 8;
const descGap = fontSize > 14 ? 6 : 4;
```

**`implicitStyles.ts:758-773` gridlistitem 분기 하드코딩**:

```ts
if (containerTag === "gridlistitem") {
  effectiveParent = withParentStyle(containerEl, {
    ...parentStyle,
    display: "flex",
    flexDirection: "column",
    minWidth: parentStyle.minWidth ?? 0,
    gap: parentStyle.gap ?? 2,
    paddingTop: parentStyle.paddingTop ?? 12,
    paddingBottom: parentStyle.paddingBottom ?? 12,
    paddingLeft: parentStyle.paddingLeft ?? 16,
    paddingRight: parentStyle.paddingRight ?? 16,
    borderWidth: parentStyle.borderWidth ?? 1,
  });
  filteredChildren = injectCollectionItemFontStyles(filteredChildren);
}
```

이 분기는 GridListItem 이 **element 로 사용**될 때 작동 — items SSOT 전환 (ADR-066/073/076 체인)과 element 기반 사용의 **이중 소비** 구조. 두 경로 모두 동일 metric 을 요구.

**ADR-078 선례와 구조 비교**:

| 영역                     | ADR-078 (ListBoxItem)                             | ADR-090 (GridListItem, 본 ADR)                                                    |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| 시작 상태                | ListBoxItem.spec 부재 → CSS 수동 + Skia 하드코딩  | 동일 — GridListItem.spec 부재 + implicitStyles 분기 추가 하드코딩 경로            |
| 패턴                     | spec 신설 + childSpecs + resolveListBoxItemMetric | 동일 패턴 재사용                                                                  |
| Generator 자식 emit 사용 | ✅ (ListBox `skipCSSGeneration: false`)           | ❌ (GridList `skipCSSGeneration: true` — 수동 CSS 유지)                           |
| CSS 해체 여부            | Phase 4 에서 수동 ListBox.css 50% 해체            | **scope 외** — GridList.skipCSSGeneration 해체는 후속 ADR                         |
| 분기 해체                | (ListBox 는 implicitStyles 분기 내용 없음 — N/A)  | implicitStyles.ts:758-773 gridlistitem 분기 리프팅 (ADR-083 Phase 0 read-through) |

### Hard Constraints

1. **ListBoxItem.spec 과 parallel 한 GridListItem.spec 모델링** — `childSpecs` 배선 + `resolveGridListItemMetric(fontSize)` resolver
2. **Skia shapes 의 fontSize-based 분기 유지** — 단일 `sizes.md` 로 모든 fontSize 를 표현 불가. resolver 가 fontSize 파라미터를 받아 분기 로직을 내부화 (상수는 spec.sizes.md 에서 참조)
3. **implicitStyles.ts gridlistitem 분기 완전 해체** — ADR-083 Phase 0 `resolveContainerStylesFallback` 에 위임 (display/flexDirection/padding/gap/borderWidth 모두 `containerStyles` 에 선언)
4. **GridList 수동 CSS 유지** — `skipCSSGeneration: true` 보존. 수동 CSS 해체는 본 ADR scope 외 (후속 ADR 대기)
5. GridListItem 이 **element 로 존재 가능** — items SSOT + element 기반 사용 이중 호환 유지
6. `pnpm type-check` 3/3 + specs 166/166 + builder 217/217 PASS

### Soft Constraints

- `injectCollectionItemFontStyles` 호출은 Text/Description 자식 font 주입용 — 유지 (scope 외)
- GridListItem.sizes 는 현재 `md` only. 향후 sm/lg 확장 여지 남김 (MenuItem 4-size 스키마 patternize)
- Skia shapes 의 카드 시각 생성 로직은 전반 유지 — 상수값만 resolver 로 대체

## Alternatives Considered

### 대안 A: GridListItem.spec 신설 + childSpecs 배선 + Skia metric SSOT 복귀 + implicitStyles 분기 해체 (선정)

- 설명: 본 ADR 의 5-Phase 구현. ADR-078 선례를 1:1 재사용하며 GridList 의 skipCSSGeneration=true 특성 때문에 **Generator 자식 emit 은 건너뛰고** Spec-level SSOT 만 복귀
- 근거: 범위 한정 + 선례 패턴 안정성. `implicitStyles.ts:758-773` 분기 해체는 ADR-083 Phase 0 `resolveContainerStylesFallback` read-through 인프라 재사용 (추가 infra 투자 0)
- 위험:
  - 기술: LOW — 단일 spec 추가, 단일 분기 해체, 단일 resolver 신설
  - 성능: LOW
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0 (기존 GridList element 유지)

### 대안 B: GridListItem.spec 신설 + `GridList.skipCSSGeneration = false` 전환 + 수동 CSS 전면 해체

- 설명: ADR-078 Phase 4 와 동일하게 Generator 자식 emit 경로 + 수동 CSS 해체까지 포함
- 근거: D3 symmetric 완전 복원 — CSS/Skia/Layout 3경로 모두 Spec SSOT
- 위험:
  - 기술: **MEDIUM** — GridList.css 177 LOC 중 drag-and-drop / empty state / layout grid / Checkbox 통합 등 Generator 미커버 영역 다수. 수동 CSS 를 Generator 로 완전 이관 불가능 (Generator 미지원 기능 다수)
  - 성능: LOW
  - 유지보수: **HIGH** — 완전 해체 실패 시 부분 이관 debt 발생 (ADR-078 Phase 4 에서도 ~30% 수동 유지). 본 ADR 볼륨 폭증
  - 마이그레이션: MEDIUM — 기존 CSS override 경로 확인 필요

### 대안 C: 현 상태 유지 (debt 영구화)

- 설명: GridListItem.spec 신설 없이 3경로 하드코딩 유지
- 근거: 범위 축소
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — ADR-087 후속 후보 #4 debt 영구화. ADR-063 D3 symmetric 원칙 위반 고착화. fontSize-based 카드 값 vs implicitStyles padding 12/16 값 이미 불일치 상태 (각각 14 vs 14 기준 값)
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                                  | HIGH+ 수 | 판정                                     |
| ------------------------------------- | :------: | ---------------------------------------- |
| A: spec 신설 + childSpecs + 분기 해체 |    0     | PASS                                     |
| B: Full CSS 해체 포함                 |    2     | (볼륨 폭증 + 완전 해체 실패 위험 → 기각) |
| C: 현 상태 유지                       |    1     | (debt 영구화 → 기각)                     |

대안 A 가 HIGH+ 0 개로 threshold pass.

## Decision

**대안 A 채택**. 5-Phase 분할 구현:

- **Phase 1**: `packages/specs/src/components/GridListItem.spec.ts` 신설 — `skipCSSGeneration: true` (parent GridList 와 동일), `sizes.md` (paddingX/Y, borderRadius, gap, descGap, fontSize, lineHeight), `containerStyles` (display: flex, flexDirection: column, padding, gap, borderWidth), `states` (hover/pressed/selected/focusVisible/disabled). `export function resolveGridListItemMetric(fontSize)` resolver.
- **Phase 2**: `packages/specs/src/components/GridList.spec.ts` — `childSpecs: [GridListItemSpec]` 배선 (Generator 는 `skipCSSGeneration: true` 때문에 emit 안 하지만 Spec 관계는 선언).
- **Phase 3**: `GridList.render.shapes` — `cardPaddingX/Y`, `cardBorderRadius`, `descGap` 하드코딩 4줄 제거 → `resolveGridListItemMetric(fontSize)` 참조.
- **Phase 4**: `implicitStyles.ts:758-773` gridlistitem 분기 — `padding/gap/borderWidth` 하드코딩 제거 (resolveContainerStylesFallback 이 대신 주입). `display/flexDirection` 도 제거 (spec.containerStyles 가 선언). `minWidth: 0` 과 `injectCollectionItemFontStyles` 호출은 유지 (runtime 결정 로직 — spec 주도 불가).
- **Phase 5**: 검증 — type-check + specs 재빌드 + snapshot 갱신 + builder 테스트 + 하드코딩 카운트 0 확인.

### 기각 사유

- **대안 B 기각**: GridList.css 구조(drag-and-drop/empty state/Checkbox 통합/forced-colors) 가 Generator 미커버 영역 다수 → 완전 해체 실패 위험 + 볼륨 폭증. CSS 해체는 별도 ADR에서 Generator 확장과 함께 진행
- **대안 C 기각**: D3 symmetric 원칙 위반 고착화, ADR-087 후속 debt 영구화

### 구현 파일 변경 목록 (5-touch-point)

1. `packages/specs/src/components/GridListItem.spec.ts` — **신규**. ListBoxItem.spec 구조 재사용
2. `packages/specs/src/components/GridList.spec.ts` — `childSpecs` + Skia shapes 리프팅
3. `packages/specs/src/components/index.ts` — GridListItem export 추가
4. `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:758-773` — 분기 대부분 해체
5. `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` — GridListItem snapshot 추가 (skipCSSGeneration=true 여도 snapshot 기록되는지 확인 필요)

## Risks

| ID  | 위험                                                                  | 심각도 | 대응                                                                                                                             |
| --- | --------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Skia shapes fontSize-based 분기가 `md` 단일 sizes 로 완전 표현 불가   |  LOW   | `resolveGridListItemMetric(fontSize)` 내부에 fontSize-based 분기 로직을 캡슐화. spec.sizes.md 는 기본값(fontSize=14 기준)만 선언 |
| R2  | GridListItem element 기반 기존 프로젝트 호환 (items SSOT 미전환 경로) |  LOW   | `implicitStyles.ts` 분기 리프팅 시 `containerStyles` + resolveContainerStylesFallback 경로가 동일 값 공급 → BC 유지              |
| R3  | `injectCollectionItemFontStyles` 의존성 유지 필요 여부                |  LOW   | Text/Description 자식 font 주입 runtime 로직은 spec 주도 불가 → 분기 일부는 유지 (display/padding 만 해체)                       |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 검증 기준 (Implementation 단계):

- type-check 3/3 PASS
- specs 166/166 PASS (snapshot 변동 있을 수 있음)
- builder 217/217 PASS
- `rg 'cardPaddingX|cardPaddingY|cardBorderRadius|descGap' GridList.spec.ts` = 0건 (또는 resolver 경유 참조만)
- `rg 'paddingTop: parentStyle.paddingTop \?\? 12' implicitStyles.ts` = 0건 (gridlistitem 분기)
- GridList 수동 CSS 무변경 — `packages/shared/src/components/styles/GridList.css` diff 0

## Consequences

### Positive

- ADR-087 후속 후보 #4 debt 완결 — GridListItem SSOT 복귀
- ListBox/GridList 가 동일 패턴(spec 신설 + childSpecs + resolver) 로 통일 → Select/ComboBox/Tree 등 후속 컬렉션 spec 신설 시 참고 가능
- `implicitStyles.ts` `gridlistitem` 분기 대부분 해체 — ADR-083 read-through 인프라 추가 활용
- D3 symmetric 부분 복원 (Skia + Layout 2경로, CSS 는 scope 외)

### Negative

- GridList.css 수동 유지 (후속 ADR 필요) — 완전 SSOT 복귀는 단계적
- `resolveGridListItemMetric(fontSize)` 내부 fontSize-based 분기는 여전히 존재 — 다만 단일 위치에 캡슐화 (shapes 인라인 대비 개선)

## 참조

- [ADR-087](087-implicitstyles-residual-branches-categorized-sweep.md) — 후속 ADR 후보 #4 선언 (GridListItem spec 신설)
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — ListBoxItem spec + Generator 자식 selector emit (본 ADR 선례)
- [ADR-079](079-spec-defaults-read-through-layout-primitive-ssot.md) — containerStyles read-through 인프라
- [ADR-083](083-archetype-base-styles-lifting.md) — Phase 0 resolveContainerStylesFallback 공통 선주입
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙

# ADR-906: Collection spacing 런타임 계약

## Status

Superseded — 2026-04-24 by [ADR-907](907-collection-container-style-pipeline.md)

본 ADR 의 Decision B (per-component resolver) 는 GridList 1건 해결용. 9+ 동일 패턴 컴포넌트의 누적 비용 재계산 결과 ADR-907 (Container style pipeline 전수화) 로 대체됨. GridList 증상은 ADR-907 Phase 3 pilot 에 흡수되어 Implemented.

## Context

GridList에서 Style Panel로 `padding`/`gap`을 편집해도 Preview CSS와 Builder Skia 양쪽에 반영되지 않는 증상이 확인됐다. 원인은 단일 parser 누락이 아니라 collection/self-render 컴포넌트의 런타임 소비 계약이 컴포넌트별로 갈라진 데 있다.

확인된 현재 상태:

1. Preview `renderGridList`는 `<GridList>` root에 `element.props.style`을 전달하지 않는다.
2. `GridList` shared component는 `props.style`을 병합할 준비가 되어 있으나, renderer 경계에서 값이 끊긴다.
3. `GridList.css`의 `[data-layout="grid"]` selector는 RAC 내부 root `<div>`가 `data-layout={layout}`을 auto-emit하므로 (`react-aria-components@1.15.1` `dist/GridList.mjs:198`) 이미 매칭되어 작동한다 — 이 부분은 결함이 아니다. 실제 결함은 `renderGridList`가 root `element.props.style`을 전달하지 않아 `style.padding/gap` 편집이 DOM에 도달하지 않는 것이다.
4. Skia `GridListSpec.render.shapes`는 container `gap`을 `size.gap`에서 읽고, root `padding`은 좌표 계산에 반영하지 않는다.
5. 반면 `calculateContentHeight()`의 GridList 분기는 `style.gap`/`style.padding`을 읽는다. 즉 layout height와 paint shapes가 서로 다른 metric source를 사용한다.
6. ListBox는 이미 Preview style 전달과 Skia `props.style` 우선 소비 패턴을 갖고 있어 GridList의 직접 선례가 된다.

동일 위험 후보는 collection/self-render 계열에 집중된다. 특히 TagGroup/TagList는 root style 전달과 chip gap source가 분리되어 있고, Table은 `TableProps`/renderer/component root style 계약이 약하다.

### SSOT 체인 위치 (ADR-063)

본 ADR은 [ADR-063](063-ssot-chain-charter.md)의 **D3 (시각 스타일)** 및 ADR-079/080/082의 layout primitive read-through 후속이다. D3 시각 스타일은 `props.style`/Spec metric/Preview CSS/Skia paint가 동일 의미를 가져야 한다.

### Hard Constraints

1. **Preview root style 계약**: collection root renderer는 `element.props.style`을 실제 시각 root에 전달해야 한다.
2. **Skia layout/paint metric 단일화**: items-SSOT 또는 self-render shapes를 가진 컴포넌트는 `calculateContentHeight()`와 `render.shapes()`가 같은 spacing metric resolver를 사용해야 한다.
3. **소유권 분리**: root container `padding/gap`과 item 내부 `padding/gap`은 같은 속성으로 섞지 않는다.
4. **ListBox 회귀 금지**: 이미 정합화된 ListBox Preview/Skia behavior는 변경하지 않는다.
5. **BC 우선**: 기존 저장 프로젝트의 `props.style` 부재 경로는 기존 default visual과 동일해야 한다.

### Soft Constraints

- 긴급 증상인 GridList는 첫 Phase에서 해결한다.
- TagGroup/TagList와 Table은 GridList와 같은 계약으로 audit 후 순차 적용한다.
- 공통 helper는 specs/builder 양쪽 import boundary를 깨지 않는 위치에 둔다.
- 새 warning이나 telemetry는 본 ADR의 필수 요건으로 포함하지 않는다.

## Alternatives Considered

### 대안 A: component별 patch

- 설명: GridList renderer에 `style`을 전달하고, `GridListSpec.render.shapes`에 `props.style.gap/padding`을 직접 읽는 코드를 추가한다.
- 근거:
  - 최소 변경으로 현재 사용자가 본 GridList 증상은 빠르게 완화된다.
  - 기존 ListBox 동작에는 손대지 않는다.
- 위험:
  - 기술: **M** — GridList 내부의 layout/paint 중복 공식은 계속 남는다.
  - 성능: **L** — 추가 계산 비용은 작다.
  - 유지보수: **H** — TagGroup/Table에서 같은 결함이 반복될 수 있다.
  - 마이그레이션: **L** — BC 영향은 작다.

### 대안 B: collection spacing runtime contract + shared metric resolver

- 설명: Preview root style 전달 계약을 명문화하고, self-render collection은 spacing metric resolver를 도입해 `render.shapes()`와 `calculateContentHeight()`가 공유한다. GridList를 1차 적용하고 TagGroup/TagList/Table을 audit로 확장한다.
- 근거:
  - ADR-076/080의 ListBox 선례와 일치한다.
  - 현재 증상인 "height는 변할 수 있으나 paint는 그대로" drift를 구조적으로 차단한다.
  - root spacing과 item spacing의 의미를 분리해 Style Panel UX와 Skia paint를 같은 계약에 묶을 수 있다.
- 위험:
  - 기술: **M** — specs/builder import boundary와 helper 위치를 신중히 잡아야 한다.
  - 성능: **L** — resolver는 숫자 parsing과 기존 metric 계산 재사용 수준이다.
  - 유지보수: **L** — 중복 공식을 줄인다.
  - 마이그레이션: **M** — GridList/TagGroup/Table의 기존 default visual baseline을 고정해야 한다.

### 대안 C: Style Panel에서 collection root spacing 편집 금지

- 설명: GridList/TagGroup/Table 같은 collection root에서는 `padding/gap` 편집 UI를 숨기거나 disabled 처리한다.
- 근거:
  - 구현량은 가장 작다.
  - Skia/Preview parity 문제를 surface에서 차단한다.
- 위험:
  - 기술: **M** — component별 편집 가능 속성 gating이 추가된다.
  - 성능: **L** — runtime 영향 없음.
  - 유지보수: **M** — 예외 UI 정책이 늘어난다.
  - 마이그레이션: **H** — 기존 Style Panel 기대와 collection layout 편집 기능을 후퇴시킨다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | L            |     1      |
| B    | M    | L    | L        | M            |     0      |
| C    | M    | L    | M        | H            |     1      |

루프 판정: 대안 B는 HIGH 위험이 없어 채택 가능하다. 대안 A는 단기 증상 완화에는 유효하지만 같은 drift를 반복시킨다. 대안 C는 기능 후퇴가 커서 기각한다.

## Decision

**대안 B: collection spacing runtime contract + shared metric resolver**를 선택한다.

선택 근거:

1. GridList의 실제 결함은 Preview style 전달 누락과 Skia layout/paint metric drift가 결합된 문제이므로, 두 계약을 함께 고정해야 한다.
2. ListBox가 이미 같은 방향의 선례를 제공한다.
3. root spacing과 item spacing을 분리하면 Style Panel의 `padding/gap` 의미가 Preview CSS와 Builder Skia에서 동일해진다.
4. TagGroup/TagList/Table 같은 동일 패턴 후보를 audit 대상으로 포함해 재발 가능성을 줄인다.

기각 사유:

- **대안 A 기각**: GridList만 고쳐도 사용자는 당장 개선을 보지만, helper 공유 없이 `render.shapes()`와 `calculateContentHeight()`가 계속 분리되면 다음 collection에서 같은 문제가 반복된다.
- **대안 C 기각**: 편집 UI를 막는 방식은 D3 스타일 편집 기능을 축소하며, ListBox에서 이미 가능한 동작과도 일관되지 않는다.

> 구현 상세: [906-collection-spacing-runtime-contract-breakdown.md](../design/906-collection-spacing-runtime-contract-breakdown.md)

## Risks

| ID  | 위험                                                                            | 심각도 | 대응                                                       |
| --- | ------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------- |
| R1  | `packages/specs` helper가 builder-only utility를 참조해 package boundary를 위반 |  HIGH  | 상세는 R1 상세 섹션 (표 아래) 참조                         |
| R2  | GridList root padding 적용으로 기존 card 좌표가 이동해 시각 baseline 변화       |  MED   | 상세는 R2 상세 섹션 (표 아래) 참조                         |
| R3  | TagGroup/TagList의 root gap과 chip gap 의미가 혼동                              |  MED   | root spacing과 chip spacing 소유권을 breakdown에 분리 명시 |
| R4  | Table은 component 구조가 별도라 같은 방식으로 직접 일반화하면 scope 폭증        |  MED   | Table은 Phase 3 audit 후 root style 계약부터 분리 적용     |

### R1 상세 — package boundary 위반 방어

- helper 배치: `packages/specs/src/primitives/*` 또는 `packages/specs/src/components/GridList.spec.ts` 의 spec-local export. **builder-local adapter 는 불가** — 공유 resolver 는 `packages/specs` 의 `render.shapes()` 에서도 import 되어야 G3 "같은 resolver 사용" 조건을 충족하는데, 의존 방향 계약상 `packages/specs` 는 `apps/builder/**` 를 import 할 수 없기 때문 (아래 2번 bullet 과 양립 불가).
- **Public export surface 계약**: spec-local export 채택 시 반드시 `packages/specs/src/index.ts` root barrel 에 re-export 한다. 이유: `packages/specs/package.json:exports` 가 `"."`, `"./renderers"`, `"./primitives"`, `"./types"`, `"./adapters"` 만 노출하고 `"./components"` subpath 는 비공개이며, Builder tsconfig 에도 `@composition/specs/*` path alias 가 없어 (`apps/builder/tsconfig.app.json:7-10`) direct subpath import 가 불안정하다. 기존 패턴도 `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 가 `@composition/specs` root 로만 import 한다 (`utils.ts:16-39`). **direct subpath import 금지** (`import { resolveGridListItemMetric } from "@composition/specs/components/GridList.spec"` 같은 형식은 build 취약).
- 의존 방향 계약: `packages/specs` ← `packages/shared` ← `apps/builder`. `packages/specs/**` 파일은 `apps/builder/**` 및 `packages/shared/**` 를 import 하지 않는다.
- Phase 0 G1 검증 명령 (네 개 모두 조건 충족이어야 PASS, 전부 `rg` 로 자동화 가능):
  - `rg "from ['\"](\.\./)+apps/builder" packages/specs` = **0건** (specs → apps/builder 역방향 import 차단)
  - `rg "from ['\"]@composition/shared" packages/specs` = **0건** (specs → shared 역방향 import 차단)
  - `rg "<resolver 심볼명>" packages/specs/src/index.ts` ≥ **1건** (root barrel re-export 확인 — 심볼명 예: `resolveGridListSpacingMetric`, Phase 0 helper 결정 시 확정)
  - `rg "@composition/specs/(components|src)" apps/builder packages/shared` = **0건** (Builder/Shared 가 비공개 subpath 직접 import 하지 않음 — `./renderers/./primitives/./types/./adapters` 는 `package.json:exports` 가 허용한 public subpath 이므로 match 되어도 무방하나 본 검증은 `components|src` 만 차단)

### R2 상세 — BC 영향 수식화

- 현 GridList factory 기본 style = `{ width: "100%" }` 단독 (`apps/builder/src/builder/factories/definitions/SelectionComponents.ts:322-324`) → **factory 기본값으로 신규 생성된 GridList 인스턴스** 는 `props.style.padding` / `props.style.gap` 보유 비율 = 0%.
- 단, 사용자가 Style Panel 로 편집한 **기존 저장 인스턴스의 padding/gap 분포는 현 시점 실측 없이 불명**. Phase 1 착수 직전 프로젝트 DB scan (Supabase 쿼리 또는 export 파일 `rg`) 으로 `tag = 'GridList'` AND (`props.style.padding` 또는 `props.style.gap` 정의됨) 인스턴스 수 `N_edited` 를 측정한다. `N_edited` 결과에 따라 fixture baseline 이 두 분기로 나뉜다:
  - (a) **unedited baseline** — `style` 부재 또는 padding/gap 미설정: 현 `main` 렌더와 byte-equal 유지.
  - (b) **edited baseline** (`N_edited > 0`): 편집값이 존재하면 이는 BC 회귀가 아니라 **본 ADR 의 핵심 목표 충족 여부** (Hard Constraint 1 "Preview root style 계약"). 새 파이프라인이 `style.padding/gap` 을 정확히 DOM/Skia 양쪽에 반영하는지 검증한다.
- G3 통과 조건 (unedited baseline 수치 고정): `paddingTop = paddingRight = paddingBottom = paddingLeft = 0` 이고 `gap = 12` 일 때 `render.shapes()` 좌표 출력과 `calculateContentHeight()` 반환값이 현 `main` 과 byte-equal (fixture test).
- Phase 0 실측 gate: `N_edited` 수치를 ADR-906 Addendum 또는 breakdown 에 기록 후 Phase 1 착수.

## Gates

| Gate                        | 시점    | 통과 조건                                                                                                                                                                                               | 실패 시 대안                                                                                                                                                                              |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1: Boundary                | Phase 0 | shared metric resolver가 specs/shared/builder package boundary를 위반하지 않고, spec-local export 인 경우 `packages/specs/src/index.ts` root barrel 에 re-export 되어 있다 (direct subpath import 금지) | helper 위치를 `packages/specs` primitive 로 재분리 (spec-local export 의 public surface 승격이 불가능하면 primitives/\* 이관, builder-local adapter 는 G3 resolver 공유 조건과 양립 불가) |
| G2: GridList Preview        | Phase 1 | `GridList` root `style.padding/gap`이 Preview inline style로 반영되고, RAC auto-emit `data-layout`과 `GridList.css` selector 매칭이 test로 확인된다 (수동 추가 아님)                                    | renderer root props 계약 재검토                                                                                                                                                           |
| G3: GridList Skia           | Phase 1 | `render.shapes()`와 `calculateContentHeight()`가 같은 resolver를 사용하고 style 부재 baseline이 유지된다                                                                                                | GridList 전용 resolver로 축소 후 후속 ADR 분리                                                                                                                                            |
| G4a: TagGroup/TagList Audit | Phase 2 | TagGroup/TagList의 root style 전달 및 spacing metric source가 표로 고정된다 (root gap ↔ chip gap 소유권 분리 포함)                                                                                      | 위험 후보별 follow-up ADR 분리                                                                                                                                                            |
| G4b: Table Audit            | Phase 3 | Table의 root style 전달 및 spacing metric source가 표로 고정되며, GridList 패턴 직접 이식 가능 여부가 판정된다                                                                                          | Table 단독 후속 ADR 로 이관 (R4 의 scope 폭증 위험 실현 시)                                                                                                                               |
| G5: Regression              | Phase 3 | ListBox 기존 tests/behavior가 변하지 않고 GridList spacing 회귀 테스트가 추가된다                                                                                                                       | ListBox 영향 diff 제거 후 GridList 단독 재시도                                                                                                                                            |

## Consequences

### Positive

- GridList `padding/gap`이 Preview CSS와 Builder Skia에서 같은 의미로 동작한다.
- self-render collection에서 layout height와 paint shapes의 drift를 구조적으로 줄인다.
- Style Panel에서 root spacing과 item spacing의 책임 경계가 명확해진다.
- TagGroup/TagList/Table 같은 동일 위험 후보를 명시적으로 추적할 수 있다.

### Negative

- GridList 단일 수정 대비 초기 설계/테스트 비용이 증가한다.
- Table은 구조가 달라 같은 resolver 패턴을 그대로 적용하지 못할 수 있다.
- root spacing 적용이 기존 visual baseline을 바꿀 수 있어 fixture와 시각 검증이 필요하다.

## References

- [docs/adr/completed/063-ssot-chain-charter.md](063-ssot-chain-charter.md)
- [docs/adr/completed/076-listbox-items-ssot-hybrid.md](076-listbox-items-ssot-hybrid.md)
- [docs/adr/completed/080-layout-engine-spec-direct-read-through.md](080-layout-engine-spec-direct-read-through.md)
- [docs/adr/completed/090-gridlistitem-spec-and-skia-metric-ssot.md](090-gridlistitem-spec-and-skia-metric-ssot.md)
- [packages/shared/src/renderers/SelectionRenderers.tsx](../../../packages/shared/src/renderers/SelectionRenderers.tsx)
- [packages/shared/src/components/GridList.tsx](../../../packages/shared/src/components/GridList.tsx)
- [packages/shared/src/components/styles/GridList.css](../../../packages/shared/src/components/styles/GridList.css)
- packages/specs/src/components/GridList.spec.ts
- [apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts](../../../apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts)

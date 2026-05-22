# ADR-907: Collection/self-render 컨테이너 style pipeline 전수화

## Status

Implemented — 2026-04-24

Phase 전원 land (Phase 1/2/3/5/4 순서). Gate G1-G8 충족 — 구현 상세 및 재audit 결과는 [breakdown 의 Phase 4 Execution Log](../design/907-collection-container-style-pipeline-breakdown.md#phase-4-execution-log-실행-결과) 참조.

**Supersedes**: [ADR-906 Collection spacing 런타임 계약](906-collection-spacing-runtime-contract.md) — 906 은 GridList 1건 + per-component resolver 방식이었으나, 9+ 동일 패턴 컴포넌트의 누적 scope 재계산 결과 본 ADR 로 승격한다. GridList 증상은 본 ADR Phase 3 pilot 으로 흡수.

## Context

ADR-906 작성/리뷰 과정에서 **같은 유형의 drift 가 9+ 컴포넌트에 반복 가능**하다는 것이 식별됐다.

- `element.props.style` 이 3경로 (Preview DOM / Skia `render.shapes()` / Layout engine `calculateContentHeight()`) 에 반영되어야 하는데, 각 경로의 소비 계약이 **컴포넌트별로 갈라져** 있다.
- 영향 대상 (총 11 컴포넌트):
  - `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 10개 (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:155-170`): `Breadcrumbs, ComboBox, GridList, ListBox, Select, Table, Tabs, TagGroup, Toolbar, Tree`.
  - 추가 1개 `Menu` — [ADR-068](068-menu-items-ssot-and-menuitem-spec.md) 에서 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` Set 에서 제거됐으나 items SSOT 컴포넌트로서 동일 drift 위험 (render.shapes 가 `props.items` 기반 self-render).
- 현상: GridList 는 증상 표면화 (ADR-906 Context), ListBox 는 이미 정합 (선례), 나머지 9개는 **미측정이나 구조상 동일 위험**.

ADR-906 Decision B (per-component resolver) 는 GridList 1건 + audit 2건 (TagGroup/Table) 만 다루므로 **나머지 7+ 컴포넌트에서 같은 drift 가 재발 가능**. 각 재발 시 별도 ADR 작성 → 누적 비용이 54~90일로 추정되며, 같은 설계 결정을 9번 반복한다.

본 ADR 은 **구조적 drift 차단** 을 목표로 한다:

1. CSS value parser SSOT (`packages/specs/src/primitives/cssValueParser.ts`) — padding shorthand/px 파싱 1곳.
2. Container spacing primitive (`packages/specs/src/primitives/containerSpacing.ts`) — 공통 7 필드 (padding 4way + row/columnGap + borderWidth + fontSize) 공유 resolver.
3. Renderer style contract 강제 (`packages/shared/src/renderers/__tests__/rendererStyleContract.test.ts`) — renderer root 의 `style={element.props.style}` 전달 누락을 test/lint 로 차단.
4. Spec metric SSOT — `render.shapes()` 와 `calculateContentHeight()` 가 같은 resolver 호출 강제.

### SSOT 체인 위치 (ADR-063)

본 ADR 은 [ADR-063 SSOT Charter](063-ssot-chain-charter.md) 의 **D3 (시각 스타일)** 에 위치한다. Spec 을 SSOT 로 하여 Preview DOM / Skia shapes / Layout engine 3경로가 동일 시각 결과를 산출하도록 pipeline 을 선언적으로 묶는다. ADR-079/080/082 의 layout primitive read-through 흐름을 **collection/self-render 전수로 확장**한다.

### Scope 정규화 (11 주대상 컴포넌트)

본 ADR 의 scope 를 Phase/Gate/matrix 산식과 정합시키기 위해 대상 집합을 다음 분류로 고정한다:

| 분류                       |   수   | 컴포넌트                            | Phase                  | Layer 적용 profile (Phase 0 실측 기반)  |
| -------------------------- | :----: | ----------------------------------- | ---------------------- | --------------------------------------- |
| **기준 선례 (이미 정합)**  |   1    | `ListBox`                           | Phase 0 audit 재검증만 | A/B/C/D 모두 정합                       |
| **Phase 3 pilot**          |   1    | `GridList`                          | Phase 3                | A + B + C + D                           |
| **Phase 5 별도 판정**      |   1    | `Table`                             | Phase 5                | C (a) 선반영 가능, B/D 는 audit 후 판정 |
| **Phase 4 Layer D 적용**   |   4    | `Menu, ComboBox, Select, Toolbar`   | Phase 4                | A + B + C + D (shapes 하드코딩)         |
| **Phase 4 Layer D 무적용** |   4    | `Tree, Tabs, Breadcrumbs, TagGroup` | Phase 4                | A + B + C (shapes N/A — Layer D 생략)   |
| **합계**                   | **11** |                                     |                        |                                         |

- TagList 는 `TagGroup` 의 중간 compositional 컨테이너 (ADR-097) 로 별도 주대상이 아니며, TagGroup Phase 4 follow-up ADR 에서 sub-target 으로 흡수된다. breakdown matrix 에도 독립 행이 아니라 TagGroup 종속 note 로 기록한다. **TagGroup 자체 spec 은 shapes 빈 배열 (TagGroup.spec.ts:395-421)** 로 Layer D (resolve{Component}SpacingMetric) 무관. Phase 3 co-pilot 승격은 ADR-097 compositional 구조 (실렌더가 TagList) 와 충돌하므로 Phase 4 최우선 (ADR-908 등) 으로 유지.
- Menu 는 `SYNTHETIC_CHILD_PROP_MERGE_TAGS` Set (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:155-170`, 10개) 에는 포함되지 않으나 ADR-068 의 items SSOT 컴포넌트로서 `render.shapes` 가 `props.items` 기반 self-render 이므로 동일 drift 위험을 가진다. 따라서 본 ADR scope 에 포함.
- **Layer C renderer contract 는 11 전수 + allowlist 유지** (Layer B/D 의 조건부 적용과 독립). 즉 Phase 2 `rendererStyleContract.test.ts` 는 11 renderer 전부 확인하되, Tree/Tabs/Breadcrumbs/TagGroup 은 renderer 수준 style 전달만 검증 (Layer D resolver 호출 미검증).

### Hard Constraints

1. **Renderer contract 강제**: 본 ADR scope 의 11 주대상 컴포넌트 renderer (`renderListBox, renderGridList, renderMenu, renderComboBox, renderSelect, renderTree, renderTabs, renderToolbar, renderBreadcrumbs, renderTagGroup, renderTable`) 는 root 컴포넌트에 `style={element.props.style as React.CSSProperties | undefined}` 를 전달한다. 누락은 `rendererStyleContract.test.ts` 로 차단 (allowlist 예외는 Phase 3/4/5 에서 단계적 제거). `renderTable` 은 Layer C 대상이나 Phase 5 판정 전까지 allowlist 임시 허용. `TableView` (LayoutRenderers.tsx:1982) 는 non-collection wrapper style merge 구조로 본 ADR scope 밖.
2. **Spec metric SSOT**: items-SSOT 또는 self-render shapes 를 가진 컴포넌트는 `calculateContentHeight()` 와 `render.shapes()` 가 **동일 resolver 심볼** 을 호출한다 (grep 로 검증 가능).
3. **CSS parser SSOT**: padding/gap/border 파싱은 `packages/specs/src/primitives/cssValueParser.ts` 만 사용한다. `rg "parseFloat.*padding|parseFloat.*gap" apps packages` = 0건 (allowlist 외).
4. **Root ↔ item spacing 소유권 분리** (ADR-906 HC3 승계): root container `padding/gap` 과 item 내부 `padding/gap` 은 같은 속성명으로 섞지 않는다. root = collection root `<GridList>/<ListBox>/<Table>` 의 `props.style`, item = `<GridListItem>/<Tag>/<Cell>` 내부 content padding. Spec 설계 시 양 spacing 을 분리 필드 (예: `cardPaddingX/Y` vs root `paddingX`) 로 명명.
5. **BC 우선**: 기존 저장 프로젝트의 `props.style` 부재 경로는 기존 default visual 과 byte-equal 유지 (`main` fixture 회귀).
6. **ListBox 회귀 금지**: 이미 정합된 ListBox Preview/Skia behavior 는 변경하지 않는다.
7. **Package boundary**: `packages/specs` 는 `apps/builder/**` 및 `@composition/shared` 를 import 하지 않는다 (ADR-906 R1 의 boundary 계약 승계).
8. **Generator scope 외**: 본 ADR 은 runtime style/metric pipeline 만 다룬다. Spec → CSS 자동 생성 (`CSSGenerator`) 의 자식 selector/variant emit 확장은 scope 밖. GridList.spec.ts:71 `skipCSSGeneration: true` 같은 Generator 한계는 follow-up ADR 에서 컴포넌트별 재확인 (breakdown Phase 4 template step 6 참조).

### Soft Constraints

- 11 주대상 중 Phase 4 follow-up 8 컴포넌트 (`Breadcrumbs, ComboBox, Menu, Select, Tabs, TagGroup, Toolbar, Tree`) 는 별도 ADR 로 분기 가능 — 본 ADR 은 framework + pilot(GridList) 확정이 최소 scope.
- Table 은 구조가 다르므로 Phase 5 에서 별도 판정 (직접 이식 / 부분 이식 / 단독 후속 3분기).
- Renderer contract 강제 방식 (ESLint custom rule vs vitest runtime) 은 Phase 2 에서 구체 선택.

## Alternatives Considered

### 대안 A: per-component patch (ADR-906 의 기각안 A 재등장)

- 설명: GridList 만 renderer 에 style 전달 + `render.shapes()` 에 `props.style` 직접 읽기. TagGroup/Table/Menu 등은 증상 표면화 시점에 각각 별도 패치.
- 근거: 최소 변경, 긴급 증상 즉시 해소. 외부 리서치: 많은 React 컴포넌트 라이브러리 (Chakra, MUI) 가 style passthrough 를 컴포넌트별 계약으로 처리.
- 위험:
  - 기술: **L** — 변경 규모 작음.
  - 성능: **L** — 영향 없음.
  - 유지보수: **H** — 나머지 10 주대상 컴포넌트에 같은 drift 가 재발. 각 재발 시 별도 ADR + 구현 사이클.
  - 마이그레이션: **L** — BC 영향 작음.

### 대안 B: per-component resolver (ADR-906 Decision B 현행)

- 설명: 각 컴포넌트 spec 에 `resolve{Component}SpacingMetric()` 신설. `render.shapes()` 와 `calculateContentHeight()` 가 공유. GridList pilot → TagGroup/Table audit → 나머지 sweep.
- 근거: ADR-076/080 의 ListBox 선례. Spec-local 심볼로 boundary 명확.
- 위험:
  - 기술: **M** — resolver 설계가 컴포넌트별 반복.
  - 성능: **L** — 숫자 파싱 수준.
  - 유지보수: **M** — 11 resolver 의 공통 부분 중복. CSS parser 중복. renderer contract 누락 재발 가능.
  - 마이그레이션: **M** — 각 컴포넌트별 fixture baseline 필요. 누적 ADR 11건 추정 54~90일.

### 대안 C: universal resolver + per-component 확장

- 설명: 공통 7 필드만 `primitives/containerSpacing.ts` 공유 resolver. 컴포넌트-specific 확장은 spec 내부 조합. renderer contract 는 컴포넌트별로 남김.
- 근거: DRY 원칙 + 공통 primitive 로 중복 축소.
- 위험:
  - 기술: **M** — primitive 설계 + 기존 per-component resolver 와 인터페이스 정렬.
  - 성능: **L**.
  - 유지보수: **M** — renderer contract 누락 재발 가능 (style 전달 강제 부재). 공통 필드 외의 컴포넌트별 drift 는 여전히 수동.
  - 마이그레이션: **M** — ListBox 기존 `resolveListBoxItemMetric` 과 공존 전략 필요.

### 대안 D: Renderer contract + Spec metric SSOT 2-layer

- 설명: Renderer root style 전달을 lint/test 로 강제 + Spec metric SSOT (`shape coord` 와 `height calc` 공유) 강제. 공통 primitive 는 도입하지 않고 per-component resolver 유지.
- 근거: 재발 차단이 목표이면 "contract 강제" 만으로도 달성 가능.
- 위험:
  - 기술: **M** — lint rule 또는 vitest 수동 enumeration.
  - 성능: **L**.
  - 유지보수: **M** — CSS parser/공통 spacing 필드는 여전히 중복. 각 컴포넌트 resolver 는 처음부터 별도 작성.
  - 마이그레이션: **M** — 11 주대상에 resolver + renderer 수정 적용 필요.

### 대안 E: Container style pipeline 전수화 (D + C 통합)

- 설명: CSS parser SSOT (Layer A) + Container spacing primitive (Layer B) + Renderer contract 강제 (Layer C) + Spec metric SSOT (Layer D). 4 layer 모두 도입. GridList 를 Phase 3 pilot 으로 적용, 8 컴포넌트 (`Breadcrumbs, ComboBox, Menu, Select, Tabs, TagGroup, Toolbar, Tree`) 는 Phase 4 follow-up ADR 템플릿으로 이관, Table 은 Phase 5 별도 판정, ListBox 는 기준 선례로 재검증만.
- 근거:
  - D3 SSOT 원칙 (Preview/Skia symmetric consumer) 의 구조적 보장.
  - 반복 ADR 누적 비용 (54~90일) vs 단일 근본 ADR 비용 (17~25일) 비교 — 본 ADR 이 50~70% 싸다.
  - 외부 리서치: Adobe React Spectrum 의 `UNSAFE_className`/`UNSAFE_style` passthrough 계약 (root style 전달 공식 규약) + CSS-in-JS 라이브러리 (Emotion/styled-components) 의 파싱 SSOT 패턴.
- 위험:
  - 기술: **M** — 4 layer 설계 + 기존 call-site 전수 교체.
  - 성능: **L** — 파싱/resolve 숫자 연산.
  - 유지보수: **L** — 공통 SSOT 1곳. 신규 컴포넌트 추가 시 확장 3~4줄.
  - 마이그레이션: **M** — renderer contract allowlist 로 단계적 전환 가능. fixture 회귀 필요 컴포넌트 수 명확.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    M     |      M       |     0      |
| C    |  M   |  L   |    M     |      M       |     0      |
| D    |  M   |  L   |    M     |      M       |     0      |
| E    |  M   |  L   |    L     |      M       |     0      |

루프 판정:

- 대안 A 는 유지보수 HIGH 로 유일 HIGH+ 를 가진다 (ADR-906 의 원 기각 대안 A 와 동일 판정).
- 대안 B/C/D 는 HIGH 0 이지만 **부분 해결** (B: resolver 공유만 / C: primitive 만 / D: contract 만).
- 대안 E 는 유지보수 L 로 4 대안 중 유일 L. 4 layer 통합이 반복 drift 를 구조적으로 차단.
- 루프 불필요 — 대안 E 채택.

## Decision

**대안 E: Container style pipeline 전수화** 를 선택한다.

선택 근거:

1. **누적 비용 우위**: 11 주대상 컴포넌트에 ADR-906 스타일 per-component resolver 를 반복하면 누적 54~90일. 본 ADR 의 Layer A/B/C/D 통합은 17~25일 (Phase 0-3 + Phase 6). Phase 4 follow-up 은 Phase 0 실측 반영 — Layer D (Spec metric SSOT) 적용 필요 4건 (Menu/ComboBox/Select/Toolbar, shapes 하드코딩) × 1.5일 + Layer D 무적용 4건 (Tree/Tabs/Breadcrumbs/TagGroup, shapes N/A) × 0.5~1일 = **8~10일** (원 추정 8~16일에서 하한 유지 + 상한 -37.5%). 각 follow-up 이 본 ADR framework 재사용으로 **설계 결정 반복이 제거**된다.
2. **SSOT 원칙 정합**: ADR-063 D3 시각 스타일의 3경로 대칭을 pipeline 으로 선언화. Preview DOM / Skia / Layout engine 이 동일 `ContainerSpacing` 타입을 소비하므로 구조적 drift 불가능.
3. **Renderer contract 재발 차단**: Layer C 의 test/lint 가 신규 renderer 추가 시 style 전달 누락을 자동 차단. 미래 컴포넌트 추가 시 누락 가능성 0.
4. **GridList 증상 흡수**: Phase 3 pilot 으로 ADR-906 의 Hard Constraint 1/2 를 그대로 충족. 906 의 리뷰 7라운드 맥락은 Supersede 링크로 보존.
5. **Phase 4/5 분기 가능**: 본 ADR 은 framework + pilot 만 land. 나머지 컴포넌트는 follow-up ADR 로 **속도 조절 가능** — framework 가 먼저 land 되면 follow-up 은 템플릿 작업.

기각 사유:

- **대안 A 기각**: GridList 만 고치면 나머지 10 주대상 컴포넌트의 재발이 구조적으로 보장됨. Risk 유지보수 HIGH 유일.
- **대안 B 기각 (ADR-906 Decision B)**: per-component resolver 11번 반복 = 같은 설계 결정의 N-번 재작성. CSS parser/renderer contract 는 여전히 수동.
- **대안 C 기각**: primitive 만으로 renderer contract 누락 재발 차단 불가. 본 ADR 의 Layer B 만 해당하는 부분집합.
- **대안 D 기각**: contract 강제만으로 공통 파싱/spacing 중복 제거 불가. 본 ADR 의 Layer C + D 부분집합.

> 구현 상세: [907-collection-container-style-pipeline-breakdown.md](../design/907-collection-container-style-pipeline-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                        | 심각도 | 대응                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `packages/specs` primitive 가 builder-only utility 또는 `@composition/shared` 를 참조해 package boundary 위반                               |  HIGH  | 상세는 R1 상세 섹션 (표 아래) 참조                                                                                                     |
| R2  | 11 주대상 전수 fixture 회귀에서 편집값을 반영한 기존 프로젝트의 시각 변화가 BC 회귀로 오인                                                  |  MED   | 상세는 R2 상세 섹션 (표 아래) 참조                                                                                                     |
| R3  | Renderer contract allowlist 가 Phase 3/4 에서 단계적 축소되지 않고 영구 잔존 (debt 고정화)                                                  |  MED   | allowlist 항목별 issue/ADR 링크 필수 + 월별 audit. `rendererStyleContract.allowlist.ts` 상단에 expiry date 주석 고정                   |
| R4  | Phase 4 follow-up ADR 이 8건으로 분기되며 관리 오버헤드 증가                                                                                |  MED   | follow-up ADR 공통 템플릿 확정 (breakdown Phase 4) + 단일 "tracking" ADR (예: ADR-908 통합 트래커) 로 progress 집계 가능성             |
| R5  | Layer A CSS parser SSOT 전수 교체 시 기존 edge case (undefined/숫자/문자열/percentage/calc 등) 누락                                         |  MED   | Phase 1 parser test 10+ 로 edge case enumerate + allowlist 로 미교체 call-site 임시 허용 후 단계적 제거                                |
| R6  | Layer D Spec metric SSOT 강제 (`render.shapes()` ↔ `calculateContentHeight()` 동일 resolver) 가 grep 기반 검증만 가능 (AST-level 강제 없음) |  LOW   | 각 컴포넌트별 spacing test (`{Component}.spacing.test.ts`) 가 `render.shapes()` 출력 좌표와 resolver 반환값의 일치를 runtime 으로 검증 |

### R1 상세 — package boundary 유지

- 본 ADR 의 Layer A (cssValueParser) + Layer B (containerSpacing) 는 `packages/specs/src/primitives/` 에 위치. primitives 는 이미 `packages/specs/package.json:exports` (line 20-23) 에서 `"./primitives"` public subpath 로 노출. Builder tsconfig (`apps/builder/tsconfig.app.json:7-10`) 에는 `@composition/specs/*` path alias 가 없어 direct subpath import 불가 ([ADR-906:120](906-collection-spacing-runtime-contract.md#r1-상세) 승계).
- 의존 방향 계약: `packages/specs` ← `packages/shared` ← `apps/builder`. `packages/specs/**` 파일은 `apps/builder/**` 및 `@composition/shared/**` 를 import 하지 않는다.
- **HIGH+ 위험 관련 코드 경로 3곳 이상 구체 인용** (adr-writing.md 반복 패턴 seed #1 충족):
  - 선례 1: `packages/specs/src/components/ListBoxItem.spec.ts` 의 `resolveListBoxItemMetric` → `packages/specs/src/index.ts:303` 에서 barrel re-export → `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:35` 에서 `@composition/specs` root 경로로 import. 동일 패턴이 새 `resolveContainerSpacing` / `resolveGridListSpacingMetric` 에 재적용된다.
  - 선례 2: `packages/specs/src/components/GridListItem.spec.ts:112` `resolveGridListItemMetric` → `packages/specs/src/index.ts:390` barrel → `apps/builder/.../utils.ts` 에서 동일 root 경로 소비. 새 resolver 도 동일 3-hop 경로 따름.
  - 위반 위험 지점: `packages/specs/src/components/GridList.spec.ts` 의 `render.shapes()` 가 Phase 3 에서 resolver 를 호출할 때 `apps/builder/**` 의 type 이나 utility 를 import 하려는 유혹 — G5 Gate rg 4 명령으로 차단. `packages/specs/src/primitives/containerSpacing.ts` 가 내부 token resolver 호출 시에도 `packages/specs/src/primitives/colors.ts` 같은 같은 package 내 primitive 만 사용.
- 검증 명령 (Phase 1 + Phase 2 각 gate 에서 실행):
  - `rg "from ['\"](\.\./)+apps/builder" packages/specs` = **0건**
  - `rg "from ['\"]@composition/shared" packages/specs` = **0건**
  - `rg "resolveContainerSpacing|parsePxValue|parsePadding4Way|parseBorderWidth|parseGapValue" packages/specs/src/primitives/index.ts` ≥ **5건** (barrel re-export 확인)
  - `rg "@composition/specs/(components|src)" apps/builder packages/shared` = **0건** (비공개 subpath 차단 — `./renderers` `./primitives` `./types` `./adapters` 는 public subpath 로 match 허용)

### R2 상세 — BC 영향 수식화

- **측정 불가능성 전제**: composition 은 element 영속을 **per-user 로컬 IndexedDB** (`apps/builder/src/lib/db/index.ts` — `db.elements.getByPage()` / `saveService.savePropertyChange()`) 에 위임한다. Supabase 는 auth 전용 + legacy TableEditor 잔존 경로만 사용하므로 **중앙 `elements` 테이블 쿼리로 `N_edited` (padding/gap 편집 인스턴스 수) 를 산출할 수 없다**. ADR-906 breakdown 의 Supabase SQL 접근은 본 ADR 에서 폐기. 대신 **hand-crafted edited fixture** 로 BC 커버리지를 확보한다.
- **G1 audit matrix 산식**: 11 주대상 × 3 축 (a/b/c) = **33 cell** (원래 48 cell 에서 TagList 행 제거 + Menu 편입 + N_edited 축 제거로 재산출). Phase 0 은 33 cell 전부 기록되어야 통과.
- Baseline 분기 (측정 없이 항상 커버):
  - (a) **unedited baseline** (`style` 부재 또는 padding/gap 미설정): 현 `main` 렌더와 **byte-equal** 유지. fixture test 로 Phase 3/4/5 각 컴포넌트에 고정.
  - (b) **edited baseline** (hand-crafted 샘플 k≤5: 흔한 편집 패턴 — `padding: 16, gap: 8` / `paddingLeft: 24, columnGap: 4` / border/rowGap 조합 등): 편집값이 DOM/Skia 양쪽에 정확히 반영되는지 시각 equivalence 검증. 이는 BC 회귀가 아니라 **Hard Constraint 1 충족**. 실제 프로덕션 편집 빈도 측정이 불가능하므로 GridList/Table/TagGroup 처럼 root `style` 편집 UI 가 열려있는 컴포넌트는 k=5, 나머지는 k=2 수동 샘플링.
- G8 통과 조건 (Phase 6): unedited baseline 회귀 0 + edited baseline 시각 equivalence PASS (hand-crafted 샘플).

## Gates

| Gate                              | 시점                     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                                                      |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| G1: Audit Matrix                  | Phase 0                  | 11 주대상 컴포넌트 audit matrix 총 **33 cell** (11 × 3 축 (a/b/c)) 이 breakdown 에 기록되고 Phase 3/4/5 적용 우선순위 결정. 추가로 `packages/specs/vitest.config.ts` 및 `packages/shared/vitest.config.ts` 의 include 패턴에 Phase 1-2 신규 test 경로가 수집됨을 확증 (test discovery 확인).                                                                                                                                       | scope 축소 — Phase 4 에서 적용할 컴포넌트 집합 재정의                             |
| G2: CSS Parser SSOT               | Phase 1                  | `cssValueParser` 가 `packages/specs/src/primitives/` 에 위치 + `rg "parseFloat.*padding\|parseFloat.*gap" apps packages` = 0 (allowlist 외)                                                                                                                                                                                                                                                                                        | parser SSOT 를 Layer A scope 축소 (padding 만)                                    |
| G3: GridList Pilot (ADR-906 흡수) | Phase 3                  | GridList renderer root `style` 전달 + `resolve{GridList}SpacingMetric` 이 `render.shapes()` 와 `calculateContentHeight()` 양쪽에서 호출 확인 + unedited/edited baseline PASS + **RAC `data-layout={layout}` auto-emit selector 매칭 test** (`[data-layout="grid"]` / `[data-layout="stack"]` CSS selector 가 `react-aria-components@1.15.1 dist/GridList.mjs:198` auto-emit DOM 에 매칭됨을 runtime test 로 확인, ADR-906 G2 흡수) | GridList 적용 축소 후 ADR-906 Decision B 로 회귀 (pilot 실패 시 framework 재검토) |
| G4: Renderer Contract Enforcement | Phase 2                  | `rendererStyleContract.test.ts` 가 최소 ListBox + GridList PASS + allowlist 항목별 만료일 명시                                                                                                                                                                                                                                                                                                                                     | vitest 기반 runtime 검증에서 ESLint custom rule 로 전환 또는 역전환               |
| G5: Boundary Preservation         | Phase 1/2/3 각 완료 시점 | R1 상세의 4개 `rg` 명령 모두 조건 충족                                                                                                                                                                                                                                                                                                                                                                                             | helper 위치를 `primitives/` 내 재분리 또는 scope 축소                             |
| G6: Follow-up Template            | Phase 4                  | follow-up ADR 공통 템플릿 확정 + 최소 1건 follow-up (ADR-908 등) Proposed                                                                                                                                                                                                                                                                                                                                                          | follow-up ADR 경로 기각 시 본 ADR scope 를 전 컴포넌트로 확장 재설계              |
| G7: Table Audit                   | Phase 5                  | 4-item O/X 매트릭스 결과 기록 + 3분기 (4/4 / 2-3/4 / 0-1/4) 판정 명시                                                                                                                                                                                                                                                                                                                                                              | Table 단독 후속 ADR 로 전체 이관                                                  |
| G8: Regression                    | Phase 6                  | ListBox 기존 tests/behavior 불변 + Phase 3 적용 컴포넌트 fixture 회귀 0                                                                                                                                                                                                                                                                                                                                                            | 회귀 발견 시 해당 Phase 롤백 후 재시도                                            |

## Consequences

### Positive

- **구조적 drift 차단**: 11 주대상 컴포넌트의 `element.props.style` → 3경로 반영이 pipeline 으로 선언화. 미래 컴포넌트 추가 시 framework 자동 적용.
- **SSOT 1곳 수렴**: CSS value parser + container spacing resolver 가 각각 1 primitive 로 통합. 현행 ad-hoc 파싱 중복 제거.
- **반복 ADR 비용 축소**: 추정 누적 54~90일 → **25~35일** (framework 17~25일 + follow-up 8~10일, Phase 0 실측 기반) = 약 55~61% 절감.
- **Renderer contract 재발 차단**: test/lint 로 신규 renderer 의 style 전달 누락 자동 차단.
- **ADR-906 맥락 보존**: Supersede 링크로 906 의 리뷰 7라운드 맥락 추적 가능.

### Negative

- **초기 설계 비용 증가**: ADR-906 Decision B (GridList 단일 5~10일) 대비 framework 17~25일. 단기 overhead.
- **Phase 4 follow-up 관리**: 8 follow-up ADR 의 tracking 오버헤드. R4 로 대응.
- **Renderer contract allowlist debt 가능성**: Phase 3 이후 allowlist 가 영구 잔존 시 debt 고정화 위험. R3 로 대응.
- **Spec metric SSOT grep 기반 검증 한계**: AST-level 강제 부재. R6 로 대응 (컴포넌트별 spacing test).

## References

- [docs/adr/906-collection-spacing-runtime-contract.md](906-collection-spacing-runtime-contract.md) — Supersedes
- [docs/adr/completed/063-ssot-chain-charter.md](063-ssot-chain-charter.md) — SSOT D3 Charter
- [docs/adr/completed/076-listbox-items-ssot-hybrid.md](076-listbox-items-ssot-hybrid.md) — items SSOT 선례
- [docs/adr/completed/079-container-styles-read-through.md](079-container-styles-read-through.md) — Style Panel Spec 3경로 대칭화
- [docs/adr/completed/080-layout-engine-spec-direct-read-through.md](080-layout-engine-spec-direct-read-through.md) — Layout engine containerStyles Spec direct read-through
- [docs/adr/completed/082-style-panel-spec-consumer.md](082-style-panel-spec-consumer.md) — Style Panel Spec Consumer 통합
- [.claude/rules/ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — SSOT 체인 정본
- [packages/specs/src/primitives/](../../../packages/specs/src/primitives/) — Layer A/B 배치 위치
- [packages/shared/src/renderers/](../../../packages/shared/src/renderers/) — Renderer contract 적용 대상
- [apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts](../../../apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts) — `calculateContentHeight` 통합 대상

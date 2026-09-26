# ADR-150: 데이터 바인딩 목록의 Canvas 정합 — 행 위치 단일 소스 · 데이터 행 origin 진입 (ADR-912 잔여 재작성)

## Status

In Progress — Accepted 2026-09-26 (리뷰 round 3 · 4 pending 0 + 실행자 종결 선언, 사용자 `/execute-adr 150`) · Phase 0 완료 2026-09-27 (G0 PASS — R2 가설 live 성립 · RED 4 고정 · breakdown §2 결과 고정). **Phase 1 완료 2026-09-27** (G1 PASS — 실 브라우저 DOM oracle 3/3 · live Canvas 15/15 · 원복 RED 6/7 (GAP 4 skip 무반응 사유 기록) · 판독 HIGH 0 · MEDIUM 3 수리 · breakdown §3 결과). **본문 재작성 2026-09-26**. 사용자 판정은 두 가지다: "본문 재작성", 그리고 데이터 행 진입을 "origin 자식 선택" 으로 한다. 이전 판은 Accepted 2026-07-18 로 3축 (A1 상태 threading · A2 가상화 · A3 drill-in) 이었고, 본문 원문은 git `7519dee51` 에 있다. 재작성 본문은 리뷰 round 3 이 필요하다.

> **재작성 사유** (2026-09-26 코드 실측 — 조사 3 갈래와 직접 대조):
>
> - **A1** (Skia hover/pressed/focusVisible 상태 threading): 2026-07-20 에 철회했다 (`5e635ebbc`, D1/D3 경계 오판). 선언적 상태 (selected/disabled) 는 [ADR-230](completed/230-base-element-state-variant-origins.md) 이 실행했고, [ADR-234](completed/234-variant-instances-and-slot-filled-collections.md) 에서 상태 변형 origin 의 ref + 층으로 다시 실행했다 (`stateVariantLayers.ts` · `canonicalRefResolution.ts` `resolveActiveStateLayer`). 그래서 150 이 가질 몫이 없다. 이전 판 HC#3 과 Consequences 의 "상태 시각 = catalog `FillStateTokens` 단일 소스 · 신규 정본 없음" 은 현재 코드와 반대다.
> - **A2** (가상화 window, 2026-07-19~20 `b9698aa4c` · `90dd52b32` · `73e7b367b` · `360a12201` · `34c56ea70` · `4a29fcf5a` · `e994822b9`): 코드는 ListBox · GridList · Table 에서 가동 중이다. 노드 수 상한은 성립한다. 반면 **행 위치 단일 소스는 세 가족 모두 성립하지 않는다** (Context 2). 07-19 부터 걸려 있던 "시각 최종 확인 대기" 는 이 상태로는 닫을 수 없는 게이트였다.
> - **A3** (가장 깊은 projected 노드 선택 · drill stack · template/data/override 3-route registry): ADR-234 계열 (234 · 237 · 238 · 239 · 241) 로 정적 목록 항목이 canonical instance 자식이 됐다. 그래서 editingContext 더블클릭 진입 · Esc 복귀 · synthetic 자식 선택 · `descendants[origin path]` override 가 이미 동작한다. 원 설계는 현재 불변식 두 가지와 충돌한다. ① projected id 는 selection 에 들어가지 않는다 (`resolveCanvasInteractionTarget.ts:22-24`). ② override 는 항목 instance 자신에 저장한다 (원 설계는 collection 노드의 `descendants[itemKey]`). 남은 공백은 **데이터 바인딩 행** 뿐이다.
> - **R6** (ADR-916 사후 parity sweep 의 collection 축 선행): [ADR-151](completed/151-builder-residual-parity-defect-remediation.md) (Implemented 2026-07-17) 로 해소됐다. 남은 잔존은 Disclosure percent-in-intrinsic 1 건으로 collection 축이 아니다.

## Context

**도메인 (ADR-063)**: D3 시각과 render-space interaction (ADR-135/136 경계) 이다. D3 시각은 행 위치와 스크롤 범위다. 두 가지 모두 Builder (Skia) 와 Preview (DOM) 에서 시각 결과가 달라질 수 있는 요소다. D1 · D2 는 건드리지 않는다. schema · prop · catalog 변경은 0 이다.

**제품 전제**: 빌더는 정의 · 구성 도구이고, 데이터 전체 재현은 목표가 아니다 ([ADR-157](completed/157-collection-builder-display-policy.md)).

- 데이터 행 입력 경로 상한은 DataTable 100 (`DataTableCreator.tsx:818-823`) 과 AI 50 (`services/ai/data/tableSpec.ts:25`) 이다. 붙여넣기 · API 저장 경로에는 상한이 없다.
- `pnpm perf:baseline` 의 레버 순위에 canvas collection 스크롤은 없다 (`BUILDER_PERF_BASELINE_2026-09.md` §4).
- 그래서 목표는 "10k 행 60fps" 가 아니다. 목표는 두 가지다. **스크롤 소유자에서 보이는 행이 DOM 과 같은 자리에 있고 끝 행까지 스크롤이 닿는 것.** 그리고 노드 수가 window 에 묶이는 것.

**현재 코드 (2026-09-26 working tree 실측)**:

1. **가상화 대상**: 가족은 listbox · gridlist · table 3 개다 (`collectionVirtualization.ts:130-137`). 그중 높이 고정 + overflow scroll 소유자만 대상이다 (`BuilderCanvas.tsx:322-336`). auto-height 소유자는 ADR-157 방식 (샘플 10 행 + hatch) 을 따른다. TagGroup · Tab · Breadcrumb 은 window 가 없고 정적 cap 100 을 쓴다 (`resolveCollectionItems.ts:36`).
2. **행 위치 단일 소스 불성립**:
   - **ListBox**:
     - scene 행 묶음은 `rowGap: rowGapPx` 를 쓴다. 기본값은 catalog `{spacing.2xs}` = 2px 이다 (`canvasSceneNode.ts:1252-1288`).
     - 그런데 scroll 모드 trailing spacer 는 `trail × rowHeight` 뿐이다 (`:1440`). resolver 의 `contentHeight = (visualRows + headerRows) × rowHeight` (`collectionVirtualization.ts:404-406`) 에도 gap 이 빠져 있다.
     - 그 결과 `maxScrollTop` 이 (행 수 − 1) × gap 만큼 짧다. 100 행이면 약 198px 이라 끝 행에 스크롤이 닿지 않는다.
     - 행 높이 resolver 는 layout 과 같은 함수를 쓰지만 입력이 다르다: wrap · inset · 명시 `height` · selected variant (`utils.ts:2947-2995` 대 `:401-418`).
     - **행 높이가 행마다 다르다 (round 3 h2)**: resolver 는 첫 행의 description 만 읽어 모든 행을 같은 높이로 둔다 (`collectionVirtualization.ts:365-386`). scene 은 행마다 description 을 만들고 (`canvasSceneNode.ts:1358-1368`) layout 은 행별로 높이를 계산한다 (`utils.ts:2955-3001`). description 유무가 교대하는 100 행이면 실제 높이는 32 · 50px 로 합계 4100px 인데 resolver 는 3200px 이다. gap 을 빼고도 900px 가 부족하다 (production layout helper 실행값). 단일 줄이어도 균일하지 않다.
   - **GridList**:
     - 2026-07-23 `2a7002cd6` 에서 행 묶음이 `display:grid` + `1fr × numCols` 로 바뀌었다 (`canvasSceneNode.ts:1686-1694`).
     - 그런데 spacer 는 여전히 `{width:100%, height, flexShrink:0}` 이다 (`:991`). grid 에서는 한 칸만 차지할 수 있다 (live 미확인).
     - stride 는 고정 공식이고 첫 행의 description 으로 모든 카드 높이를 정한다 (`collectionVirtualization.ts:221-226`). padding 과 gap 도 렌더 경로와 다른 소스에서 읽는다: `resolveGridListItemMetric` 대 카드 style, `resolveGridListSpacingMetric` 대 `props.gap`.
     - 펼친 카드 (ADR-162 Phase 2) 는 엔진이 실측한다. 그 가변 높이는 ADR-162 Phase 4 범위다.
   - **Table**:
     - 행 높이는 상수 미러 36/44/52 다 (`collectionVirtualization.ts:144-156`). catalog `TableRow.sizes` 와 값만 같은 두 번째 소스다.
     - ADR-241 요소 헤더 (`headerFromElements`) 의 높이를 rowHeight 로 가정한다 (`collectionVirtualization.ts:362, 405-406`).
   - 주석 `collectionVirtualization.ts:165-167` 의 "ListBox/Table 은 rowsGroup gap 0 이라 정확" 은 ADR-157 gap 배선 이후 틀린 서술이다.
   - window 테스트는 노드 수와 spacer 값만 본다. gap 이 있는 ListBox · grid 좌표 · 끝 행 도달을 보는 테스트는 0 이다.
3. **데이터 행 진입 부재**:
   - 데이터 바인딩 행 클릭은 owner 로 넘어간다 (ListBox · GridList · Table · Tag · Tab · Breadcrumb, `resolveCanvasInteractionTarget.ts:132-165`). ADR-162 Phase 2 에서 펼친 카드의 자식도 `inheritCollectionRowProjectionToSyntheticChildren` (`canvasSceneNode.ts:3707-3719`) 을 거쳐 owner 로 간다.
   - 더블클릭하면 owner 로 진입하지만, 다음 클릭도 owner id 로 바뀌어 context 가 풀린다. 막다른 길이다 (코드 판독).
   - **raw hit 이 double-click handler 전에 사라진다 (round 3 h1)**: `resolveCanvasInteractionTarget` 이 owner id 만 돌려주고 (`:160-164`), pointer handler 는 그 id 만 남긴다 (`useCentralCanvasPointerHandlers.ts:394-397`). double-click 두 분기 (`:430` · `:476-494`) 와 `handleElementDoubleClick(elementId)` (`useCanvasElementSelectionHandlers.ts:293-302`) 모두 owner id 만 받는다. 펼친 카드의 서로 다른 Text 자식 두 개가 모두 owner 로 도착한다 (리뷰 probe).
   - 데이터 행 `descendants` 는 `{field}` 보간으로 scene 시점에 만들고 저장하지 않는다. 행별 override 를 저장할 곳이 없다. 카드 모양 편집은 origin (Components 페이지) 편집뿐이다.
   - `resolveCollectionWriteTarget` (ADR-912 단계 4, 3-route) 은 production 호출이 0 이다.
   - origin 이동 인프라는 이미 있다: `selectElementWithPageTransition` (`stores/elements.ts:1594`), "원본으로 이동" 액션 (`componentSemanticsActions.ts:128`).
4. **910/911**:
   - [ADR-911](911-rac-pencil-target-component-architecture.md) R-3 HIGH / G-projected (10k draw/hit · 가장 깊은 선택 · drill-in/data edit) 를 증명할 곳은 150 뿐이다. 그런데 150 이 닫힐 때 911 Status 를 바꾸는 조항이 없다.
   - [ADR-910](910-rac-pencil-component-architecture.md) T-7/G-state 는 A1 철회를 반영하지 않았다.

**인접 ADR**:

- [ADR-162](162-gridlist-template-subtree-projection.md) Phase 4 (펼친 카드의 시각 행별 높이 가상화) 는 본 ADR A2' 뒤에 온다. 의존 방향은 그대로 162 Phase 4 → 150 A2' 이다. 150 은 행 offset 함수를 정하고, 162 Phase 4 는 그 함수에 실측 · 추정 행 높이를 공급한다.
- ADR-162 Phase 5 (GridList 카드 필드 패널) 는 A3' 와 같은 Properties 표면을 쓴다. 쓰기 대상도 origin 문서로 같다.

### Hard Constraints

1. **노드 수**: draw/hit 투영 행 ≤ window + overscan (현행 유지).
2. **행 위치 한 곳**: 다음 값들이 같은 행 높이 · gap · 헤더 값을 읽는다 — window index, spacer, contentHeight, maxScrollTop, 실제 행 배치 ([ADR-160](completed/160-collection-projection-metric-ssot.md) 원칙).
3. **id 경계**: projected · 가상 id 는 selection · canonical mutation · history · IndexedDB 에 들어가지 않는다 (ADR-135/136, ADR-236 `canOperate`).
4. **쓰기 대상**: 데이터 행 편집은 origin 문서 하나에만 쓴다. 행별 저장을 새로 만들지 않는다 (schema 변경 0).
5. **pointer hot path**: scene rebuild · signature 계산 금지 (`.claude/rules/canvas-rendering.md` §9).

## Alternatives Considered

A2' (행 위치) 와 A3' (데이터 행 진입) 는 독립 축이라 대안을 따로 둔다.

### 대안 A (A2'): 행 offset 함수 하나

- 설명: resolver 가 scene 행 묶음과 같은 metric 입력 (행 높이 · gap · 헤더 높이) 으로 시각 행 높이 목록을 만든다. 그 목록에서 offset · spacer · contentHeight · maxScrollTop 을 한 함수가 산출한다. scene spacer 와 BuilderCanvas 주입도 이 결과만 읽는다. 행 높이는 행 데이터에서 layout 과 같은 metric 함수로 행마다 산출한다 (description 유무 · 선택 variant 처럼 layout 전에 알 수 있는 차이). 모든 행이 같은 높이일 때만 곱셈 경로를 쓰고, 아니면 누적합 경로를 쓴다. 엔진 실측이 필요한 높이 (ADR-162 Phase 4 의 펼친 카드) 는 같은 함수에 실측값을 넣는다.
- 근거: react-window `VariableSizeList` · TanStack Virtual 이 쓰는 구조 (크기 목록 → offset 누적합) 와 같다. ADR-160 "행 metric 한 곳" 원칙을 window 경로까지 넓힌다.
- 위험: 기술 M — 세 가족의 metric 입력을 layout 과 맞춰야 하고, grid spacer 가 전체 열을 차지하게 해야 한다 / 성능 L — 행별 높이 목록은 행 데이터 · metric 이 바뀔 때만 O(n) 으로 다시 만들고 스크롤마다 만들지 않는다. 균일 입력은 O(1) 을 유지한다 / 유지보수 L / 마이그레이션 L — 문서 변경 0.

### 대안 B (A2'): 가족별 개별 수리

- 설명: ListBox spacer 와 contentHeight 에 gap 을 더하고, GridList spacer 에 `gridColumn` span 을 주고, Table 헤더 상수를 보정한다. 함수 분리 구조는 그대로 둔다.
- 근거: 수정 범위가 가장 작다.
- 위험: 기술 L / 성능 L / 유지보수 **H** — resolver 와 scene 이 값을 따로 계산하는 구조가 남는다. 같은 축의 어긋남이 07-23 (grid 전환) · ADR-157 (gap 배선) · ADR-241 (요소 헤더) 에서 세 번 생겼다. ADR-162 Phase 4 는 세 곳을 다시 고쳐야 한다 / 마이그레이션 L.

### 대안 C (A2'): canvas 가상화 폐기 — scroll 소유자도 샘플 + hatch

- 설명: ADR-157 의 샘플 N 행 + hatch 를 scroll 소유자에도 적용하고 window 코드를 지운다.
- 근거: 빌더 = 정의 도구 전제와 맞고, 코드가 줄어든다.
- 위험: 기술 **H** — DOM 은 스크롤로 전체 행을 보여 주는데 Canvas 는 스크롤해도 뒤 행을 보여 주지 않는다. D3 대칭이 성립하지 않는다 / 성능 L / 유지보수 L / 마이그레이션 L.

### 대안 D (A3'): 제자리 선택 — 현재 페이지에서 origin 자식을 선택

- 설명: 데이터 행 자식을 더블클릭하면 현재 페이지에 머문 채 selection 을 origin 자식 canonical id (Components 페이지 요소) 로 둔다. 캔버스는 모든 카드의 같은 자리를 강조한다.
- 근거: 편집 맥락을 떠나지 않는다.
- 위험: 기술 **H** — selection 이 현재 페이지 밖 요소를 가리키는 계약이 정해져 있지 않다 (ADR-137 스냅샷 · 페이지 필터 · Pointer→Move · Properties 페이지 판정) / 성능 L / 유지보수 M — 강조 overlay 를 새로 만들어야 한다 / 마이그레이션 L.

### 대안 E (A3'): origin 으로 이동해 자식 선택

- 설명: 데이터 행 자식을 더블클릭하면 가상 id 의 path 로 origin 자식을 찾는다. 그 자식을 `selectElementWithPageTransition(origin 자식, Components 페이지)` 로 선택한다. Properties 는 "이 원본을 쓰는 카드 전체에 적용" 을 안내한다. 단일 클릭은 지금처럼 owner 를 선택한다.
- 근거: "원본으로 이동" 과 같은 기존 경로다. 데이터 행에는 행별 저장이 없으므로, 편집 대상이 origin 이라는 사실을 표면이 그대로 보여 준다. Pencil 의 "Go to component" 와 같은 동작이다.
- 위험: 기술 L — 기존 인프라를 재사용한다 / 성능 L / 유지보수 L / 마이그레이션 L. 제품 측면에서는 작업 페이지를 떠난다 (R3).

### 대안 F (A3'): 원 설계 유지

- 설명: 가장 깊은 projected id 선택, drill stack, template/data/override 3-route registry 를 쓴다.
- 근거: 2026-07 판 설계와 ADR-910 §5.11.
- 위험: 기술 **H** — projected id selection 금지 불변식, instance 저장 모델과 충돌한다 / 성능 L / 유지보수 **H** — editingContext 와 drill 모델이 둘이 된다 / 마이그레이션 L.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ---- | :---: | :--: | :------: | :----------: | :---: |
| A    |   M   |  L   |    L     |      L       |   0   |
| B    |   L   |  L   |  **H**   |      L       |   1   |
| C    | **H** |  L   |    L     |      L       |   1   |
| D    | **H** |  L   |    M     |      L       |   1   |
| E    |   L   |  L   |    L     |      L       |   0   |
| F    | **H** |  L   |  **H**   |      L       |   2   |

루프 판정: A2' 는 A, A3' 는 E 가 HIGH 0 이라 추가 대안이 필요 없다. D 의 HIGH 는 페이지 밖 selection 계약이 미정이라서 생긴다. E 로 운영한 뒤 사용자가 제자리 편집을 요구하면 별도 판단으로 다시 연다.

## Decision

**A2' = 대안 A (행 offset 함수 하나), A3' = 대안 E (origin 으로 이동해 자식 선택)** 를 채택한다.

1. **A2'**: 세 가족의 window · spacer · contentHeight · maxScrollTop · 행 배치가 한 함수의 결과를 읽는다. layout 전에 알 수 있는 행별 높이 차이 (ListBox · slot-only GridList 의 description 유무 · 선택 variant) 는 150 이 production 에서 행별 높이 목록으로 공급한다. 균일 stride 는 모든 행이 같을 때만 쓰는 특수 경우다. ADR-162 Phase 4 는 같은 함수에 펼친 카드의 실측 · 추정 높이를 공급한다 (의존 방향 162 → 150 유지).
2. **A3'**: 데이터 행 (펼친 GridList 카드와, 항목 origin 템플릿을 가진 가족) 안을 더블클릭하면 origin 의 대응 자식으로 이동해 선택한다. interaction target 은 선택 id (owner) 와 별도로 raw hit (노드 id · projection) 을 싣고, pointer handler 의 두 double-click 분기가 그것을 handler 까지 넘긴다. raw id 는 해석 입력으로만 쓰고 selection 에 넣지 않는다. 단일 클릭 · 드래그는 owner 선택을 유지한다. 행별 저장은 만들지 않는다.
3. **철회 · 폐기**:
   - A1 은 철회 상태를 유지한다 (선언적 상태 = ADR-230 → 234).
   - 원 A3 의 가장 깊은 projected 선택 · drill stack · 3-route registry 는 폐기한다. `resolveCollectionWriteTarget` 의 처분 (삭제 또는 A3' 경로에 흡수) 은 Phase 0 inventory 가 정한다.
   - TagGroup chip remove · Tab selection 의 "후속" 주석 (`canvasSceneNode.ts` TagList · TabList 투영) 은 범위 밖이다. 데이터 바인딩 chip 삭제는 데이터 편집이고 빌더 캔버스의 조작 대상이 아니다.
4. **910/911 종결 조항**: 150 이 Implemented 가 될 때 다음을 반영한다.
   - 911 R-3 / G-projected 를 본 ADR 게이트로 재정의한 뒤 닫힘으로 표기한다: 10k 행 → window 노드 상한 + 행 위치 = DOM, 가장 깊은 선택 · drill-in → 데이터 행 origin 진입.
   - 910 T-7 / G-state 에 A1 철회 1 줄을 남긴다.

선택 근거:

- 대안 B 기각: 같은 축의 결함이 세 번 생긴 구조를 그대로 둔다.
- 대안 C 기각: Canvas 가 DOM 과 다른 행 집합을 보여 주는 대칭 위반이다.
- 대안 D 기각: 페이지 밖 selection 계약이라는 새 경계가 필요하다.
- 대안 F 기각: 현재 불변식과 저장 모델에 역행한다.

> 구현 상세: [150-rac-pencil-residual-interaction-execution-breakdown.md](design/150-rac-pencil-residual-interaction-execution-breakdown.md) — §1 fork 확인 / §2 Phase 0 inventory / §3 Phase 1 (A2') / §4 Phase 2 (A3') / §5 Phase 3 closure.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                   |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 행별 높이 공급 — 행 높이는 description 유무 · 선택 variant 로 행마다 다르다 (round 3 h2: 32 · 50px 교대 100 행에서 900px 부족). 첫 행 하나로 높이를 정하면 offset · 스크롤 범위가 어긋난다. wrap (label · description 줄바꿈) 은 폭이 layout 뒤에 정해져 scene build 시점에 알 수 없다 | **HIGH** | G1. layout 전에 알 수 있는 입력 (description 유무 · 선택 variant · 명시 height · inset · gap) 은 layout 과 같은 metric 함수로 행마다 계산해 production 에서 목록으로 공급한다. 모든 행이 같을 때만 균일 경로를 쓴다. **wrap 은 Phase 1 지원 범위 밖**이다. G1 fixture 는 단일 줄로 두고, wrap 행이 있는 목록은 "행 위치 정합" 을 주장하지 않는다. wrap 은 ADR-162 Phase 4 의 실측 캐시가 들어온 뒤 150 후속 항목으로 ListBox · slot-only GridList 에 연결한다 (closure 에 잔여로 기록)                                                                                              |
| R2  | GridList grid spacer — spacer 가 전체 열을 차지해야 하는데 (`gridColumn: 1 / -1` 류) 엔진 grid 배치가 그 표현을 DOM 과 같게 처리하는지 미확인                                                                                                                                          |   MED    | G0 에서 live 1 회 (가설: 첫 window 카드가 spacer 옆 칸에 붙는다) + 엔진 지원 확인. 불가하면 spacer 를 행 묶음 밖 (scroll content padding) 으로 옮긴다                                                                                                                                                                                                                                                                                                                                                                                                                               |
| R3  | 페이지 이동 UX — 데이터 카드를 더블클릭하면 작업 페이지를 떠난다                                                                                                                                                                                                                       |   MED    | G2 live 사용자 확인. 돌아오기는 기존 페이지 이동을 쓴다. 제자리 편집 요구가 나오면 대안 D 를 별도 판단으로 연다                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R4  | Table 요소 헤더 높이 — `headerFromElements` 헤더 높이는 엔진 결과인데 resolver 는 layout 전에 돈다                                                                                                                                                                                     |   MED    | G1. layout 이 쓰는 같은 catalog Column 셀 metric 함수로 산출한다. 상수 미러 `TABLE_ROW_HEIGHT_BY_SIZE` 는 catalog `TableRow.sizes` 읽기로 바꾼다                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R5  | 가상 id → origin 자식 해석 실패 — path 가 origin 구조와 어긋나거나 (origin 편집 후) 템플릿 origin 이 없는 가족                                                                                                                                                                         |   MED    | G2. 해석 실패 시 지금처럼 owner 를 선택하고 안내 없음. 가상 id 는 해석 입력으로만 쓰고 selection 에 넣지 않는다 (HC3 negative unit)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R6  | ADR-162 Phase 4 와의 경계 — 두 ADR 이 같은 파일 (`collectionVirtualization.ts`) 을 고친다                                                                                                                                                                                              |   LOW    | 함수 계약 (행별 높이 목록 입력 → offset 결과) 과 layout 전 공급자 (description · variant) 는 150 Phase 1 이 고정하고, 162 Phase 4 는 실측값 공급만 한다. 후행 측이 착수 때 선행 측 반영 상태를 재실측한다                                                                                                                                                                                                                                                                                                                                                                           |
| R7  | raw hit 전달 경로 — owner redirect 가 hit 자식 정보를 버린다 (round 3 h1). 두 double-click 분기 (선택 경계 안 · 밖) 중 하나만 연결하면 경로마다 동작이 갈린다. double-click 판정 키는 owner id 라, 짧은 간격으로 다른 카드 두 개를 누르면 double-click 으로 판정된다                   | **HIGH** | G2. interaction target 에 raw hit (노드 id · projection) 을 선택 id 와 별도 필드로 싣고, 두 분기 모두 handler 에 넘긴다. double-click 연속성 판정 키는 raw hit 이 있으면 그 노드 id (카드 · 자식 단위), 없으면 지금처럼 선택 id 다. 클릭 기록 (`commitPointerClick`) 과 판정 (`isPointerDoubleClick`) 이 같은 키 함수를 쓴다 (round 4 h1 — owner 키면 카드 A 클릭 200ms 뒤 카드 B 단일 클릭이 double-click 으로 판정돼 페이지가 이동한다). 선택 id 는 owner 를 유지한다 (단일 클릭 · 드래그 계약 무변경). raw id 는 판정 · 해석 입력으로만 쓰고 selection · mutation 에 넣지 않는다 |

잔존 HIGH 는 R1 · R7 이며, 각각 G1 · G2 와 대응한다.

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                             |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| G0   | Phase 0 후 | 가족별 행 높이 · gap · 헤더 입력 표 (layout 쪽 · window 쪽 소스 대조, 행마다 달라지는 입력 표시) 고정. GridList grid spacer live 1 회 (R2 가설 판정). 템플릿 origin 을 가진 데이터 행 가족 표. `resolveCollectionWriteTarget` 처분 확정. round 3 probe 2 개를 저장소 unit 으로 옮겨 RED 고정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                        |
| G1   | Phase 1 후 | 반례 입력: (1) description 유무가 교대하는 scroll ListBox 100 행 (32 · 50px, gap 2px) · (2) description 유무가 교대하는 2 열 slot-only GridList 200 행 (시각 행 높이 = 그 행 카드 최대) · (3) 요소 헤더 Table 200 행 · (4) 모든 행이 같은 ListBox (균일 경로 회귀). (a) 스크롤 끝에서 마지막 행 하단 = viewport 하단 (±1). (b) 중간 스크롤 위치 3 곳에서 보이는 행의 y = DOM 같은 행 y (±1, `tests/parity/` browser test — oracle 은 실 브라우저 overflow scroll). (c) contentHeight = DOM `scrollHeight` (±1). (d) draw/hit 노드 수 ≤ window + overscan 유지. (e) 원복 RED. 불리 입력 포함: gap ≠ 0 · 교대 높이 · selected 행 · 요소 헤더 · 끝 이동 (중간 행 건너뜀). 측정 조건: 실 브라우저 oracle · visibilityState visible 기록 · 행 데이터는 규모 전용 합성 (분포 주장 없음) · 모든 행 단일 줄 (wrap 은 R1 범위 밖). live Canvas 1 회 | 가족 단위 hold — 통과한 가족만 새 함수로 전환, 나머지는 현행 유지 + 기록 |
| G2   | Phase 2 후 | (a) 펼친 GridList 데이터 카드 안의 서로 다른 자식 두 개 (예: 제목 Text · 설명 Text) 를 각각 더블클릭 → 각자 다른 origin 자식 선택. 선택 경계 밖 (처음 더블클릭) · 안 (owner 선택 후 더블클릭) 두 분기 모두 (unit + live 1 회 + 사용자 확인). (b) 단일 클릭 · 드래그 owner 선택 회귀 0. 카드 A 클릭 → 200ms 뒤 카드 B 단일 클릭 · 같은 카드의 다른 자식 연속 클릭은 double-click 이 아니다 (페이지 이동 0, 두 분기 각각 unit). (c) 가상 · projected id 의 selection · mutation 유입 0 (negative unit). (d) origin 편집 → 모든 데이터 카드 반영 (live). (e) 해석 실패 입력은 owner 선택 (unit)                                                                                                                                                                                                                                               | owner 선택 유지 + Phase 2 hold                                           |
| G3   | closure    | 911 R-3 / G-projected · 910 T-7 / G-state 문구 반영, wrap 잔여 (R1) 기록, README · CHANGELOG 갱신, `### Live Exercise` 절                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                        |

## Consequences

### Positive

- 스크롤 소유자의 데이터 목록이 끝 행까지 닿고, 보이는 행 위치가 DOM 과 같아진다. 같은 축의 결함이 생길 구조적 자리 (resolver · scene 이중 계산) 가 사라진다.
- ADR-162 Phase 4 가 새 가상화를 만들지 않고 행 높이만 공급하면 된다.
- 데이터 카드 안을 더블클릭하면 그 모양을 정하는 origin 자식으로 바로 간다. 막다른 길이 사라진다.
- 911 R-3 에 종결 경로가 생기고, 910/911/912 계열의 미결 기록이 정리된다.

### Negative

- 데이터 카드 편집은 항상 모든 카드에 적용된다. 한 행만 다르게 만드는 수단은 없다 (행별 저장 0 — 의도된 제약).
- 더블클릭 진입이 페이지를 바꾼다 (R3).
- wrap 으로 높이가 달라지는 행은 Phase 1 뒤에도 근사로 남는다. ADR-162 Phase 4 실측 캐시를 ListBox · slot-only GridList 에 연결하는 150 후속 항목이 해소한다 (R1).
- 이전 판의 10k 행 60fps 목표는 목표에서 빠진다. 노드 수 상한은 유지하지만 대용량 스크롤 프레임은 게이트가 아니다.

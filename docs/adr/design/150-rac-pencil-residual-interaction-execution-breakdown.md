# ADR-150 Breakdown: 데이터 바인딩 목록의 Canvas 정합

> [ADR-150](../150-rac-pencil-residual-interaction-execution.md) 의 구현 상세다. 2026-09-26 본문 재작성과 함께 새로 썼다. 이전 판 (3축 A1 · A2 · A3, 07-13 ~ 07-20 실행 기록) 은 git `7519dee51` 의 이 파일에 있다.

## §1 Fork 확인 (2026-09-26)

사용자 판정은 2026-09-26 AskUserQuestion 으로 받았다.

- ADR 구조: **"본문 재작성"** 을 골랐다. 다른 선택지는 "150 종결 + 결함은 /fix", "A2 를 162 로 흡수" 였다.
- 데이터 행 진입: **"origin 자식 선택"** 을 골랐다. 다른 선택지는 "진입 없음 · 패널만", "행 값 편집까지" 였다.

아래는 4 질문 확인 결과다.

1. **base / 응용 분류**: 150 A2' 는 행 offset 함수이고 base 다. [ADR-162](../162-gridlist-template-subtree-projection.md) Phase 4 는 펼친 카드의 행 높이를 공급하고 응용이다. 150 A3' 와 162 Phase 5 는 같은 Properties 표면을 쓰는 형제 관계이고, 쓰기 대상은 둘 다 origin 문서다.
2. **schema 직교성**: canonical schema · catalog · prop 변경이 모두 0 이다. 새 타입은 render-space 전용이다 (행 offset 결과, 가상 id → origin 자식 해석).
3. **선행 ADR 전제 역방향 검증**: ADR-234 계열이 정적 목록 항목을 instance 자식으로 바꿨다. 그래서 원 A3 의 문제 표면이 데이터 바인딩 행으로 줄었다 (본문 Context 3). 의존 방향은 150 → 234 · 157 · 160 · 241 (완결 상태) 이고, 162 Phase 4 → 150 A2' 이다. 역방향은 없다.
4. **리뷰 순서**: 본문 재작성 뒤 리뷰 round 3 을 거친다. Phase 0 은 round 3 종결 뒤에 착수한다.

## §2 Phase 0 — inventory (G0)

코드 변경은 0 이다. 산출물은 이 절에 표로 고정한다.

1. **가족별 행 metric 입력 대조표**: ListBox · GridList (slot-only) · Table 각각에 대해 layout 쪽 (`utils.ts` §1.55b-2 · §1.55b2 · §1.55c, `canvasSceneNode.ts` 행 묶음 style) 과 window 쪽 (`collectionVirtualization.ts` resolver) 이 행 높이 · gap · padding · 헤더 높이를 어디서 읽는지 적는다. 대조 결과는 "같음" · "값만 같음 (소스 둘)" · "다름" 으로 표기한다. 이 가운데 layout 전에 알 수 있는 입력과 엔진 결과가 필요한 입력 (R1) 을 나눈다.
2. **GridList grid spacer live 1 회**: 높이 고정 + overflow scroll 을 가진 2 열 데이터 GridList 200 행을 준비한다. 스크롤 중간에서 lead spacer 옆 칸에 카드가 붙는지 확인한다 (R2 가설). 엔진이 `gridColumn: 1 / -1` (또는 span) 을 지원하는지도 확인한다 (`packages/engine` grid placement).
3. **gap 결함 재현 기록**: ListBox scroll 모드에서 행 100 · gap 2px 로 `maxScrollTop` 부족분을 unit 으로 기록한다 (Phase 1 RED 로 그대로 쓴다).
4. **데이터 행 템플릿 origin 표**: 데이터 바인딩 행 projection 중 `templateOriginId` 를 가진 가족과, 행 자식의 가상 id → origin path 가 복원되는 가족을 적는다. 후보는 GridList 펼친 카드 · ListBox 행 · Table · Tag · Tab · Breadcrumb 이다. A3' 대상은 이 표가 정한다.
5. **`resolveCollectionWriteTarget` 처분**: production 호출 0 을 재확인한다. A3' 해석기가 그 일부 (path 해석 · `assertCanonicalWriteTarget`) 를 쓰면 흡수하고, 나머지 route (data · item-override on collection 노드) 는 삭제 대상으로 둔다. 삭제는 사용자 승인 후 진행한다.
6. **stale 표기 목록**: `collectionVirtualization.ts:165-167` 주석, ADR-162 Context 의 "stride 는 상수 origin id" 서술 (Phase 1 에서 해소됨), 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview` 의 "FillStateTokens + racStateAttrs 로 이미 표시됨".

## §3 Phase 1 — A2' 행 offset 함수 (G1)

1. **함수 계약**: 입력은 가족, 시각 행 수, 행 높이 (균일 값 또는 시각 행별 목록), gap, 헤더 높이, viewport, scrollTop, overscan, columns 다. 출력은 window (시작 · 끝 index), lead · trail spacer 높이, contentHeight, maxScrollTop, 행별 offset 조회다. 균일 입력은 곱셈으로, 목록 입력은 누적합 + 이분 탐색으로 계산한다. 목록 경로는 162 Phase 4 가 쓰고, 이 phase 는 계약과 unit 만 둔다.
2. **gap 포함**: spacer = 행 수 × 높이 + (행 수 − 1) × gap. 그리고 spacer 와 인접 행 사이 gap 을 행 묶음 rowGap 이 넣는 것까지 합산이 맞도록 한다. ADR-157 sample 모드 hatch 공식 (`canvasSceneNode.ts` ListBox hatch) 과 같은 규칙이다. contentHeight 와 maxScrollTop 도 같은 결과를 쓴다.
3. **입력 소스 정렬** (§2-1 표 기준):
   - ListBox 는 명시 `height` · selected variant · inset 을 resolver 입력에 넣는다.
   - GridList 는 카드 padding · gap 을 렌더와 같은 소스 (카드 origin style · owner gap) 에서 읽는다.
   - Table 은 상수 미러를 catalog `TableRow.sizes` 읽기로 바꾸고, 요소 헤더 높이는 Column 셀 metric 함수로 계산한다 (R4).
4. **grid spacer**: §2-2 결과에 따라 두 가지 중 하나를 쓴다. 엔진이 지원하면 spacer 에 전체 열 span 을 준다. 지원하지 않으면 spacer 를 행 묶음 밖 scroll content 여백으로 옮긴다.
5. **wrap 제약 (R1)**: 균일 stride 가족의 단일 줄 가정은 함수 문서에 명시 제약으로 적는다. 줄바꿈으로 높이가 달라지는 입력은 목록 경로 (162 Phase 4) 의 소관이다.
6. **검증**:
   - unit: 함수 계약, 가족별 반례 3 개 (원복 RED).
   - `tests/parity/` browser test: 행 y 와 끝 도달 — 실 브라우저 DOM overflow scroll 을 oracle 로 쓴다.
   - live Canvas 1 회: 끝 행까지 스크롤한다.
   - 노드 수 unit 은 기존 것을 그대로 쓴다.

## §4 Phase 2 — A3' 데이터 행 origin 진입 (G2)

1. **해석기**: 입력은 hit 노드 (가상 · projected id) 와 그 행 projection (`templateOriginId` · 행 id) 이다. 출력은 origin 의 대응 자식 canonical id 이거나 null 이다. path 는 행 id 뒤 `/<path>` 로 origin 서브트리를 따라간다 (synthetic 자식 규칙 `syntheticDescendantLookup.ts` 와 같은 path 문법). null 이면 호출자는 owner 선택으로 돌아간다 (R5).
2. **진입점**: 더블클릭 handler (`useCanvasElementSelectionHandlers.ts` `handleElementDoubleClick`) 가 hit 가 데이터 행 안일 때 해석기를 부른다. 성공하면 `selectElementWithPageTransition(originChildId, originPageId)` 을 호출한다. 단일 클릭 경로 (`resolveCanvasInteractionTarget` owner 선택) 는 바꾸지 않는다.
3. **안내**: Properties 에서 선택 요소가 데이터 목록 템플릿 origin 의 자식이면 "이 원본을 쓰는 카드 전체에 적용" 을 표시한다. ADR-162 Phase 5 카드 필드 절과 같은 문구 체계를 쓴다.
4. **대상 가족**: §2-4 표에서 템플릿 origin 이 있는 가족만 대상이다. 나머지는 owner 선택을 유지한다.
5. **검증**:
   - unit: 해석기 (성공 · path 불일치 · origin 없음), 가상 id 가 selection · mutation 에 들어가지 않음 (negative), 단일 클릭 owner 회귀.
   - live: 펼친 카드 Text 더블클릭 → Components 페이지 origin 자식 선택 → 스타일 변경 → 원래 페이지 모든 카드 반영. 페이지 이동 UX 는 사용자 확인 (R3).

## §5 Phase 3 — closure (G3)

1. [ADR-911](../911-rac-pencil-target-component-architecture.md) R-3 / G-projected 문구를 본 ADR 게이트로 재정의하고 닫힘으로 표기한다. [ADR-910](../910-rac-pencil-component-architecture.md) T-7 / G-state 에 A1 철회 1 줄을 남긴다.
2. §2-6 stale 표기를 정정한다.
3. README 현황 · 실행 순서 행을 갱신한다. ADR-162 Phase 4 의 선행 조건을 "150 A2 시각 확인" 에서 "150 Phase 1 함수 계약" 으로 바꾼다. CHANGELOG 와 `### Live Exercise` 절도 채운다.
4. `/cross-check` 를 가족당 1 회 돌린다. 판독은 phase 당 1 + 수리 검증 1 로 한다 (`.claude/rules/review-loop-closure.md`).

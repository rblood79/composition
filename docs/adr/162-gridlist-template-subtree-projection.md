# ADR-162: 데이터 바인딩 GridList 카드 = 항목 origin instance (임의 자식 + 행별 `{field}`)

## Status

In Progress — Phase 0 ~ 3 · 5 완료 2026-09-26 (Phase 4 는 ADR-150 Phase 1 행 offset 함수 뒤 — 150 재작성 2026-09-26 으로 선행 조건 변경 · Phase 6 closure 남음) · Proposed 2026-07-24 · **본문 재작성 2026-09-26** (사용자 판정 "본문 재작성": [ADR-234](completed/234-variant-instances-and-slot-filled-collections.md) 이후 모델 기준으로 범위와 설계를 다시 정함)

> 재작성 사유: 07-24 판의 대안 A (composed 모드 — 별도 판정 심볼 `isComposedCollectionTemplate` + 새 투영 경로) 는 ADR-148 의 "slot = 템플릿 역할 표" 모델을 전제로 했다. ADR-234 (Implemented 2026-09-23) 가 그 모델을 정적 목록에서 "항목 origin 의 instance 를 자식으로 채운다" 로 대체했고, 데이터 바인딩 목록만 `items` + 항목 origin 템플릿으로 남겼다 (ADR-234 Decision · CHANGELOG 2026-09-23 "데이터 바인딩 GridList 는 그대로 `items`"). 07-24 판을 그대로 실행하면 같은 카드에 규칙이 둘 (정적 = instance, 데이터 = composed) 생긴다. 리뷰 기록 [reviews/162.md](reviews/162.md) round 1 (승인) 은 07-24 판 기준이라 착수 전 round 2 가 필요하다.

## Context

**사용자 요구 (2026-07-24 보고, 원래 의도 — 변함 없음)**: ① Components 페이지의 GridList 카드 템플릿에 Image · Button 등을 추가하면 모든 카드에 반영된다. ② GridList 패널에서 추가한 자식의 prop 에 데이터 컬럼을 연결한다.

**현재 코드 (2026-09-26 실측, 조사 3 갈래 + 직접 대조)**:

| 경로                                                                | 카드를 만드는 곳                                                                                                                                                                           | ① 임의 자식                                                                                                                                                                                                                                                                                                                          | ② 컬럼 연결                                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정적 GridList (ADR-234 — 카드 = GridListItem instance 자식)         | Canvas: 일반 scene visit, slot 자식은 `_slots` 로 접힘 (`canvasSceneNode.ts:3288-3301`) · DOM: `renderGridListItem` 이 자식 전부를 `context.renderElement` (`SelectionRenderers.tsx:1172`) | DOM 은 그린다. Canvas 는 미확정 — 비-slot 자식이 scene 자식이 되면 `_hasChildren` (`buildSpecNodeData.ts:1764-1772`) 으로 escape 가 shell 만 그리는데 (`skiaPrimitives.ts:411-415`) label · description 은 이미 접혀 있다                                                                                                            | 해당 없음 (행 데이터 없음)                                                                                                                            |
| 데이터 바인딩 GridList (`items`/`dataBinding` + 항목 origin 템플릿) | Canvas: `appendGridListRowProjection` (`canvasSceneNode.ts:1532`) 이 행마다 자식 없는 GridListItem 노드 · DOM: Path 1/2 (`SelectionRenderers.tsx:947-1066`) · `GridList.tsx:421-490`       | 안 된다 — 두 leg 모두 `resolveSlotComposition` (`slotRoles.ts:180` 역할 없는 자식 `continue`) 만 읽고 label · description 두 칸만 그린다 (`gridlist_card` escape `skiaPrimitives.ts:489-503` · `renderGridListItemSlotContent` `SelectionRenderers.tsx:135-172`). Preview 채널도 slot 구성만 싣는다 (`preview/App.tsx:358-361, 427`) | label · description 에만 `{field}` (Canvas `canvasSceneNode.ts:1580-1594, 1720-1727` · DOM `SelectionRenderers.tsx:79, 933-944`). 임의 prop 경로 없음 |

**round 2 리뷰 (2026-09-26, codex) 로 추가 확인한 현행**:

- Preview 는 템플릿 origin 을 전역 하나로 정한다 — `component-gridlist` 의 slot[0] (`preview/App.tsx:349-354`) 을 모든 GridList 에 전달 (`:427, 871`). Canvas 는 소유자마다 자기 slot[0] 또는 ref master 의 slot[0] (`canvasSceneNode.ts:811-820`, custom slot 테스트 `canvasSceneNode.test.ts:2253-2268`). 가상화 stride 는 상수 id (`collectionVirtualization.ts:183`).
- DOM 데이터 카드 Path 1 (`columnMapping` 또는 property binding + GridListItem 템플릿 자식, `SelectionRenderers.tsx:921-923`) 은 템플릿에 Field 자식이 있으면 Field 만 DataField 로 그린다 (`:953-994`).
- DOM GridList 는 가상화하지 않는다 — CSS grid 가 시각 행마다 가장 높은 카드로 늘린다.

**선행 결정 대조**:

- [ADR-234](completed/234-variant-instances-and-slot-filled-collections.md): 정적 목록 = 항목 instance 자식, 데이터 바인딩 목록 = `items` + 항목 origin 템플릿 유지 ("행마다 같은 변형 규칙"). 본 ADR 은 후자의 **행 모양** 을 전자와 같게 만든다 — 234 의 경계 (데이터 목록은 `items`) 는 유지.
- [ADR-159](completed/159-collection-field-template-binding.md) (Implemented 2026-07-24): `{field}` 보간 `compileFieldTemplate` / `interpolateFieldTemplate` (`packages/shared/src/collections/fieldTemplate.ts`) 과 컬럼 피커 (`useOwnerCollectionColumns.ts` · `PropertyFieldTemplateInput`). 07-24 판의 선행 의존은 해소됐다. 피커는 편집 중인 Text 의 **조상** 에서 데이터 소유자를 찾으므로, Components 페이지 origin 자식 편집에서는 뜨지 않는다 (Components 페이지는 데이터 바인딩 없음 — 09-21 사용자 판정).
- ADR-239 / 241: 두 해석기 (DOM `resolvers/canonical/index.ts:217` `applyDescendantsToTree` · Canvas `materializeSyntheticDescendants`) 가 origin 안 중첩 ref 의 자기 자식까지 펼친다. **정적 instance 트리 전용** — 데이터 행마다 origin 을 펼치는 곳은 없다 (ListBox · Table · Tag · Tab 포함 선례 0).
- ADR-238: RAC 는 역할마다 받는 slot 이름이 정해져 있어 아무 slot 이나 실으면 "Invalid slot" 크래시 (GridListItem label 실측). 비-slot 자식에 slot 속성을 달면 안 된다.
- [ADR-150](150-rac-pencil-residual-interaction-execution.md) (2026-09-26 본문 재작성): A2' = 가상화 window · spacer · contentHeight · maxScrollTop · 행 배치가 읽는 **행 offset 함수 하나** (균일 입력 = 곱셈, 시각 행별 높이 목록 = 누적합 + 이분 탐색 — 목록 경로의 계약 · unit 은 150 Phase 1). 본 ADR Phase 4 는 그 함수에 펼친 카드의 실측 · 추정 행 높이를 공급한다 (의존 방향 162 Phase 4 → 150 Phase 1). 카드 stride 의 origin 은 Phase 1 (`3b957e17b`) 에서 상수 대신 소유자별 `resolveGridListTemplateOriginId` 로 바뀌었다.

**SSOT 3-domain 분류**: D3 중심 — 카드 구성 · 크기의 Skia ↔ DOM 대칭. 카드 안 콘텐츠는 RAC GridListItem 이 허용하는 자식 범위라 D1 무변경 (slot 속성은 RAC 가 받는 역할 자식에만 — ADR-238). 데이터 매핑은 159 의 `{field}` 문법 소비로 D2 신규 prop 없음.

**Hard Constraints**:

1. 행 규칙 하나 — 데이터 행 카드는 같은 origin 의 정적 카드 instance 와 **같은 노드 모양** 으로 만든다 (별도 판정 심볼 · 별도 렌더 모드 금지).
2. BC — slot 자식만 가진 템플릿 (현재 문서 전부) 의 데이터 행은 Canvas 픽셀 · DOM 구조 무변경. 스키마 필드 추가 0 → 재직렬화 0 B.
3. D3 대칭 — 비-slot 자식이 있는 카드의 Skia 결과 = DOM 결과 (parity test + live).
4. 행 높이 한 곳 — 가상화 offset · 컨테이너 높이 · 실제 카드 높이가 같은 값을 읽는다 (ADR-160 원칙). DOM 은 가상화하지 않고 CSS grid 가 **시각 행마다 가장 높은 카드** 로 행을 늘린다 (`GridList.css:31` `repeat(var(--gl-columns, 2), 1fr)` · `align-items` 기본 stretch) — `{title}` 처럼 길이가 다른 값이 들어가면 행 높이가 행마다 다르다. 단일 stride 는 이 입력에서 성립하지 않는다 (round 2 h1).
5. 템플릿 origin 은 소유자별 — 같은 페이지의 두 데이터 GridList 가 서로 다른 항목 origin 을 slot 에 두면 두 leg 가 각자 그 origin 을 읽는다 (round 2 h2).
6. 보간 한 곳 — `{field}` 파싱은 159 의 두 심볼만 (자체 파싱 0 — 159 grep gate).
7. 성능 — 펼친 자식은 가상화 window 안의 행만 (노드 수 ≤ window 행 × 템플릿 노드 수). 60Hz floor p95 유지.

**Soft Constraints**: GridList 먼저. ListBox 데이터 경로 (같은 한계) · Menu (정적 경로에서도 비-slot 자식을 뺀다 — `CollectionRenderers.tsx:1052-1130`) 는 범위 밖. publish 는 기능 링크만 (메모리 `project-publish-link-only-defer-until-builder-stable`).

**Generator 선언**: catalog 경로 — Spec CSS Generator 확장 없음. 펼친 자식은 각 컴포넌트의 기존 catalog binding / renderer 를 그대로 쓴다.

## Alternatives Considered

### 대안 A: 데이터 행 = 항목 origin 의 가상 instance (정적 카드와 같은 규칙) + 159 보간

- 설명: 데이터 행마다 항목 origin 의 해석된 자식 트리를 행 카드 아래에 펼친다 (id `${행 projection id}::${origin 자식 id}`). 자식의 string prop 에 159 보간을 행별로 적용한다. 접기 규칙은 정적 카드와 하나로 둔다 — 카드 자식이 전부 slot 역할이면 지금처럼 `_slots` 로 접고 escape 가 카드를 그린다 (BC). 비-slot 자식이 하나라도 있으면 reusable origin 이 이미 쓰는 **펼침 경로** (자식 전부 scene 노드 · escape = shell — `canvasSceneNode.ts:3288-3291`, `skiaPrimitives.ts:411-415`) 를 탄다. DOM 은 같은 조건에서 `renderGridListItem` (정적 카드 경로) 로 행을 그린다.
- 근거: RAC collection 은 정적 children 과 `items` + render 함수가 **같은 항목 컴포넌트** 를 그린다 — render 함수 안이 정적 항목과 같은 모양이다. Figma · Framer 의 collection list 도 "행 = 컴포넌트 instance + 필드 바인딩" 이다. 프로젝트 안에는 reusable origin 펼침 경로 (07-17) 와 ADR-234 정적 카드가 이미 있다.
- 위험:
  - 기술: **H** — 비-slot 자식이 있는 템플릿은 카드 높이가 공식이 아니라 자식 크기와 행 데이터에 달려 (행마다 다름), 가상화 offset (scene build 시점 = layout 전) 과 엔진 실측 사이 순서 문제가 생기고 균일 stride 가 깨진다 (07-24 리뷰 m1 · round 2 h1 과 같은 축).
  - 성능: M — window 행 × 템플릿 노드. window cap 으로 상한.
  - 유지보수: L — 접기 규칙 하나를 정적 · 데이터 · origin 이 공유. 새 모드 없음.
  - 마이그레이션: L — 스키마 변경 0, slot-only 템플릿은 경로 무변경.

### 대안 B: composed 모드 (07-24 판 대안 A)

- 설명: `isComposedCollectionTemplate` 판정 심볼 + 데이터 행 전용 서브트리 투영 + 전용 높이 resolver `resolveComposedCardMetric`.
- 근거: 07-24 판 결정. 당시에는 정적 카드도 가상 행이라 별도 모드가 유일한 길이었다.
- 위험:
  - 기술: **H** — 대안 A 와 같은 높이 축.
  - 성능: M.
  - 유지보수: **H** — ADR-234 이후 정적 카드 (instance) 와 데이터 카드 (composed) 가 다른 규칙으로 같은 origin 을 읽는다. 정적 카드 경로 수리가 데이터 카드에 전파되지 않는다.
  - 마이그레이션: L.

### 대안 C: 데이터 행을 문서의 실제 instance 자식으로 기록

- 설명: 데이터를 불러올 때 행마다 GridListItem ref 자식을 canonical 문서에 쓴다 (정적 목록으로 변환).
- 근거: ADR-234 정적 목록 경로를 그대로 재사용 — Canvas · DOM 모두 코드 추가가 가장 적다.
- 위험:
  - 기술: M — 데이터 변경마다 문서 쓰기 · history 기록.
  - 성능: **H** — 10k 행 데이터면 문서 노드 10k × 템플릿 노드 (가상화가 문서 크기를 줄이지 못한다).
  - 유지보수: **H** — 투영 id 가 문서 · IndexedDB 로 들어간다 (render-space 경계 위반 — canvas-rendering.md §9). RAC 의 데이터 경로 (`items` + render) 를 버린다 (D1 과 어긋남).
  - 마이그레이션: M — 바인딩 목록 전부 재직렬화.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | H    | M    | L        | L            |     1      |
| B    | H    | M    | H        | L            |     2      |
| C    | M    | H    | H        | M            |     2      |

루프 판정: 모든 대안이 HIGH 1 개 이상. A 의 HIGH (높이 순서) 는 B 도 같이 갖는 축이라 회피 대안이 없고, C 는 높이 축을 피하는 대신 성능 · 경계 HIGH 2 개를 만든다. 1 회 루프에서 "카드 높이 고정 (템플릿 높이 + 텍스트 줄 수 제한을 두 leg 에 강제)" 안을 검토했다. 균일 stride 가 되돌아오지만 요구 ① (추가한 대로 반영) 을 깎고, Skia 줄 수 제한 · CSS line-clamp 를 새로 맞춰야 해 대칭 표면이 늘어난다. A 의 실패 시 대안으로만 둔다 (G3). A 의 HIGH 는 **시각 행별 높이 가상화** (측정 캐시 + 추정 + scroll anchoring — TanStack Virtual `measureElement` · react-window `VariableSizeList` 와 같은 방식) 로 Gate G3 에서 관리한다.

## Decision

**대안 A: 데이터 행 = 항목 origin 의 가상 instance (정적 카드와 같은 규칙) + 159 보간** 을 선택한다.

선택 근거:

1. 요구 ① · ② 를 데이터 바인딩 목록에서 충족하면서 카드 규칙을 하나로 둔다 — 정적 카드 · 데이터 카드 · origin 카드가 같은 접기 규칙과 같은 렌더 경로를 쓴다. ADR-234 의 방향 (RAC 두 collection 경로 = 같은 항목 모양) 과 같다.
2. 새 메커니즘은 넷이다: 행별 origin 펼침 (해석기 재사용), 행별 보간 적용 (159 소비), 소유자별 템플릿 origin 해석 한 곳 (Canvas scene · 가상화 · Preview 가 같은 함수), 비-slot 템플릿의 시각 행별 높이 가상화. 07-24 판의 판정 심볼 · 전용 resolver 는 빠진다.
3. 잔존 HIGH (높이) 는 B 와 공통이며, slot-only 템플릿은 공식 · 균일 stride 경로를 그대로 써서 영향 범위가 비-slot 자식을 추가한 문서로 한정된다.
4. 기존 Field 템플릿 (Path 1 — `SelectionRenderers.tsx:953` Field 가 있으면 Field 만 그림) 은 legacy 로 고정한다: Field 자식이 하나라도 있는 템플릿은 새 규칙을 타지 않고 두 leg 모두 현행 그대로 (DOM Δ0). ADR-147/148 이 폐기한 메타 노드 모델이라 병합 규칙을 새로 만들지 않는다.

기각 사유:

- **대안 B 기각**: ADR-234 이후 같은 origin 을 두 규칙이 읽는다 — 유지보수 HIGH. 정적 카드 수리가 데이터 카드에 전파되지 않는다.
- **대안 C 기각**: 투영 id 가 문서에 들어가고 (render-space 경계), 대량 데이터에서 문서가 커진다. RAC 데이터 경로를 버린다.

> 구현 상세: [162-gridlist-template-subtree-projection-breakdown.md](design/162-gridlist-template-subtree-projection-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                           |  심각도  | 대응                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 비-slot 템플릿 카드 높이가 행마다 다르다 (`{title}` 길이 · 줄바꿈). 가상화는 균일 stride (`collectionVirtualization.ts:169-224` 행 간격 · `:389-404` spacer · window index · maxScrollTop) 를 가정하고, 컨테이너 높이 §1.55c (`utils.ts:3034` 이후) · 카드 metric §1.55b2 (`utils.ts:2955-3030`) 도 공식이다. 첫 행 하나로 stride 를 정하면 긴 행에서 spacer · 스크롤 위치가 어긋나고 window 가 움직일 때 값이 바뀌어 진동한다 | **HIGH** | G3 — 시각 행별 높이 가상화: 행 높이 = 그 시각 행의 카드 중 최대 (DOM grid stretch 와 같음), 실체화된 행은 엔진 실측을 캐시, 아직 안 본 행은 추정 (템플릿 공식), offset = 시각 행 높이의 누적합, 추정 → 실측 교체 시 화면 첫 행을 고정 (scroll anchoring) |
| R2  | 소유자별 origin 불일치 — Canvas 는 소유자의 slot[0] (`canvasSceneNode.ts:811-820`), 가상화 stride 는 상수 `GRIDLIST_ITEM_DEFAULT_ORIGIN_ID` (`collectionVirtualization.ts:183`), Preview 는 전역 `component-gridlist` slot 하나 (`preview/App.tsx:349-354, 427, 871`). origin 이 다른 GridList 두 개면 leg 마다 다른 자식을 그린다 (slot 구성만 쓰는 지금도 같은 비대칭)                                                       | **HIGH** | G2 — 소유자별 origin 해석 함수 하나를 shared 로 옮겨 Canvas scene · 가상화 · Preview 가 호출. Preview 는 소유자 id 별로 구성 · 자식 트리를 싣는다 (전역 1 개 채널 폐지)                                                                                  |
| R3  | 정적 카드 경로 자체가 비-slot 자식에서 어긋날 수 있다 — **G0 (2026-09-26) 결과: 정적 ref 카드는 항상 펼침이라 문제 없음**, ref 가 아닌 카드 (detach · legacy) 만 자식 단위 접기로 label 이 사라진다 (정적 판독)                                                                                                                                                                                                                |   MED    | Phase 1 — 접기 조건을 카드 단위 (전부 slot 일 때만 접기) 로. unit 반례 = detach 카드 + Image                                                                                                                                                             |
| R4  | slot-only · Field 데이터 행 회귀 — 접기 규칙 변경이 기존 카드를 바꾼다                                                                                                                                                                                                                                                                                                                                                         |   MED    | G1 — slot-only 문서 Canvas 픽셀 · DOM 구조 Δ0, Field 템플릿 문서 DOM Δ0 (legacy 고정), 기존 gridlist 테스트 전량 GREEN                                                                                                                                   |
| R5  | Field 템플릿 (Path 1) 과 새 규칙의 우선순위 — Field 가 있으면 Field 만 그리는 분기 (`SelectionRenderers.tsx:953-1013`) 를 새 규칙이 덮으면 기존 카드가 바뀌고, 그대로 두면 같은 카드의 Image 가 빠진다                                                                                                                                                                                                                         |   MED    | Decision 4 — Field 가 하나라도 있으면 legacy (두 leg 현행). Phase 0 에서 Field 템플릿 문서 수를 세고, 0 이 아니면 Field → Text `{key}` 이관을 별도 결정으로 올린다                                                                                       |
| R6  | 펼친 자식의 선택 · 이동 — projection kind 미등록이면 클릭 무반응 또는 투영 id 가 선택 · 문서로 들어간다 (`resolveCanvasInteractionTarget.ts:131-158` "신규 family 추가 시 OR + ProjectionLike union 동시 갱신")                                                                                                                                                                                                                |   MED    | 펼친 자식이 행 projection 을 물려받아 owner GridList 로 redirect. 투영 id 문서 유입 negative test (G1)                                                                                                                                                   |
| R7  | 보간 범위 — 모든 string prop 에 보간하면 사용자가 쓴 `{`…`}` 글자가 바뀐다 · 자체 파싱 유입                                                                                                                                                                                                                                                                                                                                    |   MED    | 바인딩 가능 prop 허용표 하나를 Canvas · DOM · 패널이 공유. 159 grep gate                                                                                                                                                                                 |
| R8  | 성능 — window 행 × 템플릿 노드 + 행 높이 캐시                                                                                                                                                                                                                                                                                                                                                                                  |   MED    | G4 — 대조 arm (slot-only 같은 행 수) 과 `scene.build` A/B, 불리 조작 (origin 편집 · 스크롤) 포함                                                                                                                                                         |

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                                                               |
| ---- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0        | 정적 GridList 카드 instance 의 origin 에 Image 를 추가 → Canvas 카드가 label · description · Image 를 모두 그리는지 live 1 회 (실제 builder, 팔레트 경로). Preview 쪽은 DOM parity test (Preview iframe · Compare Mode 는 열지 않는다) · Field 템플릿 문서 수 (seed + 사람이 만든 문서) 집계                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 어긋나면 R3 — Phase 1 에서 접기 규칙과 함께 수리                                                           |
| G1   | Phase 1 · 3 후 | slot-only 템플릿: 데이터 행 · 정적 카드 Canvas 픽셀 Δ0 (대조 arm = 변경 전 빌드, 사람이 만든 문서 + seed 문서) · Field 템플릿 (`columnMapping` + Field 1 + origin Image 1 반례 포함): DOM 구조 Δ0 · 기존 gridlist 테스트 전량 GREEN · 투영 id 문서 유입 0 · type-check 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 접기 규칙 원복, 비-slot 경로만 flag 로 격리                                                                |
| G2   | Phase 1 · 3 후 | (a) 소유자별 origin: 기본 origin 과 custom origin 을 slot 에 둔 데이터 GridList 2 개 — 두 leg 가 각자 자기 origin 자식을 그린다 (Canvas scene unit + DOM render unit, 원복 RED) · 가상화도 같은 origin 을 읽는다. (b) 비-slot 템플릿 (Image + Button + 중첩 Frame) 데이터 카드: Skia 상자 = DOM `getBoundingClientRect` (±1, `tests/parity/` browser test — oracle 은 실 브라우저) + live Canvas 1 회 + Preview 는 사용자 확인                                                                                                                                                                                                                                                                                                                                                                                                                             | 비대칭 축 root cause 후 재검증                                                                             |
| G3   | Phase 4 후     | 반례 입력 = 2 열 GridList, 1 행 짧은 `{title}` · 2 행 3 줄 `{title}` 교대, 200 행. (a) 가상화가 모든 행을 실체화하는 크기 (window ≥ 행 수) 에서 시각 행 y · 높이 = DOM (±1). (b) **중간 행을 건너뛴 끝 이동** (스크롤 thumb 을 끝으로 — 중간 행은 추정으로 남는다): 마지막 시각 행이 viewport 아래 끝에 완전히 보이고 (끝 고정 anchoring), 보이는 행들의 상대 y · 높이 = DOM 의 같은 행들 (±1). 이때 총 높이는 게이트가 아니다 — Σ실측 + Σ추정 과 DOM `scrollHeight` 의 차이를 기록만 한다. (c) **모든 행을 측정한 뒤** (처음부터 끝까지 순차 스크롤): content 총 높이 = DOM `scrollHeight` (±1). (d) 추정 → 실측 교체 때 기준 행 (끝 도달 상태면 마지막 행, 아니면 화면 첫 행) 의 화면 y 변화 0 · 같은 스크롤 위치에서 두 번 연속 build 의 window · offset 동일 (진동 0). 불리 케이스: 스크롤 중 origin 편집 · breakpoint 전환 (열 수 변경 = 캐시 무효화) | 비-slot 템플릿에 카드 높이 고정 (템플릿 높이 + 줄 수 제한, 두 leg) 또는 가상화 끄기 (window cap 정적 상한) |
| G4   | Phase 6        | 같은 세션 headed A/B — 대조 arm = slot-only 같은 행 수 · 실험 arm = 비-slot 3 자식 템플릿 · 20 행 window · 불리 조작 (origin 편집 · 스크롤로 가시 집합 변경) · warm-up 3 · visibilityState visible · `scene.build` p95 median Δ 기록, 60Hz floor p95 유지 · 노드 수 ≤ window 행 × 템플릿 노드                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | window overscan 축소 또는 펼침 노드 상한                                                                   |

## Consequences

### Positive

- 데이터 바인딩 GridList 도 템플릿에 추가한 대로 카드에 나온다 — 정적 카드와 같은 모양이라 사용자가 두 목록 차이를 배울 필요가 없다.
- 카드 규칙이 하나다 — 접기 · 펼침 규칙 수리가 정적 · 데이터 · origin 카드에 한 번에 적용된다.
- 템플릿 origin 해석이 한 곳이 된다 — 지금 있는 소유자별 origin 비대칭 (Canvas 소유자 slot vs Preview 전역 slot) 도 같이 없어진다.
- `{field}` 가 label · description 밖 (Image src · Button 글자 등) 으로 넓어진다 — 159 문법 그대로.
- ListBox 데이터 경로에 같은 규칙을 옮길 수 있다 (후속).

### Negative

- 비-slot 템플릿의 가상화는 아직 안 본 행을 추정으로 둔다 — 모든 행을 한 번 볼 때까지 총 높이 · 스크롤바 길이가 DOM 과 다를 수 있고 스크롤하며 바뀐다. 보이는 행의 위치 · 끝 도달은 anchoring 으로 보장한다 (G3 b · d). 미측정 행의 정확한 높이를 미리 얻는 독립 측정 (행마다 격리 layout) 은 행 수에 비례하는 비용이라 1 차 범위에서 제외.
- 펼친 카드는 escape 단일 paint 대신 실제 노드 트리라 카드당 비용이 크다 (window 로 상한).
- Field 템플릿은 legacy 로 남는다 — 그 카드에 Image 를 넣어도 나오지 않는다 (Field 이관은 별도 결정).
- 컬럼 피커는 Components 페이지 origin 편집에서 데이터 소유자를 조상으로 찾지 못한다 — GridList 패널에서 편집하는 경로를 새로 둔다 (Phase 5).
- 1 차 범위: origin 공유 매핑만 (instance 별 매핑 없음) · 인터랙티브 자식의 행 컨텍스트 이벤트 없음. slot-only 템플릿의 긴 label 줄바꿈은 현행 공식 그대로 (본 ADR 범위 밖).

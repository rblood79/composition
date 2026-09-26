# ADR-150 Breakdown: 데이터 바인딩 목록의 Canvas 정합

> [ADR-150](../150-rac-pencil-residual-interaction-execution.md) 의 구현 상세다. 2026-09-26 본문 재작성과 함께 새로 썼다. 이전 판 (3축 A1 · A2 · A3, 07-13 ~ 07-20 실행 기록) 은 git `7519dee51` 의 이 파일에 있다.

## §1 Fork 확인 (2026-09-26)

사용자 판정은 2026-09-26 AskUserQuestion 으로 받았다.

- ADR 구조: **"본문 재작성"** 을 골랐다. 다른 선택지는 "150 종결 + 결함은 /fix", "A2 를 162 로 흡수" 였다.
- 데이터 행 진입: **"origin 자식 선택"** 을 골랐다. 다른 선택지는 "진입 없음 · 패널만", "행 값 편집까지" 였다.

아래는 4 질문 확인 결과다.

1. **base / 응용 분류**: 150 A2' 는 행 offset 함수이고 base 다. [ADR-162](../completed/162-gridlist-template-subtree-projection.md) Phase 4 는 펼친 카드의 행 높이를 공급하고 응용이다. 150 A3' 와 162 Phase 5 는 같은 Properties 표면을 쓰는 형제 관계이고, 쓰기 대상은 둘 다 origin 문서다.
2. **schema 직교성**: canonical schema · catalog · prop 변경이 모두 0 이다. 새 타입은 render-space 전용이다 (행 offset 결과, 가상 id → origin 자식 해석).
3. **선행 ADR 전제 역방향 검증**: ADR-234 계열이 정적 목록 항목을 instance 자식으로 바꿨다. 그래서 원 A3 의 문제 표면이 데이터 바인딩 행으로 줄었다 (본문 Context 3). 의존 방향은 150 → 234 · 157 · 160 · 241 (완결 상태) 이고, 162 Phase 4 → 150 A2' 이다. 역방향은 없다.
4. **리뷰 순서**: 본문 재작성 뒤 리뷰 round 3 을 거친다. Phase 0 은 round 3 종결 뒤에 착수한다.

## §2 Phase 0 — inventory (G0)

코드 변경은 0 이다. 산출물은 이 절에 표로 고정한다.

1. **가족별 행 metric 입력 대조표**: ListBox · GridList (slot-only) · Table 각각에 대해 layout 쪽 (`utils.ts` §1.55b-2 · §1.55b2 · §1.55c, `canvasSceneNode.ts` 행 묶음 style) 과 window 쪽 (`collectionVirtualization.ts` resolver) 이 행 높이 · gap · padding · 헤더 높이를 어디서 읽는지 적는다. 대조 결과는 "같음" · "값만 같음 (소스 둘)" · "다름" 으로 표기한다. 이 가운데 layout 전에 알 수 있는 입력과 엔진 결과가 필요한 입력 (R1) 을 나눈다.
2. **GridList grid spacer live 1 회**: 높이 고정 + overflow scroll 을 가진 2 열 데이터 GridList 200 행을 준비한다. 스크롤 중간에서 lead spacer 옆 칸에 카드가 붙는지 확인한다 (R2 가설). 엔진이 `gridColumn: 1 / -1` (또는 span) 을 지원하는지도 확인한다 (`packages/engine` grid placement).
3. **결함 재현 기록 (Phase 1 · 2 RED 로 그대로 쓴다)**:
   - ListBox scroll 모드에서 행 100 · gap 2px 로 `maxScrollTop` 부족분을 unit 으로 기록한다.
   - round 3 probe 2 개를 저장소 unit 으로 옮긴다 (원본 `/private/tmp/adr150-review-20260926-probe.test.ts`). 하나는 description 교대 ListBox 100 행 (32 · 50px, resolver 3200 대 실제 4100) 이고, 다른 하나는 펼친 GridList 카드의 서로 다른 Text 자식 두 개가 모두 owner id 로 도착하는 경로다.
4. **데이터 행 템플릿 origin 표**: 데이터 바인딩 행 projection 중 `templateOriginId` 를 가진 가족과, 행 자식의 가상 id → origin path 가 복원되는 가족을 적는다. 후보는 GridList 펼친 카드 · ListBox 행 · Table · Tag · Tab · Breadcrumb 이다. A3' 대상은 이 표가 정한다.
5. **`resolveCollectionWriteTarget` 처분**: production 호출 0 을 재확인한다. A3' 해석기가 그 일부 (path 해석 · `assertCanonicalWriteTarget`) 를 쓰면 흡수하고, 나머지 route (data · item-override on collection 노드) 는 삭제 대상으로 둔다. 삭제는 사용자 승인 후 진행한다.
6. **stale 표기 목록**: `collectionVirtualization.ts:165-167` 주석, ADR-162 Context 의 "stride 는 상수 origin id" 서술 (Phase 1 에서 해소됨), 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview` 의 "FillStateTokens + racStateAttrs 로 이미 표시됨".

### §2 Phase 0 결과 (2026-09-27 고정)

조사 2 갈래 (Explore) + 직접 대조 + live 1 회 + unit RED 4. 제품 코드 변경 0. 약칭: U = `layout/engines/utils.ts`, S = `scene/canvasSceneNode.ts`, V = `scene/collectionVirtualization.ts`, M = `packages/specs/src/renderers/utils/collectionItemMetrics.ts`.

#### §2-1 가족별 행 metric 입력 대조표

판정: 같음 / 값만 같음 (소스 둘) / 다름 / window 에 없음. "layout 전" 열은 scene build 시점에 알 수 있는지다.

| 가족            | 입력                   | layout 쪽                                                                                    | window 쪽                                                   | 판정                        | layout 전         |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------- | ----------------- |
| ListBox         | 행 높이 공식           | `resolveListBoxItemRowHeightFromStyle` (U:2954-3001), enrich 가 행 border 가산 (U:5656-5659) | 같은 함수, wrap · inset · border 없음 (V:278-311)           | 같음 (입력은 아래처럼 다름) | 예                |
| ListBox         | description 유무       | 행마다 (U:2956-2962, S:1362-1368)                                                            | 첫 행 하나 (V:365-386)                                      | 다름                        | 예 (전체 행 스캔) |
| ListBox         | 선택 variant style     | `{...anchor, ...selectedOriginStyle}` (S:1147-1160)                                          | 없음                                                        | window 에 없음              | 예                |
| ListBox         | responsive override    | `resolveResponsiveStyleMap` (S:1132-1143)                                                    | raw `props.style` (V:290-291)                               | 다름                        | 예                |
| ListBox         | 명시 height            | §1 우선 반환 (U:2620-2622)                                                                   | 읽지 않음                                                   | window 에 없음              | 예                |
| ListBox         | gap                    | rowsGroup `rowGap` (S:1252-1288, catalog 기본 2)                                             | 없음 (V:404-406)                                            | window 에 없음              | 예                |
| ListBox         | owner padding · border | scroll content 에 포함 (catalog 기본 4 · 1)                                                  | `maxScrollTop = n·h − H` (V:406-407)                        | window 에 없음              | 예                |
| ListBox         | 폭 (wrap)              | `wrapContext` 여러 줄 (U:2974-2993)                                                          | 단일 줄                                                     | window 에 없음              | **아니오**        |
| GridList (접힌) | 카드 높이              | §1.55c `padY·2 + border·2 + sel + label + desc` (U:3192-3199)                                | `padY·2 + sel + label + desc` — **border 없음** (V:221-225) | 다름 (카드당 2px)           | 예                |
| GridList (접힌) | description 유무       | 카드마다, 시각 행 = 그 행 최대                                                               | 첫 행 하나 (V:188-191)                                      | 다름                        | 예                |
| GridList (접힌) | 카드 padding           | 카드 origin style (U:5680)                                                                   | owner fontSize 분기 metric (M:493-511)                      | 값만 같음 (기본값 한정)     | 예                |
| GridList (접힌) | gap                    | `props.gap ?? 12` (S:1584, 1690)                                                             | `style.gap ?? 12` (M:493-500)                               | 다름 (축이 다름)            | 예                |
| GridList (접힌) | 열 수                  | S:1581-1583                                                                                  | V:177-182                                                   | 값만 같음                   | 예                |
| GridList (접힌) | 폭 (wrap)              | 열 트랙 폭으로 측정                                                                          | 단일 줄                                                     | window 에 없음              | **아니오**        |
| Table           | 행 높이                | catalog `TableRow.sizes` L3 주입 (추론)                                                      | 상수 미러 36/44/52 (V:144-156)                              | 값만 같음                   | 예                |
| Table           | 헤더 (요소)            | Column §1.56 = 24 + 8·2 = **40** (U:2798-2827)                                               | `1 × rowHeight` = 44 (V:362, 405)                           | 다름 (md 4px)               | 예                |
| Table           | gap                    | 0                                                                                            | 0                                                           | 같음                        | 예                |

ListBox 합산식 (n 행, window [s, e), k = e − s, 높이 h, gap g): 실제 content = n·h + (n − 1)·g, 가상화 content = n·h + (k + [s>0] + [e<n] − 1)·g (spacer 에 gap 없음 — 스크롤 위치마다 g 단위로 흔들린다), resolver = n·h. 기본값 (padding 4 · border 1 · g 2) 에서 끝 도달 부족 = 10 + (n − 1)·2 px 수준.

#### §2-2 GridList grid spacer — live (R2 판정: **가설 성립**)

`apps/builder/scripts/adr150-p0-grid-spacer-live.mjs` (실제 builder, Playwright headful, 2 열 데이터 GridList 200 행 · 400×300 · overflowY auto).

- scrollTop 0: trail spacer `x 0 · w 194 · h 7740` — 한 칸만 차지.
- scrollTop 3000: lead spacer `x 0 · y 0 · w 194 · h 2408`, 첫 window 카드 r56 이 **spacer 옆 칸 `x 206 · y 0`**, r57 이 다음 grid 행 `x 0 · y 2420`. 이후 **카드 열이 뒤바뀐다** (스크린샷: 왼쪽 열 Row 71 · 73 · 75, DOM 은 짝수가 왼쪽).
- `maxScrollTop` 이 스크롤 위치에 따라 8320 (top) · 8256 (mid) 으로 흔들린다.
- 엔진 지원: 자체 Rust 엔진이 `span` 과 음수 라인을 처리한다 (`packages/engine/src/grid.rs:896-930`, `-1` = 마지막 명시 라인). 단 shorthand `gridColumn` 은 운반되지 않고 longhand `gridColumnStart` / `gridColumnEnd` 만 간다 (`fullTreeLayout.ts:1084-1087`). → Phase 1 은 spacer 에 `gridColumnStart: "1", gridColumnEnd: "-1"` 을 준다 (행 묶음 밖 이전안은 불요).

#### §2-3 결함 재현 RED

`scene/adr150Phase0Red.test.ts` — 4 건 `it.fails` (기대 동작을 단언). 일반 `it` 으로 돌려 **전제 통과 · 마지막 단언 실패** 를 확인했다: ① gap 만 (3200 vs 3398) ② description 교대 (3200 vs 4298) ③ `sourceHit` 없음 (undefined) ④ 카드 A → B 가 double-click (true). Phase 1 · 2 가 고치면 `it` 으로 바꾼다.

#### §2-4 데이터 행 템플릿 origin 표

| 가족                         | `templateOriginId`                                          | 행 안 자식                                                    | 가상 자식 → origin 자식                                                                | A3'                               |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| GridList 펼친 카드 (ADR-162) | 채움 (S:1593-1596, 1828) + 행 `ref` · `descendants`         | 있음 — `${rowId}/${path}` (canonicalRefResolution.ts:967-970) | 가능 — path 구간 = `getCanonicalRefPathSegment` (customId ‖ componentName ‖ name ‖ id) | **대상 (자식 단위)**              |
| GridList 접힌 카드           | 채움                                                        | 없음 (`_slots` 만)                                            | origin 루트만                                                                          | 대상 (origin 루트)                |
| ListBox                      | 채움 — 상수 fallback 은 문서 존재 미확인 (S:750-765)        | 없음                                                          | origin 루트만. 선택 행도 기본 origin                                                   | 대상 (origin 이 문서에 있을 때만) |
| TagGroup                     | 채움 (chip 선택 반영, S:2555-2557) · `__show_all__` 은 null | 없음                                                          | origin 루트만                                                                          | 대상 (`__show_all__` 제외)        |
| Tabs                         | 채움 (S:2915-2917)                                          | 없음                                                          | origin 루트만                                                                          | 대상 (origin 루트)                |
| Table (row · cell)           | 항상 null                                                   | chip `${cellId}::tag-${i}` (path 문법 아님)                   | 불가                                                                                   | **비대상**                        |
| Breadcrumbs                  | 항상 null                                                   | 없음                                                          | 불가                                                                                   | **비대상**                        |

해석 규칙 (Phase 2 입력으로 고정):

- **행 id 에 `/` 가 들어갈 수 있다** (ref instance 안 TagList · TabList owner 가 synthetic id). 첫 `/` 로 자르지 않는다. `sourceHit.projection` 의 `listBoxId` · `itemKey` 로 `toCollectionRowProjectionId` 를 다시 만들고 `hitId.startsWith(rowId + "/")` 로 path 를 뗀다.
- **path 로 걷기**가 1 차다. 공용 함수는 없고 private 복제 2 개 (`collectionItemInsert.ts:117` · `tableColumnInsert.ts:57`) 가 있어 공용으로 뽑는다. 구간 이름은 canonical 노드에서 `readLegacyMetadataCustomId` (legacyMetadata.ts:53) 를 같이 읽는다.
- **중첩 ref (origin 안 instance)**: 결과는 `<바깥 origin 안 중첩 ref id>/<나머지 path>` (synthetic 자식 선택 — 쓰기는 그 ref 의 `descendants[path]`, inspectorActions.ts:1013-1014) 로 한다. 중첩 master 자식 (편집이 그 컴포넌트 전체로 퍼짐) 은 쓰지 않는다 — "이 원본을 쓰는 카드 전체" 의도와 맞는 쪽.
- 가상 자식 scene 노드의 `sourceNode.id` (canonicalRefResolution.ts:1212 spread · S:659) 는 중첩이 아닐 때 path 결과와 같아야 한다 — 교차 확인용 unit 으로만 쓴다.
- origin 페이지: `getLastProjectableNodeLookupById(originId)?.pageId` (canonicalTraversalHelpers.ts:601).
- **발견 (범위 밖 기록)**: 형제 구간 이름이 같으면 synthetic id 가 겹친다 (충돌 처리 grep 0). 정적 instance 에도 같은 축이라 150 범위 밖 — Phase 2 반례는 서로 다른 이름을 쓰고 closure 에 잔여로 기록한다.

#### §2-5 `resolveCollectionWriteTarget` 처분

production import 0 (주석 참조 4 곳뿐), 테스트 1 파일 (it 9). path 해석 코드가 없고 override route 는 현재 저장 모델과 의미가 다르다. **파일 전체를 삭제 후보**로 둔다 — `assertCanonicalWriteTarget` 의 "출력 id 자기 검사" 만 Phase 2 해석기에 다시 쓴다. 삭제는 사용자 승인 뒤 (Phase 2 또는 closure). 삭제 시 `isCollectionRowProjectionKind` 는 해석기가 쓰면 남고 `isCollectionCellProjectionKind` · `isCollectionRowsGroupProjectionKind` 는 호출처 0 이 된다.

#### §2-6 추가 stale 표기

위 목록에 더해 `canvasSceneNode.ts:968-971 · 1718-1721` (spacer 가 wrap-flow 에서 행 점유 — grid 전환 전 서술), `:1311` · `utils.ts:2876` ("rowsGroup gap 0"), `collectionVirtualization.ts:159-163` ("§1.55c 와 동일 공식" — border 빠짐).

## §3 Phase 1 — A2' 행 offset 함수 (G1)

1. **함수 계약**: 입력은 가족, 시각 행 수, 행 높이 (균일 값 또는 시각 행별 목록), gap, 헤더 높이, viewport, scrollTop, overscan, columns 다. 출력은 window (시작 · 끝 index), lead · trail spacer 높이, contentHeight, maxScrollTop, 행별 offset 조회다. 균일 입력은 곱셈으로, 목록 입력은 누적합 + 이분 탐색으로 계산한다. **목록 경로는 이 phase 에서 production 으로 연결한다** (아래 2).
2. **행별 높이 공급자 (round 3 h2)**: layout 전에 알 수 있는 행별 차이를 layout 과 같은 metric 함수로 행마다 계산한다.
   - ListBox: 행마다 description 유무 · 선택 variant style (`selectedOriginStyle`) 을 넣어 `resolveListBoxItemRowHeightFromStyle` 로 높이를 구한다. 이 함수는 layout §1.55b-2 와 같은 함수다.
   - slot-only GridList: 카드마다 description 유무로 카드 높이를 구하고, 시각 행 높이는 그 행 카드들의 최대로 둔다 (DOM grid stretch 와 같다).
   - Table: 행 높이는 균일 (catalog `TableRow.sizes`) 이고, 헤더만 따로 둔다.
   - 목록은 행 데이터 (collection 버전) · owner metric · 선택 상태가 바뀔 때만 다시 만든다. scroll 은 목록을 다시 만들지 않는다 (HC5). 모든 값이 같으면 균일 경로로 내린다.
   - 펼친 GridList 카드 (엔진 실측) 는 이 공급자 밖이며 ADR-162 Phase 4 가 같은 목록 입력에 실측값을 넣는다.
3. **gap 포함**: spacer = 행 수 × 높이 + (행 수 − 1) × gap. 그리고 spacer 와 인접 행 사이 gap 을 행 묶음 rowGap 이 넣는 것까지 합산이 맞도록 한다. ADR-157 sample 모드 hatch 공식 (`canvasSceneNode.ts` ListBox hatch) 과 같은 규칙이다. contentHeight 와 maxScrollTop 도 같은 결과를 쓴다.
4. **입력 소스 정렬** (§2-1 표 기준):
   - ListBox 는 명시 `height` · selected variant · responsive override (`resolveResponsiveStyleMap`) · inset · 행 border 를 resolver 입력에 넣는다.
   - GridList 는 카드 padding · border (`cardBorderWidth × 2` — 지금 window 는 카드당 2px 짧다) 를 렌더와 같은 소스 (카드 origin style) 에서 읽고, gap 은 행 묶음이 쓰는 축 하나로 통일한다 (지금 `props.gap` 대 `style.gap`).
   - Table 은 상수 미러를 catalog `TableRow.sizes` 읽기로 바꾸고, 요소 헤더 높이는 Column 셀 metric (§1.56, md 40) 으로 계산한다 (R4).
   - contentHeight · maxScrollTop 에 owner padding · border 를 넣는다 (scroll content box 기준).
5. **grid spacer**: spacer 에 `gridColumnStart: "1"`, `gridColumnEnd: "-1"` (longhand — shorthand 는 엔진에 운반되지 않는다) 를 준다 (§2-2).
6. **wrap 제약 (R1)**: 줄바꿈으로 높이가 달라지는 입력은 이 phase 의 지원 범위 밖이다. 공급자 문서에 "단일 줄 가정" 을 명시 제약으로 적고, G1 fixture 는 단일 줄로 둔다. 해소 owner 는 150 후속 항목이다. ADR-162 Phase 4 의 실측 캐시가 들어온 뒤 ListBox · slot-only GridList 에 연결하며, closure (§5) 에 잔여로 기록한다.
7. **검증**:
   - unit: 함수 계약, 가족별 반례 4 개 (description 교대 ListBox · description 교대 2 열 GridList · 요소 헤더 Table · 균일 ListBox 회귀) (원복 RED).
   - `tests/parity/` browser test: 행 y 와 끝 도달 — 실 브라우저 DOM overflow scroll 을 oracle 로 쓴다.
   - live Canvas 1 회: 끝 행까지 스크롤한다.
   - 노드 수 unit 은 기존 것을 그대로 쓴다.

### §3 Phase 1 결과 (2026-09-27)

약칭은 §2 와 같다 (S · V · U), R = `scene/collectionRowOffsets.ts`.

#### §3-1 반영한 것

- **행 위치 단일 소스** `resolveCollectionRowOffsets` (R, 신규): 입력 = 시각 행 수 · 행 높이 (균일 값 또는 목록) · gap · 앞/뒤 여백 · viewport · scrollTop · overscan (· sample 모드 고정 window). 출력 = window · lead/trail spacer · 행 영역 · maxScrollTop. 행 top = Σ(h + gap), lead = top(s) − gap, trail = 행 영역 − top(e). 균일은 O(1), 목록은 누적합 + 이분 탐색.
- **행별 높이 공급자** (V): ListBox 는 행마다 description · 선택 variant · 명시 height · responsive · 행 border 를 넣어 layout 과 같은 `resolveListBoxItemRowHeightFromStyle` 로 잰다 (S 에서 행 context · 표시 해석을 export 해 scene 과 같은 함수를 쓴다). GridList 는 카드마다 같은 방식으로 재고 시각 행 = 그 행 카드 최대, 카드 padding · border 는 카드 origin style (없으면 catalog metric). Table 은 catalog `TableRow.sizes` (상수 미러 삭제) + 요소 헤더 = Column 셀 `calculateContentHeight` 최대. 목록은 문서 · collections · breakpoint 가 같으면 캐시를 쓴다 (스크롤은 재계산 안 함).
- **owner inset**: ListBox 4/1 · GridList 0/0 (spacing metric) 을 앞/뒤 여백으로 넣는다. `contentHeight` 는 이제 inset 포함 전 scroll content 다.
- **scene 소비** (S): ListBox · GridList · Table 의 spacer · sample hatch · `_projectedRowsContentHeight` 가 resolution 필드를 먼저 쓴다 (legacy 균일 식은 필드 없을 때만).
- **grid spacer**: `COLLECTION_FILLER_STYLE` (`width 100%` · `flexShrink 0` · `gridColumnStart "1"` · `gridColumnEnd "-1"`) 를 spacer 와 hatch 가 같이 쓴다.
- **GridList gap 축**: `style.rowGap/columnGap ?? style.gap ?? props.gap ?? 12` — DOM 이 읽는 style 축을 먼저 (ListBox rowGapPx 와 같은 순서). 행 묶음 rowGap · columnGap 과 단일 소스 gap 이 같은 값.
- **스크롤 범위 writer 하나**: fullTreeLayout GAP 4 가 projection 행 묶음 (`*-rows`) 을 가진 가상화 owner 를 건너뛴다. BuilderCanvas 는 resolver 에 `activeBreakpoint` 를 넘긴다.
- **live 가 잡은 결함 2 (같은 phase 에서 수리)**: (1) ref instance owner (팔레트 요소) 를 raw instance props 로 읽어 origin 에만 있는 값을 놓쳤다 — 팔레트 Table 은 origin `size: "sm"` 이라 Canvas 행 36 인데 resolver 44 → resolver 입구에서 scene 과 같은 `applyPropsPatch(origin chain props, instance props)` view 를 쓴다 (문서 identity 로 캐시). (2) quick connect Table (ref instance + mode C 자기 열) 은 문서 자식이 없어 요소 헤더를 못 찾았다 — Canvas 헤더 40 인데 36 으로 읽어 스크롤 범위 4px 부족 → `tableColumnInsert.readTableHeaderColumnNodes` (quick connect · Preview 와 같은 열 reader) 로 읽는다.

#### §3-2 G1 증거

| 기준                          | 증거                                                                                                                                                                                                                                                                                | 결과                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| (b)(c) 실 브라우저 DOM oracle | `tests/parity/adr150RowPositionsDom.browser.test.ts` — CanonicalNodeRenderer 로 그린 ListBox 100 행 (32 · 50 교대) · GridList 2 열 100 카드 (시각 행 50 · 76 교대) · GridList `style.gap 20px` 40 카드. 모든 행 (카드) y · 높이 · `scrollHeight − clientHeight` 를 단일 소스와 대조 | 3/3 PASS (±1)                     |
| (a) live Canvas               | `apps/builder/scripts/adr150-p1-row-positions-live.mjs` (headed, 팔레트 ref instance): ListBox 1000 · GridList 400 · Table 500 을 top · 중간 · 끝에서 layout map window 행 y · 높이 · scroll state maxScrollTop 대조 + quick connect Table (요소 헤더 40, dataTable 바인딩) 끝 도달 | 15/15 PASS, 오차 0, 페이지 에러 0 |
| (d) 노드 수                   | 기존 10k 노드 수 unit (ListBox 18 · GridList · Table 15 data 행)                                                                                                                                                                                                                    | PASS                              |
| unit                          | `collectionRowOffsets.test.ts` 10 · `adr150Phase0Red.test.ts` (Phase 1 describe 5) · `collectionVirtualization.test.ts` 57 (판독 수리 5 포함)                                                                                                                                       | PASS                              |

(e) 원복 RED (백업 복사로 원복, git checkout 미사용):

| 원복                              | 반응                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spacer `gridColumnStart/End` 제거 | Phase 1 spacer 전체 열 unit RED                                                                                                                                                          |
| 단일 소스 gap = 0                 | offsets unit 8 + window unit 2 RED                                                                                                                                                       |
| 행별 높이 → 첫 행 균일            | ListBox · GridList 교대 높이 unit 2 RED                                                                                                                                                  |
| ref instance props 병합 제거      | 팔레트 Table origin sm unit RED                                                                                                                                                          |
| 요소 헤더 reader → 문서 자식만    | quick connect 모양 unit RED                                                                                                                                                              |
| GridList gap → `props.gap` 축     | gap 축 unit RED + DOM oracle `style.gap 20px` RED                                                                                                                                        |
| GAP 4 skip 제거                   | **반응 없음** (live 13/13) — spacer 가 정확해져 두 writer 가 같은 값을 낸다. skip 은 예측 ≠ layout 인 입력 (wrap, R1) 에서 값이 window 마다 흔들리는 것을 막는 단일 writer 규약으로 둔다 |

#### §3-2b Phase 1 판독 (reviewer 1회, 2026-09-27) — HIGH 0 · MEDIUM 3 수리

| #   | 판독                                                                                                                                          | 수리                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 원복 RED                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| M1  | plan 캐시 key 가 문서 identity 라 다른 요소를 편집할 때마다 가상화 목록 전 행을 다시 잰다 (10k 행 +6 ~ 8ms)                                   | store 는 편집마다 문서를 얕게 복제한다 (`cloneNode` — props · dataBinding.config 값 참조 유지). 문서가 바뀌면 입력 서명 (collections · owner props 값 참조, style 만 내용 · dataBinding · config 값 · ctx 의 style 내용 · 템플릿 참조) 이 같을 때 높이 목록을 재사용한다. 행 높이는 (선택, description) 조합마다 한 번만 잰다 (scene 과 같은 `resolveListBoxRowLayoutStyle` · `resolveCollectionRowDescription`). node 벤치 10k 행: 편집 1회 4.2 → 0.03 ~ 0.1ms | 서명 무조건 적중 → unit 8 RED               |
| M2  | resolver 가 ADR-214 state 템플릿 (`{{ }}`) 을 풀지 않아 description `{{ subtitle }}` (기본값 "") 행을 50 으로 봤다 (scene 32)                 | resolver 입력 `projectVariables` → scene `stateEnvFor` 와 같은 shared 함수로 owner env (page 보강 제외) → ctx `stateEnv`. BuilderCanvas 가 넘기고 plan 캐시 조건에 넣었다                                                                                                                                                                                                                                                                                       | env 제거 → 5198 ≠ 3398 RED                  |
| M3  | GridList · Table 은 owner 여백을 raw style 로 읽어 responsive padding 을 놓쳤다 (layout 은 반영) — mobile padding 16 이면 스크롤 범위 32 부족 | ListBox 와 같이 `resolveResponsiveStyleMap(style, node.responsive, breakpoint)`. GridList plan 캐시에 breakpoint                                                                                                                                                                                                                                                                                                                                                | responsive 제거 → GridList · Table unit RED |

LOW deferred (production 증상 없음): L1 목록 입력이면 스크롤마다 `allEqual` · 누적합 할당 O(n) (50k 행 0.2ms 미만) · L2 legacy `resolveListBoxRowHeight` / `resolveGridListRowStride` 가 대표 `rowHeight` 용으로 남음 (두 번째 metric 소스) · L3 Table plan 캐시 없음 (열 수만큼) · L4 GridList sample 모드 3 열이면 샘플 카드 10 → 12 (hatch 와 정합) · L5 oracle 전용 `resolveCollectionRowPositions` 가 overflow 를 확인하지 않음. 수리 뒤 live 15/15 · DOM oracle 3/3 · builder 전체 7895 통과 재확인.

#### §3-3 범위 밖 발견 (기록만)

- **GridList 혼합 행 카드 stretch**: 한 시각 행에 description 카드 (76) 와 없는 카드가 섞이면 DOM 은 grid stretch 로 두 카드 모두 76, Canvas 는 짧은 카드가 50 그대로 (live 매 위치 5 ~ 8 장). 행 위치 · 스크롤 범위는 맞다 (시각 행 높이 = 최대). 카드 상자 높이의 D3 비대칭이라 layout (카드 높이 enrich) 쪽 별도 수리 대상.
- DOM ListBox · GridList 는 가상화하지 않을 때 100 행에서 자른다 (`useResolvedCollectionItems` windowLimit) — Canvas 는 전 행을 가상화한다. 100 행 초과 데이터 목록의 DOM↔Canvas 행 수 비대칭.
- template anchor 없는 data-bound ListBox 는 DOM 이 평문 행 (28, description 없음) 을 그리고 Canvas 는 slot 행 (32 · 50) 을 그린다. production 에서 anchor 없는 모양이 생기는지 미확인.
- 같은 이름 형제 segment 의 synthetic id 충돌 (Phase 2 path walk 에서 다시 본다).
- `catalogOrigins.test.ts` (ADR-228 G4 descendants 개수 138 ≠ 139) 실패 — Phase 1 과 무관한 다른 세션 변경 이후 상태.

## §4 Phase 2 — A3' 데이터 행 origin 진입 (G2)

1. **해석기**: 입력은 hit 노드 (가상 · projected id) 와 그 행 projection (`templateOriginId` · 행 id) 이다. 출력은 origin 의 대응 자식 canonical id 이거나 null 이다. path 는 행 id 뒤 `/<path>` 로 origin 서브트리를 따라간다 (synthetic 자식 규칙 `syntheticDescendantLookup.ts` 와 같은 path 문법). null 이면 호출자는 owner 선택으로 돌아간다 (R5).
2. **raw hit 전달 (round 3 h1)**: owner redirect 이전의 hit 정보를 double-click handler 까지 보존한다.
   - `CanvasInteractionTarget` 의 `select` 에 선택 id (owner) 와 별도로 `sourceHit?: { nodeId, projection }` 필드를 둔다. collection projection 을 owner 로 돌릴 때 (`resolveCanvasInteractionTarget.ts:160-164`) 그 필드를 채운다.
   - pointer handler (`useCentralCanvasPointerHandlers.ts`) 는 `hitElementId` 옆에 `sourceHit` 을 보관한다. double-click 두 분기 — 선택 경계 밖 (`:430`), 선택 경계 안 (`:476-494`, `resolveDoubleClickTargetId`) — 모두 `handleElementDoubleClickRef.current(targetId, { sourceHit })` 로 넘긴다.
   - **double-click 연속성 키 (round 4 h1)**: 키 함수 `resolvePointerClickKey(sourceHit, targetId)` 하나를 둔다. `sourceHit` 이 있으면 그 노드 id (예: `projection:gridlist-row:grid:a/heading` — 카드 · 자식 단위) 를, 없으면 지금처럼 선택 id 를 돌려준다. 두 분기의 `commitPointerClick` (기록) 과 `isPointerDoubleClick` (판정, `pointerSession.ts:8-22` 는 키 문자열만 비교한다) 이 모두 이 키를 쓴다. owner id 를 키로 두면 서로 다른 카드의 연속 단일 클릭이 300ms 안에서 double-click 이 된다.
   - 해석은 두 번째 클릭의 `sourceHit` 으로 한다. 선택 id 는 owner 를 유지한다. 단일 클릭 · 드래그 · hover 경로는 `sourceHit` 을 읽지 않는다. `sourceHit` 이 없는 요소 (데이터 행 밖) 는 키가 지금과 같아 동작 변경 0 이다.
   - `sourceHit.nodeId` 는 해석 입력으로만 쓰고 selection · mutation · history 에 넣지 않는다 (HC3).
3. **진입점**: 더블클릭 handler (`useCanvasElementSelectionHandlers.ts` `handleElementDoubleClick`) 는 `sourceHit` 이 데이터 행 projection 이면 해석기를 부른다. 성공하면 `selectElementWithPageTransition(originChildId, originPageId)` 을 호출한다. 실패하거나 `sourceHit` 이 없으면 지금의 진입 동작을 그대로 쓴다.
4. **안내**: Properties 에서 선택 요소가 데이터 목록 템플릿 origin 의 자식이면 "이 원본을 쓰는 카드 전체에 적용" 을 표시한다. ADR-162 Phase 5 카드 필드 절과 같은 문구 체계를 쓴다.
5. **대상 가족**: §2-4 표에서 템플릿 origin 이 있는 가족만 대상이다. 나머지는 owner 선택을 유지한다.
6. **검증**:
   - unit: 해석기 (성공 · path 불일치 · origin 없음), 가상 id 가 selection · mutation 에 들어가지 않음 (negative), 단일 클릭 owner 회귀.
   - unit (round 3 h1 반례): 펼친 카드의 서로 다른 Text 자식 두 개를 각각 hit → 두 double-click 분기 각각에서 서로 다른 origin 자식으로 해석된다.
   - unit (round 4 h1 반례): 카드 A `a/heading` 클릭 t=1000 → 카드 B `b/detail` 클릭 t=1200 → double-click 아님 · 페이지 이동 0. 같은 카드의 `a/heading` → `a/detail` 도 아님. 같은 자식 두 번 (t=1000 · 1200) 만 double-click. 두 분기 각각, 원복 (owner 키) 시 RED.
   - live: 펼친 카드의 서로 다른 Text 두 개를 각각 더블클릭 → Components 페이지 origin 자식 선택 → 스타일 변경 → 원래 페이지 모든 카드 반영. 페이지 이동 UX 는 사용자 확인 (R3).

## §5 Phase 3 — closure (G3)

1. [ADR-911](../911-rac-pencil-target-component-architecture.md) R-3 / G-projected 문구를 본 ADR 게이트로 재정의하고 닫힘으로 표기한다. [ADR-910](../910-rac-pencil-component-architecture.md) T-7 / G-state 에 A1 철회 1 줄을 남긴다.
2. §2-6 stale 표기를 정정하고, wrap 잔여 (R1) 를 후속 항목으로 기록한다.
3. README 현황 · 실행 순서 행을 갱신한다. ADR-162 Phase 4 의 선행 조건을 "150 A2 시각 확인" 에서 "150 Phase 1 함수 계약" 으로 바꾼다. CHANGELOG 와 `### Live Exercise` 절도 채운다.
4. `/cross-check` 를 가족당 1 회 돌린다. 판독은 phase 당 1 + 수리 검증 1 로 한다 (`.claude/rules/review-loop-closure.md`).

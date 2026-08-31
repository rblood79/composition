---
description: 캔버스 인터랙션 (히트 바운드 · hover 하이라이트 · 선택 박스 좌표계 · 드래그 의도 판정) 파일 작업 시 적용 — canvas-rendering.md §8.5–8.8 에서 분리 (2026-08-31, 대용량 경고 해제)
paths:
  - "apps/builder/src/builder/workspace/canvas/interaction/**"
  - "apps/builder/src/builder/workspace/canvas/selection/**"
  - "**/skiaOverlayBuilder*"
  - "**/pagePaintOrder*"
  - "**/useCentralCanvasPointerHandlers*"
  - "**/useDragInteraction*"
---

# 캔버스 인터랙션 규칙 (canvas-rendering.md §8.5–8.8 분리)

> 렌더링 일반 규칙은 [canvas-rendering.md](canvas-rendering.md). 본 파일은 2026-07-24 실측 4절만 담는다.

## 8.5 Clip-Aware Hit Bounds — 원본 박스 ↔ 히트 영역 분리 (2026-07-24)

포인터 판정(클릭 선택 / 호버 아웃라인 / 휠 스크롤 타깃 / 드롭 타깃)은 **렌더러가 실제로 그린 영역만** 대상으로 해야 한다. `renderCommands.buildRenderCommandStream` 은 이를 위해 **두 맵**을 낸다.

| 맵                                   | 내용                             | 소비자                                                                                       |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `boundsMap` (`getSceneBounds`)       | 요소 **원본 박스** (클립 미적용) | 선택 오버레이 / TextEditOverlay / AI 이펙트 / overflowInfoMap / 측정                         |
| `hitBoundsMap` (`getSceneHitBounds`) | 원본 박스 ∩ **조상 clip rect**   | SpatialIndex(`syncSpatialIndex`) / 호버 AABB / 휠 스크롤 타깃 / **콘텐츠성 오버레이 chrome** |

**오버레이 chrome 의 갈림 기준 — "요소를 가리키는가" vs "내용 자리를 그리는가"**: 오버레이 패스는 씬의 clip save/restore **밖**에서 돌기 때문에 어떤 맵을 넘기느냐가 곧 클립 여부다.

| chrome                                                                                                                                                                                                    | 맵             | 이유                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| 선택 박스 / 리사이즈 핸들 / 프레임 타이틀                                                                                                                                                                 | `boundsMap`    | 요소를 **가리키는** 표식 — 일부가 잘려도 전체 범위를 보여야 조작 가능      |
| slot 해치·테두리 (`buildSlotMarkerTargets`), collection remainder (`buildCollectionRemainderTargets`), 호버 chrome **전체** — 자식 점선 가이드라인 + context 실선 아웃라인 (`buildHoverHighlightTargets`) | `hitBoundsMap` | **내용이 놓일 자리**를 그리는 콘텐츠성 chrome — 실제 내용과 같이 잘려야 함 |

- 호버 아웃라인은 **선택 박스와 다르다**. 선택 박스는 핸들을 잡아야 하므로 부분 클립돼도 원본 박스를 유지하지만, 호버 아웃라인은 조작 대상이 없는 순간 피드백이라 가시 영역만 그린다. 전부 잘리면 아웃라인 자체를 생성하지 않는다. **Why (2026-07-24 사용자 보고)**: slot 컴포넌트에 마우스를 올린 채 스크롤해 컨테이너가 프레임 밖으로 밀리면, 자식 점선만 사라지고 **실선 아웃라인은 캔버스 배경에 그대로 남았다** (context 분기만 `treeBoundsMap` 을 쓰고 있었음).
- 단 **page body 는 예외** — 조상이 없어 clip 대상이 아니고 두 맵 모두에 없을 수 있다. `resolvePageBodyBounds` 프레임 경계 폴백을 그대로 둔다.
- **페이지끼리는 조상 관계가 아니라 `hitBoundsMap` 클립이 잡지 못한다** (2026-08-12). 겹친 페이지의 가림은 페인트 순서(활성 페이지 최상단 — `pagePaintOrder.ts::orderPagesForPaint`)의 산물이므로, 콘텐츠성 chrome(슬롯 해치/테두리, collection remainder, hover 아웃라인)은 target 에 소유 `pageId` 를 싣고 오버레이 패스에서 `withPageOcclusionClip`(`skiaOverlayBuilder.ts`) 이 소유 페이지보다 페인트 순서가 뒤인 페이지 rect 를 `ClipOp.Difference` 로 제외하고 그린다 — 페이지 테두리 `renderFrameAreaBorder` 의 순서 기반 occlusion 과 동일 규칙. **Why (2026-08-12 사용자 보고)**: 아래 페이지의 빈 슬롯 해치가 위(활성) 페이지 body 위에 그대로 그려졌다.
- **페이지 타이틀은 두 축에서 분류가 다르다** (2026-08-12). 조상-clip 축(§8.5 표)에서는 조작 표식(원본 박스, 부분 클립돼도 전체 표시)이지만, **페이지 간 축에서는 occlusion 대상** — 가려진 페이지를 가리키는 표식이 위 페이지 body 위에 떠 있으면 위 페이지의 내용처럼 읽힌다 (2026-08-12 사용자 보고: 아래 페이지의 "Page N" 타이틀이 활성 페이지 body 한가운데 표시). 페인트는 타이틀 렌더도 `withPageOcclusionClip` 경유, 히트는 `pageTitleBoundsMap` **등록은 유지**하고 BuilderCanvas pointerdown capture 의 paint-rank guard 가 point 단위로 거른다 (`resolveTopPageIdAtPoint` rank 비교 — 부분 가림에서 보이는 구간만 잡히도록 rect 차집합 대신 point 판정). 활성(최상단) 페이지 타이틀은 어느 쪽에서도 잘리지 않는다.

- 클립 교차는 `intersectBoxes()` (`selection/types.ts`) 단일 수식. 렌더 커맨드의 조상 clip 교차와 오버레이 가시 영역 산출이 같은 함수를 쓴다.
- padding inset 같은 **요소 상대** 변환은 원본 박스 기준으로 먼저 하고, 가시 영역 클립은 **그 다음**이다. 순서를 바꾸면 잘린 요소의 inset 이 잘린 박스 기준이 돼 어긋난다.
- **Why (2026-07-24 실측)**: `renderSlotHatchPattern` 은 자기 bounds 로만 `clipRect` 를 걸어서 원본 박스를 넘기면 조상 클립을 전혀 받지 않았다. page body(`overflow:auto`, 390x844) 를 스크롤해 프레임 밖으로 나간 ListBox 해치가 프레임 상단 경계 **위로 66px** 캔버스 배경에 그려졌다. 같은 요소의 히트 영역은 이미 클립돼 있어 **"보이는데 클릭은 안 되는"** 비대칭이 됐다.

- clip rect 계약은 렌더러와 **1:1 미러**: `CMD_CHILDREN_BEGIN` 이 `clipChildren` 일 때 `(0,0,clipWidth,clipHeight)` 로 클립하므로, 절대 좌표 clip rect = `(absX, absY, clipWidth, clipHeight)`. **자기 자신은 클립되지 않고 자식만** 클립된다.
- scroll translate 는 clip **뒤**에 적용되므로 clip rect 원점에는 `scrollOffset` 을 반영하지 않는다 (자식 절대 좌표에는 이미 차감돼 있음).
- 교차 결과가 비면 `hitBoundsMap` 에 **미등재** = 히트 불가. 조상 clip 이 완전히 비면 서브트리에 `EMPTY_CLIP`(크기 0)을 전파한다 — `null`(=클립 없음)로 되돌리면 전부 잘린 서브트리가 오히려 무제한 히트 가능해진다.
- drag top-layer 재방문(`renderAsTopLayer`)은 clip save/restore **밖**에서 그려지므로 clip 미적용(`clipRect = null`)으로 재방문한다.
- **Why (2026-07-24)**: `boundsMap` 만으로 SpatialIndex 를 채우면 화면에 없는 영역이 히트된다. 실측 — ListBox 인스턴스 `maxHeight:300 + overflow:auto` 에서 owner 아래 10px(local y=310) 클릭 시 body 대신 ListBox 가 선택 (row projection → `projection.listBoxId` owner redirect). page body(`overflow:auto`, 844) 아래로 밀려난 형제도 프레임 밖 빈 캔버스에서 선택됨. 컨테이너 전반 공통 결함이라 컴포넌트별 우회가 아니라 bounds 생성 지점에서 차단.

### 금지 패턴

- ❌ 포인터 판정에 `boundsMap` / `getSceneBounds` 사용 → `hitBoundsMap` / `getSceneHitBounds` 필수
- ❌ **선택 박스·핸들·프레임 타이틀**·측정에 `hitBoundsMap` 사용 → 부분 클립 요소의 선택 박스·텍스트 편집 위치가 잘림
- ❌ **콘텐츠성 오버레이 chrome**(slot 해치/테두리, collection remainder, 자식 가이드라인)에 `boundsMap` 사용 → 오버레이 패스는 씬 clip 밖이라 프레임·overflow 컨테이너를 뚫고 그려진다
- ❌ 콘텐츠성 chrome 을 `withPageOcclusionClip` 없이 직접 render → 조상 clip(`hitBoundsMap`)은 페이지 간 가림을 모른다 — 아래 페이지 chrome 이 위 페이지 body 를 가로지른다
- ❌ 오버레이 chrome 에서 요소 상대 변환(padding inset 등)을 클립 **뒤**에 적용 → 잘린 박스 기준 inset 으로 어긋남
- ❌ 클립 교차를 지역 헬퍼로 재구현 → `intersectBoxes()` (`selection/types.ts`) 단일 수식 사용
- ❌ `visitElement` 에 clip 파라미터를 추가하면서 자식 재귀에 전달 누락 → 조상 clip 이 한 단계에서 끊김
- ❌ clip 교차 결과가 빈 경우 `null` 로 폴백 (= 클립 해제) → `EMPTY_CLIP` 전파 필수

## 8.6 Hover 그룹 하이라이트 — body 는 확장 대상 아님 (2026-07-24)

`useElementHoverInteraction` 은 컨테이너를 호버하면 리프 자손을 모아 점선 자식 가이드라인을 그린다 (Pencil deep-hover 패턴). 확장 판정은 `resolveHoverGroupState()` **단일 진입점**.

- 호버 후보(`candidates`)는 **editingContext 직계 자식 또는 body 직계 자식**이라 body 자신은 AABB 히트로 context 가 되지 않는다. body 가 context 가 되는 경로는 빈 영역 fallback (`resolvePageBodyHoverTarget` / `resolveFrameBodyHoverTarget`) **뿐**이며, 이는 "여기엔 요소가 없다" 신호다.
- 따라서 **body context 는 리프 확장 금지** — `hoveredLeafIds: []`, `isGroupHover: false`. context 자체의 실선 아웃라인은 유지해 "클릭하면 body 선택" affordance 를 남긴다.
- **Why (2026-07-24)**: 확장 분기가 context 종류를 구분하지 않아, 페이지의 요소 없는 빈 공간에 마우스를 올리면 `collectLeafDescendants(body)` 가 **페이지 전체 리프**를 반환 → `buildHoverHighlightTargets` 가 모든 리프에 점선을 그렸다 (ListBox 2개의 전 행이 동시에 가이드라인 표시).

### 캐시 계층 분리 — "무엇을 호버 중인가" ↔ "지금 어디에 그리는가"

| 계층                                                | 내용                                       | 갱신 시점                           |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| hover state (`hoveredElementId` / `hoveredLeafIds`) | **구조적** — childrenMap 만으로 산출       | hover context 변경 시 (pointermove) |
| overlay target (`buildHoverHighlightTargets`)       | **기하** — `hitBoundsMap` 으로 가시성 판정 | 프레임마다                          |

- `collectLeafDescendants` 는 bounds 로 거르지 않는다. 가시성(클립/스크롤)은 프레임마다 달라지는데 hover state 는 context 가 그대로면 재계산되지 않으므로, 여기서 걸러 캐시하면 **최초 가시 집합이 고착**된다.
- 자식 점선 가이드라인의 가시성 판정은 `buildHoverHighlightTargets` 가 `hitBoundsMap` 조회로 수행 — 전부 잘린 리프는 건너뛰고, 부분 가시 리프는 보이는 구간에만 그린다.
- **Why (2026-07-24)**: 스크롤 가능한 ListBox 를 호버하면 처음 보이는 행만 가이드라인이 잡히고, 휠 스크롤로 새 행이 들어와도(포인터 미이동 → hover 재계산 없음) 가이드라인이 안 나왔다. 마우스를 뺐다 다시 넣어야 갱신되던 증상.

### 금지 패턴

- ❌ hover 확장 판정을 훅 내부에 인라인 (테스트 불가 + 조건 누락) → `resolveHoverGroupState()` 경유
- ❌ 빈 영역 fallback 으로 잡힌 context 를 일반 컨테이너 호버와 동일 취급 → 페이지 전체 가이드라인
- ❌ `hoveredLeafIds` 를 bounds/가시성으로 필터링해 캐시 → 스크롤 후 stale (재계산 trigger 가 context 변경뿐)
- ❌ 자식 가이드라인을 `treeBoundsMap`(원본 박스) 으로 조회 → 잘려 안 보이는 리프에도 점선

## 8.7 선택 박스 좌표계 — scene 단일계 (2026-07-24)

포인터 판정에 쓰이는 값은 **전부 scene 좌표**다. 클릭 좌표(`screenToCanvasPoint` 결과), 히트 bounds(`getSceneHitBounds`), 선택 박스(`computeSelectionBounds`) 셋이 같은 계여야 한다.

- `getElementBoundsSimple` / `getSceneBounds` 는 **이미 scene 좌표**를 반환한다. 여기에 `panOffset` 을 빼거나 `zoom` 으로 나누는 보정을 **추가하지 않는다** — PixiJS `getBounds()` 가 screen 좌표를 주던 시절의 잔재다.
- `computeSelectionBounds` 의 body 분기는 raw 페이지 좌표를 쓴다. 요소 분기도 동일해야 하며, 한 함수 안에서 두 좌표계가 섞이면 안 된다.
- **Why (2026-07-24, 40클릭 실측)**: 요소 분기만 `(bounds - panOffset) / zoom` 보정을 하고 있었다. zoom=1 에서도 선택 박스가 `panOffset` 만큼 통째로 이동 — 실측 `component-listbox` scene `20,188 350x110` → 계산값 `-195,-40 350x110`. 그 유령 박스에 걸린 클릭이 `inSelectionBounds` 로 판정돼 **선택이 통째로 무시**됐다(실패 10/40, 그 중 9건이 `inSelectionBounds=true`). 유령 박스 위치가 pan 과 선택 요소 위치의 조합에 좌우돼 **컴포넌트와 무관하게 불특정**하게 재현됐다. 노드 트리 선택은 이 경로를 안 거쳐 항상 정상 — 비대칭이 진단 단서였다.

### 금지 패턴

- ❌ scene 좌표 bounds 에 `panOffset` 감산 / `zoom` 제산 추가 (`computeSelectionBounds` 에서 `panOffset` 파라미터는 삭제됨 — 재도입 시 컴파일 에러)
- ❌ 한 bounds 계산 함수 안에서 body 분기와 요소 분기가 다른 좌표계 사용
- ❌ 선택이 "가끔" 안 되는 증상을 히트 테스트 문제로 단정 — `inSelectionBounds` 가드가 먼저 삼키는지 확인 (히트는 성공하고 그 뒤 단계에서 버려질 수 있다)

## 8.8 드래그 의도 판정 — bbox 아닌 계층 정규화 타깃 (2026-07-24)

pointerdown 을 "현재 선택을 잡아 끄는 동작" 으로 볼지의 판정은 **선택 박스 안인가**가 아니라 **커서 아래 요소를 현재 editingContext 깊이로 정규화한 결과가 지금 선택된 요소인가**로 한다. 단일 진입점은 `resolveSelectionDragIntent()` (`interaction/selectionModel.ts`).

| 클릭 대상                                  | 드래그 의도 | 결과                                                   |
| ------------------------------------------ | :---------: | ------------------------------------------------------ |
| 선택 요소 자신                             |     ✅      | 선택 유지 + `pendingDrag`                              |
| 선택 요소의 자손 (정규화 결과가 선택 요소) |     ✅      | 선택 유지 + `pendingDrag`                              |
| **선택 박스에 겹쳤을 뿐인 다른 요소**      |     ❌      | **그 요소를 새로 선택**                                |
| body 선택 상태                             |     ❌      | 자식 클릭이 정상 선택                                  |
| 히트 없음 (`hitElementId === null`)        |     ✅      | 기존 동작 보존 — 빈 영역이어도 박스 안이면 드래그 핸들 |

- 깊이 진입은 **더블클릭 + `editingContext`** (`resolveClickTarget` / `handleElementDoubleClick`) 가 전담한다. 드래그 의도 판정이 깊이 모델을 겸하면 안 된다 — 두 축이 섞이면 겹친 형제 클릭이 삼켜진다.
- body 예외를 판정 함수 **바깥**에 특수 분기로 두지 않는다. body 선택 박스는 페이지 전체를 덮어 bbox 판정이면 모든 클릭이 무시되므로, 같은 결함의 국소 우회가 재발한다.
- **Why (2026-07-24 실측 + 외부 도구 대조)**: 판정이 bbox 였을 때 `component-gridlist` 선택 상태에서 그 박스(`20,374 350x340`) 안으로 들어온 `component-form__field-1-input` 클릭이 무반응이었다. Figma 는 실제 객체 지오메트리로 판정해 그 객체를 선택하고(공식 문서), Pencil 도 동일 — 실측 확인: 파랑 프레임 선택 → 파랑 bbox 안의 주황 프레임 클릭 → **주황 선택**. 깊이 진입은 두 도구 모두 더블클릭이라 composition 과 이미 일치했고, 발산 지점은 이 판정 하나였다.

### 금지 패턴

- ❌ `hitTestSelectionBounds` 결과(`inSelectionBounds`) 단독으로 드래그 의도 판정 — `resolveSelectionDragIntent()` 와 **AND** 로만 사용
- ❌ 드래그 의도를 "선택 요소의 자손인가" 로 판정 — body 는 모든 요소의 조상이라 body 선택 시 전 클릭이 삼켜진다 (정규화 결과 비교여야 함)
- ❌ body 선택 특수 분기를 호출부에 재도입 (`resolveSelectionDragIntent` 내부가 유일한 거처)
- ❌ 깊이 진입 규칙을 드래그 의도 판정에 얹기 (더블클릭 + editingContext 가 전담)

# ADR-221: 캔버스 페이지 헤더 DOM 층 이관 — 제스처 게이트 + 단일 drag 추종

## Status

Accepted — 2026-09-17 (사용자 `/execute-adr 221` 착수 지시 = Accepted 승인 · [reviews/221.md](reviews/221.md): round 1 HIGH 2 · MEDIUM 2 · LOW 2 → 본문·breakdown 반영 (사용자 판정 1 — capture 가드는 `.canvas-container` 안, Decision 4) → round 2 이슈 0, pending 0) · In Progress — Phase 0 착수 2026-09-17

> 출처: 2026-09-17 사용자 관찰 "framer 의 경우 page 헤더를 dom (html) 영역에서 생성하고 있다" + "드래그 이동 중에는 헤더가 나타나지만 스크롤·휠 이동 중에는 나타나지 않고 이동 종료 후에 나타난다". 같은 날 Skia 오버레이에 페이지 헤더 띠를 넣으면서 (`470c1859b` … `4049a416c`) 토큰 스코프 리졸버 · 테마 캐시 무효화 · Paragraph bold 캐시라는 우회 3개가 쌓인 직후의 경계 정리다.

## Context

**SSOT 3-domain 관계**: D1/D2/D3 어느 것도 아니다. 페이지 헤더는 산출물 (preview/publish) 에 없는 **빌더 workspace chrome** 이라 Builder↔Preview 시각 대칭 대상이 아니고, RAC DOM 도 컴포넌트 props 도 아니다. 이 ADR 이 정하는 것은 "카메라를 따라가는 빌더 chrome 을 어느 렌더 층에 두는가" 라는 workspace 표시 축의 경계다.

### 문제

페이지 헤더 (타이틀 + 띠) 는 Skia 오버레이 패스에서 그리고 있다. 빌더 chrome 이 Skia 에 있어서 생기는 비용이 하루 만에 세 번 드러났다:

1. **토큰**: 빌더 테마 토큰은 `[data-context="builder"]` 스코프에 있어 `:root` 를 읽는 `getCSSVariable` 로는 preview 팔레트가 나온다 → `getBuilderCSSVariable` 신설. 컴포넌트 지역 변수 (`--button-color`, `Button.css` 가 `.react-aria-Button` 안에서만 선언) 는 어느 스코프에서도 못 읽어 `--fg` 폴백을 손으로 짰다.
2. **테마 전환**: JS 가 읽은 토큰은 캐시돼 테마를 바꿔도 부팅 값이 남았다 (`invalidateCSSVariableCache` 호출자 0 이던 결함을 이번에 배선).
3. **굵기**: direct `ck.Font` 는 variable font 의 weight 요청을 반영하지 않아 (Bold 요청 = Regular 글리프, live 실측 dark px 393→50) 타이틀만 Paragraph + `fontVariations` 로 옮기고 paragraph 캐시를 들였다.

DOM 층이면 셋 다 CSS 가 공짜로 해 준다. 반면 DOM 층은 카메라를 매 프레임 따라가야 하고, 그 비용은 노드 수에 비례한다 — Framer 가 pan/zoom 중 헤더를 숨기는 이유다.

### 코드 사실 (2026-09-17, HEAD `62cf2df45`)

| 사실                                                                                                                                                                                                                                                                                                                                                                                                                                       | 경로 : 라인                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **페인트** — 오버레이 패스 "Page Titles" 블록: 페이지마다 `withPageOcclusionClip` 안에서 `renderPageHeader` (띠 28px · gap 1px · 기본 `--button-color`→`--fg` 10% / 활성 `--focus-ring` 30%) → `renderPageTitle` (Paragraph wght 700, 12px) → `buildPageTitleBounds` 로 히트 map 등록                                                                                                                                                      | `workspace/canvas/skia/skiaOverlayBuilder.ts:434-510` · `selectionRenderer.ts` (`PAGE_HEADER_*` 상수 · `renderPageHeader` · `acquirePageTitleParagraph`) · `skiaOverlayHelpers.ts` (`buildPageTitleBounds` · `PageTitleBounds:121-134`) |
| **프레임 타이틀** 이 같은 `renderPageTitle` 을 재사용 — 페인트만, 히트 map 미등록                                                                                                                                                                                                                                                                                                                                                          | `skiaOverlayBuilder.ts:512-548` (`buildFrameTitleRenderItems`)                                                                                                                                                                          |
| **토큰 우회 3종** (이 ADR 이 걷어낼 것): `resolvePageHeaderColor` / `resolvePageHeaderActiveColor` · `getBuilderCSSVariable` · `onThemeChange` 의 `invalidateCSSVariableCache()`                                                                                                                                                                                                                                                           | `skiaOverlayBuilder.ts:302-315` · `canvas/utils/cssVariableCore.ts` · `skia/SkiaCanvas.tsx` (`setupThemeWatcher` 콜백)                                                                                                                  |
| **히트 — pointerdown capture (`.canvas-container` 에 `capture: true`)**: target 가드는 `input, textarea, [contenteditable="true"]` 만 건너뛴다 → 자손 DOM 노드의 자체 핸들러보다 **항상 먼저** 실행된다. 이어서 `pageTitleBoundsMap` 순회 → paint-rank guard (`resolveTopPageIdAtPoint` vs `buildPagePaintRank`, 가려진 구간 point 단위 제외) → shift 면 ADR-178 body 다중 선택 토글 → 아니면 `lastPageTitleHitRef` 기록 + `startPageDrag` | `workspace/canvas/BuilderCanvas.tsx:1193 · 1255 · 1303-1420 · 1466-1467` (가드 `:1193`, shift 분기 `:1334`, drag `:1411`, 등록 `:1466`) · `hooks/usePageDrag.ts:85`                                                                     |
| **이름 편집**: dblclick capture 가 `lastPageTitleHitRef` (1 s 이내) + `isPointInPageTitleBounds` 로 판정 → `pageTitleEditState` → DOM `<input.page-title-edit-input>` 을 `resolvePageTitleEditorRect` (**`textScene*` 글리프 box**) 위치에 렌더. 즉 편집기는 이미 DOM 이고 Skia 는 그 자리를 알려 주는 역할만 한다                                                                                                                         | `BuilderCanvas.tsx:1433-1467 · 1556-1557 · 1644-1676` · `interaction/pageTitleEditing.ts:3-26`                                                                                                                                          |
| **페이지 간 occlusion**: 활성 페이지 최상단 페인트 순서 (`orderPagesForPaint`) 를 3 소비자 (페인트 · body 히트 · 요소 tie-break) 가 공유; 타이틀은 페인트 `withPageOcclusionClip` + 히트 paint-rank guard 로 "가려진 페이지의 타이틀이 위 페이지 body 위에 뜨지 않는다" (2026-08-12 사용자 보고)                                                                                                                                           | `scene/pagePaintOrder.ts:1-25 · 45` · `skiaOverlayBuilder.ts:339` · 규칙 `.claude/rules/canvas-interaction.md:34-35`                                                                                                                    |
| **카메라 프레임 신호 (재료)**: Skia RAF 가 매 프레임 `publishCanvasFramePresentation(cameraState, pagePositionSnapshot)` → 구독자는 React 재렌더 없이 DOM `style.transform` 만 쓴다 — `ContextualActionBar` 가 이미 이 패턴 (`applyAutomaticPageAnchor`, transform 문자열 비교 후 쓰기)                                                                                                                                                    | `canvas/canvasFramePresentation.ts:22-46` · `skia/SkiaCanvas.tsx:1158` · `components/overlay/actionBar/useActionBarPlacement.ts:84-105 · 210`                                                                                           |
| **제스처 신호 (재료 — 단, 현재 소비자 0)**: `isPanningRef` / `isZoomingRef` · 휠 종료 디바운스 **150 ms** → `finishWheelInteraction("idle")` · `onInteractionStart/End` 콜백은 휠 zoom/pan 시작 · 휠 idle · pointer pan 시작/종료 · interrupt 6 지점에서 호출되지만 **유일한 마운트 `ViewportControlBridge` 에 prop 이 전달되지 않는다 (dead prop)** · `ViewportController.addUpdateListener` (pan/zoom 실시간)                            | `canvas/viewport/useViewportControl.ts:86-96 · 228 · 266 · 293-311 · 329 · 384 · 422` · `viewport/ViewportControlBridge.tsx:25-56` · `BuilderCanvas.tsx:1633-1639` (prop 미전달) · `viewport/ViewportController.ts:250-272`             |
| **페이지 drag 프레젠테이션**: drag 중 위치는 store 가 아니라 `pagePositionSnapshot` 델타 (`readPagePositionDelta`) 로 RAF 스로틀 전달 — 헤더 하나만 이 델타를 읽으면 된다. drag 는 카메라를 건드리지 않는다 (auto-pan 없음)                                                                                                                                                                                                                | `interaction/pagePositionPresentation.ts` · `hooks/usePageDrag.ts:425-445` · `skiaOverlayHelpers.ts` (`buildPageTitleRenderItems` 델타 적용)                                                                                            |
| **DOM 마운트 자리**: `.canvas-container` 가 Skia 캔버스 · 이름 편집 input · `TextEditOverlay` 를 이미 형제로 품는다. 형제 `.workspace-overlay` 는 `pointer-events: none`                                                                                                                                                                                                                                                                   | `BuilderCanvas.tsx:1563` · `workspace/overlay/TextEditOverlay.tsx:66` · `Workspace.css:22-33 · 211-215`                                                                                                                                 |
| **휠·pan 리스너 소유자 = `.canvas-container`**: 휠 (`capture: true`) 과 pan 시작 pointerdown (`gestureSession.beginPointer`) 이 `containerEl` 에 걸려 있다 — 컨테이너 **밖** 노드 위에서는 휠 zoom/pan · 스페이스 pan 이 동작하지 않는다                                                                                                                                                                                                   | `viewport/useViewportControl.ts:225 · 270 · 393`                                                                                                                                                                                        |
| **성능 하니스**: `pnpm perf:baseline -- --lane frame` 은 pan/zoom 부류를 갖지만 시드는 페이지 **2장** 전제 (`pages`/`page-switch` 액션이 "두 번째 페이지" 하나만 찾는다) — 22 페이지 문서 시드 옵션 없음                                                                                                                                                                                                                                   | `apps/builder/scripts/perf-baseline.mjs:66-72 · 771-773 · 1675-1689 · 2069`                                                                                                                                                             |
| **편집기 스타일**: `.page-title-edit-input` 은 `font-weight: 500` (Skia Medium 타이틀 시절) — 정적 테스트가 500 을 잠근다                                                                                                                                                                                                                                                                                                                  | `workspace/Workspace.css:35-53` · `BuilderCanvas.pageTitleEditing.static.test.ts:31`                                                                                                                                                    |
| **테스트 — 현행 5 파일**이 Skia 타이틀 계약을 잠근다 (paragraph 조판 · 헤더 rect · 히트 bounds · 편집기 rect · 정적 가드)                                                                                                                                                                                                                                                                                                                  | `selectionRenderer.test.ts` · `skiaOverlayHelpers.pageHeaderHit.test.ts` · `skiaOverlayBuilder.static.test.ts` · `pageTitleEditing.test.ts` · `BuilderCanvas.pageTitleEditing.static.test.ts`                                           |

### Hard constraints

- **프레임 예산**: Canvas cadence 는 native refresh, 60 Hz floor (p95) — CLAUDE.md §성능 기준. pan/zoom 중 DOM 층이 이 예산을 잠식하면 안 된다. 실문서 기준 22 페이지 (2026-07-31 힙 실측 문서) 에서 판정한다.
- **히트 대칭 (`canvas-interaction.md` §8.5)**: "보이는데 클릭이 다른 페이지로 간다" 가 생기면 안 된다 — 가려진 페이지의 헤더는 보이지도 잡히지도 않아야 하고, 활성 (최상단) 페이지 헤더는 어느 쪽에서도 잘리지 않는다.
- **동작 보존 3종**: 헤더 띠 drag 로 페이지 이동 (`a06de0780`) · shift-클릭 body 다중 선택 토글 (ADR-178) · dblclick 이름 편집 (Enter 확정 / Esc 취소) — 이관 후 결과가 같아야 한다.
- **테마**: light/dark 전환 즉시 반영, JS 토큰 읽기 0.

### Soft constraints

- 페이지 이름 편집을 헤더 안 in-place `contenteditable`/input 으로 바꿀 수 있지만 이 ADR 은 **현행 편집기 (별도 input) 를 헤더 노드 안으로 옮기는 것까지만** — 편집 UX 변경은 범위 밖.
- 프레임 타이틀 (`FrameAreaGroup`) 은 히트가 없는 페인트 전용이라 이번에 옮기지 않는다 — Skia `renderPageTitle` 경로는 프레임 타이틀 소비자로 남는다.

## Alternatives Considered

### 대안 A: 현행 유지 — Skia 오버레이 + 우회 보강

- 설명: 지금 구조를 유지하고 필요할 때마다 토큰 리졸버 · paragraph 캐시를 늘린다. 렌더 경로 1개, 히트·occlusion 코드 무변경.
- 근거: Figma 는 라벨을 GPU 캔버스에 직접 그린다 (자체 텍스트 래스터라이저 보유). 우리는 CanvasKit direct Font 가 variable weight 를 못 다뤄 이미 Paragraph 로 우회했다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 빌더 chrome 확장마다 CSS 로 공짜인 것을 JS 로 재구현: 아이콘 · hover · 툴팁 · 컴포넌트 지역 변수) / 마이그레이션(L)

### 대안 B: DOM 층 상시 추종

- 설명: 페이지마다 DOM 헤더 노드를 두고 `subscribeCanvasFramePresentation` 으로 매 프레임 모든 노드의 transform 을 갱신한다. `ContextualActionBar` 패턴을 N 배 확장.
- 근거: 액션바 (노드 1개) 가 이미 이 방식으로 프레임 예산 안에 든다.
- 위험: 기술(L) / 성능(**H** — pan/zoom 중 N 노드 style 쓰기 = 스타일 재계산 + 합성 레이어 갱신이 캔버스 RAF 와 같은 프레임을 나눠 씀; zoom 은 역스케일 텍스트라 폭까지 재계산 · 텍스트 재래스터 가능; 22 페이지에서 p95 악화 가능) / 유지보수(L) / 마이그레이션(M)

### 대안 C: DOM 층 + 제스처 게이트 + 단일 drag 추종 (Framer 방식)

- 설명: DOM 헤더 노드를 두되 **카메라 제스처 (휠 pan/zoom · 스페이스 pan · 핀치) 동안 층을 `visibility: hidden`** 으로 끄고, 제스처 settle (기존 휠 종료 디바운스 150 ms · pointer pan 종료) 에 최종 카메라로 **1회** 배치해 켠다. 페이지 drag 는 대상 노드 1개만 `pagePositionSnapshot` 델타로 프레임 추종 (나머지는 정지). occlusion 은 정지 상태에서만 필요하므로 z-order (`orderPagesForPaint` 순서 = DOM 순서) + 위 페이지 rect 로 `clip-path`/겹침 판정으로 근사.
- 근거: Framer 실측 (사용자 관찰 2026-09-17) — drag 중 표시 · pan/zoom 중 비표시 · 종료 후 표시.
- 위험: 기술(M — 게이트 신호 `onInteractionStart/End` 는 호출 지점 6개가 살아 있으나 현재 소비자 0 인 dead prop 이라 배선부터 해야 하고, pan/zoom 3 경로에서 빠짐없이 받아야 함) / 성능(L — 제스처 중 DOM 쓰기 0, 정지 시 1회) / 유지보수(L) / 마이그레이션(**M→H 판정 R1** — pointerdown capture 의 타이틀 선판정 + paint-rank guard + ADR-178 분기를 DOM 이벤트로 옮기며 히트 순서가 깨질 수 있음)

### 대안 D: 하이브리드 — 제스처 중 Skia, 정지 시 DOM

- 설명: pan/zoom 중에는 지금의 Skia 헤더를 그리고, settle 후 DOM 으로 교체한다. 제스처 중에도 헤더가 보인다.
- 위험: 기술(M) / 성능(L) / 유지보수(**H** — 같은 헤더의 렌더 경로 2개 (CSS 와 Skia) 를 시각 동일하게 유지해야 하고, 오늘 걷어내려는 토큰·paragraph 우회를 전부 남겨야 함; 교체 순간 1 프레임 이중 표시/깜빡임) / 마이그레이션(M)

### Risk Threshold Check

| 대안 | HIGH+                             | 판정                                           |
| ---- | --------------------------------- | ---------------------------------------------- |
| A    | 유지보수 H                        | 기각 — 확장마다 우회 누적                      |
| B    | 성능 H                            | 기각 — hard constraint (프레임 예산) 직접 충돌 |
| C    | 마이그레이션 (히트 순서) H 1 → R1 | **채택** — Gate G1 로 1:1 관리                 |
| D    | 유지보수 H                        | 기각 — 렌더 경로 2개 유지                      |

루프 1회: B 의 성능 HIGH 를 회피하는 C 를 추가했고, C 의 잔존 HIGH 는 새 접근이 아니라 게이트로 관리 가능한 이행 위험이라 여기서 종결.

## Decision

**대안 C 채택.** 페이지 헤더 (띠 + 타이틀 + 이름 편집기) 를 `.canvas-container` 안 DOM 층 `PageHeaderLayer` 로 옮긴다. 층은 다음 4 규칙을 따른다:

1. **경계 규칙** — 카메라를 따라가며 텍스트·토큰·hover 가 필요한 빌더 chrome (페이지 헤더, 이후 breakpoint 라벨·페이지 미니 툴바) 은 **DOM 층**. 픽셀 정합이 필요한 표식 (선택 박스 · 핸들 · 스냅선 · 치수 배지 · hover 아웃라인) 은 **Skia 오버레이** 에 남는다. 프레임 타이틀은 히트 없는 페인트 전용이라 이번 범위 밖 (Skia 유지).
2. **제스처 게이트** — 카메라 제스처 시작 시 층 hidden, settle 시 1회 배치 후 표시. 신호는 `useViewportControl` 이 이미 호출하는 `onInteractionStart/End` (휠 zoom/pan 시작 · 휠 idle 150 ms · pointer pan 시작/종료 · interrupt) 를 **`ViewportControlBridge` 마운트에 배선** 해 받는다 — 현재는 소비자 0 인 dead prop 이므로 "재사용" 이 아니라 "배선" 이다. 새 타이머·새 store 를 만들지 않는다. 제스처 중 헤더 층 DOM 쓰기는 **0**.
3. **단일 drag 추종** — 페이지 drag 중에는 대상 헤더 1개만 `pagePositionSnapshot` 델타로 프레임 추종 (`subscribeCanvasFramePresentation`, transform 문자열 비교 후 쓰기 — 액션바와 같은 규약). 나머지 헤더는 정지.
4. **히트 순서 계약** — 헤더 층은 **`.canvas-container` 안** 에 두고, 컨테이너의 pointerdown/dblclick **capture** 핸들러는 target 이 `[data-page-header]` 자손이면 **즉시 return** 한다 (기존 `input, textarea, [contenteditable]` 가드와 같은 자리, `BuilderCanvas.tsx:1193 · 1436`). 그래야 헤더 노드의 자체 핸들러가 Skia hit-test 보다 앞선다 — capture 는 자손 target 핸들러보다 항상 먼저 실행되므로 가드 없이는 헤더 클릭이 아래 요소/body 를 먼저 선택한다 (round 1 h1). 가드는 **Skia 선판정만** 건너뛰고 `gestureSession` 의 pan 판정은 그대로 통과한다 — 스페이스를 누른 채 헤더 위 드래그 = 카메라 pan, 아니면 = 페이지 drag. Skia 측 타이틀 선판정 · paint-rank guard · `pageTitleBoundsMap` 은 제거. shift-클릭 (ADR-178) · dblclick 이름 편집은 헤더 노드 핸들러로 이관하되 결과 (selection · `renamePageTitle`) 는 같은 store 액션을 호출하고, 헤더 핸들러는 `__handled` 를 세워 중앙 핸들러를 막는 기존 계약 (`:1180`) 을 그대로 쓴다.
   - **왜 컨테이너 안인가 (2026-09-17 사용자 판정 — 성능·완성도 기준)**: 성능은 두 배치가 같다 (노드 수 · 프레임 쓰기 동일, 가드는 pointerdown 당 `closest` 1회). 완성도에서 형제 배치 (`.workspace-overlay`) 는 휠 zoom/pan 과 스페이스 pan 리스너가 `containerEl` 소유라 (`useViewportControl.ts:225 · 270 · 393`) 헤더 위에서 카메라 조작이 죽고 이벤트 재전달 코드가 필요해진다. 컨테이너 안이면 이벤트가 자연히 컨테이너까지 올라간다.
   - **occlusion** — DOM 층은 항상 Skia 캔버스 **위** 에 있으므로 "DOM 순서 = `orderPagesForPaint` 순서" 는 **헤더끼리의** z-order 만 정한다. 가려진 페이지 헤더가 위 페이지 **body** (Skia 가 그림) 아래 깔리게 할 수단은 clip 뿐이다: 위 페이지의 **body rect ∪ 헤더 rect** 와 겹치는 구간을 `clip-path: inset` 으로 잘라 보이지도 잡히지도 않게 한다 (§8.5 대칭 유지 · 2026-08-12 보고 재현 차단).

**위험 수용 근거**: R1 (히트 순서) 은 결과가 결정적이라 live 3 시나리오 + occlusion 1 시나리오로 회귀를 잡을 수 있고, 실패 시 Skia 선판정 코드를 되살리는 롤백이 1 커밋이다. 성능은 제스처 중 DOM 쓰기 0 이라 구조적으로 B 의 문제가 생기지 않으며 G2 가 22 페이지 문서로 확인한다.

**기각 사유**: A — 빌더 chrome 확장마다 CSS 공짜 기능을 JS 로 재구현하는 비용이 누적 (오늘 우회 3종이 그 첫 사례). B — pan/zoom 중 N 노드 DOM 쓰기가 프레임 예산 hard constraint 와 직접 충돌. D — 렌더 경로 2개를 시각 동일하게 유지해야 해 A 의 비용을 그대로 안고 교체 깜빡임까지 얻는다.

> 구현 상세: [221-canvas-page-header-dom-layer-breakdown.md](design/221-canvas-page-header-dom-layer-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                    |  심각도  | 대응                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 히트 순서 이관 — Skia pointerdown capture 선판정 · paint-rank guard · ADR-178 shift 분기 · `lastPageTitleHitRef` dblclick 판정을 DOM 핸들러로 옮기며 결과가 달라질 수 있다. 특히 **capture 가드 누락** 이면 헤더 클릭이 아래 요소를 먼저 선택한다 (round 1 h1)                          | **HIGH** | Decision 4 의 capture 가드 (`[data-page-header]` 자손 → return) 를 정적 테스트로 잠금 + G1: live 5 시나리오 (drag · shift · dblclick · 가려진 헤더 클릭 · 스페이스 pan/휠 over 헤더) 결과 동일. 실패 시 Skia 선판정 복원 롤백 1 커밋 |
| R2  | 게이트 신호 누락 — `onInteractionStart/End` 는 현재 dead prop (round 1 h2) 이라 **배선 자체가 빠지면 모든 경로에서** 대안 B 의 비용이 나고, 배선 뒤에도 pan/zoom 진입 경로 (휠 · 스페이스 pan · 핀치 · 프로그램 zoom `setZoom`) 중 하나가 게이트를 안 켜면 그 경로에서 같은 비용이 난다 |   MED    | Phase 1 에 `ViewportControlBridge` prop 배선 + 배선 정적 테스트. G2: 경로별로 제스처 중 헤더 층 DOM 쓰기 0 을 계측 (MutationObserver attribute 카운트). 프로그램 zoom 은 1회 배치라 게이트 대상 아님을 breakdown 에 명시             |
| R3  | occlusion 근사 — z-order + `clip-path` 가 Skia `ClipOp.Difference` 와 다르게 보이는 경우 (3 페이지 이상 겹침 · drag 중 겹침 진입)                                                                                                                                                       |   MED    | drag 중 겹침은 게이트 밖 (drag 는 표시 유지) 이므로 drag 종료 시 clip 재계산; 3 겹침은 위 페이지 전부의 rect 를 `clip-path: polygon` 차집합 대신 **rect 별 개별 노드 clip** 으로 단순화                                              |
| R4  | 제스처 settle 지연 체감 — 150 ms 디바운스 뒤 헤더가 "튀어나오는" 느낌                                                                                                                                                                                                                   |   LOW    | Framer 와 같은 동작이고 사용자가 원한 것. 필요 시 `opacity` 트랜지션 80 ms 만 허용 (transform 트랜지션 금지 — 1회 배치 원칙)                                                                                                         |
| R6  | G2 측정 수단 — `perf-baseline.mjs` 는 페이지 2장만 시드해 22 페이지 문서를 만들지 못한다 (round 1 m1)                                                                                                                                                                                   |   MED    | Phase 0 산출물로 `--pages N` 시드 옵션 추가 (breakdown §8). 옵션 없이 잰 수치는 G2 근거로 인용 금지 (measurement-validity Q1)                                                                                                        |
| R5  | Skia 잔존 — 프레임 타이틀이 `renderPageTitle` (Paragraph 캐시) 소비자로 남아 걷어내려던 코드 일부가 남는다                                                                                                                                                                              |   LOW    | 토큰 우회 3종 (`getBuilderCSSVariable` · 헤더 색 리졸버 · 테마 캐시 무효화 배선) 은 소비자 0 이 되므로 삭제; Paragraph 경로는 프레임 타이틀 후속 (별도 판정) 까지 유지, 본문에 사실로 기록                                           |

## Gates

| Gate | 시점                 | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                    | 실패 시 대안                                                                                 |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료         | 위 코드 사실 표가 HEAD 와 일치 (라인 재확인) · 병행 세션 (ADR-013 미커밋 sweep) 과 파일 교집합 0 확인 · `perf-baseline.mjs --pages N` 시드 옵션 추가 + 이관 전 기준선 1회 (R6)                                                                                                                                                                                                                                                               | 교집합 있으면 해당 커밋 대기 후 재freeze                                                     |
| G1   | Phase 2 종료 (R1)    | live (headed Playwright, 실제 빌더) 5 시나리오 결과 동일: ① 띠 빈 영역 drag → `pagePositions` 이동 ② shift-클릭 → body 다중 선택 토글 · `currentPageId` 무변경 ③ dblclick → 편집기 열림 · Enter 로 `renamePageTitle` · Esc 취소 ④ 겹친 페이지에서 가려진 구간 클릭 → 위 페이지 요소/body 가 잡힘 (헤더 아님) ⑤ 스페이스 누른 채 헤더 위 드래그 → 카메라 pan (페이지 이동 0) · 헤더 위 휠 → zoom/pan 동작                                     | Skia 선판정 + `pageTitleBoundsMap` 복원 (롤백 1 커밋), DOM 층은 표시 전용으로 축소 후 재판정 |
| G2   | Phase 3 종료 (R2·R6) | 22 페이지 문서 (`--pages 22` 시드) 에서 ① 휠 pan · 휠 zoom · 스페이스 pan 각각 제스처 중 헤더 층 attribute 변경 **0** (MutationObserver — 배선 정적 테스트와 별개로 live 계측) ② `pnpm perf:baseline -- --lane frame --pages 22` 의 pan/zoom 부류 p95 가 이관 전 기준선 대비 악화 없음 (headed · 같은 commit 의 before worktree — `feedback-baseline-build-separate-worktree-original-deps` · 불리 케이스 = 22 페이지 전부 뷰포트 안 10% 줌) | 게이트 누락 경로 수리; p95 악화가 settle 배치 비용이면 배치를 뷰포트 안 페이지로 컬링        |
| G3   | Phase 3 종료 (R5)    | Skia 페이지 헤더 코드 (`renderPageHeader` · `buildPageTitleBounds` · `PageTitleBounds` · 헤더 색 리졸버 · `getBuilderCSSVariable` · `onThemeChange` 의 캐시 무효화 배선) 삭제 후 `grep` 0 · 현행 5 테스트 파일이 새 계약으로 대체 · `pnpm type-check` PASS                                                                                                                                                                                   | 소비자가 남은 항목은 R5 표에 사유 기록 후 유지                                               |
| G4   | Phase 3 종료         | light/dark 전환 즉시 헤더 색 반영 (CSS 만, JS 토큰 읽기 0 — `getComputedStyle` 호출 grep 0 in `PageHeaderLayer`) · 편집기 `.page-title-edit-input` 굵기 700 으로 헤더와 일치 (round 1 l1)                                                                                                                                                                                                                                                    | —                                                                                            |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 빌더 chrome 이 CSS 토큰 · 폰트 · hover · 툴팁을 패널과 같은 방식으로 쓴다. 오늘의 우회 3종 (`getBuilderCSSVariable` · 헤더 색 리졸버 · 테마 캐시 무효화 배선) 삭제.
- 이름 편집기가 헤더 노드 안으로 들어가 Skia 가 좌표를 알려 주던 `textScene*` 채널이 사라진다 (`pageTitleEditing.ts` 의 rect 변환 삭제).
- 이후 breakpoint 라벨 · 페이지 미니 툴바가 같은 층 · 같은 게이트 규칙으로 붙는다 (Decision 1 이 정본).
- pan/zoom 중 헤더 층 DOM 쓰기 0 — 프레임 예산은 Skia 가 그대로 쓴다.

### Negative

- pan/zoom 중 헤더가 보이지 않는다 (의도된 동작이나 Skia 시절과 다르다). 사용자가 원한 Framer 동작.
- 히트 판정이 두 층으로 나뉜다 — 헤더는 DOM 이벤트 (컨테이너 capture 가드가 길을 터 줌), 나머지 캔버스는 Skia 캡처. `canvas-interaction.md` §8.5 에 "페이지 헤더는 DOM 층이 자체 수신 (capture 가드 `[data-page-header]`) · occlusion 은 헤더 간 DOM 순서 + 위 페이지 body∪헤더 rect clip-path" 한 줄을 추가해야 한다 (Phase 4).
- 프레임 타이틀은 Skia `renderPageTitle` (Paragraph 캐시) 에 남아 타이틀 렌더 경로가 페이지/프레임으로 갈린다 — 후속 판정 항목.
- `BuilderCanvas.tsx` pointerdown capture 에서 타이틀 분기 (~120 줄) 가 빠지고 `PageHeaderLayer` 로 옮겨 가는 만큼, 이 파일을 참조하는 정적 테스트 (`BuilderCanvas.pageTitleEditing.static.test.ts`) 를 새 위치로 다시 잠가야 한다.

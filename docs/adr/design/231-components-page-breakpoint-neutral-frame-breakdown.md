# ADR-231 설계 breakdown — Components 페이지의 breakpoint 중립 frame

> 본문: [231](../completed/231-components-page-breakpoint-neutral-frame.md). 구현 상세 (Phase · 파일 변경표 · 게이트 실행 기록) 는 이 파일에만 둔다.

## 1. 전제 lock-in (fork 4 질문)

사용자 진술 2026-09-22: "components page 는 breakPoint 에 영향을 받을 필요가 없는 page 이지 않나?" — 새 ADR (기존 ADR 분리 아님). 확정은 `/review-adr 231` 종결 또는 사용자 confirm 으로.

1. **base / 응용**: ADR-228 (Components 페이지 = origin 전집 페이지) · 154 (breakpoint = 사용자 페이지 반응형 축) · c849fdd52/b290d75da (페이지 frame = body 저작 크기) 가 base. 이 ADR 은 그 위의 **Components 페이지 frame 응용** — 전부 Implemented 라 prerequisite 충족.
2. **schema 직교성**: canonical 스키마 변경 0. body `props.style` 부재 키 채움 (F4 기존 계약) + 빌더 viewport 채널 (`pageContentHeights`, 문서 밖) 뿐. 227/229/230 과 직교 — origin 노드 무변경.
3. **선행 전제 reverse 검증**: ADR-154 의 "모든 페이지 노드를 activeBreakpoint 로 resolve" 는 **그대로 승계** (대안 C 기각 근거 — F6 채널 보존). 반대 방향 (Components 가 breakpoint 의 base) 은 성립하지 않는다 — origin 은 override 를 _가질 뿐_ frame 은 소비 뷰포트가 아니다.
4. **codex 1차 진입**: 본문 작성 완료 후 `/review-adr 231`.

## 2. 코드 사실 inventory

본문 §코드 사실 F1~~F10 (2026-09-22, main `a74700961`). Phase 0 에서 재grep 하고 아래 F11~~F13 을 추가 확정한다.

| ID  | Phase 0 확정 항목                                                                                                         | 방법                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| F11 | 시드 origin 86 (RAC 57 · item 2 · 상태 변형 23 · 조합 자식) 중 `height: %` / `height: 100%` 를 root style 에 가진 것의 수 | `ensureTemplateOrigins` 시드 표 + catalog `containerStyles` grep             |
| F12 | 기존 프로젝트 (사용자 IndexedDB) Components body 실제 style 키 — 사용자가 손댄 width/height/overflow 유무                 | headed builder `useCanonicalDocumentStore` 읽기 (Chrome MCP 또는 Playwright) |
| F13 | 레이아웃 발행 → 페이지별 body 높이를 실을 기존 채널 유무 (`useViewportSyncStore` · `useScrollState.updateMaxScroll` 이웃) | grep `pageContentHeight` · `bodyHeight` · `updateMaxScroll` 소비처           |

## 3. Phase

각 phase 종료 시 commit 가능 상태 (type-check PASS · 해당 unit GREEN). Preview/Publish leg 없음 (F8) — 대칭 검증은 Skia 1 leg + store.

### Phase 0 — inventory freeze (G0)

- F1~~F10 재grep (라인 drift 반영) · F11~~F13 확정 · 본문 §코드 사실 갱신.
- 산출: 이 파일 §2 표 완성 · ledger `pnpm agent:run`.

### Phase 1 — frame 폭 · 높이 · 스크롤 (G1)

1. `scene/pageFrameSize.ts` — `readPageFrameSize(pageId, …)` 에 Components 분기: 페이지가 `isComponentsPageMirror` 면 `width = 저작 width ?? CANVAS_VIEWPORT.desktop.width`, `height = 저작 height ?? max(CANVAS_VIEWPORT.desktop.height, publishedContentHeight ?? 0)` — 저작 height/maxHeight 가 있으면 그 값 (리뷰 m3 · HC 저작값 우선). 사용자 페이지 경로 무변경 (unit 기존 5 GREEN 유지). 주석에 "레이아웃 결과를 읽는 유일한 예외 (ADR-231)" 명시.
2. `scene/buildSceneIndex.ts` `buildPageFrames` — `pageContentHeights` 입력 추가 (구조 스냅샷 입력 `BuildSceneStructureInput` 확장 · `BuilderCanvas` 가 viewport store 에서 읽어 넘김).
3. `layout/engines/fullTreeLayout.ts` Step 1.5 — root body 가 Components 페이지면 `width = 1920` (저작 없을 때) · `minHeight = 1080` · **`bodyViewportHeight` 미설정** (보고 높이 = 내용) — 저작 height/minHeight 가 있으면 현행 분기 그대로 (Step 1.5 는 저작값을 덮지 않는다, 리뷰 m3): 그 body 는 GAP 4 스크롤이 남는다. 판정 입력은 `elementsMap` 의 body 노드 metadata 가 아니라 caller 가 넘기는 플래그 (`isBreakpointNeutralRoot`) — 엔진 파일이 페이지 술어를 import 하지 않도록.
4. `scene/layoutCache.ts` · `hooks/useLayoutPublisher.ts` — Components 페이지의 `pageWidth/pageHeight` 입력을 1920×1080 상수로 치환 (dimension key 도 상수 → 뷰포트 치수만으로는 breakpoint 전환에 캐시 miss 0. origin 에 override 가 있으면 responsive 해소 시그니처 (`pageLayoutSignature`) 가 바뀌어 miss 하는 것은 현행 그대로 — 리뷰 h1). **발행 높이는 key 에 넣지 않는다** (R1).
5. 발행 채널 — `useLayoutPublisher` 가 layout map 의 body 높이를 `useViewportSyncStore.setPageContentHeight(pageId, height)` 로 싣는다 (Components 페이지 한정 · 값 같으면 no-op). 구조 스냅샷 useMemo dep 에 추가.
6. `pages/systemComponentsPage.ts` — 시드 style 무변경 (`overflow:auto` 유지). 기존 문서에는 부재 키만 채우는 계약이라 시드값을 바꿔도 기존 body 에는 닿지 않고, 스크롤 제거는 3번 (보고 높이 = 내용) 만으로 성립한다 — GAP 4 가 `내용 extent − 보고 높이 = 0` 을 발행. unit 으로 `maxScrollTop = 0` 을 고정.
7. unit: `pageFrameSize.test.ts` (+3: Components 폭 · floor · 발행 높이) · `fullTreeLayout` Step 1.5 (+2: 보고 높이 = 내용 · maxScroll 0) · `useLayoutPublisher` publish 횟수 spy (+1: 발행 높이 갱신 뒤 재발행 0 — R1) · `%` 높이 origin 자식 (+1, F11 결과에 따라).

### Phase 2 — 위치 스냅샷 · live · 성능 · BC (G2 · G3 · G4)

1. `stores/elements.ts` `calculatePagePositions` · `calculateNextPagePosition` — 입력 `pages` 에서 시스템 페이지 (`systemOwned` — 지금은 Components 하나, `isComponentsPageMirror` 는 부분집합) 를 **제외**하고 사용자 페이지만 현행 산술로 배치한 뒤, 시스템 열을 결과에 더한다: `x = homeX − (max(pageSizes[system].width) + gap)`, `y = homeY + Σ(앞선 시스템 페이지 높이 + gap)` (`homeX/homeY` = 첫 사용자 페이지 위치). 사용자 판정 2026-09-22 ×2 — Home 이 (0,0), 시스템 페이지는 왼쪽 세로 열이라 Layouts 탭 분리 · Customize 페이지가 생겨도 아래로 쌓인다 (새 정책 0). 격자 참여 0 이므로 겹침 경로 없음 (사용자 페이지 x ≥ homeX, 시스템 열 오른쪽 끝 = homeX − gap). unit: 세 방향 × [Components, Home, P2, P3] → 사용자 페이지 위치 = 시스템 페이지 부재 시와 동일 · Components = (homeX − 2000, homeY) (gap 80) · 시스템 페이지 2개 fixture 는 두 번째가 (homeX − 2000, homeY + h₁ + gap) · `calculateNextPagePosition` 은 시스템 페이지를 무시.
2. `stores/elements.ts` `switchPagePositionsBreakpoint` · `initializePagePositions` (align) · hydration — **시스템 페이지 위치는 breakpoint 공통값 하나** (리뷰 round 2 m2): `switchPagePositionsBreakpoint` 는 시스템 페이지를 대상 스냅샷 · `firstEntryPositions` 적용에서 제외하고 `currentPositions` 값을 그대로 `nextPositions` 에 싣는다 (전환은 시스템 위치를 읽지도 쓰지도 않는다). 첫 진입 `calculatePagePositions(…, pageSizes)` 는 사용자 페이지만 (1번 산술의 사용자 부분, caller `BuilderCore.tsx:540-558` 가 `allPageFrames` 로 `pageSizes` 를 만든다). `updatePagePosition` (드래그) · align 이 시스템 페이지를 쓸 때는 `pagePositionsByBreakpoint` 세 값 + canonical `pagePositions` 세 breakpoint 에 같은 값 (스키마 무변경 · history 는 현행 entry 하나). hydration (`initializePagePositions` persisted 병합): 시스템 페이지의 breakpoint 별 값이 다르면 **활성 breakpoint 의 값** 을 공통값으로 채택. 열 산술은 align 과 위치가 전혀 없는 새 문서에만. unit: 드래그 (−2500,200) → mobile 첫 진입 (−2500,200) · 기존 문서 desktop (0,0) / mobile (10,10) 을 mobile 활성으로 열면 (10,10) · 사용자 페이지는 현행 (스냅샷 복원 · 첫 진입 산술).
3. `stores/utils/pageFrameReflow.ts` `computePageFrameReflow` + caller `BuilderCanvas.tsx:656-700` — **열/격자 경계** (리뷰 round 2 h1 실행 반증: Components (−2000,0) 1080→3000 · Home (0,0) · P2 (0,1160) → 현행은 vertical/auto 에서 P2 → 3080). 입력에 `systemPageIds: ReadonlySet<string>` 추가: 바뀐 페이지가 시스템이면 시스템 페이지만 순회하며 세로 규칙 (`y > origin.y` → `dy`, 전역 방향 무관), 사용자 페이지면 시스템을 건너뛰고 현행 규칙. unit: 리뷰 반례 → `[]` (세 방향) · 시스템 2개 fixture (두 번째 (−2000,1160)) → 두 번째만 (−2000,3080) · Home 1080→2000 (vertical) → P2 만 이동 · Components 무이동.
4. live 하니스 (headed Playwright 또는 Chrome MCP · `scripts/` 전용 vitest config): (1) override 없는 문서: desktop→tablet→mobile→desktop 전환 4회 — Components frame `{x,y,width,height}` Δ0 · 사용자 페이지 3개 frame/위치 = 종전 스냅샷 · origin 86 bbox 가 frame 안 · `maxScrollTop(body) = 0`. (2) origin 1 개에 mobile `paddingTop` + `height` override 저장 후 왕복 — `{x,y,width}` Δ0 · `Δheight == Δ내용 extent` (layout map 의 body 자식 maxBottom 차로 예측) · mobile 뷰 instance 반영 · desktop 복귀 base. (3) align 버튼 · localStorage 스냅샷 초기화 후 첫 진입 · 새 페이지 추가 — Home (0,0)/(leftInset,0) · Components (homeX − 2000, 0) · 페이지 bbox 쌍 교집합 0 · Components 드래그 좌표 보존. **Compare Mode/Preview 는 열지 않는다** (메모리 `feedback-no-compare-mode-preview-checks-now`).
5. 성능 A/B (G3): `pnpm perf:baseline -- --lane frame` 유사 — 600 요소 문서 `scene.build` · layout publish p95, before/after 7회 median.
6. BC (G4): 기존 문서 reload 2회 — Δnode 0 · body style diff = 부재 키만 · 두 번째 열기 페이지 위치 Δ0.
7. 문서: 본문 `### Live Exercise` · README 완료 표 · CHANGELOG (사용자-가시).

## 4. 파일 변경표 (예상)

| 파일                                                                                            | 변경                                                                | Phase |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | :---: |
| `workspace/canvas/scene/pageFrameSize.ts` (+test)                                               | Components 분기 (폭 상수 · 높이 = max(floor, 발행))                 |   1   |
| `workspace/canvas/scene/buildSceneIndex.ts` · `buildSceneSnapshot.ts` · `sceneSnapshotTypes.ts` | `pageContentHeights` 입력                                           |   1   |
| `workspace/canvas/layout/engines/fullTreeLayout.ts` (+test)                                     | Step 1.5 `isBreakpointNeutralRoot` 플래그 · 보고 높이 = 내용        |   1   |
| `workspace/canvas/scene/layoutCache.ts` · `hooks/useLayoutPublisher.ts` (+test)                 | Components 페이지 입력 상수화 · 발행 높이 채널 (key 미포함)         |   1   |
| `workspace/canvas/stores/viewportSync*.ts`                                                      | `pageContentHeights` + setter (no-op 가드)                          |   1   |
| `workspace/canvas/BuilderCanvas.tsx`                                                            | 채널 배선 (구조 스냅샷 dep) · reflow caller 에 `systemPageIds` 전달 |  1·2  |
| `stores/elements.ts` (+test) · `main/BuilderCore.tsx`                                           | 위치 스냅샷 교체 제외 · 첫 진입 `pageSizes`                         |   2   |
| `scripts/` live 하니스 · `docs/adr/evidence/231-*.md`                                           | G2 · G3 · G4 기록                                                   |   2   |

새 상수 0 (`CANVAS_VIEWPORT.desktop` 재사용) · 새 스키마 필드 0 · i18n 0.

## 5. 게이트 실행 기록

### G0 — Phase 0 inventory freeze (2026-09-22, HEAD `12063c042`)

- F1~F10 재grep: 라인 일치 (F1 `Workspace.tsx:56 · 76 · 90` · F3 `pageFrameSize.ts:46 · 65` / `buildSceneIndex.ts:94` · F4 `systemComponentsPage.ts:46 · 72` · F5 `fullTreeLayout.ts:2862 · 2898 · 3553 · 3571` · F6 `BuilderCanvas.tsx:345` / `useLayoutPublisher.ts:159` · F7 `BuilderCore.tsx:548 · 576` / `elements.ts:2508` · F9 `useLayoutPublisher.ts:72-76` · F10 `BuilderCanvas.tsx:660`). `a74700961..12063c042` 는 imageCache 만 — 대상 파일 무변경.
- F11: origin root style 에 `height: %` **0**. catalog `height: "100%"` 2건은 Meter · ProgressBar 의 `.fill` sub-part (고정 높이 track 안) — body 직계가 아니라 R2 무관.
- F12: 사용자 IndexedDB 문서의 Components body style 은 Phase 2 live 하니스가 store 에서 읽어 기록 (시드 경로는 width/height 를 쓴 적이 없으므로 사용자가 Size 를 손대지 않은 한 부재).
- F13: 페이지별 body 높이 발행 채널 **부재** (`pageContentHeight` grep 0). `useViewportSyncStore` (`stores/viewportSync.ts`, `canvasSize`/`containerSize` 이웃) 에 신설. 발행자 = `useLayoutPublisher` 의 페이지 루프 (layout map 의 body 높이), 소비자 = `buildSceneStructureSnapshot` → `buildPageFrames`.
- 루프 분석 (R1): `sceneVersion` 은 `visiblePagePositionVersion` (frame 크기 포함) 을 넣으므로 frame 높이 갱신 → `projectionVersion` → publisher effect 1회 재실행. 그 실행은 `pageLayoutSignature` · dimension key 가 같아 `getCachedPageLayout` **캐시 hit (엔진 0)** 이고 같은 높이를 다시 싣는 setter 는 no-op — 2회째 재실행 없음. G1 (c) 의 계측 단위 = 엔진 호출 (`getCachedPageLayout` 입력의 pageWidth/pageHeight 가 상수인지 + setter no-op).

### G1 — Phase 1 frame 폭·높이·스크롤 + 발행 채널 (2026-09-22)

- 구현: `pageFrameSize.ts` `resolveNeutralPageFrameSize` + `readPageFrameSize(…, { neutral, publishedContentHeight })` · `buildSceneIndex.buildPageFrames` (`isComponentsPageMirror` → neutral · `pageContentHeights` 입력) · `viewportSync.ts` `pageContentHeights` + `setPageContentHeight` (no-op 가드) · `fullTreeLayout.ts` `FullTreeLayoutOptions.breakpointNeutralRoot` (Step 1.5 `bodyViewportHeight` 미설정) · `layoutCache.ts` 옵션 전달 + 캐시 entry 비교 · `rendererInput.ts` / `useLayoutPublisher.ts` (Components 는 1920×1080 상수 입력 · body 높이 발행) · `BuilderCanvas.tsx` (구조 스냅샷 입력 · publisher 입력 · `__composition_SCENE_DEBUG__.readPageFrames`).
- unit: `pageFrameSize.test.ts` +3 · `buildPageFrames.test.ts` +1 · `useLayoutPublisher.test.ts` +2 (G1 (a) · (c) — 엔진 입력 상수 · 같은 높이 store no-op 참조 유지) · 인접 스위트 scene/hooks/stores/layout/renderers 102 파일 828/828.
- browser (`tests/parity/bodyViewportBox.browser.test.ts` +4, G1 (b) · (b′) · (d)): 중립 root 넘침 → 보고 높이 1200 (뷰포트 400 아님) · 짧으면 floor · 저작 height 300 은 그대로 · flex-wrap row 시드 모양 5행 = 644. 하니스 함정: `pipelineLeg` 의 pageH 는 content-box 라 padded body 의 floor 는 pageH + padding.
- live smoke (`scripts/adr231-components-frame-live.mjs --phase 1`, headed Chrome, 새 프로젝트): **7/7** — origin 86 · frame 1920×4881 = 발행 body 높이 · originMaxBottom 4857 ≤ 4881 · `maxScrollTop 0` · body style 시드 키만 · desktop→tablet→mobile→desktop 왕복 Components [1920,4881] ×4 · 사용자 페이지 768×1024 / 390×844 / 1920×1080 · pageerror 0. 기록 `docs/adr/evidence/231-components-frame-live/phase1-live.json`.
- F12 실측: 새 프로젝트 body style = `{overflow, display, flexDirection, flexWrap, alignItems, alignContent, gap, padding}` — width/height 부재 (R7 경로 없음).
- 하니스 함정: RAC ToggleButton `id` 는 DOM id 가 아니다 → `.builder-control-group button` nth 로 · store `Page.slug` 는 `/__components`.

### G2 — Phase 2 시스템 페이지 열 · reflow 경계 · breakpoint 공통 위치 (2026-09-22)

- 구현: `stores/utils/pageFrameReflow.ts` `systemPageIds` (열/격자 경계 — 시스템 변화는 시스템만 세로로 · 사용자 변화는 사용자만) · `stores/elements.ts` `placeSystemColumn` / `splitSystemPages` / `resolveSystemPageIds` / `resolvePagePlacementInputs` / `mirrorSystemPagePositions` / `buildPagePositionWriteEntries` — `calculatePagePositions` · `calculateNextPagePosition` (시스템 제외 + 왼쪽 열) · `initializePagePositions` (hydration 활성값 공통화) · `switchPagePositionsBreakpoint` (시스템은 현재값 그대로 · 첫 진입 `pageSizes`) · `updatePagePosition` / `applyPageFrameReflow` / `updatePagePositionsBatch` (세 breakpoint 동시 쓰기 · history 세 entry) · `viewport/pageLayoutActions.ts` align (세 entry) · `hooks/usePageManager.ts` 새 페이지 (시스템 무시) · `BuilderCanvas.tsx` reflow caller.
- unit: `pageFrameReflow.test.ts` +4 (리뷰 round 2 h1 실행 반례 → `[]` 세 방향 · 시스템 2개 +1920 · Home 변화 시스템 0 · 호환) · `pagePositionsFrameSizes.test.ts` +5 (리뷰 h2 산술 390·80·1000 → Home (0,0) · P2 (470,0) · Components (−2000,0) · 세 방향 · leftInset · 시스템 2개 누적 · 사용자 페이지 0 · next 무시) · `systemPagePositions.test.ts` +4 (전환 현재값 · 드래그 세 스냅샷 · hydration 활성값 · align 열) · 인접 stores/viewport/scene/hooks/settings 144 파일 1111/1111.
- live (`scripts/adr231-components-frame-live.mjs --phase 2`, headed Chrome, 새 프로젝트): **15/15** — Phase 1 의 7 + 전환 왕복 위치 Δ0 ([−2000,0] ×4) · 새 문서 hydration Components (−2000,0) = homeX − (1920+80) · 드래그 finish (`updatePagePosition` (−2500,200)) 후 mobile→desktop 왕복 보존 · reload 후 (−2500,200) · 1920 · 높이 = 발행 · 새 페이지 (Navigator "페이지 추가" 실입력) → (0,1160) · Components 불변 · align (줌 메뉴 → 페이지 정렬 실입력, auto) → Home (2055,0) (leftInset) · Components (55,0) = homeX − 2000 · 페이지 bbox 쌍 겹침 0 · origin 1 개 (`component-iconbutton`) mobile `height` override (tier 토글 ON → `responsive.styles.height.mobile = 600px`) → mobile frame 4881→5451 = 발행 body 높이 (내용 함수) · desktop 복귀 4881 · width/x/y Δ0. 기록 `docs/adr/evidence/231-components-frame-live/phase2-live.json`.
- 하니스 함정: Components 가 x<0 이라 보이는 페이지만 레이아웃 → 읽기 전 `__composition_APPLY_VIEWPORT__` 로 열 쪽으로 pan (`showComponents`) · `updateSelectedStyle(property, value)` 시그니처 · ADR-154 개정 1 — tier 토글 (`setResponsiveStyleOverrideEnabled`) 없이는 base 에 쓴다 · align 은 줌 메뉴 `.zoom-menu-item[data-key="align-pages"]`.

### G3 — 성능 A/B (2026-09-22) — **PASS (단계 분해 재측정)** · 1차 수치는 하니스가 계약 밖 구간을 더한 headless total

- **1차 (게이트 미달로 기록됐던 것)**: `scripts/adr231-frame-perf-ab.mjs` headless · total = 편집 시작 → rAF 폴링으로 layout map 갱신을 관측할 때까지 (render frame + rAF 대기 포함) · after = Phase 1 빌드 (`ba14e85d3`). Components origin 편집 +2.4 ~ +5.0 ms (r1~~r4, 4 짝 모두). probe 로 publisher 실행 30/30 · signature 동급 · body 높이 불변 · sceneVersion 동일 → 코드 경로로 잡히지 않았다. 판독 (Codex, 사용자 전달 2026-09-22): "G3 계약은 scene.build · layout publish 비용인데 하니스는 프레임 대기를 포함한다 · headless · Phase 1 기준 → 현재 HEAD 에서 headed 로 scene.build → layout → 명령 생성 → draw → 관측 대기를 분리".
- **분해 하니스** `scripts/adr231-frame-decomp-ab.mjs` (신규): 편집마다 `__composition_PERF__.reset()` → 관측 후 라벨 누적치 — commit (동기 store) · `scene.build` · `layout.publish` (신규 라벨, 발행 effect 본문 — 계측 커밋 `e85b8d359`, before arm 에도 같은 계측을 얹은 worktree 커밋 `fbb27e7d7`) · `render.frame` (= content.build + plan.build + skia.draw[record/flush]) · other (= total − 위 합 = React 커밋 · 오버레이 DOM · rAF 대기). before = `12063c042` + 계측 (5174) · after = Phase 2 HEAD + 계측 (5175), 둘 다 별도 worktree · 같은 lockfile · engine-pkg/wasm 복사. arm 마다 새 브라우저 + 새 프로젝트 + 시드 600 mixed · 짝마다 arm 순서 교대 · 워밍업 5 + 30회 × 3 반복 (Home 대조군 2) · Components 뷰포트 0.12 (페이지 전체가 보인다) · DPR 2 · CPU throttle 1 · visibilityState visible.
- **결과** (p95 median → 뒤 괄호 Δ · 기록 `evidence/231-components-frame-live/g3-decomp/*` (local, gitignored)):

  | 조건                                                          | op                     | total (p95 / p50)                                                                          | scene.build            | layout.publish              | render.frame     | other            |
  | ------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------------------- | ---------------- | ---------------- |
  | headed Chrome · 4 짝                                          | Components origin 편집 | 59.0→59.6 (+0.6) / 56.4→56.7 (+0.3)                                                        | 2.6→2.6 (0)            | 29.8→29.8 (0)               | 9.2→9.7 (+0.5)   | 19.6→19.2 (−0.4) |
  | headed Chrome · 4 짝                                          | Home 편집 (대조군)     | 45.2→47.6 (+2.4) / 42.8→42.9 (+0.1)                                                        | 2.7→2.7 (0)            | 19.1→19.2 (+0.1)            | 3.9→4.8 (+0.9)   | 19.8→20.6 (+0.8) |
  | headless · 2 짝                                               | Components origin 편집 | 61.5→66.4 (+4.9) / 57.3→58.8 (+1.5)                                                        | 2.7→3.6 (+0.9 · p50 0) | 30.9→31.3 (+0.4 · p50 +0.8) | 10.0→10.9 (+0.9) | 19.4→19.9 (+0.5) |
  | headed · Home 만 보임 (두 arm 모두 Components 화면 밖) · 2 짝 | Home 편집              | 35.6→33.2 (−2.4) / 33.9→32.4 (−1.5)                                                        | 2.9→2.8 (−0.1)         | 12.9→11.0 (−1.9)            | 2.5→2.3 (−0.2)   | 19.2→18.6 (−0.6) |
  | headless · 종전 하니스 · Phase 2 HEAD 재실행 (7 반복)         | Components / Home      | 59.2→61.8 (+2.6) / 42.4→43.7 (+1.3) — run 분포 겹침 (before 56.9~~67.2 · after 59.6~~66.8) | —                      | —                           | —                | —                |

- **판정**: 게이트 계약 지표 (`scene.build` · `layout.publish` p95 Δ) 는 headed **Δ0 / Δ0**, headless +0.9 / +0.4 — 모두 ≤ +1 ms → **G3 PASS**. 1차의 +2.4~~+5 는 (i) headless (software GL) 에서 render frame · rAF 대기 꼬리가 넓어진 것 + (ii) 하니스 total 이 계약 밖 구간 (`render.frame` + other) 을 더한 것. headed 에서는 그 total 도 +0.6 (Home 대조군 total p95 +2.4 는 p50 +0.1 · 짝별 분포 겹침 — 꼬리 잡음).
- **잔차 (계약 밖, 원인 확정)**: `render.frame` +0.5 ms p95 = `render.skia.draw` (record +0.2 · flush +0.2). Components 가 화면에 있을 때만 나고 (Home 만 보이게 하면 frame Δ −0.2 · draw Δ0), 이유는 after 가 페이지 전체 (4881 · origin 86) 를 그리고 before 는 body 1080 clip 안의 일부만 그리기 때문 — 이 ADR 의 목적 (내용이 스크롤에 갇히지 않는다) 그 자체다. 0.12 줌에서 페이지 전체가 보일 때 frame p95 9.7 ms (< 16.7). 수리 대상 아님.
- 하니스 함정: before 빌드에는 `readPageFrames` 가 없다 → store `pagePositions` 폴백 · before 빌드는 Components 가 (0,0) · Home 이 (0,1160) 이라 "Home 만 보이는" 뷰포트는 arm 마다 Home 위치 기준으로 계산해야 한다 (고정 좌표 (40,80)·0.3 은 after 에서 Components 열 오른쪽 16 px 띠를, (700,80) 은 열 전체를 화면에 올린다) · `--headless` 는 chromium headless (software GL), headed 는 `channel: "chrome"`.

### G4 — BC (2026-09-22)

- `scripts/adr231-bc-live.mjs` (headless, 새 프로젝트 → 드래그 커밋 (−2400,120) → reload 2회): Δnode 0 (nodeCount 동일 3회) · Components body style 키 동일 (`overflow · display · flexDirection · flexWrap · alignItems · alignContent · gap · padding`) · reload 간 pagePositions 동일 · 저장 `pagePositionsByBreakpoint` desktop/tablet/mobile 모두 (−2400,120) (세 breakpoint 동시 쓰기 확인). Phase 2 live (15/15) 의 reload 항목과 합쳐 G4 PASS.

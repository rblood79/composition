# ADR-231 설계 breakdown — Components 페이지의 breakpoint 중립 frame

> 본문: [231](../231-components-page-breakpoint-neutral-frame.md). 구현 상세 (Phase · 파일 변경표 · 게이트 실행 기록) 는 이 파일에만 둔다.

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
2. `stores/elements.ts` `switchPagePositionsBreakpoint` · `initializePagePositions` (align) — 1번 산술 그대로 (첫 진입 `pageSizes` 전달, caller `BuilderCore.tsx:540-558` 가 `allPageFrames` 에서 만든다). 기존 스냅샷이 있는 breakpoint 는 재배치 0 · 사용자가 시스템 페이지를 드래그한 좌표는 스냅샷 보존, align 때만 열로 복귀.
3. `BuilderCanvas.tsx:656-700` Δ reflow — Components 발행 높이 변화도 같은 규칙으로 뒤 페이지를 민다 (변경 0 예상 · unit +1 로 고정).
4. live 하니스 (headed Playwright 또는 Chrome MCP · `scripts/` 전용 vitest config): (1) override 없는 문서: desktop→tablet→mobile→desktop 전환 4회 — Components frame `{x,y,width,height}` Δ0 · 사용자 페이지 3개 frame/위치 = 종전 스냅샷 · origin 86 bbox 가 frame 안 · `maxScrollTop(body) = 0`. (2) origin 1 개에 mobile `paddingTop` + `height` override 저장 후 왕복 — `{x,y,width}` Δ0 · `Δheight == Δ내용 extent` (layout map 의 body 자식 maxBottom 차로 예측) · mobile 뷰 instance 반영 · desktop 복귀 base. (3) align 버튼 · localStorage 스냅샷 초기화 후 첫 진입 · 새 페이지 추가 — Home (0,0)/(leftInset,0) · Components (homeX − 2000, 0) · 페이지 bbox 쌍 교집합 0 · Components 드래그 좌표 보존. **Compare Mode/Preview 는 열지 않는다** (메모리 `feedback-no-compare-mode-preview-checks-now`).
5. 성능 A/B (G3): `pnpm perf:baseline -- --lane frame` 유사 — 600 요소 문서 `scene.build` · layout publish p95, before/after 7회 median.
6. BC (G4): 기존 문서 reload 2회 — Δnode 0 · body style diff = 부재 키만 · 두 번째 열기 페이지 위치 Δ0.
7. 문서: 본문 `### Live Exercise` · README 완료 표 · CHANGELOG (사용자-가시).

## 4. 파일 변경표 (예상)

| 파일                                                                                            | 변경                                                         | Phase |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | :---: |
| `workspace/canvas/scene/pageFrameSize.ts` (+test)                                               | Components 분기 (폭 상수 · 높이 = max(floor, 발행))          |   1   |
| `workspace/canvas/scene/buildSceneIndex.ts` · `buildSceneSnapshot.ts` · `sceneSnapshotTypes.ts` | `pageContentHeights` 입력                                    |   1   |
| `workspace/canvas/layout/engines/fullTreeLayout.ts` (+test)                                     | Step 1.5 `isBreakpointNeutralRoot` 플래그 · 보고 높이 = 내용 |   1   |
| `workspace/canvas/scene/layoutCache.ts` · `hooks/useLayoutPublisher.ts` (+test)                 | Components 페이지 입력 상수화 · 발행 높이 채널 (key 미포함)  |   1   |
| `workspace/canvas/stores/viewportSync*.ts`                                                      | `pageContentHeights` + setter (no-op 가드)                   |   1   |
| `workspace/canvas/BuilderCanvas.tsx`                                                            | 채널 배선 (구조 스냅샷 dep · Δ reflow 무변경)                |  1·2  |
| `stores/elements.ts` (+test) · `main/BuilderCore.tsx`                                           | 위치 스냅샷 교체 제외 · 첫 진입 `pageSizes`                  |   2   |
| `scripts/` live 하니스 · `docs/adr/evidence/231-*.md`                                           | G2 · G3 · G4 기록                                            |   2   |

새 상수 0 (`CANVAS_VIEWPORT.desktop` 재사용) · 새 스키마 필드 0 · i18n 0.

## 5. 게이트 실행 기록

(Phase 진행 시 기재 — G0 → G4)

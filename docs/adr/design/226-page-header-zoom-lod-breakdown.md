# ADR-226 구현 설계: 페이지 헤더 DOM 층 줌 LOD

정본: [ADR-226](../226-page-header-zoom-lod.md)

작성일: 2026-09-19. 코드 사실은 이 날짜의 main (`1cb5c9b5b`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in

- base / 응용: ADR-221 (페이지 헤더 DOM 층 · 제스처 게이트 · 단일 drag 추종) 이 base 이고 이 ADR 은 그 층의 **부하 정책** (제스처 중 프레임 집합 동결 + 헤더 폭 티어) 만 더하는 응용이다. 221 의 4 규칙 (경계 · 게이트 · 단일 drag · 히트 순서) 은 바꾸지 않는다.
- schema: 문서 schema · canonical · store 필드 변경 0. 헤더 노드의 `data-lod` attribute 와 CSS 만 새로 생긴다.
- 의존 방향: 221 → 226 한 방향. 226 이 221 의 게이트 신호 (`useViewportSyncStore.cameraGestureActive`) 를 **읽기만** 한다 — 신호를 새로 만들지 않는다.
- fork 아님: 연구 문서 [PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md](../../explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md) §4-2 의 실행 ADR. sub-phase 분할 없음 (Phase 3 개, 파일 ≤ 10).

## 2. Phase 0 코드 사실 표 (2026-09-19 실측, `1cb5c9b5b`)

| #   | 사실                                                                                                                                                                                                                                                                  | 경로:라인                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 헤더 층 입력 = `sceneStructureSnapshot.document.visiblePageFrames` — 뷰포트 컬링 (200 px 화면 마진) 결과. 제스처 중에는 `transientVisiblePageIds` 가 presentation 구독으로 갱신되어 BuilderCanvas 가 재렌더되고 이 prop 참조가 바뀐다                                 | `BuilderCanvas.tsx:641-690` (transient 갱신) · `:1648` (prop) · `scene/buildSceneSnapshot.ts:153-162` · `scene/buildVisiblePageSet.ts:7,17-49` |
| F2  | 층 컴포넌트는 `frames` 를 `orderPagesForPaint` 로 정렬해 `PageHeaderItem` (memo, key = pageId) 을 그린다 — 집합이 바뀌면 React 가 항목을 mount/unmount 한다 (div + Play 버튼 + span + X 버튼 + svg 2)                                                                 | `overlay/pageHeader/PageHeaderLayer.tsx:105-117 · 210-280`                                                                                     |
| F3  | 배치 훅은 제스처 중 **쓰기만** 게이트한다 (`gestureActiveRef` early return · `[layerNode, frames]` layoutEffect skip) — 주석이 "팬/줌은 transientVisiblePageIds 재계산으로 frames 참조를 매 프레임 바꿔 이 이펙트를 재실행시킨다" 고 명시. mount/unmount 는 게이트 밖 | `overlay/pageHeader/usePageHeaderPlacement.ts:170-177 · 181-186 · 202-227`                                                                     |
| F4  | 게이트 신호 = `useViewportSyncStore.cameraGestureActive` (setter `setCameraGestureActive`, 같은 값이면 no-op). 소비자는 배치 훅 하나                                                                                                                                  | `canvas/stores/viewportSync.ts:17 · 34 · 87-93`                                                                                                |
| F5  | settle 카메라 = `useViewportSyncStore.zoom` (BuilderCanvas 가 presentation 과 대조하는 미러). 제스처 중 presentation 과 다르고, 층 컴포넌트는 zoom 을 받지 않는다                                                                                                     | `BuilderCanvas.tsx:425 · 655-661`                                                                                                              |
| F6  | 헤더 화면 폭 = `frame.width × zoom`, 높이 28 고정 · 간격 8. 안쪽 chrome = padding `--spacing-xs` ×2 + 액션 버튼 20 ×2 + gap `--spacing-sm` ×2 (≈ 64 px)                                                                                                               | `overlay/pageHeader/pageHeaderGeometry.ts:19-20 · 46-59` · `PageHeaderLayer.css:47-56 · 110-122`                                               |
| F7  | 페이지 폭 = breakpoint 프리셋 desktop 1920 · tablet 768 · mobile 390 → 줌 하한 0.1 에서 헤더 폭 192 · 76.8 · 39 px                                                                                                                                                    | `workspace/canvasBreakpoints.ts:16-18` · `viewport/ViewportController.ts:72` (`minZoom` 0.1)                                                   |
| F8  | 액션 버튼 2 (Play · Close) 는 `onPress` 미배선 ("동작 보류") — compact 티어에서 빼도 기능 손실 0                                                                                                                                                                      | `PageHeaderLayer.tsx:254-275`                                                                                                                  |
| F9  | 이름 편집 중 (`data-editing`) 헤더는 `<input>` 을 품는다. 편집 중 페이지가 목록에서 빠지면 편집기를 닫는 이펙트가 있다                                                                                                                                                | `PageHeaderLayer.tsx:119-125 · 228-250`                                                                                                        |
| F10 | 실측 (§4-1): 200p · 줌 0.1 (V=60) 수평 pan 3 s 헤더 childList 200/240 · 22p 76/95 · 줌 1 50p 4/4. 하니스 pan callback gap p95 22p 9.4 → 200p 11.8 ms · 할당 49.7 → 100 MB/s · GC 8 → 19. 레이어 47 · 텍스처 2.7 MB — 병목 아님. 드래그 style 쓰기 4.0/move (V 무관)   | `docs/explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md` §4-1 결과 · `docs/adr/evidence/page-header-scaling-2026-09/` (local)      |
| F11 | 계측 재료: `perf-baseline.mjs` `--pages N --zoom Z` + export 된 `createIsolatedProject · openPanels · seedDocument · wheelBurst`; 헤더 층 childList/attribute probe 스크립트                                                                                          | `apps/builder/scripts/perf-baseline.mjs` · `docs/adr/evidence/page-header-scaling-2026-09/page-header-scaling-probe.mjs`                       |

## 3. Phase 1 — 제스처 중 프레임 집합 동결 (Decision 1)

**목표**: 카메라 제스처 동안 층 컴포넌트가 받는 `frames` 를 settle 시점 값으로 고정해 mount/unmount 를 0 으로. 층은 그동안 `data-hidden` 이라 시각 변화 0.

- `PageHeaderLayer.tsx`: `frames` prop 을 그대로 쓰지 않고 `useSettledFrames(frames)` 를 거친다.
  - 구현: `useViewportSyncStore((s) => s.cameraGestureActive)` 구독 + `useState` 로 settled 값 보유. `active === false` 면 최신 `frames` 를 그대로 반환하고 ref 에 기록. `active === true` 면 ref 의 마지막 settled 값을 반환 (prop 변화 무시).
  - gate-off 순서 (F3·F4): `setCameraGestureActive(false)` → 배치 훅 구독 콜백이 **현재 노드 집합** 에 `placeAll` 1회 → React 재렌더로 새 집합 mount/unmount → `[layerNode, frames]` layoutEffect 가 paint 전에 `placeAll` 1회 더. settle 당 placeAll 2회 (기존 1회 + 1) — 두 번째가 새 노드 배치의 정본이라 필요하고, 첫 번째는 이제 곧 사라질 노드에 쓰는 낭비지만 값 변경 가드로 실제 쓰기는 작다. G2 가 잰다.
  - 편집 중 (F9) 보호: 동결 중에는 목록이 안 바뀌므로 편집기가 닫히지 않는다. settle 때 편집 페이지가 뷰포트 밖이면 기존 이펙트가 닫는다 (현행 동작 유지).
- 정적/단위 테스트: `PageHeaderLayer.test.tsx` 에 "gestureActive=true 동안 frames 교체 → 노드 집합 불변 · false 전환 → 최신 집합 반영" 1건. 원복 RED = `useSettledFrames` 를 identity 로.
- Skia 쪽 `visiblePageFrames` 소비 (`skiaFramePlan` · `skiaOverlayBuilder`) 는 그대로 — 동결은 헤더 층 prop 에서만.

## 4. Phase 2 — 헤더 폭 티어 (Decision 2)

**목표**: 헤더 화면 폭이 chrome 을 담지 못하는 좁은 페이지 (tablet · mobile 저줌) 에서 액션 버튼을 빼고 타이틀 띠만 남긴다. 티어는 **settle zoom** (F5) 과 동결된 frames 로만 판정 — 제스처 중 티어 전환 0.

- `pageHeaderGeometry.ts`: `PAGE_HEADER_COMPACT_MAX_WIDTH = 96` (chrome 64 + 타이틀 최소 32) · `resolvePageHeaderLod(screenWidth): "full" | "compact"` 순수 함수 + 테스트 (경계 96 · 95.99 · 0).
- `PageHeaderLayer.tsx`: `zoom = useViewportSyncStore((s) => s.zoom)` 구독 (settle 미러). 항목마다 `lod = resolvePageHeaderLod(frame.width * zoom)` 을 `PageHeaderItem` prop 으로 전달 → `data-lod` attribute · compact 면 액션 버튼 2 를 **렌더하지 않는다** (CSS 숨김이 아니라 노드 수 감소). 편집 중 (`data-editing`) 은 항상 full (편집기 폭 확보).
- `PageHeaderLayer.css`: `.page-header[data-lod="compact"]` — padding 축소 (`--page-header-padding-x: 2px`) · gap 0 · 타이틀 폰트 유지 (12px · 700, 역스케일 규약 유지). 색 · 상태 규칙 (highlighted / active / editing) 은 티어 무관.
- 테스트: `PageHeaderLayer.test.tsx` — zoom 0.1 · width 390 → compact (버튼 0) / width 1920 → full (버튼 2) / 편집 중 mobile → full. 원복 RED = 판정 함수 상수를 0 으로.
- **하지 않는 것**: hidden 티어 (폭 < 24 px 미마운트) — 현행 breakpoint × `minZoom` 0.1 에서 도달 불가 (F7 최소 39 px). `minZoom` 이 내려가거나 커스텀 폭 페이지가 생기면 그때 같은 함수에 티어를 더한다 (ADR 본문 Decision 3 유보).

## 5. Phase 3 — 게이트 · 문서

- **G1 probe**: `page-header-scaling-probe.mjs` 의 pan 구간 observer 를 제스처 창 (`data-hidden` 있는 동안) 과 settle 창으로 나눠 센다 → 200p · 줌 0.1 · 수평/수직 pan 각각 제스처 창 childList **0**, settle 창 ≤ V. 50p · 줌 1 수평 pan 도 제스처 창 0.
- **G2 하니스**: `pnpm perf:baseline -- --lane frame --pages 200 --zoom 0.1 --headed --classes idle,pan,zoom --duration-ms 3000` + 같은 세션 `--pages 22` 대조. pan callback gap p95 (200p) 가 before 11.8 ms 대비 악화 없음 · max ≤ 25 ms (settle 스파이크 상한) · 22p 는 before 9.4 대비 ±0.5. 할당 MB/s 는 참고 지표 (Skia 페이지 사각형 200 개 비용이 섞인다 — 헤더 귀속 아님).
- **G3 live** (headed Playwright 또는 Chrome MCP · 사용자 참관): ① 휠 pan · 휠 zoom · 스페이스 pan 각각 settle 후 헤더 집합 = 뷰포트 안 페이지 (동결 해제 확인) ② 제스처 interrupt (pointercancel · blur) 뒤에도 헤더가 복귀 ③ mobile 페이지 줌 0.1 → compact (버튼 없음 · 타이틀 보임) · 줌 0.3 → full ④ compact 헤더 drag 로 페이지 이동 · shift-클릭 body 토글 · dblclick 이름 편집 (편집 중 full) 3 동작 보존 ⑤ 이름 편집 중 pan → 편집기 유지.
- **G4 회귀**: `overlay/pageHeader/*.test.*` · `BuilderCanvas.pageHeaderLayer.static.test.ts` · `pnpm type-check`.
- 문서: `.claude/rules/canvas-interaction.md:35` 한 줄에 "제스처 중 프레임 집합 동결 · 폭 티어" 추가 · CHANGELOG (compact 티어는 사용자-가시) · 연구 문서 §4-2 에 결과 링크 · ADR `### Live Exercise`.

## 6. 파일 변경표

| 파일                                                          | 변경                                                                   | Phase |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | :---: |
| `overlay/pageHeader/PageHeaderLayer.tsx`                      | `useSettledFrames` · `zoom` 구독 · `lod` prop · compact 시 버튼 미렌더 | 1 · 2 |
| `overlay/pageHeader/pageHeaderGeometry.ts` (+ test)           | `PAGE_HEADER_COMPACT_MAX_WIDTH` · `resolvePageHeaderLod`               |   2   |
| `overlay/pageHeader/PageHeaderLayer.css`                      | `[data-lod="compact"]` 규칙                                            |   2   |
| `overlay/pageHeader/PageHeaderLayer.test.tsx`                 | 동결 1 · 티어 3                                                        | 1 · 2 |
| `overlay/pageHeader/usePageHeaderPlacement.ts`                | 주석만 (F3 문장을 "동결로 참조 불변" 으로 정정)                        |   1   |
| `apps/builder/scripts/page-header-scaling-probe.mjs` (신규)   | evidence 의 probe 를 scripts 로 승격 + 제스처/settle 창 분리           |   3   |
| `.claude/rules/canvas-interaction.md` · CHANGELOG · 연구 문서 | 문서                                                                   |   3   |

## 7. 원복 RED 매트릭스

| 원복                                | RED 가 되는 게이트  |
| ----------------------------------- | ------------------- |
| `useSettledFrames` → identity       | Phase 1 단위 · G1   |
| `PAGE_HEADER_COMPACT_MAX_WIDTH` → 0 | Phase 2 단위 · G3 ③ |
| compact 에서 버튼 렌더 복귀         | Phase 2 단위        |
| 편집 중 full 강제 제거              | Phase 2 단위 · G3 ④ |

# ADR-226 구현 설계: 페이지 헤더 DOM 층 줌 LOD

정본: [ADR-226](../completed/226-page-header-zoom-lod.md)

작성일: 2026-09-19. 코드 사실은 이 날짜의 main (`1cb5c9b5b`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in

- base / 응용: ADR-221 (페이지 헤더 DOM 층 · 제스처 게이트 · 단일 drag 추종) 이 base 이고 이 ADR 은 그 층의 **부하 정책** (제스처 중 프레임 집합 동결 + 헤더 폭 티어) 만 더하는 응용이다. 221 의 4 규칙 (경계 · 게이트 · 단일 drag · 히트 순서) 은 바꾸지 않는다.
- schema: 문서 schema · canonical · store 필드 변경 0. 헤더 노드의 `data-lod` attribute 와 CSS 만 새로 생긴다.
- 의존 방향: 221 → 226 한 방향. 226 이 221 의 게이트 신호 (`useViewportSyncStore.cameraGestureActive`) 를 **읽기만** 한다 — 신호를 새로 만들지 않는다.
- fork 아님: 연구 문서 [PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md](../../explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md) §4-2 의 실행 ADR. sub-phase 분할 없음 (Phase 3 개, 파일 ≤ 12).

## 2. Phase 0 코드 사실 표 (2026-09-19 실측, `1cb5c9b5b`)

| #   | 사실                                                                                                                                                                                                                                                                  | 경로:라인                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 헤더 층 입력 = `sceneStructureSnapshot.document.visiblePageFrames` — 뷰포트 컬링 (200 px 화면 마진) 결과. 제스처 중에는 `transientVisiblePageIds` 가 presentation 구독으로 갱신되어 BuilderCanvas 가 재렌더되고 이 prop 참조가 바뀐다                                 | `BuilderCanvas.tsx:641-690` (transient 갱신) · `:1648` (prop) · `scene/buildSceneSnapshot.ts:153-162` · `scene/buildVisiblePageSet.ts:7,17-49` |
| F2  | 층 컴포넌트는 `frames` 를 `orderPagesForPaint` 로 정렬해 `PageHeaderItem` (memo, key = pageId) 을 그린다 — 집합이 바뀌면 React 가 항목을 mount/unmount 한다 (div + Play 버튼 + span + X 버튼 + svg 2)                                                                 | `overlay/pageHeader/PageHeaderLayer.tsx:105-117 · 210-280`                                                                                     |
| F3  | 배치 훅은 제스처 중 **쓰기만** 게이트한다 (`gestureActiveRef` early return · `[layerNode, frames]` layoutEffect skip) — 주석이 "팬/줌은 transientVisiblePageIds 재계산으로 frames 참조를 매 프레임 바꿔 이 이펙트를 재실행시킨다" 고 명시. mount/unmount 는 게이트 밖 | `overlay/pageHeader/usePageHeaderPlacement.ts:170-177 · 181-186 · 202-227`                                                                     |
| F4  | 게이트 신호 = `useViewportSyncStore.cameraGestureActive` (setter `setCameraGestureActive`, 같은 값이면 no-op). 소비자는 배치 훅 하나                                                                                                                                  | `canvas/stores/viewportSync.ts:17 · 34 · 87-93`                                                                                                |
| F5  | settle 카메라 = `useViewportSyncStore.zoom` (BuilderCanvas 가 presentation 과 대조하는 미러). 제스처 중 presentation 과 다르고, 층 컴포넌트는 zoom 을 받지 않는다                                                                                                     | `BuilderCanvas.tsx:425 · 655-661`                                                                                                              |
| F6  | 헤더 화면 폭 = `frame.width × zoom`, 높이 28 고정 · 간격 8. 안쪽 chrome = padding `--spacing-xs` ×2 + 액션 버튼 20 ×2 + gap `--spacing-sm` ×2 (≈ 64 px). 일반 타이틀은 12px · 600, 이름 편집 input 만 700                                                             | `overlay/pageHeader/pageHeaderGeometry.ts:19-20 · 46-59` · `PageHeaderLayer.css:44-57 · 108-122 · 141-150`                                     |
| F7  | 페이지 폭 = breakpoint 프리셋 desktop 1920 · tablet 768 · mobile 390 → 줌 하한 0.1 에서 헤더 폭 192 · 76.8 · 39 px                                                                                                                                                    | `workspace/canvasBreakpoints.ts:16-18` · `viewport/ViewportController.ts:72` (`minZoom` 0.1)                                                   |
| F8  | 액션 버튼 2 (Play · Close) 는 `onPress` 미배선 ("동작 보류") — compact 티어에서 빼도 기능 손실 0                                                                                                                                                                      | `PageHeaderLayer.tsx:254-275`                                                                                                                  |
| F9  | 이름 편집 중 (`data-editing`) 헤더는 `<input>` 을 품는다. 편집 중 페이지가 목록에서 빠지면 편집기를 닫는 이펙트가 있다                                                                                                                                                | `PageHeaderLayer.tsx:119-125 · 228-250`                                                                                                        |
| F10 | 실측 (§4-1): 200p · 줌 0.1 (V=60) 수평 pan 3 s 헤더 childList 200/240 · 22p 76/95 · 줌 1 50p 4/4. 하니스 pan callback gap p95 22p 9.4 → 200p 11.8 ms · 할당 49.7 → 100 MB/s · GC 8 → 19. 레이어 47 · 텍스처 2.7 MB — 병목 아님. 드래그 style 쓰기 4.0/move (V 무관)   | `docs/explanation/research/PAGE_HEADER_DOM_LAYER_SCALING_2026-09.md` §4-1 결과 · `docs/adr/evidence/page-header-scaling-2026-09/` (local)      |
| F11 | 계측 재료: `perf-baseline.mjs` `--pages N --zoom Z` + export 된 `createIsolatedProject · openPanels · seedDocument · wheelBurst`; 헤더 층 childList/attribute probe 스크립트                                                                                          | `apps/builder/scripts/perf-baseline.mjs` · `docs/adr/evidence/page-header-scaling-2026-09/page-header-scaling-probe.mjs`                       |
| F12 | wheel gate-off 는 마지막 입력 150 ms 뒤다. 현행 frame lane 은 `wheelBurst` 반환 직후 recorder 를 정지하므로 settle commit 을 재지 못한다. pointer pan effect cleanup 은 session 을 finish 하지만 `onInteractionEnd` 를 호출하지 않는다                                | `viewport/useViewportControl.ts:304-310 · 275-285` · `apps/builder/scripts/perf-baseline.mjs:1586-1609 · 1773-1787`                            |

## 3. Phase 1 — 제스처 중 프레임 집합 동결 (Decision 1)

**목표**: 카메라 제스처 동안 층 컴포넌트가 받는 `frames` 를 settle 시점 값으로 고정해 mount/unmount 를 0 으로. 층은 그동안 `data-hidden` 이라 시각 변화 0.

- `PageHeaderLayer.tsx`: `frames` prop 을 그대로 쓰지 않고 `useSettledFrames(frames)` 를 거친다.
  - 구현: `useViewportSyncStore((s) => s.cameraGestureActive)` 구독 + ref 로 마지막 settle 집합을 보유. `active === true` 면 ref 의 집합을 반환해 prop 변화를 무시하고, `active === false` render 는 최신 `frames` 를 반환하면서 ref 를 갱신한다. 별도 effect 뒤늦은 state 복사로 한 render 더 stale 하게 만들지 않는다.
  - gate-on: `usePageHeaderPlacement` 가 즉시 `data-hidden` 을 세우고 이후 frame/list 배치를 skip 한다.
  - **gate-off commit-before-reveal** (F3·F4): store 구독 콜백은 `data-hidden` 을 제거하거나 구 노드에 `placeAll` 하지 않는다 → `cameraGestureActive=false` 로 React 가 최신 settled frames 를 커밋 → `[layerNode, settledFrames, cameraGestureActive]` layoutEffect 가 새 노드 전부를 `placeAll` 1회 → 같은 layoutEffect 마지막에 `data-hidden` 제거. 브라우저 paint 전에 최신 집합·transform·visible 순서가 닫히며 settle 당 `placeAll` 은 1회다.
  - 편집 중 (F9) 보호: 동결 중에는 목록이 안 바뀌므로 편집기가 닫히지 않는다. settle 때 편집 페이지가 200px 가시 마진 안이면 유지하고, 밖이면 기존 이펙트가 닫는다.
- `usePageHeaderPlacement.ts`: gate-off 구독의 즉시 `removeAttribute("data-hidden")` / `placeAll` 을 제거하고 위 layoutEffect 가 reveal 을 단독 소유하게 한다. 초기 mount active=false, frames 불변 gate-off도 `cameraGestureActive` dependency 로 같은 경로를 탄다.
- `useViewportControl.ts`: pointer pan effect cleanup 이 진행 중 session 을 `finish("interrupted")` 한 뒤 `onInteractionEndRef.current?.()` 를 호출해 store gate 를 false 로 돌린다. pointercancel · blur · visibility hidden 기존 경로와 cleanup/unmount 를 같은 종료 계약으로 묶는다.
- 정적/단위 테스트:
  - `PageHeaderLayer.test.tsx`: active=true 동안 frames 교체 → 노드 집합 불변; false 전환 → 최신 집합·transform 반영 뒤 hidden 제거. 원복 RED = identity / premature reveal 각각.
  - `useViewportControl` 인접 테스트: pointer pan 중 control unmount → `onInteractionEnd` 1회 · remount store false. pointercancel/blur/visibility 대조군도 false.
- Skia 쪽 `visiblePageFrames` 소비 (`skiaFramePlan` · `skiaOverlayBuilder`) 는 그대로 — 동결은 헤더 층 prop 에서만.

## 4. Phase 2 — 헤더 폭 티어 (Decision 2)

**목표**: 헤더 화면 폭이 chrome 을 담지 못하는 좁은 페이지 (tablet · mobile 저줌) 에서 액션 버튼을 빼고 타이틀 띠만 남긴다. 티어는 **settle zoom** (F5) 과 동결된 frames 로만 판정 — 제스처 중 티어 전환 0.

- `pageHeaderGeometry.ts`: `PAGE_HEADER_COMPACT_MAX_WIDTH = 96` (chrome 64 + 타이틀 최소 32) · `resolvePageHeaderLod(screenWidth): "full" | "compact"` 순수 함수 + 테스트 (경계 96 · 95.99 · 0).
- `PageHeaderLayer.tsx`: `zoom = useViewportSyncStore((s) => s.zoom)` 구독 (settle 미러). 항목마다 `lod = resolvePageHeaderLod(frame.width * zoom)` 을 `PageHeaderItem` prop 으로 전달 → `data-lod` attribute · compact 면 액션 버튼 2 를 **렌더하지 않는다** (CSS 숨김이 아니라 노드 수 감소). 편집 중 (`data-editing`) 은 항상 full (편집기 폭 확보).
- `PageHeaderLayer.css`: `.page-header[data-lod="compact"]` — gap 0 뿐 (padding 축소 `--page-header-padding-x: 2px` 는 구현 중 사용자 판정 2026-09-19 로 제거 — full 과 같은 padding). 일반 타이틀 12px · 600, 편집 input 700 을 그대로 둔다. 색 · 상태 규칙 (highlighted / active / editing) 은 티어 무관.
- 테스트: `PageHeaderLayer.test.tsx` — zoom 0.1 · width 390 → compact (버튼 0) / width 1920 → full (버튼 2) / 편집 중 mobile → full. CSS 정적 계약은 일반 600 · input 700. 원복 RED = 판정 함수 상수를 0 으로.
- **하지 않는 것**: hidden 티어 (폭 < 24 px 미마운트) — 현행 breakpoint × `minZoom` 0.1 에서 도달 불가 (F7 최소 39 px). `minZoom` 이 내려가거나 커스텀 폭 페이지가 생기면 그때 같은 함수에 티어를 더한다 (ADR 본문 Decision 3 유보).

## 5. Phase 3 — 게이트 · 문서

- **G1 probe**: `page-header-scaling-probe.mjs` 의 pan observer/recorder 를 `data-hidden` on 동안의 gesture 창과 `cameraGestureActive=false`→2 rAF 의 settle 창으로 분리한다. 200p · 줌 0.1 수평/수직 pan, 50p · 줌 1 수평 pan 각각 gesture childList 0. settle 은 child delta ≤ V · 최종 page id = `visiblePageFrames` · 모든 header transform 설정 뒤 hidden 제거 · 이후 2 rAF 추가 childList 0. identity와 gate-off 즉시 reveal을 각각 원복해 RED.
- **G2 하니스**: frame lane recorder 종료 조건을 wheel driver 반환이 아니라 `cameraGestureActive=false` 관찰 + 2 rAF 로 확장하고 raw JSON 에 `gestureWindow` / `settleWindow` 를 따로 저장한다. `pnpm perf:baseline -- --lane frame --pages 200 --zoom 0.1 --headed --fixed-inputs --classes pan,zoom --duration-ms 3000` 을 identity 원복 A / 구현 B 각각 3회, 같은 기기·20분 안 교차 실행한다. native refresh · DPR · visibilityState 기록. 200p gesture p95 중앙값 B ≤ A+0.5 ms, settle callback/RAF max ≤25 ms, longtask 0. 22p A/B p95 차이 절댓값 ≤0.5 ms 환경 대조. 역사 수치 11.8/9.4 는 비교 참고만 한다. 할당 MB/s 는 Skia 페이지 200개 비용이 섞여 참고 지표다.
- **G3 live** (headed Playwright 또는 Chrome MCP · 사용자 참관): ① 휠 pan · 휠 zoom · 스페이스 pan 각각 settle 후 헤더 집합 = 뷰포트 안 페이지 ② pointercancel · blur · visibility hidden · pointer pan 중 control unmount/remount 뒤 store false, 헤더 visible·최신 집합 ③ mobile 페이지 줌 0.1 → compact (버튼 없음 · 타이틀 보임) · 줌 0.3 → full ④ compact 헤더 drag 로 페이지 이동 · shift-클릭 body 토글 · dblclick 이름 편집 (편집 중 full) ⑤ 편집 페이지가 200px 가시 마진 안에 남는 pan 은 편집기 유지, 밖으로 나간 settle 은 기존처럼 닫힘.
- **G4 회귀**: `overlay/pageHeader/*.test.*` · `viewport/useViewportControl*.test.*` · `BuilderCanvas.pageHeaderLayer.static.test.ts` · 일반 타이틀 600/편집 input 700 정적 계약 · `pnpm type-check`.
- 문서: `.claude/rules/canvas-interaction.md:35` 한 줄에 "제스처 중 프레임 집합 동결 · 폭 티어" 추가 · CHANGELOG (compact 티어는 사용자-가시) · 연구 문서 §4-2 에 결과 링크 · ADR `### Live Exercise`.

## 6. 파일 변경표

| 파일                                                          | 변경                                                                                          | Phase |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | :---: |
| `overlay/pageHeader/PageHeaderLayer.tsx`                      | `useSettledFrames` · commit-before-reveal · `zoom` 구독 · `lod` prop · compact 시 버튼 미렌더 | 1 · 2 |
| `overlay/pageHeader/pageHeaderGeometry.ts` (+ test)           | `PAGE_HEADER_COMPACT_MAX_WIDTH` · `resolvePageHeaderLod`                                      |   2   |
| `overlay/pageHeader/PageHeaderLayer.css`                      | `[data-lod="compact"]` 규칙                                                                   |   2   |
| `overlay/pageHeader/PageHeaderLayer.test.tsx`                 | 동결/reveal 순서 2 · 티어 3 · 타이포그래피 정적 계약                                          | 1 · 2 |
| `overlay/pageHeader/usePageHeaderPlacement.ts`                | gate-off 즉시 reveal/placeAll 제거 · 최신 커밋 layoutEffect 단일 소유                         |   1   |
| `viewport/useViewportControl.ts` (+ 인접 test)                | pointer pan cleanup 도 `onInteractionEnd` 1회                                                 |   1   |
| `apps/builder/scripts/perf-baseline.mjs`                      | wheel gate-off+2 rAF 까지 recorder 연장 · gesture/settle raw 분리                             |   3   |
| `apps/builder/scripts/page-header-scaling-probe.mjs` (신규)   | evidence 의 probe 를 scripts 로 승격 + 제스처/settle/reveal 순서 분리                         |   3   |
| `.claude/rules/canvas-interaction.md` · CHANGELOG · 연구 문서 | 문서                                                                                          |   3   |

## 7. 원복 RED 매트릭스 (2026-09-19 실측 결과)

| 원복                                                   | RED 가 되는 게이트       | 결과                                                                                            |
| ------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `useSettledHeaderInput` → identity                     | Phase 1 단위 · G1        | 단위 RED (동결 childList 0 · reveal 순서 2 실패) · G1 probe pan-v gesture childList 389         |
| gate-off 구독에서 즉시 hidden 제거                     | Phase 1 순서 단위 · G1   | 단위 RED (reveal 순서 테스트 1 실패)                                                            |
| pointer pan cleanup 의 `onInteractionEnd` 제거         | viewport 단위 · G3 ②     | 단위 RED (`pointerCleanup.test.tsx` unmount 1회 실패)                                           |
| recorder 를 `wheelBurst` 반환 즉시 정지                | G2 settle 표본 부재      | `windows` null → settle 열 부재 (설계상 — 구 빌드는 `waitForCameraSettle` 가 `supported:false`) |
| `PAGE_HEADER_COMPACT_MAX_WIDTH` → 0                    | Phase 2 단위 · G3 ③      | 단위 RED 5 (경계 · breakpoint · 티어 · 제스처 중 · 편집)                                        |
| compact 에서 버튼 렌더 복귀                            | Phase 2 단위             | 단위 RED (버튼 0 기대 실패 — 티어 테스트에 포함)                                                |
| 편집 중 full 강제 제거 또는 일반 타이틀을 700으로 변경 | Phase 2 단위 · G3 ④ · G4 | 단위 RED 1 (편집 중 full) · CSS 정적 계약이 600/700 고정                                        |

## 8. 실행 기록 (2026-09-19, `/execute-adr 226`)

- Phase 0 G0: F1~F12 HEAD `2b9bd06f0` 일치, src drift 0.
- Phase 1 `cdd9620f0`: `useSettledHeaderInput` (frames · zoom · gestureActive 스냅샷 — render 중 ref 갱신, gate-off render 에서만 최신화 → reviews/226 l1 흡수) · `usePageHeaderPlacement` gate-off 구독 즉시 reveal 제거 → `[layerNode, frames, gestureActive]` layoutEffect 가 `placeAll` 1회 뒤 `data-hidden` 제거 · pointer pan cleanup `onInteractionEnd`.
- Phase 2 `c55df5512`: `PAGE_HEADER_COMPACT_MAX_WIDTH` 96 · `resolvePageHeaderLod` · `data-lod` · compact 버튼 미렌더 · 편집 중 full. **사용자 판정**: compact 의 `--page-header-padding-x: 2px` 제거 — padding 은 full 과 같고 gap 0 만 (CSS 정적 계약도 padding 재정의 금지로 갱신).
- Phase 3: `perf-baseline.mjs` recorder 에 frameTimes · markers(gateOff · settleEnd) · longTaskEntries · `waitForCameraSettle` (pan/zoom 부류 gate-off + 2 rAF 까지 기록) · `summarizeSettleWindows` (`results[cls].windows.gesture/settle` + `environment.refreshHz/dpr`) · 보고서 settle 표 · `page-header-scaling-probe.mjs` (scripts 승격 — gesture/settle/post 창 + reveal 순서 판정, fixed inputs) · `adr226-page-header-lod-live.mjs` (G3 14 항목). DEV 전역 `__composition_VIEWPORT_SYNC__` (store) · `__composition_VISIBLE_PAGE_IDS__` 를 BuilderCanvas 가 낸다.
- **G3 ④ 실측 결함 (ADR-221 잔존) 수리**: blur / visibility 로 끊긴 스페이스 pan 의 pointer 가 `CanvasGestureSession` 에 "pan" 으로 남아 다음 좌클릭 · page drag 를 막았다 (`interruptViewportInteraction` 이 `endPointer` 를 안 함). `panPointerIdRef` + interrupt 3경로 `endPointer` — 단위 RED 2 → GREEN. G1 probe 함정: wall-clock `wheelBurst` 는 120 Hz 에서 pan 이 문서 밖까지 나가 settle 집합이 0~10 이 된다 → fixed inputs.
- Gate 결과 · Live Exercise: ADR 본문 §Gates. evidence (local, gitignored): `docs/adr/evidence/226-page-header-zoom-lod/` (g1-probe · g1-identity-revert · g2-ab · g2-ab-summary.json · g2-ab.sh · g3-live.log).

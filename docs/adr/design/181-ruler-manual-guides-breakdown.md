# ADR-181 Design Breakdown: 눈금자(Ruler) + 수동 가이드

> 본문: [181-ruler-manual-guides.md](../181-ruler-manual-guides.md)
> 상태: Proposed — 2026-08-13 (Phase 0 inventory freeze 전 — 계약 표는 착수 시 실측 고정)

## §1. 문제 정의 확인 (fork checkpoint — 신규 주제, fork 아님)

- 완전 신규 주제 ADR — 기존 ADR 분리/fork 아님 (adr-writing.md Phase 0 게이트 해당 없음).
- 선행 계약 승계: [ADR-176](../176-canvas-authoring-gesture-and-page-position-optimization.md) (transient presentation + finish-only commit), [ADR-177](../completed/177-page-position-document-data.md) (canonical additive 필드 + 비-element 히스토리 entry 5계층), [ADR-179](../completed/179-snap-alignment-guides.md) (`resolveSnappedPosition` 순수 함수 + 후보 수집 드래그당 1회).
- 두 산출물의 성격이 갈린다:
  - **Ruler** = 뷰포트 chrome (문서 데이터 없음 — 토글 상태만 빌더 UI 설정)
  - **수동 가이드** = 페이지 귀속 문서 데이터 (persist + undo 대상 — ADR-177 동형 5계층)

## §2. 계약 표 (Phase 0 에서 실측 freeze — 착수 전 초안)

| ID  | 계약                                                                                        | 근거 위치 (2026-08-13 실측)                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 스냅 판정 단일 진입점은 `resolveSnappedPosition` — 후보는 rect 기반 (`rectLines`)           | `interaction/snapGuides.ts:85,483` — 소비처 2곳: `usePageDrag.ts:241`, `useDragBridge.ts:636`                                                      |
| C2  | 후보 수집은 **드래그당 1회** (ADR-179 R1 대응 — 프레임 경로에서 수집 금지)                  | ADR-179 G2 실측 0.56µs(10 후보)/1.80µs(50 후보) — 판정만 프레임 경로                                                                               |
| C3  | 오버레이 패스는 프레임당 1회, 콘텐츠성 chrome 은 `withPageOcclusionClip` 경유               | `skia/skiaOverlayBuilder.ts:264` — 스냅 정렬선(조작 표식)은 미적용 전례 `:750-756`                                                                 |
| C4  | 비-element 히스토리 entry 전례 2종 — `page-position`(ADR-177) / `snapshot-restore`(ADR-180) | `stores/history.ts:69,111,437` — undo/redo/goToIndex 3 진입점 early-branch 패턴                                                                    |
| C5  | canonical additive root 필드 + lazy write + 페이지 단위 병합 hydrate 전례                   | `composition-document.types.ts:857` (`pagePositions`) + `canonicalDocumentStore.ts:848` (`setPagePositions`)                                       |
| C6  | 드래그 중 canonical write 0 / finish 1회 — transient presentation 채널 전례                 | `interaction/pagePositionPresentation.ts` (begin/publish/finish/cancel + 값 변경 프레임만 notify)                                                  |
| C7  | pointerdown 진입은 BuilderCanvas capture 단일 지점                                          | `BuilderCanvas.tsx:1013` (`onPointerDownCapture`) — 페이지 타이틀 paint-rank guard / `resolveSelectionDragIntent` 체인                             |
| C8  | 스냅 임계 단일 상수 (screen px, zoom 환산은 호출측)                                         | `snapGuides.ts:24` `SNAP_THRESHOLD_SCREEN_PX = 5`                                                                                                  |
| C9  | Phase 0 판정 항목: 가이드 좌표의 breakpoint 축 소속                                         | `pagePositions` 는 breakpoint 별 — 가이드는 **페이지-로컬 px** 라 breakpoint 공유가 1차 가설 (breakpoint 별 페이지 크기 상이 시 의미 검토 후 확정) |
| C10 | Phase 0 판정 항목: ruler off 시 가이드 표시 여부 + 기본 토글 상태                           | Figma 실측 대조 후 확정 (Figma 관례: rulers 토글 Shift+R, 기본 OFF)                                                                                |
| C11 | Phase 0 판정 항목: 오버레이 재렌더 트리거 — 가이드 추가/이동이 프레임을 굴리는 메커니즘     | snapGuidePresentation 의 notify 경로 실측 (전용 version 카운터 vs 기존 프레임 요청 재사용)                                                         |

## §3. Phase 분해

### Phase 0 — inventory freeze (LOW)

- §2 계약 표 C1~C11 실측 고정 (초안 라인 번호 재확인 + 판정 항목 C9/C10/C11 확정).
- 히스토리 kind 소비 분기 전수 grep (ADR-177 R1 절차 재실행 — `page-position`/`snapshot-restore` 분기 위치 목록화).
- canonical 파서 additive 허용은 ADR-177 R2 에서 확정 완료 — 승계 (재검증 불요, 참조만).
- 산출: 본 문서 §2 갱신 + ADR 본문 Status 로그 1줄.

### Phase 1 — Ruler 렌더 + 토글 (LOW)

- `canvas/skia/rulerRenderer.ts` 신규 — 상단/좌측 눈금 스트립 (screen 좌표 고정), 틱·라벨은 `panOffset`/`zoom` 의 순수 함수. 라벨 typeface 는 `resolveOverlayTypeface` 재사용 (`selectionRenderer.ts` export).
- `skiaOverlayBuilder.ts` 오버레이 패스 말미 배선 (씬 clip 밖 — 항상 최상단).
- 토글: `canvasSettings.ts` slice 에 `showRulers` 필드 (기본값 C10 판정) + **`SettingsPanel.tsx` 에 on/off 스위치 노출 (사용자 지정 2026-08-13)** — 기존 `showGrid`/`snapToGrid`/`snapToObjects` 와 같은 섹션 (`setShowGrid` 어법 동형). 보조로 단축키 Shift+R (`keyboardShortcuts.ts` — 기존 바인딩 충돌 grep 선행).
- **성능 계약 (HC1)**: 별도 버전 카운터 없음 (뷰포트 변경이 이미 프레임을 굴림), paint 는 `acquirePooledPaint` 풀 재사용, 틱 라벨 문자열은 눈금 간격 단위 캐시 (per-frame 할당 최소화).
- 검증: live 토글 + 팬/줌 눈금 동기 + G5 측정 1차 (ruler on/off 프레임 시간 diff).

### Phase 2 — 가이드 document 필드 + persist/hydrate (LOW)

- `composition-document.types.ts` 에 additive root 필드 (1차안):

  ```ts
  /** 수동 가이드 — ADR-181. 페이지-로컬 px (C9 판정 반영). lazy write. */
  pageGuides?: Record<string /* pageId */, PageGuideLine[]>;
  // PageGuideLine = { id: string; axis: "x" | "y"; position: number }
  ```

- `canonicalDocumentStore.ts` 에 `setPageGuides` (ADR-177 `setPagePositions` 동형 — `mutateActiveDoc` + 빈 entry 정리) + hydrate 페이지 단위 병합.
- BC: 필드 부재 문서 = 가이드 없음 (현행과 동일 동작), 로드 시 재직렬화 0.
- 검증: 유닛 (set/clear/hydrate 병합) + live 시드 → 새로고침 유지.

### Phase 3 — 히스토리 편입 (MED)

- `history.ts` 에 `page-guide` entry kind (add/move/remove, batch 지원) — ADR-177 `page-position` payload 어법 동형 (before/after 라인 배열).
- `historyActions.ts` undo/redo/goToIndex 3 진입점 early-branch + 정적 가드 테스트 (`historyActions.static.test.ts` 전례).
- 기록 시점: 가이드 생성/이동 finish 1회 + 삭제 즉시 1회 (드래그 중 기록 0 — HC1).
- 검증: 유닛 + live undo/redo 왕복.

### Phase 4 — 가이드 렌더 (MED)

- `canvas/skia/guideRenderer.ts` 신규 — 상시 표시 선 (1 screen px, `snapGuideRenderer.ts` 어법 재사용하되 색 분리 — 스냅 웜 레드와 구분되는 가이드 고유색, Figma #59A8D7 계열 실측 대조 후 상수 확정).
- 좌표: 페이지-로컬 px → scene 변환 (페이지 위치 + 가이드 position) — **페이지 이동(ADR-177) 시 자동 추종**.
- 클립: 페이지 rect 로 클립 + `withPageOcclusionClip` 경유 (콘텐츠성 chrome — canvas-rendering.md §8.5 표 준수. 스냅 정렬선의 "조작 표식 미적용" 판정과 **다르다** — 가이드는 상시 표시).
- 검증: 겹친 페이지 occlusion live + 페이지 드래그 추종 live.

### Phase 5 — 인터랙션 (HIGH — R1)

- 신규 훅 `useGuideInteraction` (또는 BuilderCanvas capture 체인 내 분기) — 단일 판정 함수 `resolveGuideHit(point, guides, thresholdScenePx)` 순수 함수로 분리 (테스트 우선).
- 동작: ruler 스트립에서 드래그 시작 → 가이드 생성 / 기존 가이드 ±4 screen px 히트 → 이동 / ruler 로 되돌리면 삭제 / hover 시 resize 커서.
- 드래그 중 transient 채널 (C6 전례 동형 — `guidePresentation` 신설 또는 세션 로컬 상태) — canonical write 는 finish 1회.
- **우선순위 규칙 (R1 핵심)**: ruler 영역은 뷰포트 chrome 이라 씬 히트보다 항상 우선. 씬 안의 기존 가이드 히트는 요소 히트보다 우선하되 임계 ±4px 한정 — 기존 `resolveSelectionDragIntent`/페이지 타이틀 경로 진입 **전에** 판정하고, 미스 시 기존 체인 무변경 통과.
- 검증: 기존 인터랙션 유닛 전수 GREEN (G2) + live 생성/이동/삭제.

### Phase 6 — 스냅 편입 (MED — R2)

- `snapGuides.ts` 에 축별 라인 입력 추가 (1차안): `resolveSnappedPosition(raw, movingSize, candidates, threshold, extraLines?: { x: number[]; y: number[] })`.
- 가이드 라인은 **정렬선 판정에만** 참여 — 등간격(spacing) 이웃 아님 (rect 아님, `projectCandidate` 미통과).
- 소비처 2곳 (`usePageDrag` / `useDragBridge`) 이 드래그 세션 시작 시 활성 페이지 가이드를 scene 좌표로 환산해 주입 (후보 수집 드래그당 1회 계약 C2 유지).
- 검증: 유닛 — 라인 흡착 + 기존 rect 12건 GREEN + spacing 미오염.

### Phase 7 — 검증 종결 (Gates 전수)

- G1~G6 전수 실행 + ADR Status 승격 + CHANGELOG + README.

## §4. Gate 상세 (ADR 본문 Gate 표의 실행 절차)

| Gate | 절차                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: Shift+R 토글 → ruler 드래그 생성 → 가이드 이동 → ruler 복귀 삭제 → 각 조작 Cmd+Z/Cmd+Shift+Z 왕복 → 새로고침 배치 유지                                                                  |
| G2   | ruler OFF + 가이드 0 문서에서 기존 선택/드래그/더블클릭/페이지 타이틀 유닛 전수 GREEN + live 스모크 (경로 무변경)                                                                             |
| G3   | 요소·페이지 드래그가 가이드 라인에 흡착 (live) + 기존 rect 스냅 유닛 GREEN + spacing 판정에 가이드 미참여 유닛                                                                                |
| G4   | 겹친 페이지에서 아래 페이지 가이드가 위 페이지 body 위 미표시 (live) + 가이드가 페이지 rect 밖 미유출                                                                                         |
| G5   | **성능 (HC1)**: ruler on/off + 가이드 20개 문서의 오버레이 패스 증가분 측정 — 프레임 예산(16.7ms) 1% 이하. 가이드 드래그 100 move 재현에서 canonical write/히스토리/persist 각 0 (finish 1회) |
| G6   | type-check + 신규 유닛·정적 가드 PASS + CHANGELOG (Implemented 승격 시)                                                                                                                       |

## §5. BC 수식화

- 기존 프로젝트 영향 **0%** — `pageGuides` 부재 문서는 가이드 없음(현행 동일), 로드 시 재직렬화 0 (lazy write — 가이드 최초 생성 시에만 필드 기록). ADR-177 HC3 동형.

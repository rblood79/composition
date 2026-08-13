# ADR-181 Design Breakdown: 눈금자(Ruler) + 수동 가이드

> 본문: [181-ruler-manual-guides.md](../181-ruler-manual-guides.md)
> 상태: Accepted — 2026-08-13 (리뷰 round 1 이슈 0건 승인). **Phase 0 완료 2026-08-13** — §2 계약 표 실측 freeze, C9/C10/C11 확정.

## §1. 문제 정의 확인 (fork checkpoint — 신규 주제, fork 아님)

- 완전 신규 주제 ADR — 기존 ADR 분리/fork 아님 (adr-writing.md Phase 0 게이트 해당 없음).
- 선행 계약 승계: [ADR-176](../176-canvas-authoring-gesture-and-page-position-optimization.md) (transient presentation + finish-only commit), [ADR-177](../completed/177-page-position-document-data.md) (canonical additive 필드 + 비-element 히스토리 entry 5계층), [ADR-179](../completed/179-snap-alignment-guides.md) (`resolveSnappedPosition` 순수 함수 + 후보 수집 드래그당 1회).
- 두 산출물의 성격이 갈린다:
  - **Ruler** = 뷰포트 chrome (문서 데이터 없음 — 토글 상태만 빌더 UI 설정)
  - **수동 가이드** = 페이지 귀속 문서 데이터 (persist + undo 대상 — ADR-177 동형 5계층)

## §2. 계약 표 (Phase 0 실측 freeze — 2026-08-13)

| ID  | 계약                                                                                              | 근거 위치 (2026-08-13 실측)                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 스냅 판정 단일 진입점은 `resolveSnappedPosition` — 후보는 rect 기반 (`rectLines`)                 | `interaction/snapGuides.ts:85` (`rectLines`), `:483` (`resolveSnappedPosition`) — 소비처 2곳: `usePageDrag.ts:241`, `useDragBridge.ts:636`                        |
| C2  | 후보 수집은 **드래그당 1회** (ADR-179 R1 대응 — 프레임 경로에서 수집 금지)                        | ADR-179 G2 실측 0.56µs(10 후보)/1.80µs(50 후보) — 판정만 프레임 경로                                                                                              |
| C3  | 오버레이 패스는 프레임당 1회, 콘텐츠성 chrome 은 `withPageOcclusionClip` 경유                     | `skia/skiaOverlayBuilder.ts:264` — 스냅 정렬선(조작 표식)은 미적용 전례 `:750`                                                                                    |
| C4  | 비-element 히스토리 kind 소비 지점은 **6곳** (초안 3곳 → 실측 확대, 아래 C4 표)                   | `stores/history.ts:69-70` (union), `:441-442` (DEV guard) + `history/historyActions.ts:351,761,1163,1712` + UI 2곳                                                |
| C5  | canonical additive root 필드 + lazy write + 페이지 단위 병합 hydrate 전례                         | `composition-document.types.ts:857` (`pagePositions`) + `canonicalDocumentStore.ts:848` (`setPagePositions`)                                                      |
| C6  | 드래그 중 canonical write 0 / finish 1회 — transient presentation 채널 전례                       | `interaction/pagePositionPresentation.ts:58,89,121,135` (begin/publish/finish/cancel) + `:45` notify (값 변경 프레임만)                                           |
| C7  | pointerdown 진입은 BuilderCanvas capture 단일 지점                                                | `BuilderCanvas.tsx:1013` (`onPointerDownCapture`), 등록 `:1155` — 페이지 타이틀 paint-rank guard / `resolveSelectionDragIntent` 체인                              |
| C8  | 스냅 임계 단일 상수 (screen px, zoom 환산은 호출측)                                               | `snapGuides.ts:24` `SNAP_THRESHOLD_SCREEN_PX = 5`                                                                                                                 |
| C9  | **확정** — 가이드 좌표는 **breakpoint 별** (`pagePositions` 동형 2단 Record)                      | 페이지 크기가 breakpoint 별 (`useLayoutPublisher.ts:63` "breakpoint(pageWidth/Height)") — 공유 시 타 breakpoint 에서 페이지 rect 밖 가이드가 스냅에만 참여 (아래) |
| C10 | **확정** — `showRulers` 기본 `false` / 가이드 **표시는 ruler 와 독립** / **조작은 ruler ON 한정** | `canvasSettings.ts:137-140` 시각 chrome 계열 전부 기본 false (`showGrid`/`showWorkflowOverlay`), 동작 보조만 true (`snapToObjects`)                               |
| C11 | **확정** — ruler 는 전용 카운터 불요 / 가이드는 `overlayVersionRef.current++` 재사용              | `SkiaCanvas.tsx:719-726` 프레임 스냅샷 키에 `cameraX/Y/Zoom` + `overlayVersion` 동시 포함, `:785-791` renderer.render 인자                                        |

### C4 — 비-element 히스토리 kind 소비 지점 전수 (`page-guide` 추가 시 필수 대응 6곳)

초안의 "undo/redo/goToIndex 3 진입점" 은 **과소 집계**였다. `page-position`/`snapshot-restore` 두 전례의 실제 분기 위치는 6곳이다.

| #   | 위치                                                                     | 역할                                                       | 누락 시 증상                                                       |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `history/historyActions.ts:351`                                          | `createUndoAction` early-branch                            | undo 무반응 또는 legacy full-replace fallback                      |
| 2   | `history/historyActions.ts:761`                                          | `createRedoAction` early-branch                            | redo 무반응                                                        |
| 3   | `history/historyActions.ts:1163`                                         | `createGoToHistoryIndexAction` early-branch                | 히스토리 패널 점프 시 미적용                                       |
| 4   | `history/historyActions.ts:1712`                                         | `syncDatabaseForEntries` **skip** (element DB 동기화 제외) | `elementId=pageId` 를 요소로 오인해 DB 동기화 (주석이 경고하는 것) |
| 5   | `stores/history.ts:441-442`                                              | DEV `canonicalEvents` 미부착 경고 **면제**                 | 콘솔 경고 오탐 (비-element 축은 canonicalEvents 없음이 정상)       |
| 6   | `panels/history/historyEntryLabel.ts:120,126` + `HistoryPanel.tsx:55,56` | 라벨 + 아이콘 매핑                                         | 히스토리 패널에 라벨/아이콘 없는 entry                             |

기록(생산) 측 전례: `viewport/pageLayoutActions.ts:75`, `stores/elements.ts:2100,2162`, `history/snapshotRestore.ts:151`.

### C9 판정 근거 — breakpoint 별인 이유

가이드 position 은 페이지-로컬 px 인데 **페이지 폭·높이가 breakpoint 별로 다르다**. breakpoint 공유(단일 목록)로 두면 desktop(예 1440)에서 만든 우측 여백 가이드 `x=1400` 이 mobile(390) 페이지에서 rect 밖으로 나간다 — Phase 4 의 페이지 rect 클립에 걸려 **보이지 않는데 Phase 6 스냅에는 참여**하는 상태가 된다. 흡착 원인을 화면에서 추적할 수 없는 비대칭이라(canvas-rendering.md §8.5 가 경계하는 "보이는 것 ↔ 판정되는 것" 불일치의 역방향) 공유 모델을 기각한다.

breakpoint 별로 두면 그 상태가 구조적으로 성립하지 않고, `pagePositions` 의 2단 Record + lazy write + 페이지 단위 병합 hydrate 를 **그대로 복제**할 수 있어 Phase 2 가 단순해진다. entry 부재 breakpoint = 가이드 없음 (빈 목록 — `pagePositions` 의 재계산 폴백에 해당하는 것이 없으므로 폴백 로직도 불요).

### C10 판정 근거 — 기본값 / 표시 / 조작의 3분

- **기본 `false`**: `canvasSettings` 의 시각 chrome 계열은 전부 기본 false(`showGrid:false`, `showWorkflowOverlay:false`)이고 동작 보조만 true(`snapToObjects:true`). ruler 는 화면을 점유하는 시각 chrome 이므로 기존 어법을 따른다.
- **표시는 ruler 와 독립 (항상 표시)**: 가이드는 Phase 6 에서 스냅에 참여한다. ruler OFF 로 숨기면 보이지 않는 선에 흡착되어 원인 추적이 불가능해진다. 또한 가이드는 문서 데이터(persist+undo)이고 ruler 는 빌더 UI 설정이라, 설정 토글이 문서 데이터의 가시성을 지배하면 계층이 뒤섞인다 (기본 OFF 인 ruler 에 종속시키면 새 세션 진입 시 기존 가이드가 전부 사라진 것처럼 보인다).
- **조작은 ruler ON 한정**: 생성(ruler 스트립 드래그)과 삭제(ruler 로 되돌리기) 진입점이 모두 ruler 에 있어, ruler OFF 에서 이동만 허용하면 조작 어휘가 불완전해진다. 더 중요한 이득은 R1(HIGH) 노출면 축소 — **ruler OFF 면 가이드 히트 판정이 pointer 체인에 아예 진입하지 않으므로**, G2 를 "가이드 0 문서" 가 아니라 "**ruler OFF 이면 가이드 유무와 무관하게** 기존 경로 무변경" 으로 강화할 수 있다 (§4 G2 갱신).

### C11 판정 근거 — 재렌더 트리거

`SkiaCanvas.tsx` 의 RAF 루프는 상시 도는 대신 프레임 스냅샷 키로 재작업 범위를 가른다. 키에 `cameraX/cameraY/cameraZoom` 과 `overlayVersion` 이 **함께** 들어간다 (`:719-726`, `:785-791`).

- **Ruler**: `panOffset`/`zoom` 의 순수 함수이고 카메라가 이미 키에 있으므로 **전용 카운터 불요** (ADR 본문 HC1 가정 확증).
- **가이드**: 카메라와 무관하게 변하므로 전용 트리거가 필요하다. 기존 어법인 `overlayVersionRef.current++` 를 재사용한다 (코드 내 18곳 전례). **`invalidateContent()` 는 부르지 않는다** — `pagePositionPresentation` 구독(`:298-310`)이 content 까지 무효화하는 것은 page root transform 이 바뀌어 본문 렌더가 달라지기 때문이고, 가이드는 오버레이 패스 전용이라 content surface 를 건드리지 않는다 (더 싼 경로 — HC1 정합).
- notify 호출 지점은 3곳: (a) 드래그 중 transient publish, (b) finish 후 canonical write, (c) 히스토리 undo/redo 적용 후.

## §3. Phase 분해

### Phase 0 — inventory freeze (LOW) — **Implemented 2026-08-13**

- ✅ §2 계약 표 C1~C8 라인 재확인 (C3 `:750-756`→`:750`, C4 `:437`→`:441-442` 정정) + C9/C10/C11 확정.
- ✅ 히스토리 kind 소비 분기 전수 grep — 3곳 가정이 **6곳**으로 확대 (§2 C4 표).
- ✅ canonical 파서 additive 허용은 ADR-177 R2 확정분 승계 (재검증 불요).
- 산출: 본 문서 §2 갱신 + ADR 본문 진행 로그 1줄.

### Phase 1 — Ruler 렌더 + 토글 (LOW)

- `canvas/skia/rulerRenderer.ts` 신규 — 상단/좌측 눈금 스트립 (screen 좌표 고정), 틱·라벨은 `panOffset`/`zoom` 의 순수 함수. 라벨 typeface 는 `resolveOverlayTypeface` 재사용 (`selectionRenderer.ts` export).
- `skiaOverlayBuilder.ts` 오버레이 패스 말미 배선 (씬 clip 밖 — 항상 최상단).
- 토글: `canvasSettings.ts` slice 에 `showRulers` 필드 (**기본 `false` — C10**) + **`SettingsPanel.tsx` 에 on/off 스위치 노출 (사용자 지정 2026-08-13)** — 기존 `showGrid`/`snapToGrid`/`snapToObjects` 와 같은 섹션 (`setShowGrid` 어법 동형). 보조로 단축키 Shift+R (`keyboardShortcuts.ts` — 기존 바인딩 충돌 grep 선행, Phase 0 확인분: `alignRight` 가 `cmdShift+r` 이라 Shift 단독과 무충돌).
- **성능 계약 (HC1)**: 별도 버전 카운터 없음 (**C11 확증** — 카메라가 프레임 스냅샷 키에 이미 포함), paint 는 `acquirePooledPaint` 풀 재사용, 틱 라벨 문자열은 눈금 간격 단위 캐시 (per-frame 할당 최소화).
- 검증: live 토글 + 팬/줌 눈금 동기 + G5 측정 1차 (ruler on/off 프레임 시간 diff).

### Phase 2 — 가이드 document 필드 + persist/hydrate (LOW)

- `composition-document.types.ts` 에 additive root 필드 (**C9 확정 반영 — `pagePositions` 동형 2단 Record**):

  ```ts
  /** 수동 가이드 — ADR-181. breakpoint 별 페이지-로컬 px. lazy write. */
  pageGuides?: Record<
    string /* pageId */,
    Partial<Record<BreakpointName, PageGuideLine[]>>
  >;
  // PageGuideLine = { id: string; axis: "x" | "y"; position: number }
  ```

- `canonicalDocumentStore.ts` 에 `setPageGuides` (ADR-177 `setPagePositions:848` 동형 — `mutateActiveDoc` + 빈 entry 정리) + hydrate 페이지 단위 병합.
- BC: 필드 부재 문서 = 가이드 없음 (현행과 동일 동작), 로드 시 재직렬화 0. entry 부재 breakpoint 도 빈 목록 — 재계산 폴백 불요 (C9).
- 검증: 유닛 (set/clear/hydrate 병합 + breakpoint 격리) + live 시드 → 새로고침 유지.

### Phase 3 — 히스토리 편입 (MED)

- `history.ts` 에 `page-guide` entry kind (add/move/remove, batch 지원) — ADR-177 `page-position` payload 어법 동형 (before/after 라인 배열).
- **§2 C4 표의 6곳 전부 대응** (초안 3곳 아님) — undo/redo/goToIndex early-branch 3곳 + `syncDatabaseForEntries` skip + DEV guard 면제 + 패널 라벨·아이콘.
- 정적 가드 테스트 (`historyActions.static.test.ts` 전례) + C4 6곳 커버리지 단언.
- 기록 시점: 가이드 생성/이동 finish 1회 + 삭제 즉시 1회 (드래그 중 기록 0 — HC1).
- 적용 후 `overlayVersionRef` 트리거 (C11 (c)).
- 검증: 유닛 + live undo/redo 왕복.

### Phase 4 — 가이드 렌더 (MED)

- `canvas/skia/guideRenderer.ts` 신규 — 상시 표시 선 (1 screen px, `snapGuideRenderer.ts` 어법 재사용하되 색 분리 — 스냅 웜 레드와 구분되는 가이드 고유색, Figma #59A8D7 계열 대조 후 상수 확정).
- 좌표: 페이지-로컬 px → scene 변환 (페이지 위치 + 가이드 position) — **페이지 이동(ADR-177) 시 자동 추종**. 활성 breakpoint 목록만 읽는다 (C9).
- 클립: 페이지 rect 로 클립 + `withPageOcclusionClip` 경유 (콘텐츠성 chrome — canvas-rendering.md §8.5 표 준수. 스냅 정렬선의 "조작 표식 미적용" 판정과 **다르다** — 가이드는 상시 표시).
- 재렌더: `overlayVersionRef.current++` 만 (`invalidateContent()` 금지 — C11).
- 검증: 겹친 페이지 occlusion live + 페이지 드래그 추종 live + breakpoint 전환 시 목록 교체.

### Phase 5 — 인터랙션 (HIGH — R1)

- 신규 훅 `useGuideInteraction` (또는 BuilderCanvas capture 체인 내 분기) — 단일 판정 함수 `resolveGuideHit(point, guides, thresholdScenePx)` 순수 함수로 분리 (테스트 우선).
- 동작: ruler 스트립에서 드래그 시작 → 가이드 생성 / 기존 가이드 ±4 screen px 히트 → 이동 / ruler 로 되돌리면 삭제 / hover 시 resize 커서.
- **진입 게이트 (C10)**: `showRulers === false` 면 히트 판정 자체를 **수행하지 않는다** — 기존 pointer 체인 무변경 통과. 가이드는 그려지되 조작 불가.
- 드래그 중 transient 채널 (C6 전례 동형 — `guidePresentation` 신설) — canonical write 는 finish 1회.
- **우선순위 규칙 (R1 핵심)**: ruler 영역은 뷰포트 chrome 이라 씬 히트보다 항상 우선. 씬 안의 기존 가이드 히트는 요소 히트보다 우선하되 임계 ±4px 한정 — 기존 `resolveSelectionDragIntent`/페이지 타이틀 경로 진입 **전에** 판정하고, 미스 시 기존 체인 무변경 통과.
- 검증: 기존 인터랙션 유닛 전수 GREEN (G2) + live 생성/이동/삭제.

### Phase 6 — 스냅 편입 (MED — R2)

- `snapGuides.ts` 에 축별 라인 입력 추가 (1차안): `resolveSnappedPosition(raw, movingSize, candidates, threshold, extraLines?: { x: number[]; y: number[] })`.
- 가이드 라인은 **정렬선 판정에만** 참여 — 등간격(spacing) 이웃 아님 (rect 아님, `projectCandidate:270` 미통과).
- 소비처 2곳 (`usePageDrag:241` / `useDragBridge:636`) 이 드래그 세션 시작 시 활성 페이지·활성 breakpoint 가이드를 scene 좌표로 환산해 주입 (후보 수집 드래그당 1회 계약 C2 유지).
- 검증: 유닛 — 라인 흡착 + 기존 rect 12건 GREEN + spacing 미오염.

### Phase 7 — 검증 종결 (Gates 전수)

- G1~G6 전수 실행 + ADR Status 승격 + CHANGELOG + README.

## §4. Gate 상세 (ADR 본문 Gate 표의 실행 절차)

| Gate | 절차                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: Shift+R 토글 → ruler 드래그 생성 → 가이드 이동 → ruler 복귀 삭제 → 각 조작 Cmd+Z/Cmd+Shift+Z 왕복 → 새로고침 배치 유지                                                                  |
| G2   | **ruler OFF 이면 가이드 유무와 무관하게** 기존 선택/드래그/더블클릭/페이지 타이틀 유닛 전수 GREEN + live 스모크 (경로 무변경 — C10 진입 게이트로 강화). ruler ON + 가이드 0 문서도 동일 단언  |
| G3   | 요소·페이지 드래그가 가이드 라인에 흡착 (live) + 기존 rect 스냅 유닛 GREEN + spacing 판정에 가이드 미참여 유닛                                                                                |
| G4   | 겹친 페이지에서 아래 페이지 가이드가 위 페이지 body 위 미표시 (live) + 가이드가 페이지 rect 밖 미유출 + breakpoint 전환 시 타 breakpoint 가이드 미표시 (C9)                                   |
| G5   | **성능 (HC1)**: ruler on/off + 가이드 20개 문서의 오버레이 패스 증가분 측정 — 프레임 예산(16.7ms) 1% 이하. 가이드 드래그 100 move 재현에서 canonical write/히스토리/persist 각 0 (finish 1회) |
| G6   | type-check + 신규 유닛·정적 가드 PASS + CHANGELOG (Implemented 승격 시)                                                                                                                       |

## §5. BC 수식화

- 기존 프로젝트 영향 **0%** — `pageGuides` 부재 문서는 가이드 없음(현행 동일), 로드 시 재직렬화 0 (lazy write — 가이드 최초 생성 시에만 필드 기록). ADR-177 HC3 동형.

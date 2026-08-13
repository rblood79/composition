# ADR-179 설계 Breakdown: 캔버스 스냅·정렬 가이드 — 페이지 축 우선, absolute 요소 확장

## 1. Scope and dependency lock

### 1.1 In scope

- 페이지 드래그 중 **객체 스냅**: 다른 페이지의 가장자리(좌/우/상/하) + 중앙(수평/수직) 정렬 스냅 + 정렬선(스마트 가이드) 오버레이 표시
- 스냅 억제 modifier (Cmd/Ctrl 홀드 — Figma 관례) + 기존 snap-to-grid 와의 우선순위 규칙
- 후속 phase: absolute 요소 자유 이동에 같은 스냅 엔진 적용 (형제/컨테이너 기준)
- 등간격(equal spacing) 스냅·표시는 페이지 축 안정화 후의 후속 phase (같은 ADR 내)

### 1.2 Explicitly out of scope

- ruler + 수동 가이드, Alt 호버 거리 측정 (감사 문서 H1 의 인접 항목 — 별도 판단)
- flow 요소 드래그(순서 변경/재부모화)에의 스냅 — drop indicator 가 이미 그 축의 피드백
- 다중 선택 이동 (ADR-178 — 직교. 다중 드래그 시 스냅 기준은 리더 bbox 로 승계 가능하게만 설계)
- 페이지 위치의 히스토리/영속화 (ADR-177)

### 1.3 Four-question fork lock

| 질문                                          | 판정                                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/application 관계인가?                    | ADR-176 의 transient presentation 이 base — 스냅은 publish **직전의 좌표 보정 함수**로 얹힌다 (canonical/commit 경로 무변경). 177/178 과 직교.                       |
| schema 가 specialization 관계인가?            | 아니다. 스키마 무변경 — 런타임 보정 + 오버레이 렌더만.                                                                                                               |
| predecessor premise 를 reverse verify 했는가? | ADR-176 HC3(프레임당 publish 1회)·HC10(map clone 금지)을 스냅 계산이 깨지 않는지 Phase 0 에서 확인. 2026-08-12 오버레이 occlusion 규칙(§8.5)과의 chrome 분류도 판정. |
| 나중 review 까지 미룰 경계가 있는가?          | 없다. 스냅 우선순위(객체 > 그리드)·임계값의 zoom 보정·억제 modifier 를 Phase 0 전에 lock 한다.                                                                       |

3-ADR 분리(177/178/179)는 사용자 confirm 완료 — 2026-08-12 AskUserQuestion "3개 분리 (권장)" 선택.

## 2. Current evidence (2026-08-12 실측)

| 경로                                                                                                                           | 현재 동작                                                                                | 관심사                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts:146-150`                                                       | `snapToGrid` 켜져 있으면 `Math.round(x/gridSize)*gridSize` — 유일한 스냅                 | 스냅 보정 삽입 지점 (`calculatePosition`)                       |
| `apps/builder/src/builder/panels/settings/SettingsPanel.tsx:121-145`                                                           | snap-to-grid 설정 (8/16/24px), 기본 OFF (`stores/canvasSettings.ts:128`)                 | 객체 스냅 설정 항목 추가 거처                                   |
| 리포지토리 전체                                                                                                                | `alignmentGuide`/`smartGuide`/`snapLine`/등간격 grep 0건                                 | 신규 서브시스템                                                 |
| `apps/builder/src/builder/workspace/canvas/interaction/pagePositionPresentation.ts`                                            | 드래그 중 transient 좌표 publish (ADR-176)                                               | 스냅 보정은 publish 직전 순수 함수                              |
| `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts`                                                         | 오버레이 패스 — 2026-08-12 `withPageOcclusionClip` (콘텐츠성 chrome 페이지 간 occlusion) | 정렬선 렌더 거처 + chrome 분류 (드래그 순간 피드백 = 조작 표식) |
| `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts:169-227`                                                     | absolute 요소 left/top 드래그 — 스냅 없음                                                | 확장 phase 의 삽입 지점                                         |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/spatialIndex.ts` (동기화: `skia/renderCommands.ts::syncSpatialIndex`) | 요소 히트 공간 인덱스 (Rust WASM 래퍼 — `queryRect` 제공)                                | absolute 확장 시 스냅 후보 검색 재사용                          |
| `docs/reference/audits/2026-07-16-figma-benchmark-gap-analysis.md:41, 107, 151`                                                | H1 — smart guides/거리 측정 전무, 우선순위 4순위 백로그                                  | 본 ADR 이 그 축의 착수 결정                                     |

### 2.1 Phase 0 inventory freeze — 계약 표 (2026-08-12 실측)

> **ADR-178 Implemented (2026-08-12, 본 freeze 직전) 반영**: §2 표의 `usePageDrag.ts:146-150 calculatePosition` 은 `calculateLeaderPosition` (리더 위치 계산 + 다중 대상 델타 공유) 로 개칭됨. 스냅을 리더에만 걸고 델타를 공유하는 구조는 usePageDrag 헤더 주석에 이미 예정 기록 — ADR Decision 3 의 "축 고정 먼저 → 고정 축만 스냅" 순서는 코드상 성립 (`applyAxisLockToDelta` 가 스냅 삽입 지점 앞).

| ID  | 계약               | 확정 내용                                                                                                                                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 순수 함수 거처     | 신규 `interaction/snapGuides.ts` — `resolveSnappedPosition(raw, movingBounds, candidates, config) → { position, guides }`. 훅 밖 순수 함수 (`resolveSelectionDragIntent` 동형 단일 진입점)                          |
| C2  | 삽입 지점          | `usePageDrag.calculateLeaderPosition` — Shift 축 고정 → 객체 스냅 → (미흡착 축만) snap-to-grid. 리더에만 스냅, 다중 대상은 델타 공유 (ADR-178 계약)                                                                 |
| C3  | 후보 수집          | 드래그 시작 1회 — **전 페이지 전수** (가시 필터 없음: 수십 규모라 HC2 상한 내 + 드래그 중 뷰포트 진입 페이지 누락 회피). rect = stacked 기본값 + canonical override (`buildPageFrames` 동형), 드래그 대상 집합 제외 |
| C4  | 임계값             | ~~8 screen px 시작값 (Figma 관례 근사)~~ → **5 screen px (2026-08-13 G1 조정 — Pen v1.2.1 실측값 채택, 사용자 결정)**. scene 임계 = 5 / zoom                                                                        |
| C5  | 억제·우선순위      | Cmd(mac)/Ctrl(win) 홀드 = 전 스냅 억제 (PointerEvent `metaKey`/`ctrlKey` — RAF `latestPointer` 에 동승). 축별로 객체 스냅 성사 시 그리드 미적용, 실패 축만 그리드                                                   |
| C6  | guides 채널        | 신규 `interaction/snapGuidePresentation.ts` (module-level snapshot + version + subscribe — pagePositionPresentation 동형 축소판). positions publish 와 같은 RAF 콜백에서 프레임당 1회, finish/cancel 시 clear       |
| C7  | 오버레이 렌더      | `skiaOverlayBuilder.buildOverlayNode` 에 guide 레이어 — scene 좌표, strokeWidth = 1/cameraZoom (1 screen px), 색 `--accent` (builder 무채색 — 명도 대비). 조작 표식: `withPageOcclusionClip` 미적용 (§3.3 판정)     |
| C8  | 설정               | `canvasSettings.snapToObjects: boolean` 기본 **true** (Figma 기본 관례) + `setSnapToObjects` + SettingsPanel "Snap to Objects" 스위치 (Grid & Guides 섹션). 비영속 slice — 기존 showGrid/snapToGrid 와 동일 취급    |
| C9  | absolute 확장 좌석 | Phase 3 — `useDragBridge` 경로, 후보 = SpatialIndex `queryRect` (`wasm-bindings/spatialIndex.ts:94`). 판정 함수·오버레이 공유                                                                                       |
| C10 | commit 무변경      | finish 는 스냅 반영 positions 를 기존 `updatePagePosition`/`updatePagePositionsBatch` 로 commit — 기존 grid snap 과 동일 취급 (ADR-176 HC3·HC10 / ADR-177 계약 무변경)                                              |

**R2 lock (Figma 관례)**: 6축 edge/center 스냅, 임계 5 screen px (2026-08-13 G1 조정 — 시작값 8 에서 Pen 실측값으로 하향), Cmd/Ctrl 억제, stateless (raw 포인터 기준 — 리뷰 round 1 판정, §3.1 해제 상태 불필요 / 히스테리시스 필요 여부는 G1 live 조작감에서 재판정).

## 3. 계약 설계

### 3.1 스냅 계산 (순수 함수)

- `resolveSnappedPosition(raw, movingBounds, candidates, threshold) → { position, guides[] }` — 훅 밖 순수 함수 (테스트 가능).
- 후보: **가시 페이지의 6축** (left/centerX/right × top/centerY/bottom) — 페이지 수 규모(수십)라 O(N) 전수로 충분. absolute 확장 시 후보 수집만 SpatialIndex 로 교체.
- 임계값은 **screen px 기준** (scene 임계 = screenThreshold / zoom) — zoom 무관하게 화면상 같은 흡착 거리.
- 축별 독립 스냅 (x 는 수직선 후보, y 는 수평선 후보) — **위치 보정은** 최근접 1개만 채택, 임계 밖이면 raw 유지. **정렬선 표시는** 흡착 확정 위치에서 성립하는 라인 전부 방출 (2026-08-13 사용자 보고 — 같은 크기 정렬 시 상·중·하 3선, Figma/Pen `recordedSnaps` 동률 다중 기록 동형).
- 기본은 stateless — 판정 기준이 raw 포인터 위치라 raw 가 임계 밖으로 나가면 즉시 해제되어 별도 해제 상태가 필요 없다. 부착/해제 임계 차등(히스테리시스) 필요 여부는 Phase 0 Figma 관례 실측에서 판정 — 필요 시 직전 스냅 상태를 명시 인자로 추가 (순수성 유지, R2/G4 연계).

### 3.2 우선순위·상호작용

- 객체 스냅 > snap-to-grid (동시 활성 시 객체 우선, 객체 임계 밖이면 그리드).
- Cmd/Ctrl 홀드 = 전 스냅 억제 (Figma 관례).
- Shift 축 고정(ADR-178)과 조합: 축 고정 먼저 → 고정된 축만 스냅.

### 3.3 정렬선 렌더

- 오버레이 패스에서 `guides[]` 를 1px(screen) 선으로 렌더.
- ~~Figma 어법(빨강 계열)이 아니라 builder 시맨틱 토큰 사용 (`--accent` 계열)~~ → **2026-08-13 사용자 결정으로 웜 레드 `#F24822` 상수로 전환** (Figma 도움말 PNG 픽셀 실측값 / Pen `#DD3F17` 대조 — 두 도구 공통 관례: 드래그 중 순간 피드백은 콘텐츠·선택 파랑·페이지 크롬과 혼동되지 않는 이질색). 무채색 `--accent` 는 선택 박스·페이지 테두리와 명도로만 겨뤄 식별성이 약했다. 선택 파랑 `OVERLAY_BLUE` 와 같은 Skia 층 상수 어법 (테마 무관 — CSS 변수 조회 없음).
- 드래그 중 순간 피드백(조작 표식)이므로 페이지 간 occlusion 대상 아님 — 드래그 대상 페이지는 활성=최상단이라 실질 겹침 없음 (§8.5 분류 판정 기록).

## 4. Phase 분해

| Phase | 내용                                                                                             | 산출 검증                                                       |
| ----- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 0     | inventory freeze — publish 경로/오버레이 삽입 지점/설정 store 확정 + Figma 임계값·억제 관례 실측 | 계약 표                                                         |
| 1     | 스냅 순수 함수 + 페이지 드래그 배선 (6축, 임계 zoom 보정, Cmd 억제, 그리드 우선순위)             | 유닛(축별/임계/우선순위) + live: 인접 페이지 가장자리·중앙 흡착 |
| 2     | 정렬선 오버레이 렌더                                                                             | live: 흡착 순간 정렬선 표시/해제                                |
| 3     | absolute 요소 확장 — 형제/컨테이너 기준 후보 (SpatialIndex)                                      | live: absolute 드래그 흡착 + 60fps                              |
| 4     | 등간격 스냅·표시 (선택 phase — Phase 1~3 안정 후)                                                | live: 3 페이지 등간격 배치                                      |
| 5     | 검증 종결 — 성능 + CHANGELOG                                                                     | live behavior 게이트                                            |

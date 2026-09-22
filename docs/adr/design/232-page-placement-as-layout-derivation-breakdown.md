# ADR-232 Design Breakdown — 페이지 배치 = 페이지 컨테이너의 레이아웃 파생값

> 본문: [232](../completed/232-page-placement-as-layout-derivation.md). 구현 상세 (Phase · 파일 · 게이트 실행 기록) 는 이 문서에만 둔다.

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-22 대화)

1. **base / 응용**: 이 ADR 은 배치 **모델** (base) 이다. ADR-177 (좌표 = 문서 데이터) · b290d75da (reflow) · ADR-231 Phase 2 (시스템 열) · 2026-09-18/22 수리는 그 모델 위의 응용이었고, 모델이 바뀌면 전부 대체된다. ADR-231 Phase 1 (frame 크기 = 1920 × 발행 높이) 은 **입력** 이라 남는다.
2. **schema 직교성**: `pagePositions` (breakpoint 별 좌표) 를 페이지 `placement` (grid 칸 · absolute inset · tier override) 가 **대체** 한다 — specialization 이 아니라 교체. 이관 규칙은 §3 Phase 3.
3. **선행 전제 reverse 검증**: ADR-177 의 "위치는 문서 데이터 · undo 일원" 은 유지된다 (placement 도 문서 데이터 · history 편입). 뒤집히는 전제는 "위치는 사용자가 정한 절대 좌표" 하나 — 사용자 진술 "page 도 canvas 내 컴퍼넌트와 같은 element · parents 의 display 로 정렬" (2026-09-22).
4. **codex 1차 진입 시점**: 본 breakdown §3 Phase 분해 뒤 `/review-adr 232`.

사용자 확인이 필요한 결정 지점 3 (본문 §Decision 에 명시): (a) grid 기본 · (b) 컨테이너 폭 = 열 수 설정, track 은 breakpoint 페이지 폭 고정 (뷰포트 아님) · (c) 이관 = 칸이면 고정 / 아니면 absolute / 전체 벡터 검증 실패면 Home 제외 전부 absolute, 보존 대상 = Home 기준 상대 벡터 (round 1 h1 · round 2 h1/m3 반영). 확정 규칙: Home 이동 불가 (사용자 2026-09-22).

## 2. 코드 사실 (2026-09-22 HEAD `f258286ef`)

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 경로                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 페이지 위에 부모 노드가 없다 — 레이아웃 root 는 페이지 body (또는 frame mirror) 각각                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `layout/layoutRootKey.ts:10-16` · `scene/layoutCache.ts:59-61`                                                                                                          |
| F2  | 페이지 위치는 저장 좌표: `pagePositions` (활성) + `pagePositionsByBreakpoint` (3 스냅샷) + canonical `pagePositions?: Record<pageId, Partial<Record<BreakpointName, {x,y}>>>`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `stores/elements.ts:593` · `packages/shared/src/types/composition-document.types.ts:1130`                                                                               |
| F3  | 좌표를 맞춰 주는 함수 14: `calculatePagePositions` · `placeUserPages` · `placeSystemColumn` · `calculateNextPagePosition` · `placeMissingUserPages` · `mirrorSystemPagePositions` · `withActivePagePositionSnapshot` · `initializePagePositions` · `switchPagePositionsBreakpoint` · `updatePagePosition` · `updatePagePositionsBatch` · `applyPageFrameReflow` · `buildPagePositionWriteEntries` · `resolvePagePlacementInputs` (elements.ts 136 행) + `stores/utils/pageFrameReflow.ts` · `viewport/pageLayoutActions.ts` · `pageLayoutConstants.ts` · `hooks/usePageDrag.ts` · `interaction/pagePositionPresentation.ts` (1,034 행) | `stores/elements.ts` · 위 5 파일                                                                                                                                        |
| F4  | 최근 60일 `pagePositions` 를 고친 elements.ts 커밋 8 — 09-18 열 수 (`54ab4caa5`) · b290d75da reflow · ADR-231 Phase 2 (`164482b42`) · 09-22 전환/hydration 유입 (`f258286ef`) 등. 전부 "저장 좌표 정합" 결함                                                                                                                                                                                                                                                                                                                                                                                                                           | `git log -S pagePositions`                                                                                                                                              |
| F5  | `pagePositions` 를 읽는 파일 37 (test 제외) — 렌더 (renderCommands · skiaTreeBuilder · visiblePageRoots) · 히트 (selectionHitTest · useCentralCanvasPointerHandlers) · 가이드 (pageGuideActions · useGuideDrag · pageGuideRevision) · 스크롤바 (viewportMetrics · CanvasScrollbar) · 오버레이 (usePageHeaderPlacement · useActionBarPlacement) · 패널 (TransformSection · PageBodyEditor) · store/history 등                                                                                                                                                                                                                           | `grep -rln pagePositions apps/builder/src/builder`                                                                                                                      |
| F6  | `pageFrames` (id · x · y · width · height) 를 읽는 파일 13 — 테두리 · 선택 · 미니맵 · 가시 페이지 집합 · 무효화. frame 은 `buildPageFrames` 가 `pagePositions` + `readPageFrameSize` 로 만든다                                                                                                                                                                                                                                                                                                                                                                                                                                         | `scene/buildSceneIndex.ts:73-122` · `skia/skiaFrameHelpers.ts` · `skia/workflowMinimap.ts` · `scene/buildVisiblePageSet.ts`                                             |
| F7  | 렌더 무효화 축: `visiblePagePosition` (viewport lane — 보이는 페이지 콘텐츠 캐시 + stale 보정) · `allPageFrameVersion` (workflow lane). 위치가 바뀌면 콘텐츠 캐시가 다시 만들어진다                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `skia/renderInvalidation.ts:43-49` · `skia/renderCommands.ts:981-1091`                                                                                                  |
| F8  | 드래그 finish → `updatePagePosition` / `updatePagePositionsBatch` (ADR-176/178 transient 채널 뒤 1회 commit) · history `pagePositionEvent.entries[]` · Styles Transform 페이지 X/Y · 방향키 nudge                                                                                                                                                                                                                                                                                                                                                                                                                                      | `hooks/usePageDrag.ts:347-458` · `stores/history/historyActions.ts:168` · `panels/styles/sections/TransformSection.tsx:142` · `hooks/useGlobalKeyboardShortcuts.ts:386` |
| F9  | Page layout (auto/vertical/horizontal) · Page gap 은 **localStorage 전용** (`composition.pageLayout.v1`) — 문서 데이터 아님                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `stores/utils/pageLayoutStorage.ts:24` · `panels/settings/SettingsPanel.tsx`                                                                                            |
| F10 | 엔진은 grid 를 지원한다: `gridTemplateColumns/Rows` · `gridAutoRows` · `gridAutoFlow` (column 포함, `grid.rs:1445`) · 자식 `gridColumn/gridRow` line·span 배치 (`grid.rs:747-1053`) · `repeat(auto-fill, minmax())` (컨테이너 폭 필요, `grid.rs:158`) · 자식 `position:absolute` + inset (ADR-224)                                                                                                                                                                                                                                                                                                                                     | `layout/engines/fullTreeLayout.ts:836-841 · 1045-1050 · 1236-1275` · `packages/engine/src/grid.rs`                                                                      |
| F11 | responsive override 는 노드 종류를 가리지 않지만 **키는 eligibility 표를 지난다** — `isResponsiveEligibleStyleProp` false 면 skip (`resolveResponsive.ts:58-64`). 리뷰 round 1 실행 확인: `gridTemplateColumns` · `gridColumnStart` · `position` = true, `gridColumn` · `gridRow` · `gridAutoFlow` = false. cascade 는 desktop → tablet → mobile 상속 (`responsive.types.ts:438-464`)                                                                                                                                                                                                                                                  | `layout/resolveResponsive.ts:58-64 · 118-124` · `packages/shared/src/types/responsive.types.ts:192-223 · 438-464`                                                       |
| F12 | 현행 auto 배치의 행 높이 = 그 행 최대 frame 높이 (`rowMaxHeight`), 열 수 = 첫 행 페이지 수 (09-18: 뷰포트 폭으로 재도출하면 zoom 마다 칸이 바뀐다 — 실측 후 기각)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `stores/elements.ts:713-745 · 790-815`                                                                                                                                  |
| F13 | ADR-231: Components frame = 1920 × 발행 높이 (입력, 유지) · 시스템 열 `x = homeX − (1920+gap)` · reflow 열/격자 경계 · breakpoint 공통값 (배치, 대체 대상)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `completed/231-*.md` §Decision · `stores/elements.ts` `resolveSystemPageIds` · `stores/utils/pageFrameReflow.ts`                                                        |
| F14 | 페이지 위치는 Preview/Publish 산출물과 무관 (ADR-177 · ADR-181 "Figma 와 동일 — 문서 데이터지만 배포 무관")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `composition-document.types.ts:1146-1150`                                                                                                                               |

## 3. Phase 분해

### Phase 0 — inventory freeze (G0)

1. F1~F14 재grep · 소비 파일 37 + 13 을 "읽기만 (frames 로 대체)" / "쓰기 (placement 로 대체)" / "삭제" 로 분류한 표를 §5 G0 에 기록.
2. 이관 대상 실측: 로컬 IndexedDB 프로젝트 N 개의 `pagePositions` 를 읽어 (a) 격자 칸과 일치 (gap 허용 ±1px) · (b) 불일치 (손 배치) · (c) breakpoint 별 상이 — 각 개수. (b)+(c) 가 absolute 승격 대상.
3. 부팅 순서 실측: `wasmLayoutReady` 전에 페이지 frame (테두리) 이 그려지는가 — 그려진다면 R3 (첫 프레임 겹침) 가 실재.

### Phase 1 — 파생 배치 root + frames (G1 · G3)

1. `scene/pagePlacement.ts` (신규): 입력 = 페이지 순서 · 페이지별 frame 크기 (`readPageFrameSize`, ADR-231 neutral 포함) · 컨테이너 style (`pageLayout` 문서 필드: direction · gap · columns · responsive override · `placementModel`) · 페이지별 `placement` (칸 longhand / absolute inset / override) → 출력 = `pageFrames` (x · y 포함). 계산은 기존 엔진 경로 (`calculateFullTreeLayout` 에 합성 root + leaf N) — CSS grid 규칙 · gap 어법 · absolute inset 을 그대로 쓴다. 메모 키 = (frame 크기 벡터 · 페이지 순서 · 컨테이너 style · placement · activeBreakpoint · placementModel). `placementModel === "legacy"` 면 placement 를 무시하고 모든 페이지를 absolute 로 넣는다 — 좌표 = `pagePositions[page][tier]` ?? `pageLayout.legacyFallback[tier][page]` (복귀 상태 — Home 포함, 흐름 0).
   - direction 매핑 (breakpoint 공통): auto → `display:grid · gridTemplateColumns: repeat(N, <breakpoint 페이지 폭>px) · gridAutoRows: auto · alignItems: start · justifyItems: start` (track 고정 폭 — 빈 열 0 폭 접힘 방지, round 2 m3) · vertical → N=1 · horizontal → `gridAutoFlow: column · gridTemplateRows: repeat(1, auto)`. track 폭은 `CANVAS_VIEWPORT[activeBreakpoint].width` 를 파생 시 계산 (저장 0).
   - 시스템 페이지 (Components) = `placement: { position: "absolute", left: −(1920+gap), top: 0 }` 기본값 — `placeSystemColumn` 특례 삭제.
2. `buildPageFrames` 가 `pagePositions` 대신 파생 frames 를 받는다. `pageFrames` 소비 13 파일 무변경. `pagePositions` 를 읽던 37 파일 중 "읽기" 분류는 `pageFrames` (또는 `pageFrames[id].x/y`) 로 교체.
3. 파생 결과를 `pagePositions` 형태의 **읽기 전용 파생 map** 으로도 노출 (전환기 — Phase 3 에서 제거) 하여 소비처 교체를 phase 안에서 나눠 커밋 가능하게 한다.

### Phase 2 — 편집 경로 = placement style (G2)

1. 드래그 finish · Transform X/Y · nudge → `setPagePlacement(pageId, placement, breakpoint)` 1 액션 (tier 토글 ON 이면 override, 아니면 base — ADR-154 개정 1 과 같은 규칙). placement 키는 longhand 만 (`gridColumnStart/End` · `gridRowStart/End` · `position` · `left/top`) — eligibility 확장 0. **Home 은 거부** (액션이 no-op 반환 · UI 는 비활성). history 는 기존 `pagePositionEvent` 를 `pagePlacementEvent` 로 개명 (entries[] 유지 — 교환은 entry 2 = Cmd+Z 1회).
2. 칸 이동 (흐름 안에서 옮기기): 드래그 중 다른 칸 위에 놓으면 칸 고정 longhand — 격자 밖에 놓으면 absolute. 스냅 판정 = 놓은 좌표가 어떤 칸 rect 안인가. **충돌 정책 (m5)**: 대상 칸을 고정 페이지가 차지 → 두 placement 교환 · 흐름 페이지가 있던 칸 → 고정 + 재흐름 · 대상이 첫 칸 (Home) → 거부. 쓰기 전 "고정 칸 페이지당 유일" 검사 — 엔진의 명시 배치 겹침 허용 (`grid.rs:1190-1210`) 에 기대지 않는다.
3. align (줌 메뉴): Home 을 제외한 모든 페이지 `placement` 삭제 (흐름 복귀) — `alignPagesToScreen` 의 좌표 계산 삭제. Navigator 순서 변경은 Home 을 index 0 에서 빼지 못한다.
4. Settings Page layout · gap → 문서 `pageLayout` (localStorage 폐기, 문서 데이터로 승격) · 열 수 입력 추가 · 열 수 · gap 은 tier 토글로 override, **direction 은 breakpoint 공통** (`gridAutoFlow` 비-eligible).

### Phase 3 — 이관 · 삭제 (G4 · G5)

1. hydration 이관 (Decision 6 · 7): 조건 = `pageLayout.placementModel` 없음 && `pagePositions` 있음. tier 마다 (i) Home 저장 좌표를 원점으로 평행이동 + 이관 세션 뷰포트 pan 보정 `newPan = oldPan + H × zoom` (활성 tier 의 H 로 한 번, `screen = world × zoom + pan` — 화면 Δ0) · (ii) Home 제외: 칸 좌표와 같으면 칸 고정 (auto 자리도) / 아니면 absolute · (iii) 파생 재실행 → 저장 벡터 (Home 기준) Δ0 검증, 실패 시 Home 제외 전부 absolute · (iv) 차분은 이전 tier cascade 결과 기준 + 명시 reset (`position:"static"` · line `"auto"`, 어댑터가 `"auto"` → 엔진 빈 문자열) · (v) 전부 기본 흐름이면 placement 쓰기 0. 완료 시 `placementModel: "derived"` 기록 (새 문서는 생성 시). **`pagePositions` 데이터는 지우지 않는다** — `"derived"` 에서는 읽지 않는 휴면 필드. 복귀 = `setPlacementModel("legacy")` (디버그 전역 `__composition_STORE__` + Settings 숨김 항목) — 전환 순간 `pagePositions` 에 좌표가 없는 (page × tier) 를 그때의 파생 위치로 `pageLayout.legacyFallback` 에 채운다 · 표식·placement 삭제 없음 · 재이관 없음 · 배치 편집 잠금 · legacy 에서 페이지 추가는 `legacyFallback` 에 다음 칸 (현행 `calculateNextPagePosition` 규칙 — 이 함수 하나는 legacy 전용으로 남긴다) · 재이관은 명시 액션 (입력 = `pagePositions ⊕ legacyFallback`). 이관 결과 요약은 `docs/adr/evidence/232-*` 하니스로.
2. 삭제: F3 의 14 함수 중 `calculateNextPagePosition` (legacy 페이지 추가 전용) 을 뺀 13 · 5 파일 · `pagePositionsByBreakpoint` · `pageLayoutStorage.ts` · `pageFrameReflow.ts` · 테스트. `pagePositions` 는 스키마 · 데이터 모두 남기되 **쓰기 0 · 읽기는 이관 입력과 legacy 모드 두 곳뿐** (`placementModel` 기준, placement 부재는 판정 기준이 아니다 — round 3 l3) — 데이터 삭제는 후속 major 의 별도 결정 (h2).
3. ADR-177 → Superseded by 232 표기 · ADR-231 본문에 "Phase 2 배치 절은 232 가 대체 (frame 크기 절은 유지)" 주석.

### Phase 4 — live · 성능 · 문서 (G2 · G3 · G4 · G5)

1. live 하니스 `scripts/adr232-page-placement-live.mjs`: 새 프로젝트 → 페이지 5 추가 (auto 3열 override: desktop 3 · mobile 6) → 전환 왕복 Δ0 · 겹침 0 · 드래그 격자 밖 → absolute → undo → reload 보존 · 흐름 칸으로 드래그 → 고정 + 뒤 페이지 재흐름 · 고정 칸으로 드래그 → 교환 (undo 1회) · Home 드래그/X/Y/nudge 무반응 · Home 칸 교환 거부 · Components 열 absolute (−2000,0) · align 으로 전부 흐름 복귀 · Home body 높이 1600 → 뒤 행만 이동 (b290d75da 동형) · Navigator 순서 변경 (Home 0 유지).
2. 성능 A/B (m6): before = 현행 HEAD worktree · after = 232, **같은 조작** 을 두 arm 이 수행. (1) 600 요소 frame 크기 불변 편집 — `scene.build` · `layout.publish` Δ ≤ +1 ms · root 파생 카운터 0/30 (`adr231-frame-decomp-ab.mjs` 재사용). (2) 페이지 30 · 0.12 줌 (다수 가시) 에서 body 높이 1080→1600 · 열 수 3→4 · breakpoint 전환 · 순서 변경 — `render.frame` p95 · total Δ ≤ +1 ms 또는 ≤ +5%. 조건: headed Chrome · DPR 2 · throttle 1 · visible · 워밍업 5 · 짝 순서 교대. 600 요소 문서는 규모 전용 (분포 지표 인용 금지).
3. BC (G4): G0 분류 문서 + 합성 fixture (혼합 승격 · 여러 행 · 불규칙 크기 · 빈 열 · Home 오프셋 317 · A→B→A · absolute→flow→absolute) — (a) normalized-world Δ0 (tier 3) · (b) 이관 세션 screen Δ0 (뷰포트 보정) · 두 번째 reload Δnode 0 · `pagePositions` 바이트 동일 · (c) `"legacy"` 전환 → `pagePositions ⊕ legacyFallback` absolute Δ0 · derived 에서 추가한 페이지가 legacy 첫 칸과 겹침 0 · legacy 페이지 추가 → 다음 칸 · reload 재이관 0 · 재이관 액션 Δ0 · 232 이전 HEAD worktree 로 열기 → 좌표 Δ0 · 저장 뒤 root 필드 보존 여부 기록.
4. 본문 `### Live Exercise` · README · CHANGELOG · 177 Superseded.

## 4. 파일 변경표 (예상)

| 파일                                                                                                                    | 변경                                                                                                    | Phase |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | :---: |
| `workspace/canvas/scene/pagePlacement.ts` (+test, 신규)                                                                 | 합성 root + leaf → 엔진 → frames · 메모 키 · direction 매핑 · 시스템 기본값                             |   1   |
| `workspace/canvas/scene/buildSceneIndex.ts` · `buildSceneSnapshot.ts` · `sceneSnapshotTypes.ts`                         | `pagePositions` 입력 → 파생 frames                                                                      |   1   |
| `packages/shared/src/types/composition-document.types.ts`                                                               | `pageLayout` (컨테이너 style + override) · page `placement` · `pagePositions` 는 읽기 전용 (deprecated) |  1·3  |
| `stores/elements.ts` · `stores/canonical/canonicalDocumentStore.ts`                                                     | `setPagePlacement` · `setPageLayout` · F3 14 함수 삭제                                                  |  2·3  |
| `hooks/usePageDrag.ts` · `interaction/pagePositionPresentation.ts`                                                      | finish → placement (칸 스냅 / absolute)                                                                 |   2   |
| `panels/styles/sections/TransformSection.tsx` · `hooks/useGlobalKeyboardShortcuts.ts` · `viewport/pageLayoutActions.ts` | X/Y · nudge · align → placement 액션                                                                    |   2   |
| `panels/settings/SettingsPanel.tsx` · `stores/utils/pageLayoutStorage.ts` (삭제)                                        | 문서 `pageLayout` · 열 수 · tier override                                                               |   2   |
| `stores/history/historyActions.ts`                                                                                      | `pagePlacementEvent`                                                                                    |   2   |
| `hooks/usePageManager.ts` · `stores/history/snapshotRestore.ts`                                                         | hydration 이관 · `initializePagePositions` 삭제                                                         |   3   |
| `stores/utils/pageFrameReflow.ts` · `workspace/canvas/pageLayoutConstants.ts` (삭제)                                    | 파생값이라 불필요                                                                                       |   3   |
| `pagePositions` 읽기 37 파일                                                                                            | `pageFrames` 로 교체 (G0 표)                                                                            |  1·3  |
| `scripts/adr232-page-placement-live.mjs` · `docs/adr/evidence/232-*`                                                    | G2 · G3 · G4 · G5 기록                                                                                  |   4   |

새 상수 0 · i18n: Settings 열 수 라벨 ko/en 2.

## 5. 게이트 실행 기록

### G0 — Phase 0 inventory freeze · **PASS** (2026-09-22, HEAD `f258286ef`)

전문: [evidence/232-g0-inventory-freeze.md](../evidence/232-g0-inventory-freeze.md) · 부팅 계측 원시값 [evidence/232-g0-inventory-probe.json](../evidence/232-g0-inventory-probe.json) · 하니스 `apps/builder/scripts/adr232-g0-inventory-probe.mjs`.

| 조건           | 결과                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1~F14 재grep  | 일치 — 정정 1건: 페이지 gap 기본값은 **80** (`PAGE_STACK_GAP`), 100 아님. track stride · 이관 칸 판정이 이 값을 쓴다                                                                      |
| 37 + 13 분류표 | A 읽기→frames 14 · B scene 파생 입력 4 · C 쓰기→placement 5 · D 삭제 5 · E 이관/legacy 축소 3 · F 버전 축 2 · G 주석·하니스 7                                                             |
| 로컬 문서 분류 | 9 문서 — 좌표 없음 5 / 있음 4 (전부 열 격자 일치, 손 배치 0) · breakpoint 상이 2 · 최대 페이지 81                                                                                         |
| 음수 칸        | 실재 (Home 왼쪽 열 2 · Home 위 행 1) — grid line ≥ 1 이라 칸 불가 → Decision 6 (ii) absolute 갈래가 흡수, **세 번째 갈래 불요**                                                           |
| 부팅 순서 (R3) | frame 데이터 1285 ms · 엔진 rect 1340 ms · Skia canvas 1369 ms — 그러나 `SkiaRenderer` 는 `await initAllWasm()` 뒤에만 생성되므로 **엔진 준비 전 frame 은 그려질 수 없다 → R3 도달 불가** |

후속 반영: (1) Phase 1 track stride 는 `CANVAS_VIEWPORT[tier].width + pageLayout.gap` (기본 80) · (2) G3 파생 1회 비용은 페이지 30 과 함께 **80** 도 1회 기록 (실물 최대) · (3) R3 대응은 신규 구현 대신 "렌더러 생성이 `ready` 뒤" 를 고정하는 정적 테스트로 대체.

### G1 — Phase 1 파생 배치 root + frames · **PASS** (2026-09-22, `476fd6af6` + `0371d0c00`)

| 조건                                                       | 결과                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| (a) 페이지 1~30 × direction 3 × breakpoint 3 = 현행 출력   | PASS — oracle `calculatePagePositions` 와 Δ0 (63 케이스)                                                                                  |
| (b) 불규칙 높이 = 행 최대 (`rowMaxHeight` 동형)            | PASS — 1600 행에서 둘째 행 y 1680 · 폭 혼합에도 auto 칸 stride 유지 · vertical/horizontal 자기 치수 누적                                  |
| (c) 칸 고정 longhand · absolute 음수 inset                 | PASS — 고정 칸 (4000,0) · 빈 열 보존 (접히면 2000) · absolute −2000 · absolute 로 빠진 칸을 뒤 페이지가 채움 · row span                   |
| (d) root 열 수 override + 페이지 칸 override (mobile 전용) | PASS — `resolveResponsiveStyleMap` (요소와 같은 SSOT) 경유 · eligibility 밖 키 (`gridAutoFlow`) 는 차단 · direction 은 breakpoint 공통    |
| (e) 메모 키 불변 시 엔진 호출 0                            | PASS — 같은 입력 10회 → 파생 1회 · 크기 벡터/breakpoint/열 수/placement 각각이 키에 포함                                                  |
| (f) tier reset (`position:"static"` · line `"auto"`)       | PASS — desktop absolute → tablet cascade 상속 → mobile 흐름 복귀                                                                          |
| (g) Home 은 흐름 원점                                      | PASS — placement 없으면 3 direction 모두 (0,0) · 다른 페이지가 absolute 로 나가도 유지. **쓰기 거부는 Phase 2** (`setPagePlacement` 액션) |
| 파생 1회 비용                                              | n=30 median 0.24 ms · n=80 median 0.57 ms (엔진 프로브 build+compute+read) — 게이트 ≤ 1 ms                                                |

unit 91/91 (`scene/pagePlacement.test.ts`) + 정적 4 (`pagePlacementKeys.static.test.ts`). 원복 RED 5/5 — gap +1 (67 FAIL) · `justifyContent:start` 제거 (20) · track `max-content` (6) · 메모 키에서 크기 벡터 제거 (1) · eligibility 필터 우회 (2).

live 21/21 (`apps/builder/scripts/adr232-derived-placement-live.mjs`, headed · 실제 빌더 · 페이지 6) — [evidence/232-phase1b-live.json](../evidence/232-phase1b-live.json). derived 전환 · 3열 격자 · 겹침 0 · 열 수 변경 · 칸 고정 + 재흐름 · breakpoint 왕복 Δ0 · tier stride 848/470 · mobile 열 수 override · Home body 1600 → 둘째 행 1680 (reflow 코드 없이) · 파생 갱신 저장 좌표 쓰기 0 · legacy 복귀.

Phase 1 구현 결정 (승인 scope 안의 통상 판단): 페이지 `placement` 는 **문서 root `pageLayout.placements[pageId]`** 에 둔다 — 페이지 노드/`Page` 배선을 건드리지 않고 `pagePositions` 를 구조적으로 1:1 대체하며, R6 (export 누출) 도 같은 근거로 닫힌다. style 언어와 cascade 는 요소와 동일 (`resolveResponsiveStyleMap`).

### G2 — Phase 2 편집 경로 · **PASS** (2026-09-22, `a208eff16`)

live 24/24 (`apps/builder/scripts/adr232-placement-edit-live.mjs`, headed · 실제 빌더 · 페이지 6) — [evidence/232-g2-placement-edit-live.json](../evidence/232-g2-placement-edit-live.json).

격자 밖 드래그 → absolute (파생 좌표 = inset) · Cmd+Z 흐름 복귀 · reload 보존 (placement·좌표 Δ0) · 흐름 칸 → 고정 + 뒤 페이지 재흐름 · 고정 칸 → 교환 (좌표 맞바뀜 · 겹침 0 · Cmd+Z 1회) · Home 드래그/nudge 무반응 · 첫 칸 교환 거부 · align → placement 0 + 3열 복귀 + 시스템 기본 배치 유지 · 열 수 5 · 저장 좌표 쓰기 0 · 시스템 페이지 기본 배치 (placement 저장 없이 왼쪽 열).

**live 가 잡은 결함 2** (unit 은 통과했다): (1) `pages[0]` 은 Home 이 아니다 — store 페이지 순서는 시스템 Components 가 앞에 와서 **Home 이동 금지 규칙이 통째로 뚫려 있었다** (R10). (2) align 이 시스템 페이지 placement 까지 지워 Components 가 흐름 첫 칸에 합류, Home 을 밀어냈다 → Decision 5 의 시스템 기본 배치를 **파생에 둔다** (저장하지 않는 기본값).

포인터 플럼빙 경계: 칸 고정·교환·거부는 드래그 finish 와 **같은 커밋 진입점** (`commitFromPoint`) 으로 실행한다 — 헤더 합성 드래그는 작은 Δ 에서 실행마다 갈려 판정 자체를 못 본다. 실제 마우스 드래그는 absolute 드롭과 Home 무반응이 덮는다. **Navigator 순서 변경** 은 현재 제품에 그 조작이 없어 (store reorder 액션 0) 하니스에서 뺐다 — ADR 본문 G2 의 해당 항목은 제품에 그 기능이 생길 때 열린다.

### G4 — Phase 3 이관 BC · **PASS** (2026-09-22, `7ab3c4727`)

live 15/15 (`apps/builder/scripts/adr232-migration-bc-live.mjs`, headed · 실제 hydration · Home 오프셋 317 + 손 배치 1 + tier 3 상이 fixture) — [evidence/232-g4-migration-bc-live.json](../evidence/232-g4-migration-bc-live.json) · unit 13 (`pagePlacementMigration.test.ts`).

(a) normalized-world Δ0 × 3 tier · 시스템 열 규칙 (Home.x − 2000) · `pagePositions` 바이트 동일 · (b) 두 번째 reload 재이관 0 + 벡터 Δ0 · (c) legacy 복귀 좌표 = 저장값 · 겹침 0 · legacy reload 재이관 0 · 재이관 벡터 Δ0.

**하니스 함정**: 새 프로젝트는 hydration 이 이미 `derived` 를 쓴다 — 레거시 문서를 재현하려면 표식을 지워야 이관이 돈다. 그러지 않으면 G4 (a) 가 흐름끼리 비교해 **거짓 통과** 한다 (첫 실행에서 실제로 그랬다).

시스템 페이지는 벡터 계약에서 뺀다 — 그 위치는 저장값이 아니라 ADR-231 규칙의 파생 기본값이고 (Decision 5) 이관 대상도 아니다. 대신 규칙 자체 (Home.x − (1920+gap)) 를 따로 본다.

**미실행 1**: (c) 의 "232 이전 빌드로 같은 문서 열기 → 좌표 Δ0 · root 필드 보존 여부" 는 이전 빌드 worktree 가 G3 측정에 쓰여 이번에 돌리지 않았다. `pagePositions` 가 바이트 동일하다는 것은 확인했으므로 이전 빌드가 읽을 좌표는 보존돼 있다 (보존 **여부 기록** 만 미실행).

### G5 — Phase 3 회귀 · **PASS** (2026-09-22)

- 정적 (`scene/__tests__/pagePositionsResidue.static.test.ts`): 문서 `pagePositions` 를 읽거나 쓰는 곳이 **허용 목록 안뿐** — 이관 (`pagePlacementHydration` · `pagePlacementMigration`) · legacy 읽기 (`pagePlacement`) · 복귀 (`pagePlacementCommit`) · canonical mutation surface · 파생 입력 1지점 (`BuilderCanvas`) · dev 디버그 전역 · 벤치 fixture. store 에 저장 좌표 필드·배치 함수 12 부재도 같이 고정.
- live 5/5 (`adr232-consumer-parity-live.mjs`): store 파생 미러 = scene frame 좌표 · 페이지 헤더 x = frame x (화면 좌표) · 히트 (페이지 중심 클릭 → 그 페이지 body 선택). 스크롤바 extent·액션 바는 그 채널이 노출/표시되지 않아 **판정 생략** (2/5 는 trivially true).
- ADR-231 Phase 2 하니스 **14/14** (`adr231-components-frame-live.mjs --phase 2`): frame 1920 × 발행 높이 · maxScrollTop 0 · 전환 왕복 Δ0 · 시스템 열 규칙 · 드래그 (−2500,200) 보존 · reload 보존 · 새 페이지 x ≥ 0 · align 뒤 시스템 열 복귀 · mobile override 왕복 · pageerror 0. (구 15 항목 중 `updatePagePosition` 직접 호출 1건은 같은 조작을 `commitFromPoint` 로 바꿔 유지.)

### G3 — Phase 4 성능 · **PASS 3 / 재승인 1** (2026-09-22)

전문: [evidence/232-g3-perf-ab.md](../evidence/232-g3-perf-ab.md). 대조군 = `f258286ef` worktree · 실험군 = `accf4eaec` worktree (둘 다 그 커밋 lockfile 로 install).

- (1) frame 크기 불변 편집 600 요소 (`--pairs 4`): `scene.build` +0.1 · `layout.publish` +0.1 · total +0.2 → **PASS**. 크기 불변 편집의 **파생 카운터 0** · 유휴 0 · 전환 1회당 1 (메모 정상).
- (2) 위치 변경 조작 (페이지 30 · 줌 0.12 · `--pairs 5`): body 높이 **−24.3 ms** · 페이지 추가 **−3.8 ms** · 열 수 (after 전용) 47.9 ms → PASS. **breakpoint 전환 total +9.9 ms (+12.6%) 미달** — `render.frame` 은 −0.2 (PASS).
- 미달 원인 분해: 메모 키 누락 아님 (파생 1회) · 렌더 캐시 재생성 아님 (`render.frame` −0.2) · scene 재구성 아님 (+0.1). 남은 것은 tier 재산출 (`layout.publish` +1.2) 과 그 뒤 React 커밋·effect 사슬 ≈ 8 ms. before 는 저장 스냅샷을 바꿔 끼우기만 했고 after 는 그 tier 로 다시 파생한다 — **모델에 내재한 1회 상호작용 비용**이다.
- ADR G3 의 실패 대안 3단계 중 앞 둘은 실측 배제 → 마지막 단계 "**원인 분해 후 재승인**" 에 따라 **사용자 재승인 2026-09-22** (「232부터 끝을 내자」). 수용 근거: 초과분은 tier 전환 1회에만 드는 비용이고 프레임 비용 (`render.frame` −0.2) 은 바뀌지 않았으며, 같은 문서의 나머지 세 조작은 같거나 빨라졌다 (−24.3 · −3.8 · +0.2).
- 조작 목록 정정: "순서 변경" 은 제품에 그 사용자 조작이 없어 **페이지 추가** 로 대체.

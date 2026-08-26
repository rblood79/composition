# ADR-181 Design Breakdown: 눈금자(Ruler) + 수동 가이드

> 본문: [181-ruler-manual-guides.md](../completed/181-ruler-manual-guides.md)
> 상태: **Implemented — 2026-08-14** (Accepted 2026-08-13, 리뷰 round 1·2 승인). Phase 0~7 종결 — §2 계약 표 실측 freeze, C9/C10/C11 확정.

## §1. 문제 정의 확인 (fork checkpoint — 신규 주제, fork 아님)

- 완전 신규 주제 ADR — 기존 ADR 분리/fork 아님 (adr-writing.md Phase 0 게이트 해당 없음).
- 선행 계약 승계: [ADR-176](../completed/176-canvas-authoring-gesture-and-page-position-optimization.md) (transient presentation + finish-only commit), [ADR-177](../completed/177-page-position-document-data.md) (canonical additive 필드 + 비-element 히스토리 entry 5계층), [ADR-179](../completed/179-snap-alignment-guides.md) (`resolveSnappedPosition` 순수 함수 + 후보 수집 드래그당 1회).
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
| C11 | **확정** — 가이드는 `overlayVersionRef.current++` 재사용 (ruler 는 DOM 이라 Skia invalidation 대상 아님 — 2026-08-13 축 2 전환)              | `SkiaCanvas.tsx:719-726` 프레임 스냅샷 키에 `cameraX/Y/Zoom` + `overlayVersion` 동시 포함, `:785-791` renderer.render 인자                                        |

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

- **Ruler**: `panOffset`/`zoom` 의 순수 함수이고 카메라가 이미 키에 있으므로 Skia 로 그릴 경우에도 전용 카운터가 불요했다 (1차 구현에서 확증). **축 2 전환 후에는 DOM 레이어라 이 축 자체가 해당 없음** — 갱신은 `subscribeViewportPresentation` 구독이 담당한다 (HC6).
- **가이드**: 카메라와 무관하게 변하므로 전용 트리거가 필요하다. 기존 어법인 `overlayVersionRef.current++` 를 재사용한다 (코드 내 18곳 전례). **`invalidateContent()` 는 부르지 않는다** — `pagePositionPresentation` 구독(`:298-310`)이 content 까지 무효화하는 것은 page root transform 이 바뀌어 본문 렌더가 달라지기 때문이고, 가이드는 오버레이 패스 전용이라 content surface 를 건드리지 않는다 (더 싼 경로 — HC1 정합).
- notify 호출 지점은 3곳: (a) 드래그 중 transient publish, (b) finish 후 canonical write, (c) 히스토리 undo/redo 적용 후.

## §3. Phase 분해

### Phase 0 — inventory freeze (LOW) — **Implemented 2026-08-13**

- ✅ §2 계약 표 C1~C8 라인 재확인 (C3 `:750-756`→`:750`, C4 `:437`→`:441-442` 정정) + C9/C10/C11 확정.
- ✅ 히스토리 kind 소비 분기 전수 grep — 3곳 가정이 **6곳**으로 확대 (§2 C4 표).
- ✅ canonical 파서 additive 허용은 ADR-177 R2 확정분 승계 (재검증 불요).
- 산출: 본 문서 §2 갱신 + ADR 본문 진행 로그 1줄.

### Phase 1 — Ruler 렌더 + 토글 (LOW) — **Implemented 2026-08-14 (DOM)**

#### 1차 구현에서 확보한 것 (DOM 경로에 승계)

착수 후 실측으로 드러난 결함 2건. **표면이 DOM 으로 바뀌어도 그대로 유효**하다.

1. **캔버스는 full-bleed 라 좌측 패널이 세로 스트립을 덮는다** — `main.workspace` 가 `position: fixed; x=0` 이고 `aside.sidebar`(접힘 48px / 패널 열림 281px)가 그 위에 겹친다. 스트립을 캔버스 좌단에 붙이면 세로 자가 **통째로 가려진다**. 가시 영역 오프셋은 `canvasViewportInset.ts` 가 ResizeObserver 로 관측한다 — DOM 경로에서는 이 값이 스트립의 CSS `left` 가 되므로 더 단순해진다.
2. **보이는 페이지가 0개면 Skia 프레임 전체가 skip 된다** — `skiaFramePipeline.ts:295` (`treeBoundsMap.size === 0` → null) → `SkiaCanvas` 가 `clearFrame()` 후 early return 하므로 오버레이 패스가 아예 돌지 않는다. **DOM 경로에서는 이 문제 자체가 소멸**한다 (Skia 프레임과 무관하게 그려짐) — `clearFrameWithChrome()` 도 함께 되돌린다.

토글·단축키·설정 스위치는 표면과 무관하므로 **그대로 유지**한다.

#### DOM 전환 근거 — 실측 (사용자 판정 2026-08-13)

`__composition_PERF__` 의 `render.frame` mean (동일 카메라, 4초 × 2 왕복):

| 단계                                | idle mean  | 증가분      | 예산 대비 |
| ----------------------------------- | ---------- | ----------- | --------- |
| ruler OFF (기준)                    | 0.40ms     | —           | —         |
| 초안 (drawLine/label 개별 호출)     | 2.87ms     | +2.47ms     | 14.8%     |
| + 틱 Path 배칭                      | 2.22ms     | +1.82ms     | 10.9%     |
| + TextBlob 캐시                     | 2.05ms     | +1.65ms     | 9.9%      |
| + `Path.MakeFromCmds` (WASM 왕복 1) | 1.69ms     | +1.29ms     | 7.7%      |
| + Picture 캐시 (최종)               | **1.21ms** | **+0.81ms** | **4.9%**  |

팬 중은 +1.20ms (7.2%). 최적화 4단계는 모두 **구성 비용**(JS 배열 생성 / WASM 왕복 / blob 생성 / display list 기록)을 걷어낸 것이고, 남은 0.81ms 는 **래스터화**다 — Picture 는 display list 만 캐시하므로 틱 ~350 세그먼트 + 라벨 ~58 글리프가 매 프레임 다시 그려진다. Skia 안에서 1% 로 가려면 오프스크린 Surface → Image blit 이 필요하고, 픽셀 정렬(어긋나면 눈금·글자가 뿌옇게 보임)과 surface 수명 관리(리사이즈/DPR/컨텍스트 손실)가 새 표면으로 붙는다.

DOM 경로는 그 비용을 **0** 으로 만들고, 참조 구현이 이미 옆에서 돌고 있다.

#### 참조 구현 — `DotBackground` (캔버스 **뒤**, 같은 기법)

`workspace/components/DotBackground.tsx` + `workspace/Workspace.css:64-99`:

```css
.dot-background {
  position: absolute;
  inset: calc(-1 * var(--dot-inset, 96px));
  pointer-events: none;
  background-image: radial-gradient(circle, var(--dot-color) var(--dot-size), transparent …);
  background-size: var(--dot-gap) var(--dot-gap);          /* 반복 패턴 */
  transform: translate3d(var(--dot-tx), var(--dot-ty), 0); /* 위상만 이동 */
}
```

```ts
gap: DOT_BACKGROUND_BASE_GAP * zoom,
tx: positiveModulo(panOffset.x + DOT_BACKGROUND_INSET, gap),  // 팬 → 위상
…
subscribeViewportPresentation(apply);   // Skia 카메라와 동일 채널
```

승계할 것 4가지:

| 항목             | DotBackground                                              | RulerOverlay 적용                                          |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 반복 패턴 + 위상 | `background-size` + `positiveModulo(pan, gap)`             | 보조/주 눈금 2겹 `repeating-linear-gradient`, 각각 위상    |
| 카메라 소스      | `subscribeViewportPresentation` (Skia 와 동일 — HC6)       | 동일 채널 재사용. 별도 카메라 사본 금지                   |
| 컴포지터 규율    | 팬 중에만 `will-change`, 200ms idle 후 해제 (ADR-047)      | 동일                                                       |
| 순수 함수 + 유닛 | `calculateDotBackgroundMetrics` + `DotBackground.test.ts`  | `calculateRulerMetrics` 동형 (gap/tx/ty/라벨 시작값)      |

**도트 배경에 없는 것 하나 — 라벨.** 값이 팬에 따라 변하므로 `background-position` 트릭이 통하지 않는다. 절대 배치 `<span>` 풀(개수는 뷰포트/간격으로 고정)을 만들어 같은 `apply()` 콜백에서 `textContent` + `transform` 만 갱신한다 — DOM 생성·파괴 없음.

#### 재구현 결과 (2026-08-14)

**HC1(a) 충족** — `render.frame` mean 실측 (동일 카메라, 4초 × 2 왕복):

| 상태 | ruler OFF | ruler ON | 증가분     |
| ---- | --------- | -------- | ---------- |
| idle | 0.33 / 0.36ms | 0.34 / 0.34ms | **0** (노이즈 내) |
| 팬   | 0.35ms    | 0.32ms   | **0**      |

Skia 구현의 +0.81ms(예산 4.9%) 가 **0** 으로 소멸했다.

착수 후 실측으로 잡은 것 2건:

1. **스트립 배경 토큰** — `--bg-raised` 는 light 테마에서 `--bg` 와 **같은 값**이라(css-tokens.md Surface Elevation: `bg(gray-100) → raised(gray-100)`) 캔버스와 구분되지 않았다. 패널과 같은 `--bg-overlay` 로 교체.
2. **세로 라벨이 스트립 밖으로 이탈** — `rotate(90deg)` + `transform-origin: 0 0` 은 회전 박스를 원점 **왼쪽**으로 보낸다 (실측 x=275, 스트립은 281 — 18/18 이탈). CSS `writing-mode: vertical-rl` 로 교체 (글자를 눕히면서 박스도 세로로 잡아 준다) → 이탈 **0/18**.

live 검증 (Chrome MCP):

| 항목 | 결과 |
| --- | --- |
| 설정 스위치 ON/OFF | 양방향 동작, OFF 시 overlay DOM·라벨 span 완전 제거 (누수 0) |
| 좌측 패널 개폐 인셋 추종 | sidebar 281 → 48 → 281, 스트립 x 정확 추종 |
| hover 가드 | 눈금자 위 hover 시 캔버스 hover chrome (점선 가이드라인 + 실선 아웃라인) 미발생 |
| pointerdown 가드 | 눈금자 클릭 시 `selectedElementId`/`selectedElementIds` 불변 |
| 페이지 0개 상태 | 눈금자 유지 (Skia 프레임 skip 과 무관 — DOM 경로에서 문제 소멸) |
| 눈금 위상/라벨 | 팬·줌에 동기, 라벨 위치 = `pan + value*zoom - origin` 실측 일치 |

유닛: `rulerMetrics.test.ts` 20건 (1차 구현에서 이관 9 + 위상/라벨 신규 11).

#### 작업 항목 (재구현)

1. **되돌림**: `skia/rulerRenderer.ts`, `skia/rulerRenderer.test.ts`, `SkiaRenderer.clearFrameWithChrome`, `skiaFramePlan`/`skiaOverlayBuilder`/`SkiaCanvas` 의 ruler 배선. **유지**: `canvasSettings.showRulers`+setter, `SettingsPanel` 스위치, `keyboardShortcuts.toggleRulers`+핸들러, `canvasViewportInset.ts`.
2. **`workspace/components/RulerOverlay.tsx` 신규** — `DotBackground` 어법. 스트립 2개(상단 가로 / 좌측 세로) + 코너. `pointer-events: none` 기본, 스트립만 `auto` (Phase 5 드래그 진입점).
3. **CSS** — `Workspace.css` 인접에 `repeating-linear-gradient` 2겹 + `--ruler-*` 커스텀 프로퍼티. 색은 기존 Skia 상수(slate-500 계열)를 시맨틱 토큰으로 대체 (`--fg-muted` / `--border` — css-tokens.md 준수. DOM 이므로 테마 자동 대응).
4. **`calculateRulerMetrics` 순수 함수 + 유닛** — 눈금 간격 결정(1-2-5×10^n, `LABEL_MIN_SPACING_PX`/`MINOR_MIN_SPACING_PX`)은 1차 구현의 `resolveTickPlan`/`niceInterval` 과 그 9개 테스트를 **그대로 이관**한다 (렌더 표면과 무관한 순수 로직).
5. **좌측 인셋** — `canvasViewportInset` 값을 스트립의 CSS `left` 로 (Skia 좌표 역산 불요).
6. **마운트** — `BuilderCanvas` 의 `<DotBackground />` 인접, 단 캔버스 **뒤가 아니라 앞** (z-index).

- 검증: live 토글(설정 스위치 + Shift+R) / 팬·줌 눈금 동기 (Skia 콘텐츠와 눈금 정합 스크린샷 대조) / 좌측 패널 개폐 인셋 추종 / **G5 (a) ruler ON·OFF 로 `render.frame` 불변** + (a′) 팬 중 리페인트 0 (DevTools Rendering → Paint flashing).

### Phase 2 — 가이드 document 필드 + persist/hydrate (LOW) — **Implemented 2026-08-14**

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
- **persist/hydrate 는 추가 작업이 없었다** — `persistActiveCanonicalDocument` 가 `db.documents.put(projectId, doc)` 로 **문서 전체**를 저장하므로 additive root 필드가 자동으로 실려 간다. C9 가 "entry 부재 = 빈 목록, 재계산 폴백 불요" 로 정해 둔 덕에 hydrate 측 병합 로직도 불요 (`pagePositions` 는 `initializePagePositions` 폴백이 필요했던 것과 갈리는 지점).
- 검증: 유닛 9건 (`canonicalDocumentStore.test.ts` — batch 기록 / breakpoint 격리(C9) / 목록 전체 교체 / null·빈 배열 제거 + 페이지 키 정리 / lazy write no-op / 부재 entry 제거 no-op / 빈 batch / 호출자 배열 alias 차단 / 필드 부재 BC). 전체 61 passed.
- live (Chrome MCP): `setPageGuides` → IndexedDB persist → 새로고침 → hydrate 왕복에서 값 동일, `version` 은 `composition-1.0` 유지(additive — BC 0%), 기존 필드 무손상. 삭제 시 문서에서 **필드 자체가 사라짐** (`hasOwnProperty("pageGuides") === false`).
- **함정 (다음 phase 주의)**: `__canonical_STORE__` 전역은 HMR 후 **중복 인스턴스**가 물릴 수 있다 (실측: documents 0건 / documentVersion 0). live 시드 전 `documents.size`·`documentVersion` 으로 실인스턴스인지 먼저 확인할 것 — 아니면 죽은 인스턴스에 기록된다.

### Phase 3 — 히스토리 편입 (MED) — **Implemented 2026-08-14**

- `history.ts` 에 `page-guide` entry kind + `PageGuideHistoryEntryItem` (`pageGuideEvent` payload). **`page-position` 과 두 곳이 갈린다**:
  - **null 이 없다** — 문서에서 entry 부재와 빈 목록이 구분되지 않으므로(C9) `[]` 하나면 충분하다. `page-position` 의 `before: null`(=entry 부재) 어법을 복제하면 표현할 수 없는 상태가 하나 생긴다.
  - **스토어 미러가 없다** — `applyPageGuideHistoryEntry` 는 `set()` 없이 canonical `pageGuides` 만 되돌린다 (`applyPagePositionHistoryEntry` 는 `pagePositionsByBreakpoint` 스냅샷을 함께 되돌린다). 그래서 화면 갱신 신호를 나를 채널이 따로 필요했다 — 아래 개정 카운터.
- 목록 **전체**를 before/after 로 담는다 (부분 diff 아님). 생성·이동·삭제가 한 어법이 되고 `setPageGuides` 의 "목록 전체 교체" 계약과 1:1 이다. 라벨은 before/after **길이 차**로 세 어휘를 가른다 (추가/삭제/이동).
- **§2 C4 표 6곳 전부 대응**:

  | #   | 위치                                                          | 조치                                                                    |
  | --- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
  | 1~3 | `historyActions.ts` undo/redo/goToIndex                       | early-branch → `applyPageGuideHistoryEntry` (element 경로 진입 전)      |
  | 4   | `historyActions.ts::syncDatabaseForEntries`                   | `continue` skip (persist 는 apply 가 자체 수행)                         |
  | 5   | `history.ts` addEntry DEV guard                               | `entry.type !== "page-guide"` 면제 (canonicalEvents 없음이 정상)        |
  | 6   | `historyEntryLabel.ts` + `HistoryPanel.tsx`                   | 라벨 3종 + `RulerDimensionLine` 아이콘 (눈금자 토글과 같은 기능군 표시) |

  6곳 중 타입 시스템이 잡아 주는 것은 아이콘 맵(`Record<HistoryEntry["type"], LucideIcon>` 완전성) **하나뿐**이라 나머지 5곳을 정적 가드로 고정했다.
- **개정 카운터** `interaction/pageGuideRevision.ts` 신설 — 문서를 바꾼 쪽이 bump, `SkiaCanvas` 가 구독해 `overlayVersionRef.current++`. **`invalidateContent()` 는 부르지 않는다** (C11 — 가이드는 오버레이 패스 전용이라 content surface 무관. `pagePositionPresentation` 구독이 content 까지 무효화하는 것과 갈리는 지점이고, 이 비대칭을 정적 가드가 잠근다).
- **기록 진입점** `viewport/pageGuideActions.ts` 신설 (`pageLayoutActions.ts` 동형 층) — `commitPageGuideChanges` 가 히스토리 1 entry + canonical batch + persist + 개정 bump 를 한 묶음으로 낸다. 변경 없는 항목은 걸러내고 전부 없으면 **아무것도 하지 않는다** (빈 entry 는 Cmd+Z 가 무반응인 구간을 만든다). Phase 5 가 호출한다.
- 검증:
  - 유닛 17건 — `pageGuideActions.test.ts` 10 (lazy write / batch / 사본 격리 / C9 read) + `pageGuideHistoryRoundtrip.test.ts` 7 (생성·이동·삭제 왕복 / breakpoint 격리 / 삭제 페이지 skip / 개정 bump / goToIndex).
  - 정적 가드 5건 (`historyActions.static.test.ts`) — C4 6곳 + C11 비대칭.
  - **민감도 실측**: undo early-branch 제거 시 5 red, goToIndex 분기 제거 시 1 red.
  - live (Chrome MCP): 생성→이동 기록 후 새로고침에서 값 보존 → undo 2회로 260→120→없음 → redo 2회로 복귀 → 패널 항목 클릭(goToIndex)으로 120 복원. 패널 라벨 "가이드 추가"/"가이드 이동" + 눈금자 아이콘 표시 확인. probe 데이터는 정리(문서 필드·히스토리 entry 2건 제거 후 새로고침 확인).
- **함정 (재발 감시)**: Vite 가 편집된 모듈을 `?t=<mtime>` 로 서빙하는데 이 쿼리는 **새로고침해도 유지**된다. 페이지 콘솔에서 `import('/src/.../history.ts')` 로 평범하게 부르면 앱이 쓰는 인스턴스와 **다른 사본**이 잡힌다 (실측: `currentPageId` 가 null 인 빈 매니저). live 진단 전 `performance.getEntriesByType('resource')` 로 앱이 실제 로드한 URL 을 확인하고 그 URL 로 import 할 것 — Phase 2 의 `__canonical_STORE__` 중복 인스턴스와 **같은 병인**이다.

### Phase 4 — 가이드 렌더 (MED) — **Implemented 2026-08-14**

- `canvas/skia/guideRenderer.ts` 신규 — 1 screen px 선, `snapGuideRenderer.ts` 어법 재사용.
- **색은 시안 #59A8D7** (Figma 가이드 계열 대조 후 확정). 스냅 웜 레드(#F24822) 재사용을 기각한 이유는 취향이 아니라 **혼동 시점**이다 — 두 표식이 동시에 보이는 순간이 정확히 드래그 중이라, 같은 색이면 "여기 기준선이 있다" 와 "지금 흡착 중" 이 구분되지 않는다. 선택 파랑(#3B82F6)과는 색상(시안 편향) + **형태**(핸들 없는 페이지 길이 가는 선)로 갈린다 — 라이브 대조에서 비선택 페이지의 회색 테두리·파랑 Tab 밑줄 모두와 구분 확인.
- 좌표 변환은 `buildPageGuideTargets` (`skiaOverlayHelpers.ts`) — 페이지-로컬 px + 페이지 원점, **축마다 더하는 원점이 다르다** (axis `"x"` = 세로선이라 `originX` 를 더한다). 페이지 드래그 transient delta 도 함께 반영 — 슬롯 마커·collection remainder 와 같은 계약이라 미반영 시 드롭 후에야 따라온다.
- 클립은 **두 겹**이고 잡는 것이 서로 다르다:
  - **페이지 rect** (`guideRenderer` 안, 페이지당 save/restore 1회 — 선마다 걸면 개수만큼 상태 전환이 는다). 선 길이가 rect 와 같아 보여도 stroke 가 양쪽으로 반폭씩 번지고, breakpoint 크기를 줄인 뒤 남은 가이드가 페이지 밖 좌표를 가질 수 있다.
  - **`withPageOcclusionClip`** (호출부) — 페이지끼리는 조상 관계가 아니라 앞의 rect 클립이 잡지 못한다 (canvas-rendering.md §8.5). 콘텐츠성 chrome 열이라 슬롯 해치와 같은 처리이고, 스냅 정렬선의 "조작 표식 미적용" 과 갈린다.
- 읽기는 `readPageGuidesByPage(breakpoint)` — 활성 breakpoint 만 (C9). **문서에 `pageGuides` 가 없는 통상 경로에서 할당 0** (공유 빈 map 재사용) — 프레임마다 불리는 자리라 이 경로가 기본값이어야 한다.
- 재렌더는 Phase 3 의 개정 카운터가 이미 담당 (`overlayVersion` 만 — C11).
- 검증:
  - 유닛 7건 — `skiaOverlayHelpers.test.ts` 4 (축별 원점 / 드래그 delta / 빈 목록·부재 페이지 / 비가시 프레임) + `pageGuideActions.test.ts` 3 (빈 map 재사용 / breakpoint 격리 / 빈 목록 제외). 영향 suite 전체 508 passed.
  - live (Chrome MCP): 세로·가로 가이드 렌더 → **페이지 rect 에서 절단** 확인 → 겹친 페이지에서 아래 페이지 가이드가 위(활성) 페이지 body 를 **가로지르지 않음** (세로 가이드 전면 가림 / 가로 가이드는 겹친 구간만 잘리고 나머지는 표시) → 페이지 드래그 transient 중 가이드가 본문과 같이 이동 → breakpoint 전환 시 목록 전체 교체(mobile 4건 → desktop 0건).
  - **HC1(a) 실측**: `render.frame` p50 **4.100 → 4.175ms (+0.075 = 예산의 0.45%)** — ON/OFF 순서 교대 4쌍 × 2s, 가이드 4개(2 페이지). mean 은 오히려 감소(4.593 → 4.548)해 노이즈 바닥 아래다. **단발 A/B 는 믿을 수 없다** — 첫 1쌍 측정은 mean +0.21ms(1.26%)로 게이트 초과처럼 보였고, 순서 교대로 반복하자 사라졌다.

### Phase 5 — 인터랙션 (HIGH — R1) — **Implemented 2026-08-14**

- **생성·이동·삭제가 한 세션**이다 (`useGuideDrag`). 시작 지점만 다르고 move/up/취소가 전부 같아서, 나누면 transient publish·commit·cleanup 이 두 벌이 되고 한쪽만 고쳐지는 형태로 어긋난다. **삭제는 별도 조작이 아니라 드래그의 한 결말**이다 — 눈금자 위로 되돌리면 `removing` 이 서고 놓으면 삭제된다 (되돌리는 동작 자체가 확인이라 별도 확인 UI 가 없다).
- **이동은 소속 페이지를 바꾸지 않는다.** 가이드 좌표가 페이지-로컬(C9)이라 페이지를 넘나들면 한 드래그 안에서 기준계가 갈린다. 포인터가 다른 페이지 위로 가도 원래 페이지 좌표계로 계속 읽는다.
- **가드는 예고대로 소멸하지 않았다** — 4곳 처리, 그중 2곳은 Phase 1 에서 이미 반영:

  | 리스너                                   | 조치                                                             |
  | ---------------------------------------- | ---------------------------------------------------------------- |
  | 컨테이너 `pointerdown` capture           | `isRulerEventTarget` 조기 반환 (Phase 1)                         |
  | `window` pointermove — hover             | 조기 반환 + `clearHover()` (Phase 1)                             |
  | 컨테이너 `onContextMenu`                 | `isRulerEventTarget` 조기 반환 (Phase 5 — 씬 좌표 환산 시 스트립 아래 요소가 잡힌다) |
  | 컨테이너 `onPointerDown` bubble          | **그대로** — 눈금자 드래그 중에도 컨테이너 포커스는 필요하다     |

- **히트 판정은 "포인터가 올라간 페이지" 의 가이드만** 본다. 겹친 페이지에서 아래 가이드는 위 페이지에 가려 보이지 않으므로(Phase 4 occlusion) 히트도 되면 안 된다 — §8.5 paint↔hit 대칭. 페이지 판정은 호출부의 `resolveTopPageIdAtPoint` 가 하고 `resolveGuideHit` 에는 페이지 간 우선순위 규칙이 **없다** (두 곳에 순서 규칙이 생기면 갈린다). 좌표 변환은 렌더(`buildPageGuideTargets`)와 같은 식(`buildGuideHitTargets`).
- **C10 진입 게이트**: `showRulers === false` 면 히트 판정 자체를 하지 않는다 — 눈금자 OFF 에서 pointer 체인은 ADR-181 이전과 **바이트 동등**하다. hover 커서 리스너도 같은 조건에서만 붙어, 기본 세션에는 pointermove 리스너가 아예 없다.
- 드래그 중 transient 는 `guidePresentation` (드래그 **1건**만 — 페이지 드래그와 달리 다중이 없다). 재렌더 신호는 `pageGuideRevision` 재사용 — 가이드가 바뀐 사실은 출처(편집/히스토리/드래그)와 무관하게 오버레이엔 같은 의미다.
- 검증:
  - 유닛 28건 — `guideHitTest.test.ts` 9 (임계·rect·교차점·동률·좌표 변환) + `guidePresentation.test.ts` 19 (합성 규칙 8 + 신호 4, 이동/삭제/생성/미소속). 캔버스 suite 1115 passed (기존 인터랙션 전수 GREEN — G2).
  - live (Chrome MCP, **실제 마우스 이벤트**): 눈금자 드래그로 생성(드롭 지점 페이지에 귀속) → 캔버스 드래그로 이동(125→295) → 눈금자로 되돌려 삭제 → Cmd+Z 로 복원. **눈금자 ON 상태에서 캔버스 클릭 선택 정상**(G2) · 가이드 드래그가 선택을 바꾸지 않음 · 눈금자 hover 시 캔버스 아웃라인 미발생.
  - **HC1(c) 계측**: 생성·이동 드래그 각각 pointermove 4~5회 동안 canonical write **0** / 히스토리 entry **0**, pointerup 에서 write 1 · entry 1.
- **함정 (재발 감시)**: 합성 pointer 이벤트로 캔버스를 조작하면 `canvasGestureSession` 이 그 pointerId 를 잡은 채 남아 **이후 실제 클릭이 전부 무시된다**. 이 세션에서 "선택이 안 된다" 로 20분을 썼는데 새로고침 후 실제 클릭은 정상이었다 — 회귀로 오판하기 쉬운 형태다. `window` 에 dispatch 한 pointerup 은 target 이 Window 라 컨테이너 리스너가 못 받는 것이 원인. **캔버스 인터랙션 검증은 실제 이벤트(`computer` 도구)로** 하고, 합성 이벤트는 window 리스너만 쓰는 경로(가이드 드래그 등)에 한정한다. 메모리 `feedback-synthetic-pointer-drag-testing-traps` 의 "pointerId 고정 재사용" 항목과 같은 병인.
- **관찰 (스코프 밖)**: 히스토리 entry 는 `historyManager.currentPageId` 기준으로 쌓이므로, A 페이지를 보면서 B 페이지에 가이드를 만들면 그 entry 는 A 의 히스토리에 남는다. `page-position`(ADR-177) 도 동일하고 per-page 히스토리 모델의 성질이라 여기서 고치지 않는다.

### Phase 6 — 스냅 편입 (MED — R2) — **Implemented 2026-08-14**

- `resolveSnappedPosition(raw, movingSize, candidates, threshold, guideLines?)` — `guideLines` 는 `{ x, y }` scene 좌표 배열. 인자를 생략하면 기존 동작과 **동일**(BC 유닛으로 고정).
- **가이드는 rect 가 아니라 크기 없는 선**이라 들어가는 자리가 둘뿐이다: `resolveAxisSnap`(흡착 판정)과 `collectMatchedLineGuides`(정렬선 방출). `resolveAxisSpacingSnap` 에는 전달하지 않는다 — 등간격은 이웃 rect 의 간격 리듬이고 선에는 폭이 없다 (`projectCandidate` 미통과). "spacing 미오염" 유닛이 대조군 비교로 이걸 고정한다.
- **흡착하면 정렬선(웜 레드)을 방출한다.** 가이드 자체는 상시 표시라 위치만으로는 "근처에 있을 뿐" 과 "붙었다" 가 구분되지 않는다. 두 선이 겹치는 순간이 곧 피드백이다.
- **동률이면 가이드가 이긴다** — 가이드 라인을 rect 보다 먼저 훑고 비교는 `<` 유지. 사용자가 명시적으로 놓은 선이 파생된 rect 라인에 밀리지 않는다.
- **rect 후보 0 이어도 흡착한다.** 두 소비처의 게이트가 `candidates.length > 0` 였는데 가이드는 형제 유무와 무관하므로 `|| hasGuideLines` 로 넓혔다. 이걸 빼면 형제 없는 요소·단독 페이지에서 가이드가 통째로 죽는다.
- **수집은 드래그당 1회** (`collectGuideSnapLines`, C2). 프레임 경로에서 부르면 ADR-179 R1 이 막아 둔 비용이 그대로 돌아온다.
- **페이지 드래그는 자기 가이드를 제외한다** (`excludePageIds`). 가이드가 페이지-로컬이라 페이지와 함께 움직이는데, scene 라인은 드래그 시작 시점에 얼어 있어서 제외하지 않으면 **시작 위치로 계속 끌려간다**. 요소 드래그는 반대로 자기 페이지 가이드가 주 후보다 — 요소는 페이지와 함께 움직이지 않는다. 두 소비처가 갈리는 유일한 지점.
- 검증:
  - 유닛 9건 추가 (`snapGuides.test.ts` 32 passed) — rect 0 흡착 / 3축(min·center·max) / 축 독립 / 임계 밖 / 정렬선 방출 / rect 우선(거리) / 동률 시 가이드 / **spacing 미오염 대조군** / **인자 생략 BC**.
  - 민감도: `resolveAxisSnap` 의 가이드 루프를 제거하면 5 red.
  - live (실제 마우스): Home 가이드(scene 770)에 Page 2 드래그 → **정확히 770** 착지. **대조군** — 가이드를 지우고 같은 드래그를 반복하면 **773.39**(raw) 착지라, 흡착이 가이드 때문임이 분리 확인된다. 자기 가이드 제외 — Page 2 에 가이드를 주고 그 위로 드래그하면 1039.80 (1040 미흡착).
- **관찰**: 요소 드래그 경로는 `isManualPositionDragTarget` 게이트가 있어 flow 배치 요소에는 스냅이 애초에 걸리지 않는다 (ADR-179 계약). 이 프로젝트 페이지들이 대부분 flow 라 live 확인은 페이지 드래그로 했다 — 요소 축은 유닛(공유 순수 함수)과 배선 대칭으로 갈음.

### Phase 7 — 검증 종결 (Gates 전수) — **Implemented 2026-08-14**

| Gate | 결과 | 실측                                                                                                                                                                                                                     |
| ---- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1   | PASS | Shift+R 토글 → 스트립 드래그 생성(local 194) → Cmd+Z 소거 → Cmd+Shift+Z 복원 → 이동(194→313) → Cmd+Z/Shift+Z 왕복 → 스트립 복귀 삭제 → Cmd+Z 복원 → **새로고침 후 313 유지**. 패널 라벨 3종 정상                        |
| G2   | PASS | ruler OFF: pointer 체인이 ADR-181 이전과 **바이트 동등**(C10 게이트가 전 분기를 감싼다). ruler ON + **가이드 0** 문서에서 실제 클릭 선택 정상(`ref` 선택). 캔버스 suite 1103 passed                                       |
| G3   | PASS | 페이지 드래그가 가이드(scene 770)에 **정확히 770** 착지, 가이드 제거 후 같은 드래그는 773.39(raw) — 대조군 분리. spacing 미오염 유닛 + rect 스냅 유닛 32 passed                                                          |
| G4   | PASS | 겹친 페이지에서 아래 가이드가 위 body 를 가로지르지 않음(세로 전면 가림 / 가로는 겹친 구간만 절단), 페이지 rect 에서 절단, breakpoint 전환 시 목록 교체(mobile 4 → desktop 0)                                            |
| G5   | PASS | 아래 §Gate 5 실측                                                                                                                                                                                                          |
| G6   | PASS | type-check 0 new violation / 전체 3337 passed (실패 2건은 **선행 결함** — 아래)                                                                                                                                            |

#### Gate 5 실측 (HC1)

측정법은 **ON/OFF 순서 교대 4쌍 × 2s** — Phase 4 에서 단발 A/B 가 +1.26% 를 냈다가 교대 반복에서 사라진 전례가 있어 이 방식으로 고정한다.

| 항목                                  | OFF   | ON    | 증가분             | 예산 대비 |
| ------------------------------------- | ----- | ----- | ------------------ | --------- |
| (a) ruler ON/OFF (가이드 0), p50      | 4.075 | 4.100 | +0.025ms           | **0.15%** |
| (a) 가이드 **20개** (2 페이지), p50   | 4.125 | 4.150 | +0.025ms           | **0.15%** |

- (a′) **will-change 수명 확인**: 팬 전 `auto` → 팬 중 `background-position` → idle 120ms 유지 → **idle 300ms 후 `auto` 복귀**. 팬이 건드리는 속성은 스트립 `background-position` 과 라벨 `transform` 둘뿐 (레이아웃 속성 0).
  - **미검증 잔여**: 실제 paint flashing 계측은 DevTools Rendering 패널이 필요해 MCP 로 구동할 수 없었다. 속성 수준(컴포지터 친화 속성만 변경) + will-change 수명까지만 확인했다.
- (c) **드래그 100 move**: canonical write **0** / 히스토리 entry **0** / persist **0**. pointerup 후 write 1 · entry 1 · persist 2.
  - persist 2 는 **선행 동작**이다 — `updatePagePosition`(ADR-177) 도 동일하게 2회(명시 persist + 앱 autosave). ADR-181 이 만든 것이 아니다.

#### 선행 결함 2건 (ADR-181 무관, 미수정)

- `panelStylePropsUnion.static.test.ts` — `position` 이 섹션 PROPS 에 있으나 `PANEL_STYLE_PROPS` 누락. 마지막 변경 `e33d84005`, 스타일 패널 축.
- `__adr171Phase6Probe.test.ts` — 다른 세션의 scratchpad 절대 경로에 기록. 마지막 변경 2026-07-29.

## §4. Gate 상세 (ADR 본문 Gate 표의 실행 절차)

| Gate | 절차                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: 설정 스위치·Shift+R 토글 → ruler 스트립 드래그 생성 → 가이드 이동 → ruler 복귀 삭제 → 각 조작 Cmd+Z/Cmd+Shift+Z 왕복 → 새로고침 배치 유지                                              |
| G2   | **ruler OFF 이면 가이드 유무와 무관하게** 기존 선택/드래그/더블클릭/페이지 타이틀 유닛 전수 GREEN + live 스모크 (경로 무변경 — C10 진입 게이트로 강화). ruler ON + 가이드 0 문서도 동일 단언  |
| G3   | 요소·페이지 드래그가 가이드 라인에 흡착 (live) + 기존 rect 스냅 유닛 GREEN + spacing 판정에 가이드 미참여 유닛                                                                                |
| G4   | 겹친 페이지에서 아래 페이지 가이드가 위 페이지 body 위 미표시 (live) + 가이드가 페이지 rect 밖 미유출 + breakpoint 전환 시 타 breakpoint 가이드 미표시 (C9)                                   |
| G5   | **성능 (HC1)**: (a) `__composition_PERF__.snapshotAll()` 의 `render.frame` 이 ruler ON/OFF 로 **불변** (ruler=DOM 이므로 Skia 증가분 0) + 가이드 20개 문서의 Skia 오버레이 증가분 1% 이하. (a′) 팬 중 ruler 레이어 리페인트 0 (DevTools Rendering → Paint flashing) + `will-change` 가 idle 에서 해제되는지. (c) 가이드 드래그 100 move 재현에서 canonical write/히스토리/persist 각 0 (finish 1회) |
| G6   | type-check + 신규 유닛·정적 가드 PASS + CHANGELOG (Implemented 승격 시)                                                                                                                       |

## §5. BC 수식화

- 기존 프로젝트 영향 **0%** — `pageGuides` 부재 문서는 가이드 없음(현행 동일), 로드 시 재직렬화 0 (lazy write — 가이드 최초 생성 시에만 필드 기록). ADR-177 HC3 동형.

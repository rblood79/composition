# ADR-155 구현 상세: 숨은 패널 selection fan-out 차단 — 패널 활성 gating

> 본문: [155-hidden-panel-selection-fanout-gating.md](../completed/155-hidden-panel-selection-fanout-gating.md)
> Status: Implemented — 2026-07-17 (Phase 0~3 전체 완료 + Gate 4종 통과. 리뷰 round 1 승인 후 착수, 같은 날 종결).

## 1. Baseline 실측 (2026-07-17, adr151-followup-verify 프로젝트 43 요소, 패널 전부 접힘 상태)

| 지표                                     | 실측값                                                                                                  | 도구                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 캔버스 선택 클릭당 longtask              | ~~110ms (86~~205ms)                                                                                     | LoAF + `longtask.input` 하니스                          |
| 포인터 핸들러 본체 (`input.pointerdown`) | 0.8~1.6ms                                                                                               | `observe()` 하니스                                      |
| React render 단계 (root actualDuration)  | ~0.3ms                                                                                                  | DevTools hook 커밋 카운터                               |
| React commit effect 순회 비중            | busy 샘플 ~74% (`recursivelyTraverseMutationEffects` + `recursivelyTraversePassiveUnmountEffects` 반반) | JS Self-Profiling (`new Profiler`, 커밋 8cf55ba3b 헤더) |
| 클릭당 DOM 속성 쓰기                     | 93건 (`name@input` ×50, `type@input` ×25 — React 내부 input 갱신 메커니즘 ×~25 입력)                    | MutationObserver                                        |
| 클릭당 요소 추가/제거                    | +8/−4 (TreeItem ×4, 테마 스와치 ×2 remount, transform-row 등)                                           | MutationObserver                                        |
| 사용자 실창 LoAF (참고)                  | dispatchDiscreteEvent 95~220ms (프로젝트 규모별)                                                        | 사용자 콘솔 로그 2026-07-16                             |

메커니즘: native listener 안 setState → React 19 microtask flush → 숨은 패널 입력 ~25개 host update + LayerTree 행 재생성 + 스와치 remount 의 commit effect 순회. render 는 저렴하고 commit 이 비용의 본체 (actualDuration 은 commit effect 미포함 — 커밋 카운터가 0 으로 보인 이유).

재실측 절차 (Gate 공통):

```js
// 1) 클릭 task 총량: LoAF 관찰자 + window.__composition_PERF__.snapshotAll() 의 longtask.input
// 2) commit effect 비율: new Profiler({sampleInterval:1}) — pointerdown capture 에서 시작, 350ms 후 stop
//    (Document-Policy: js-profiling 헤더 적용 후 하드 리로드 필수)
// 3) DOM 쓰기 수: MutationObserver(childList+attributes, subtree) 클릭 1회 카운트
```

**소형 문서 단독 측정 금지** — G3 는 대형 문서 (500+ 요소 또는 사용자 실프로젝트) 기준 병행 측정.

## 2. 현행 구조와 변경 지점

- `apps/builder/src/builder/layout/PanelContainer.tsx:49-57` — `PanelContent = memo(({panelId, side}) => <PanelComponent isActive={true} .../>)`. isActive 하드코딩 + memo 가 활성 전환 전파를 차단하는 **의도된** 설계 (파일 상단 주석: remount 비용 제거 + 상태 보존).
- `apps/builder/src/builder/layout/PanelContainer.tsx:129-137` — `PanelWrapper` 가 `data-active` 로 CSS 표시/숨김.
- 선택 구독 소비처: `stores/index.ts:190` `useSelectedElementData` → `useDebouncedSelectedElementData` ×4 (`panels/styles/StylesPanel.tsx:33,51`, `panels/properties/PropertiesPanel.tsx:789`, `panels/events/EventsPanel.tsx:281`) + 각 스타일 섹션의 `selectedElementId` 직구독 + `panels/nodes/LayersSection.tsx:102`.

## 3. Phase 계획

### Phase 0 — inventory + 스파이크 (코드 반영 없음) — **완료 2026-07-17**

1. **숨은 패널 effect 의존 inventory**: 패널 14종의 useEffect/useSyncExternalStore 중 "숨김 상태에서도 실행되어야 하는" 부수효과 grep 조사 (예: 단축키 등록, 전역 이벤트 브릿지, postMessage 채널). 결과를 본 문서 §5 표에 기록. **G1 판정 입력.** → **완료** — 의존 3건 확정 + 1건 준(準)의존 (§5 표). "의존 0건" 아님 — 제외 vs 부수효과 이전은 Phase 1 진입 시 사용자 결정.
2. **Activity 스파이크**: scratch 페이지에서 `<Activity mode="hidden">` 로 RAC TextField/Tree/Popover 를 감싼 최소 재현 — (a) hidden 중 store 갱신이 클릭 task 에 commit effect 를 만드는지, (b) visible 전환 시 최신 상태 즉시 표시, (c) display 처리 방식이 `.panel-wrapper` CSS (`data-active` transform) 와 충돌하는지 확인. → **완료** — 결과는 §5.5.
3. baseline 재실측 기록 (§1 절차, 대형 문서 포함). → §1 표 (2026-07-17 동일 날짜 실측) 를 Phase 0 baseline 으로 확정. **대형 문서 (500+ 요소) 실측은 아직 없음** — G3 판정 전 필수 (사용자 실창 LoAF 95~220ms 로그만 보유).

### Phase 1 — 파일럿 (저위험 패널 2종) — **완료 2026-07-17, G2 PASS**

1. `PanelWrapper` 에서 `<Activity mode={isActive ? "visible" : "hidden"}>` 로 `PanelContent` 래핑 — 대상: History + Themes (selection 미소비·상태 단순). → **완료** — `ACTIVITY_GATED_PANELS: ReadonlySet<PanelId>` allowlist 방식 (`PanelContainer.tsx`), Phase 2 에서 전 패널 확대.
2. CSS 정합 판정 → **`data-active` CSS 유지 확정** — 이중화가 아니라 역할 분리: CSS 는 슬라이드 애니메이션 + flex 레이아웃 공간 담당, Activity 는 갱신 지연 + effect 수명 + 상태 보존 담당. 속성축 (transform/opacity/margin vs display) 이 분리돼 충돌 없음 (라이브 확인 — 토글 열림/닫힘 정상).
3. **G2 실측 (2026-07-17, adr151-followup-verify 43 요소, Chrome MCP live)**:
   - 캔버스 선택 클릭 6회: **gated theme 0 / history 0 mutation** vs ungated styles **751** (클릭당 ~125) / nodes 48 — 클릭당 DOM 쓰기·remount 완전 소거.
   - 재숨김 후 클릭 2회 재확인: theme 0 / history 0 vs styles 252 — gating 재진입 유지.
   - 재활성 즉시 표시: 테마 패널 (Colors/Accent 현재값 체크·스와치 27·Radius/Typography/Preview) + 히스토리 패널 (24/24 최신 엔트리) 정상. Activity `display:none !important` 제거 확인.
   - 콘솔 error/warning 0 (HMR 적용 이후 상호작용 구간).
   - **미판정 잔여**: 파일럿 2종에는 popover 없음 — 스파이크 (f) portal 잔존 체크는 Phase 2 에서 Select 보유 패널 (properties/styles) 로 확인. 슬라이드-아웃 300ms 중 내용 즉시 소멸 여부는 정지 스크린샷 한계 — G4 (Phase 3) 시각 확인 항목.

### Phase 2 — 부수효과 이전 + 전 패널 확대 — **완료 2026-07-17**

1. **부수효과 이전 (사용자 승인 방향)**:
   - properties 캔버스 전역 단축키 11 핸들러 (Cmd+C/V/D/A, Escape, Cmd+Alt+X, Cmd+G/Shift+G, 정렬 6, 분배 2) + Tab 네비게이션 raw listener → **`panels/properties/CanvasSelectionShortcuts.tsx` 신설 host 로 이전** (BuilderCore mount, leaf null 렌더라 구독 재렌더 비전파). 핸들러 본문 verbatim 이동 — Copy All/Paste 의 `scope: "panel:properties"` 도 원본 그대로 보존 (scope 는 포커스 기반이라 등록 위치 무관). panel-scoped Copy/Paste Properties 2종 + Cmd+? 도움말은 패널 잔류 (Cmd+? 는 properties 숨김 중 비동작으로 동작 변화 — 도움말 modal 이 패널 내부 UI 라 수용).
   - styles Copy/Paste Styles 단축키 → 동일 host 로 이전 (핸들러는 툴바 버튼용으로 패널에도 잔류 — 같은 `useStyleActions` 경유). Focus Mode/전체 접기는 패널 UI 조작이라 잔류.
   - nodes/datatable 부트스트랩 2건은 **이전 불필요로 정정** (§5 — BuilderCore 가 이미 primary, Phase 0 grep `| head` 절단 오판).
   - `panelNodeToElement`/`panelNodeMapToElementMap` 을 `panelNodeElementMap.ts` 로 분리 (host 공유 + react-refresh 경고 회피). ADR-126 Element allowlist 에 등재 (동일 계약 이동, 신규 도입 아님).
2. left/right 전 패널 Activity 래핑 확대 완료 — `PanelWrapper` 무조건부 래핑 (파일럿 allowlist 제거). fonts/TypographySection font sync effect 에 재장착 catch-up 1줄 추가 (HC2).
3. 정적 가드 테스트 완료: `PanelContainer.static.test.ts` 3건 — Activity 래핑 존재 / `isActive={true}` 하드코딩 유지 (실값 전달 재도입 차단) / data-active CSS 채널 유지. left/right 12패널 dead 가드 제거는 후속 정리 커밋 `b563085fe` 로 완료 (MonitorPanel 은 bottom 경로 live 가드라 제외, DataTablePanel 은 param 잔존 — query enabled 소비).
4. **라이브 검증 (2026-07-17, 리로드 후)**: 비활성 10패널 전부 Activity hidden / 선택 클릭 4회 mutation: styles·nodes·theme 0 vs active properties 330 / **Escape 가 host 에서 동작 (properties 패널 hidden 상태 포함)** — 콘솔 로그 소스 `CanvasSelectionShortcuts.tsx` 확인 / nodes·datatable hidden 부트에서 프로젝트·데이터 정상 로드 / popover 열린 채 실클릭 전환 시 interactOutside 로 먼저 닫힘 (portal 잔존 없음 — 단 **키보드 단축키 패널 전환은 pointerdown 없이 전환되므로 G4 에서 확인**) / 콘솔 error 0 / LoAF (>50ms 프레임) 관찰자에 클릭 3회 동안 **0건** (baseline 86~205ms 상시 — 소형 문서 참고치, G3 판정은 대형 문서로).

### Phase 3 — Gate 총괄 실측 + 종결 — **완료 2026-07-17**

1. **G3/G4 실측 완료** (대형 문서 `adr155-g3-perf` 550 요소 — §5.6 실측값). G4 에서 스크롤 offset 소실 회귀 발견 → `PanelWrapper` scroll 기록→rAF 복원 메커니즘으로 보완 (`92b62469b`).
2. CHANGELOG Performance 엔트리 + ADR Implemented 승격 + README 갱신 완료.
3. live behavior 게이트: Chrome MCP 로 선택 클릭→패널 갱신·6패널 토글·스크롤/입력 상태 보존·Escape host 동작 exercise 기록 (§5.6).

### Fallback (G2/G3 실패 시) — 대안 A 경로

`usePanelIsActive(panelId)` (layout store 직구독) + `useSelectedElementData(enabled)` selector sentinel gating 을 패널 4소비처에 배선. Activity 래핑은 제거 (롤백 = 래퍼 삭제 1곳).

## 4. 파일 변경 표 (실제)

| 파일                                                                      | Phase | 변경                                                                           |
| ------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------ |
| `apps/builder/src/builder/layout/PanelContainer.tsx`                      | 1→2   | Activity 래핑 (파일럿 allowlist → 무조건부). isActive={true} 하드코딩 유지     |
| `apps/builder/src/builder/layout/PanelContainer.static.test.ts`           | 2     | 신규 — 래핑/하드코딩/data-active 정적 가드 3건                                 |
| `apps/builder/src/builder/panels/properties/CanvasSelectionShortcuts.tsx` | 2     | 신규 — 캔버스 전역 단축키 host (PropertiesPanel 11 핸들러 + Styles copy/paste) |
| `apps/builder/src/builder/panels/properties/panelNodeElementMap.ts`       | 2     | 신규 — PanelNode→Element 변환 분리 (host 공유)                                 |
| `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`          | 2     | 전역 단축키 핸들러 ~590줄 host 이전 제거, scoped 2종 + Cmd+? 잔류              |
| `apps/builder/src/builder/panels/styles/StylesPanel.tsx`                  | 2     | Copy/Paste Styles 단축키 entry 제거 (핸들러는 버튼용 잔류)                     |
| `apps/builder/src/builder/main/BuilderCore.tsx`                           | 2     | CanvasSelectionShortcutsHost mount                                             |
| `apps/builder/src/builder/panels/fonts/FontManagerPanel.tsx`              | 2     | 재장착 catch-up sync 1줄                                                       |
| `apps/builder/src/builder/panels/styles/sections/TypographySection.tsx`   | 2     | 재장착 catch-up sync 1줄                                                       |
| `apps/builder/eslint-local-rules/index.js`                                | 2     | ADR-126 Element allowlist 에 panelNodeElementMap.ts 등재                       |
| left/right 12패널 (Settings/Nodes/Styles/… gateway)                       | 2/3   | dead `if (!isActive)` 가드 + 미사용 PanelProps param/import 제거 (`b563085fe`) |
| `apps/builder/src/builder/layout/PanelContainer.tsx` (2차)                | 3     | G4 보완 — scroll capture 기록 → 재활성 rAF 복원 + clamp 가드 (`92b62469b`)     |
| (fallback 시) `stores/index.ts`, `panels/{styles,properties,events}/*`    | —     | enabled 파라미터 배선 — 미사용 (G2 통과로 fallback 미발동)                     |

## 5. 숨은 패널 effect 의존 inventory (Phase 0 실측 → Phase 2 정정 2026-07-17 — G1 판정)

| 패널                                                                    | 숨김 중 필요한 부수효과                                                                                                                                                                                                                           | 판정 (gating 가능/제외)                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| nodes                                                                   | ~~`initializeProject` 유일 호출처~~ → **Phase 2 정정: `BuilderCore.tsx:455` 가 primary 부트스트랩** (Phase 0 grep 이 `\| head` 절단으로 놓친 오판). `NodesPanel.tsx:123-127` 은 `pageCount===0` fallback 잔재                                     | **gating 안전** — 이전 불필요 (primary 가 패널 밖에 이미 존재). nodes hidden 부트로 프로젝트 정상 로드 라이브 실증                 |
| datatable                                                               | ~~하이드레이션 유일 경로~~ → **Phase 2 정정: `BuilderCore.tsx:472` `initializeForProject` 가 동일 fetch 3종 (variables/collections/apiEndpoints) 의 상위집합을 부트에서 실행** (`stores/data.ts:184-229`). `DataTablePanel.tsx:72-96` 은 fallback | **gating 안전** — 이전 불필요. hidden 부트에서 데이터 정상 로드 라이브 실증                                                        |
| properties                                                              | **캔버스 전역 단축키 등록** — Cmd+C/V/D/A, Escape, Cmd+G/Shift+G, 정렬 6종, 분배 2종, Cmd+Alt+X + Tab 네비게이션 raw listener                                                                                                                     | **이전 완료 (Phase 2)** — `CanvasSelectionShortcuts.tsx` host (BuilderCore mount). panel:properties scope 2종 + Cmd+? 는 패널 잔류 |
| styles                                                                  | Copy/Paste Styles (Cmd+Shift+C/V) 단축키 — 숨김 중에도 동작하던 계약. Focus Mode (Alt+Shift+S)·전체 접기 (Alt+S) 는 패널 UI 조작이라 숨김 중 무의미                                                                                               | **Copy/Paste 이전 완료 (Phase 2)** — 동일 host. Focus/접기 2종은 패널 잔류 (숨김 중 비동작 = 의미상 정상)                          |
| fonts                                                                   | font registry window listener (`FontManagerPanel.tsx`) — 자기 표시 sync. effect 본문에 initial sync 호출 없음 → 재장착 시 catch-up 누락                                                                                                           | gating 가능 — **catch-up sync 1줄 추가 완료 (Phase 2)**                                                                            |
| styles/TypographySection                                                | 동일 font sync listener (`TypographySection.tsx`)                                                                                                                                                                                                 | 동일 — **catch-up 추가 완료 (Phase 2)**                                                                                            |
| history                                                                 | `historyManager.subscribe` + mount 시 즉시 `updateHistory()` (`HistoryPanel.tsx:58-68`) — 재장착 시 초기 read 내장                                                                                                                                | gating 가능 ✓                                                                                                                      |
| theme / ai / components / settings / events / actions / datatableEditor | 전역 부수효과 0 — 테마 적용은 store/핸들러 소관 (effect 아님), AI 는 scroll·context sync (abort 없음), events 키보드는 편집기 열림 중만, `ExecutionDebugger` 는 소비처 0 (dead)                                                                   | gating 가능 ✓                                                                                                                      |
| monitor                                                                 | bottom 경로 — `BottomPanelArea.tsx:162` 가 isActive **실전달** (가드 live) + 닫힘 시 영역 자체 null. PanelContainer 밖                                                                                                                            | **ADR 범위 밖** (이미 unmount gating)                                                                                              |

**G1 최종 판정 (Phase 2)**: 제외 목록 = **공집합** — 전 패널 Activity 적용. 부트스트랩 2건은 오판 정정 (primary 가 이미 패널 밖), 단축키 2건은 host 이전 완료.

**가드 실측 정정 (리뷰 round 1 m1 의 재정정)**: `if (!isActive)` 가드는 3종이 아니라 **left/right 패널 12종 전수 + MonitorPanel(live)** — 리뷰의 단일행 grep (`isActive) return null`) 이 2행 스타일 (`if (!isActive) {\n return null`) 9곳을 놓침. 12종 전부 `PanelContent` 의 `isActive={true}` 하드코딩으로 dead (2026-07-17 `grep -rn "!isActive"` 전수). `ModalPanelContainer.tsx:194` 도 `isActive={true}` 전달 (modal 은 조건부 mount 라 정상). ActionsPanel 만 가드 없음.

## 5.5. Activity 스파이크 결과 (Phase 0, 2026-07-17 — vite dev + React 19.2.7 실측)

최소 재현: `<Activity mode>` 안에 RAC TextField ×20 (uSES 외부 store 구독) + Select/Popover + window listener effect. 대조군은 Activity 밖 동일 구조. preview.html 격리 root.

| 항목                            | 실측                                                                                                                                                                                 | 판정                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) hidden 중 store 갱신 3회    | 대조군 mutation 80건·즉시 최신값 / **hidden 렌더 0회·mutation 0건·400ms 후에도 0** (uSES 구독 자체가 해제되어 알림 미수신)                                                           | **클릭 task 에서 숨은 패널 작업 완전 소거** — ADR 성능 가설 실증                                                                                      |
| (b) visible 재전환              | 재구독 + 렌더로 최신값 catch-up 확인 (stale flash 여부는 background 탭 throttle 로 판정 불가 — G2 라이브에서 확인)                                                                   | HC2 충족 방향 확인                                                                                                                                    |
| (c) 숨김 메커니즘               | 자식 host 루트에 inline `display: none !important` 주입, DOM/상태 보존 (input 20개 유지). wrapper 의 transform/opacity 와 **속성축 분리**                                            | 공존 가능. 슬라이드-아웃 애니메이션 중 내용 즉시 소멸 가능성만 G4 시각 확인                                                                           |
| (d) effect 수명                 | hidden 전환 시 cleanup +1, visible 시 mount +1 (초기 hidden mount 는 effect 미장착)                                                                                                  | R2 실증 — §5 의존 패널 처리 없이는 gating 불가                                                                                                        |
| (e) uSES 구독                   | visible 2 → hidden 1 → visible 2 (해제/재구독)                                                                                                                                       | Zustand 구독도 동일 의미 기대                                                                                                                         |
| (f) **portal 누수 (신규 발견)** | popover 열린 채 hidden 전환 → 패널 본체 display:none, **portal 된 popover 는 body 에 잔존 + display:block (화면에 계속 보임)**. 포커스는 BODY 로 정상 해제, 재표시 시 open 상태 보존 | **G2 체크 항목 추가** — 실사용 (패널 탭 클릭 전환) 에서 RAC interactOutside 가 popover 를 먼저 닫는지 확인. 안 닫히면 전환 시 overlay 강제 close 필요 |

## 5.6. Phase 3 Gate 실측 (2026-07-17 — `adr155-g3-perf` 프로젝트 550 요소, Chrome MCP)

측정 환경: Home 페이지에 frame 25 × Text 20 = 525 요소 주입 (addComplexElement 배치, IndexedDB persist·리로드 hydrate 확인) + Components 페이지 초기 25 요소. 좌측 패널 전부 hidden (nodes 는 500 노드 트리 보유 상태로 hidden), 우측 properties 활성. 선택 클릭은 Components 페이지 (Canvas 모드) 요소 대상 — Home 은 preview(CSS) 모드 페이지라 캔버스 선택 경로가 아님.

| Gate | 항목                         | baseline (§1, 43 요소)                  | 실측 (550 요소)                                                                                                    | 판정 |
| ---- | ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| G3   | 선택 클릭 longtask (≥50ms)   | ~~110ms (86~~205ms) 상시                | **0건** (선택 클릭 6회 + 연속 8회; Event Timing pointerdown duration 24ms)                                         | ✅   |
| G3   | commit effect busy 샘플 비율 | ~74% (Mutation+PassiveUnmount 반반)     | **12%** (MutationEffects 0% / Passive 4%; busy 자체 클릭당 ~110ms → ~14ms 상당)                                    | ✅   |
| G4   | 패널 로컬 상태 — 스크롤      | 보존 (content-visibility:auto box 유지) | 소실 실측 (420→0) → **복원 메커니즘 추가 후 1600px 보존** (`92b62469b`)                                            | ✅   |
| G4   | 패널 로컬 상태 — 입력 세션   | 보존                                    | 검색어·필터 결과 보존 (React state — Activity 비-unmount)                                                          | ✅   |
| G4   | popover 잔존                 | —                                       | 실클릭 전환 시 interactOutside 선닫힘; 직접 keydown 패널 토글은 미배선 (CommandPalette 경유뿐) 이라 잔존 경로 없음 | ✅   |
| G4   | 토글 애니메이션              | 300ms 슬라이드                          | 회귀 신호 0 (다수 토글 관측 + data-active CSS 채널 정적 가드 + 콘솔 error 0)                                       | ✅   |

측정 한계 (기록 의무): baseline 74% 는 43 요소 프로젝트/실창 측정치로 이번 550 요소 문서와 동일 환경이 아니다. 다만 MutationEffects 0% + longtask 0건은 fan-out 기제 자체의 소거를 직접 보여주는 값이라 환경 차와 무관하게 유효. JS Self-Profiling 은 연속 8클릭 구간 1958 샘플 (sampleInterval 1ms) 기준.

## 6. 검증 체크리스트 (Phase 3 종결 조건)

- [x] G1~G4 전부 통과 기록 (§5.6 실측값)
- [x] 대형 문서 기준 클릭 longtask 실측 — 550 요소, longtask 0건 (소형 단독 판정 아님)
- [x] 패널 토글 → 현재 선택 즉시 반영 (stale 표시 0건 — Phase 2 라이브 검증 + Phase 3 재확인)
- [x] 패널 로컬 상태 (스크롤·입력 세션) 보존 — 스크롤은 복원 메커니즘 보완 후 충족 (`92b62469b`)
- [x] `pnpm type-check` PASS + `PanelContainer.static.test.ts` 4/4 PASS
- [x] live behavior exercise 기록 (Chrome MCP — §5.6)

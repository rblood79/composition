# ADR-155 구현 상세: 숨은 패널 selection fan-out 차단 — 패널 활성 gating

> 본문: [155-hidden-panel-selection-fanout-gating.md](../155-hidden-panel-selection-fanout-gating.md)
> Status: Accepted — 2026-07-17 (리뷰 round 1 승인). Phase 0 진행 중.

## 1. Baseline 실측 (2026-07-17, adr151-followup-verify 프로젝트 43 요소, 패널 전부 접힘 상태)

| 지표                                     | 실측값                                                                                                  | 도구                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 캔버스 선택 클릭당 longtask              | ~110ms (86~205ms)                                                                                       | LoAF + `longtask.input` 하니스                          |
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

### Phase 2 — 전 패널 확대

1. left/right 전 패널로 Activity 래핑 확대 (`PanelWrapper` 단일 지점이라 개별 패널 코드 무변경).
2. `PanelContent` 의 `isActive={true}` 하드코딩 정리 — **실값 전달 금지** 원칙 유지 (가드 패널이 즉시 unmount 로 전환되어 기각된 대안 C 동작 = Hard Constraint 3 위반). 단 **Phase 0 재실측으로 전제 갱신 (§5 하단)**: (i) 가드는 3패널이 아니라 **left/right 12패널 전수** (2행 스타일 9 + 1행 스타일 3), (ii) `PanelProps.isActive` 는 bottom 경로 (`BottomPanelArea.tsx:162` 실전달, MonitorPanel 가드 live) 가 실사용하므로 **prop 타입 제거 불가**. 따라서 정리 방식 = left/right 12패널의 dead 가드 제거 + `PanelContent` 의 `isActive={true}` 하드코딩 유지 (bottom/modal 경로 계약 보존). 12패널 가드 제거는 같은 커밋으로 묶는다. 파일럿 Phase 1 은 하드코딩 유지 상태라 이 위험 미해당.
3. 정적 가드 테스트: `PanelContainer.static.test.ts` — Activity 래핑 존재 + `isActive={true}` 하드코딩 재도입 차단.

### Phase 3 — Gate 총괄 실측 + 종결

1. **G3/G4 실측** (대형 문서 병행): 클릭 longtask, commit effect 비율, 패널 로컬 상태 (스크롤/입력값) 보존, 패널 토글 애니메이션 회귀.
2. CHANGELOG Performance 엔트리 + ADR Implemented 승격 + README 갱신.
3. live behavior 게이트 (CLAUDE.md 완료 기준): Chrome MCP 로 선택→패널 표시·토글·상태 보존 1회 exercise 기록.

### Fallback (G2/G3 실패 시) — 대안 A 경로

`usePanelIsActive(panelId)` (layout store 직구독) + `useSelectedElementData(enabled)` selector sentinel gating 을 패널 4소비처에 배선. Activity 래핑은 제거 (롤백 = 래퍼 삭제 1곳).

## 4. 파일 변경 표 (추정)

| 파일                                                                      | Phase | 변경                                           |
| ------------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| `apps/builder/src/builder/layout/PanelContainer.tsx`                      | 1→2   | Activity 래핑 + isActive 하드코딩 정리 (~30줄) |
| `apps/builder/src/builder/layout/__tests__/PanelContainer.static.test.ts` | 2     | 신규 — 래핑/하드코딩 정적 가드                 |
| `apps/builder/src/builder/layout/PanelContainer.css` 또는 해당 스타일     | 1     | data-active 숨김과 Activity 숨김의 역할 정리   |
| (fallback 시) `stores/index.ts`, `panels/{styles,properties,events}/*`    | —     | enabled 파라미터 배선                          |

## 5. 숨은 패널 effect 의존 inventory (Phase 0 실측 2026-07-17 — G1 판정 입력)

| 패널                                                                    | 숨김 중 필요한 부수효과                                                                                                                                                                                 | 판정 (gating 가능/제외)                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| nodes                                                                   | `initializeProject(projectId)` — **앱 전체에서 유일한 프로젝트 부트스트랩 호출처** (`NodesPanel.tsx:123-127`, grep 전수). 미실행 시 페이지 로드 자체가 안 됨                                            | **의존 O** — 제외 또는 부트스트랩을 BuilderCore 급으로 이전. 제외 시 TreeItem 재생성 축 잔존                         |
| datatable                                                               | collections/apiEndpoints/variables store 하이드레이션 (`DataTablePanel.tsx:72-96`) — 캔버스 `useCollectionData` 가 이 store 를 소비 (`useCollectionData.ts:239`, `:542` pending 판정 — 자체 fetch 없음) | **의존 O** — 제외 또는 하이드레이션을 프로젝트 로드 시점으로 이전. 제외 시 데이터 바인딩 컴포넌트가 패널 열림에 종속 |
| properties                                                              | **캔버스 전역 단축키 등록** — Cmd+C/V/D/A, Escape, Cmd+G/Shift+G, 정렬 6종, 분배 2종, Cmd+Alt+X, Cmd+? (`PropertiesPanel.tsx:1414-1574`) + Tab 네비게이션 raw listener (`:1578-1595`)                   | **의존 O** — 제외 또는 단축키 등록을 전역 host 로 이전. 제외 시 입력 fan-out 축 잔존                                 |
| styles                                                                  | Copy/Paste Styles (Cmd+Shift+C/V)·Focus Mode (Alt+Shift+S)·전체 접기 (Alt+S) 단축키 (`StylesPanel.tsx:88-136`) — 현재는 패널 숨김 중에도 동작                                                           | **의존 △** — 이전 또는 "패널 열림 시만 동작" 수용 (동작 변화 승인 필요)                                              |
| fonts                                                                   | font registry window listener (`FontManagerPanel.tsx:37-50`) — 자기 표시 sync. effect 본문에 initial sync 호출 없음 → 재장착 시 catch-up 누락                                                           | gating 가능 — 재장착 catch-up sync 1줄 추가 조건 (HC2)                                                               |
| styles/TypographySection                                                | 동일 font sync listener (`TypographySection.tsx:125-142`)                                                                                                                                               | 동일 조건                                                                                                            |
| history                                                                 | `historyManager.subscribe` + mount 시 즉시 `updateHistory()` (`HistoryPanel.tsx:58-68`) — 재장착 시 초기 read 내장                                                                                      | gating 가능 ✓                                                                                                        |
| theme / ai / components / settings / events / actions / datatableEditor | 전역 부수효과 0 — 테마 적용은 store/핸들러 소관 (effect 아님), AI 는 scroll·context sync (abort 없음), events 키보드는 편집기 열림 중만, `ExecutionDebugger` 는 소비처 0 (dead)                         | gating 가능 ✓                                                                                                        |
| monitor                                                                 | bottom 경로 — `BottomPanelArea.tsx:162` 가 isActive **실전달** (가드 live) + 닫힘 시 영역 자체 null. PanelContainer 밖                                                                                  | **ADR 범위 밖** (이미 unmount gating)                                                                                |

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

## 6. 검증 체크리스트 (Phase 3 종결 조건)

- [ ] G1~G4 전부 통과 기록 (본 문서에 실측값 추가)
- [ ] 대형 문서 기준 클릭 longtask 실측 — 소형 문서 단독 판정 금지
- [ ] 패널 토글 → 현재 선택 즉시 반영 (stale 표시 0건)
- [ ] 패널 로컬 상태 (스크롤·입력 세션) 보존
- [ ] `pnpm type-check` PASS + 관련 vitest PASS
- [ ] live behavior exercise 기록 (Chrome MCP)

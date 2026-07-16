# ADR-155 구현 상세: 숨은 패널 selection fan-out 차단 — 패널 활성 gating

> 본문: [155-hidden-panel-selection-fanout-gating.md](../155-hidden-panel-selection-fanout-gating.md)
> Status: Proposed — 2026-07-17. **구현 착수 금지 — 리뷰 승인 후 진행.**

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
- 선택 구독 소비처: `stores/index.ts:197` `useSelectedElementData` → `useDebouncedSelectedElementData` ×4 (`panels/styles/StylesPanel.tsx:33,51`, `panels/properties/PropertiesPanel.tsx:789`, `panels/events/EventsPanel.tsx:281`) + 각 스타일 섹션의 `selectedElementId` 직구독 + `panels/nodes/LayersSection.tsx:102`.

## 3. Phase 계획

### Phase 0 — inventory + 스파이크 (코드 반영 없음)

1. **숨은 패널 effect 의존 inventory**: 패널 14종의 useEffect/useSyncExternalStore 중 "숨김 상태에서도 실행되어야 하는" 부수효과 grep 조사 (예: 단축키 등록, 전역 이벤트 브릿지, postMessage 채널). 결과를 본 문서 §5 표에 기록. **G1 판정 입력.**
2. **Activity 스파이크**: scratch 페이지에서 `<Activity mode="hidden">` 로 RAC TextField/Tree/Popover 를 감싼 최소 재현 — (a) hidden 중 store 갱신이 클릭 task 에 commit effect 를 만드는지, (b) visible 전환 시 최신 상태 즉시 표시, (c) display 처리 방식이 `.panel-wrapper` CSS (`data-active` transform) 와 충돌하는지 확인.
3. baseline 재실측 기록 (§1 절차, 대형 문서 포함).

### Phase 1 — 파일럿 (저위험 패널 2종)

1. `PanelWrapper` 에서 `<Activity mode={isActive ? "visible" : "hidden"}>` 로 `PanelContent` 래핑 — 대상: History + Themes (selection 미소비·상태 단순).
2. CSS 정합: Activity 의 숨김 처리와 기존 `data-active` CSS 이중화 제거 여부 판정 (충돌 시 `data-active` 유지 + Activity 만 갱신 지연 담당).
3. **G2 실측**: 파일럿 패널의 클릭당 DOM 쓰기/remount 소거 + 재활성 시 현재 선택·테마 상태 즉시 표시 (Chrome MCP live).

### Phase 2 — 전 패널 확대

1. left/right 전 패널로 Activity 래핑 확대 (`PanelWrapper` 단일 지점이라 개별 패널 코드 무변경).
2. `PanelContent` 의 `isActive={true}` 하드코딩 정리 — Activity 가 액티브 의미를 대체하므로 prop 제거 또는 실값 전달로 정리 (각 패널의 `if (!isActive) return null` 가드 dead code 정리는 후속 별도 커밋).
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

## 5. 숨은 패널 effect 의존 inventory (Phase 0 에서 채움)

| 패널            | 숨김 중 필요한 부수효과 | 판정 (gating 가능/제외) |
| --------------- | ----------------------- | ----------------------- |
| [TODO: Phase 0] |                         |                         |

## 6. 검증 체크리스트 (Phase 3 종결 조건)

- [ ] G1~G4 전부 통과 기록 (본 문서에 실측값 추가)
- [ ] 대형 문서 기준 클릭 longtask 실측 — 소형 문서 단독 판정 금지
- [ ] 패널 토글 → 현재 선택 즉시 반영 (stale 표시 0건)
- [ ] 패널 로컬 상태 (스크롤·입력 세션) 보존
- [ ] `pnpm type-check` PASS + 관련 vitest PASS
- [ ] live behavior exercise 기록 (Chrome MCP)

# ADR-203 Design Breakdown — 선택 변경 fan-out 제거: Navigator 트리 창 렌더 · Properties 조건부

> ADR 본문: [203-selection-fanout-layer-tree-virtualized-rows.md](../203-selection-fanout-layer-tree-virtualized-rows.md). 본 문서는 Phase · 파일 · 체크리스트 · 측정 절차만 담는다. 전제 · 대안 · 위험 판정은 ADR 본문이 정본이며 여기에 추가 결정을 두지 않는다.

## §1 관계 선언 (fork 아님 — 신규 주제)

- **ADR-155** (Implemented 2026-07-17) 는 **숨은** 패널의 선택 fan-out 을 `<Activity mode="hidden">` 으로 차단했다. 본 ADR 은 **열린** Navigator 패널의 잔여 비용을 다룬다. 155 의 scope 밖 후속 주제이며 155 의 전제 (패널 gating) 는 그대로 유효하다.
- **ADR-150 R2** 는 캔버스 collection window 와 LayerTree 패널 정책을 분리하고 "패널은 별도 정책 결정 후 검증" 으로 남겼다. 본 ADR 이 그 패널 정책이다. 의존 방향 없음 — 캔버스 projection window (Skia draw/hit) 와 패널 DOM 창 렌더는 서로 다른 표면이다.
- tanstack 기반 `VirtualizedTree` 는 FramesTab (`FrameElementTree.tsx:176`) 도 쓴다 — scope 밖. LayerTree 에서만 제거하고 FramesTab 은 후속 fix 단위로 남긴다.

## §2 Phase 0 — inventory (2026-09-02 완료분 + 착수 시 보강 1건)

### 2-1. 패널 조합 A/B (완료 — `pnpm perf:baseline -- --lane frame --seed-count 600 --classes idle,select --duration-ms 3000 --open-panels <조합>`)

headless Chrome 60Hz · 격리 프로젝트 · 시드 600 (Text/frame, 전부 `parent_id: body.id`) · select 부류 = store 경로 `setSelectedElement` 100 ms 간격 3 s. 원본 JSON: `$CLAUDE_JOB_DIR/tmp/ab/{both,navigator,properties,none}/frame-*.json` (로컬).

| 열린 패널              | select gap p50 / p95 / max (ms) | 드롭% | 할당 MB/s | longtask n / ms | idle gap p50 / p95 |
| ---------------------- | ------------------------------: | ----: | --------: | --------------: | -----------------: |
| navigator + properties |           234.8 / 346.2 / 614.9 |  92.3 |     118.6 |       12 / 3202 |        16.7 / 17.4 |
| navigator 만           |           236.6 / 288.7 / 621.3 | 100.0 |     119.2 |       13 / 3230 |        16.7 / 18.4 |
| properties 만          |              16.7 / 19.4 / 25.3 |   0.5 |      33.9 |           0 / 0 |        16.6 / 18.3 |
| 없음                   |              16.7 / 17.9 / 23.6 |   0.0 |      15.5 |           0 / 0 |        16.7 / 17.2 |

읽기: 선택 비용은 Navigator 단독으로 재현되고 (both ≈ navigator), Properties 는 할당 +18 MB/s 뿐 드롭 0 — 600 요소에서 Properties 는 문제가 아니다. 60 요소 기준선 (§3-1 of `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md`) 도 select 드롭 16.8% · longtask 2/147 로 같은 축.

### 2-2. self-time 귀속 (navigator 만, `--profile`, JS Self-Profiling 1 ms, 294 샘플, JS idle 11.6%)

| 순위 | frame                                                     | self % | 소속                                                |
| ---: | --------------------------------------------------------- | -----: | --------------------------------------------------- |
|    1 | `logComponentRender` (react-dom DEV)                      |    6.5 | React DEV 계측 — prod 에 없음                       |
|    2 | `(anonymous) react.js:591` · `ReactElement`               |    9.2 | React element 생성 — 행 600 × 자식 트리             |
|    3 | `ShadowTreeWalker` (@react-aria/focus)                    |    3.7 | RAC 포커스 walker                                   |
|    4 | `getDirectChildren` · `getItem` · `DOMElement`            |    8.8 | RAC collection 빌더 (hidden Document) 600 행 재구축 |
|    5 | `commitUpdate` · `updateProperties` · `validateProperty`  |    6.8 | React commit — 행 DOM 속성 갱신                     |
|    — | `NormalItemContent` · `getEditingSemanticsRole` (앱 코드) | 각 0.3 | 앱 행 콘텐츠는 비용의 1% 미만                       |

읽기: 비용의 주체는 RAC `Tree` 가 `selectedKeys` 변경마다 600 `TreeItem` 을 전부 재렌더하고 collection 을 재구축하는 것이다. 앱 쪽 행 콘텐츠 memo 로는 닿지 않는다 (ADR 본문 대안 C 기각 근거).

### 2-3. 코드 사실 (착수 전 재확인 대상 — 라인은 2026-09-02 기준)

| #   | 사실                                                                                                                                                                           | 경로                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| C1  | 가상화 분기 `treeNodes.length >= 300` 는 **root 노드 개수** 기준. `treeNodes` 는 `buildTreeFromElements` 의 root 목록이라 페이지마다 body 1개 → 실 문서에서 절대 켜지지 않는다 | `panels/navigator/tree/LayerTree/LayerTree.tsx:214`, `useLayerTreeData.ts:123-141`      |
| C2  | 분기 도입 커밋 `881e5e5d6` (2026-08-29) 이후 LayerTree 에서 가동된 적 없는 경로 (측정 Q4 — 존재 ≠ 가동)                                                                        | `git log -S'treeNodes.length >= 300'`                                                   |
| C3  | 비가상 경로는 RAC `Tree` 에 전체 행 mount, `TreeBaseItem` 이 `TreeItem`/`TreeItemContent`/`Collection` 재귀                                                                    | `tree/TreeBase/TreeBase.tsx:187-208`, `TreeBaseItem.tsx:33-56`                          |
| C4  | 선택마다 `selectedKeys: new Set(activeSelectedIds)` 새 Set + `LayersSection` 의 `expandedKeys` 새 Set → Tree 전체 재렌더 확정                                                  | `LayerTree.tsx:193`, `LayersSection.tsx:151-152, 166-180`                               |
| C5  | RAC 1.20 `Tree` 는 `CollectionRendererContext` 의 `CollectionRoot` / `isVirtualized` / `layoutDelegate` / `dropTargetDelegate` 를 소비 — Virtualizer 결선 존재                 | `node_modules/react-aria-components/dist/private/Tree.mjs:215, 239-240, 280, 648, 687`  |
| C6  | `Virtualizer` · `ListLayout` 은 RAC 패키지가 re-export (신규 의존 0). 현재 builder 에서 사용 0건                                                                               | `react-aria-components/dist/exports/{index,Virtualizer}.mjs`                            |
| C7  | 행 높이는 CSS `min-height: var(--control-size)` (`calc(var(--text-2xl) + var(--spacing))`) — 숫자 상수 아님. tanstack 경로는 `itemHeight={28}` 하드코딩                        | `panels/navigator/NavigatorPanel.css:6-12`, `packages/shared/.../builder-system.css:45` |
| C8  | 패널 숨김/복원 스크롤 보존은 capture-phase `scroll` 리스너로 **임의 자손 스크롤 요소** 를 기억 — Virtualizer 스크롤 컨테이너도 자손이면 자동 대상 (착수 시 확인)               | `layout/PanelWorkspace.tsx:557-650`                                                     |
| C9  | store `setSelectedElement` 는 2단 set (Phase 1 즉시: id/ids/idsSet, Phase 2 rAF: selectedElementProps) — 패널 재렌더가 프레임당 2회 일어날 수 있다                             | `stores/elements.ts:1194-1240`                                                          |

### 2-4. 선택 구독자 인벤토리 (stores 밖 32 파일, `grep -rlE 'state\.selectedElementIds?|useDebouncedSelectedElementData\(|...'`)

| 군               | 파일 (대표)                                                                                                                      | 본 ADR 처리                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Navigator        | `LayersSection.tsx`, `NavigatorPanel.tsx`, `LayerTree.tsx`, `LayerTreeItemContent.tsx`, `FramesTab/*` (2)                        | **Phase 1~3** (FramesTab 은 scope 밖)                            |
| Properties       | `PropertiesPanel.tsx`, `CanvasSelectionShortcuts.tsx`, `components/property/*` (4)                                               | Phase 4 조건부                                                   |
| Styles           | `StylesPanel.tsx`, `styles/sections/*` (5), `styles/hooks/*` (3), `styles/components/*` (3)                                      | 155 Activity 가 숨김 시 차단 — 열림 시 비용은 G6 재측정으로 판정 |
| Canvas / overlay | `BuilderCanvas.tsx`, `skia/SkiaCanvas.tsx`, `overlay/index.tsx`, `ContextualActionBar.tsx`, `useCentralCanvasPointerHandlers.ts` | 대상 아님 (A/B "없음" 이 16.7 ms)                                |
| 기타             | `AIPanel.tsx`, `ComponentsPanel.tsx`, `InteractionsPanel.tsx`, `BuilderCore.tsx`, `services/*` (2), `commandMeta.ts`             | 대상 아님                                                        |

### 2-5. 착수 시 보강 (G0 — 코드 변경 전 1회)

- [ ] **실 문서 root 수** — Chrome MCP 로 사용자 프로젝트 1개를 열고 현재 페이지 `elements.filter(e => !e.parent_id).length` 와 `[role="treeitem"]` 수, `.layer-tree--virtualized` 유무 기록 (2026-09-02 시도는 boot "Preparing the canvas 100%" 정지 — ADR-923 readiness 작업 중 + 숨은 탭 RAF 정지 조합 — 로 미완). 측정 Q1: 사람이 만든 문서에서 C1 이 성립함을 1회 확인.
- [ ] **현재 동작 체크리스트** (parity 기준선): 키보드 ↑↓ · Home/End · typeahead · shift/meta 다중 선택 · 캔버스 클릭 → 트리 자동 펼침 + 선택 행 가시화 여부 · 우클릭 메뉴 · 삭제 버튼 · DnD 3 케이스 (형제 사이 / 컨테이너 안으로 / 무효 drop) · 패널 숨김→복원 scrollTop. 각 항목의 **현재 결과** 를 기록 (후속 G2/G3 의 대조군).

## §3 Phase 1 — 스파이크: RAC `Virtualizer` + `ListLayout` (G1)

목표: RAC Tree 를 그대로 두고 창 렌더만 켠다. 코드 변경은 TreeBase 1곳 + CSS + 행 높이 SSOT.

| 파일                                      | 변경                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree/TreeBase/TreeBase.tsx`              | `<Tree>` 를 `<Virtualizer layout={ListLayout} layoutOptions={{ rowHeight }}>` 로 감싼다. `rowHeight` 는 아래 SSOT 에서 1회 읽음. `dragAndDropHooks`/`renderDropIndicator` 는 그대로 (RAC 가 `dropTargetDelegate` 를 layout 에서 공급) |
| `panels/navigator/NavigatorPanel.css`     | `--layer-tree-row-height: 28px` 를 선언하고 `.elementItem` 은 `height: var(--layer-tree-row-height)` (min-height 아님 — ListLayout 고정 행 높이와 1:1). 트리 컨테이너 `height: 100%; min-height: 0`                                   |
| `tree/TreeBase/rowHeight.ts` (신규, 소형) | `getComputedStyle(root).getPropertyValue('--layer-tree-row-height')` → number (fallback 28). SSR/jsdom 에서는 fallback                                                                                                                |
| `panels/navigator/LayersSection.tsx`      | 변경 없음 (구독 유지). `Section` 래퍼가 트리에 높이를 주는지 확인 — 안 주면 Virtualizer 가 0 행을 그린다 (R7)                                                                                                                         |
| `tree/LayerTree/LayerTree.tsx`            | Phase 1 에서는 `>= 300` 분기 유지 (스파이크는 TreeBase 경로만). Phase 2 에서 제거                                                                                                                                                     |

RED 먼저:

- [ ] browser vitest (`vitest.browser.config.ts`) `tree/TreeBase/TreeBase.virtualized.browser.test.tsx`: 600 노드 (body 1 root + 599 자식, 펼침) 를 320 px 높이 컨테이너에 렌더 → `[role="treeitem"]` 수 ≤ ⌈320/28⌉ + overscan×2 (현재 코드로는 600 → RED). 같은 테스트에서 `selectedKeys` 를 10회 바꿔도 행 콘텐츠 렌더 횟수 (renderContent spy) ≤ 가시 행 × 10.
- [ ] 같은 파일: 계산된 `.elementItem` 높이 === `rowHeight` (CSS SSOT 와 ListLayout 상수 일치 가드).

G1 측정 (Phase 1 종료 조건): `pnpm perf:baseline -- --lane frame --seed-count 600 --classes idle,select --duration-ms 3000` (both 패널, 기본값) 에서 select gap p50 ≤ 33 ms · 드롭 ≤ 5% · longtask 0, 그리고 `--seed-count 60` 에서 드롭 0. 결과 JSON 경로를 ADR Gates 에 기록.

실패 시: 대안 B (tanstack `VirtualizedTree` 총 행 수 기준 활성화) 를 **임시** 로 켜고 D1 debt (자체 `role="tree"` 유지) 를 ADR Risks 에 HIGH 로 등재.

## §4 Phase 2 — D1 parity + 정리 (G2 · G3)

- [ ] G2 (Chrome MCP, 실 builder): 가상화 전/후 같은 행의 `role` / `aria-selected` / `aria-expanded` / `aria-level` / `aria-posinset` / `aria-setsize` diff 0. 키보드 ↑↓ Home/End typeahead, shift/meta 다중 선택, 화면 밖 행으로 포커스 이동 시 자동 스크롤. DnD 3 케이스 + drop indicator 위치.
- [ ] G3: 패널 숨김 → 복원 scrollTop 보존 (C8 경로가 Virtualizer 컨테이너를 잡는지), 캔버스 클릭 → 자동 펼침 + 선택 행 가시화 (§2-5 기준선과 동일).
- [ ] `LayerTree.tsx` 의 `>= 300` 분기와 `VirtualizedTree` import 제거 (LayerTree 한정). `FramesTab` 은 손대지 않는다. `LayerTree.tsx:193` 의 `new Set(activeSelectedIds)` 는 `useMemo` 로 (가시 행만 재렌더돼도 Set 재생성은 불필요).
- [ ] `useFocusManagement` 의 `focusedKey` 가 가상화와 충돌하지 않는지 (화면 밖 키에 focus 요청 시 RAC `layoutDelegate` 경유 scrollIntoView).
- [ ] unit: `LayerTree.static.test.ts` — `VirtualizedTree` 참조 0건 가드 (FramesTab 제외).

## §5 Phase 3 — 규모 · 조건 재측정 + ratchet (G4)

- [ ] 5k 시드 1회를 **persistent** 프로젝트에 넣고 (`--project-url`) select p50 ≤ 50 ms. 시드 4분+ 이므로 격리 컨텍스트 재시드 금지 (메모리 `project-frame-drop-map-5k-baseline`).
- [ ] `--headed` 1회 (절대값) + 실 포인터 클릭 1회 (hit-test 경로 — 하니스 select 는 store 경로라 빠져 있다).
- [ ] 하니스: frame lane select 결과에 `[role="treeitem"]` 수를 기록 (`RECORDER_SCRIPT` 종료 시 1회 `document.querySelectorAll` — 창 렌더 회귀 가드).
- [ ] `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md` §3-2 select 행과 §4 순위 갱신 (전/후 표).

## §6 Phase 4 — Properties 필드 단위 구독 (조건부, G6)

착수 조건 (G6): Styles + Properties + Navigator 열린 상태 5k 재측정에서 select gap p95 > 25 ms **또는** 할당 > 60 MB/s. 조건 미달이면 본 Phase 는 착수하지 않고 ADR Consequences 에 "측정상 불필요" 로 종결.

착수 시 범위: `PropertiesPanelContent` 가 `useDebouncedSelectedElementData()` 객체 대신 `selectedElementId` + `type` 만 구독하고, `GenericField` 각각이 `useStore(s => readProp(s, id, path))` 로 자기 값만 구독. `PropertyInput.tsx:38` / `PropertyNumberInput.tsx:48` 의 `selectedElementId` 구독은 유지 (포커스 보호용).

## §7 종결 (G5)

- [ ] `docs/CHANGELOG.md` — 사용자-가시 (선택 반응 속도) 항목.
- [ ] ADR `### Live Exercise` — G2/G3 시나리오 · 결과 · 날짜 · Chrome MCP/사용자 confirm 구분.
- [ ] README 상태 전이 + 본 breakdown 체크박스 반영.

## §8 측정 조건 · 함정

- headless 60Hz + SwiftShader — 상대 비교치. 절대값은 `--headed`.
- 새 컨텍스트는 패널 전부 닫힘 — `--open-panels` 기본값이 navigator,properties.
- React 19.2 dev 는 렌더마다 `performance.measure` 를 남긴다 — 하니스가 측정 전 clear. `logComponentRender` 6.5% 는 dev 전용.
- select 부류는 store 경로 (`setSelectedElement`) — hit-test 비용 미포함. G4 에 실 클릭 1회.
- Chrome MCP 숨은 탭은 RAF 정지 → readiness 게이트가 안 풀린다 (2026-09-02 실측). 탭을 전면에 두고 확인.
- **사용자 Chrome 은 DevTools CPU throttle 4x slowdown 상태** (사용자 고지 2026-09-02). 하니스 headless 수치는 throttle 없음 — 같은 240 ms 가 사용자 환경에서는 ~1 s 로 체감된다. live exercise (G2/G3/G4 실 클릭) 는 throttle 상태를 결과와 함께 기록하고, 수치 비교는 throttle 동일 조건에서만 한다 (measurement-validity Q/8 조건 기록).
- 프로파일 self-time 은 dev React 오버헤드 15~20% 포함 — prod 절대값은 `--serve-dist`.

# ADR-203 Design Breakdown — 선택 변경 fan-out 제거: Navigator 트리 창 렌더 · Properties 조건부

> ADR 본문: [203-selection-fanout-layer-tree-virtualized-rows.md](../203-selection-fanout-layer-tree-virtualized-rows.md). 본 문서는 Phase · 파일 · 체크리스트 · 측정 절차만 담는다. 전제 · 대안 · 위험 판정은 ADR 본문이 정본이며 여기에 추가 결정을 두지 않는다.

## §1 관계 선언 (fork 아님 — 신규 주제)

- **ADR-155** (Implemented 2026-07-17) 는 **숨은** 패널의 선택 fan-out 을 `<Activity mode="hidden">` 으로 차단했다. 본 ADR 은 **열린** Navigator 패널의 잔여 비용을 다룬다. 155 의 scope 밖 후속 주제이며 155 의 전제 (패널 gating) 는 그대로 유효하다.
- **ADR-150 R2** 는 캔버스 collection window 와 LayerTree 패널 정책을 분리하고 "패널은 별도 정책 결정 후 검증" 으로 남겼다. 본 ADR 이 그 패널 정책이다. 의존 방향 없음 — 캔버스 projection window (Skia draw/hit) 와 패널 DOM 창 렌더는 서로 다른 표면이다.
- **Builder 성능 상위 계획**에서 본 ADR은 ready 이후 선택 상호작용을 다루는 Track B다. 프로젝트 생성·편집기 진입 시 Skia cold first-frame Track A와 원인·Gate·소비 표면을 합치지 않고, 하니스와 측정 조건만 공유한다 (`BUILDER_PERF_BASELINE_2026-09.md` §4-1).
- tanstack 기반 `VirtualizedTree` 는 FramesTab (`FrameElementTree.tsx:176`) 도 쓰고, 공용 `TreeBase`는 PageTree · FrameList · FrameElementTree도 소비한다 — 모두 scope 밖. `Virtualizer`는 LayerTree에서만 감싸고, tanstack 경로도 LayerTree 에서만 제거한다. FrameElementTree는 이미 별도 tanstack 조건 분기가 있으므로 "비가상 소비자"가 아니라 **RAC `TreeBase` 호출부와 기존 tanstack 분기 모두 무변경인 소비자**로 판정한다.

**4 질문 lock-in** (`adr-writing.md` §"ADR Fork / 분리 결정 시 전제·관점 점검" — 신규 주제라 fork 는 아니지만 ADR-150·155 와의 관계 재론을 막기 위해 같은 형식으로 고정; /review 2026-09-03 LOW 반영):

1. **base / 응용 분류**: 본 ADR 은 응용 (Navigator 패널 DOM 창 렌더) 이고 base 는 RAC `Tree` + `Virtualizer` (upstream). ADR-150 A2 (캔버스 collection window) · ADR-155 (패널 gating) 어느 쪽도 본 ADR 의 base 가 아니다 — prerequisite 없음.
2. **schema 직교성**: 문서 schema · canonical 노드 · catalog 무접촉. 바뀌는 것은 LayerTree의 Virtualizer 결선, LayerTree 전용 `rowSize` 상수, Layers section의 scoped scroll style뿐이며 공용 `TreeBase.tsx`는 유지 — 150/155 의 schema 와 직교.
3. **선행 ADR 전제 reverse 검증**: 150 R2 "window 는 캔버스 전용, 패널은 별도 정책" 은 본 ADR 후에도 그대로 성립 (패널이 캔버스 window 를 소비하지 않는다 — `useLayerTreeData.ts` 는 `LISTBOX_ROW_PROJECTION_WINDOW_LIMIT` 를 projected 행 cap 으로만 쓴다). 155 의 Activity gating 은 열린 패널에 무관하므로 방향 반전 없음. 사용자 confirm: `/create-adr` 직접 입력 (2026-09-02) + 추천 순서 답변 "adr생성 차례인가" 확인.
4. **전면 재리뷰 불필요**: 전제 (Navigator 단독 비용 · 가동된 적 없는 분기) 는 Phase 0 A/B 와 코드 사실 C1~~C10 로 착수 전에 확정했고, /review round 1 (2026-09-03) 이 당시 C1~~C7 인용을 전수 대조해 정확 판정했다. 2026-09-04 변경은 설치된 RAC 구현과 G0 live에 맞춘 실행계획 보정이며 대안·위험 임계·Decision을 바꾸지 않는다. Phase 1 구현 뒤 G1 수리 검증으로 닫고 별도 전면 review round를 추가하지 않는다.

### 1-1. 리뷰 후 실행계획 보정 (2026-09-04, Decision/Status 불변)

리뷰 뒤 G0 live와 설치된 RAC 1.20 구현을 실행 관점에서 다시 대조해 아래를 보정했다. 대안 A와 위험 임계 판정은 바뀌지 않는다.

1. 실 DOM 행 selector는 `[role="treeitem"]`이 아니라 `[role="row"]`이며, 하니스는 다른 treegrid와 섞이지 않도록 `.layer-tree--rac-virtualized [role="row"]`로 scope한다.
2. RAC `Virtualizer`는 자손 `Tree`에 `CollectionRendererContext`를 공급하므로 LayerTree에서 `<TreeBase>`만 감쌀 수 있다. 공용 `TreeBase`를 수정하지 않는다.
3. `ListLayoutOptions.rowHeight`는 호환용 deprecated alias다. 현행 `rowSize`를 사용한다. RAC에는 사용자 지정 overscan prop이 없고 내부 `OverscanManager`가 진행 방향으로 viewport의 1/3을 더하므로 Gate도 실제 계약으로 계산한다.
4. `Virtualizer`의 `CollectionRoot`는 `Tree` ref에 inline overflow/content size를 부여한다. 기존 `.section-content`와 이중 스크롤이 되지 않도록 Layers section의 scroll owner를 RAC Tree 하나로 옮긴다.
5. G0 live에서 캔버스 선택은 조상을 펼치지만 선택 행을 강제 자동 스크롤하지 않았다. G3는 이 기준선을 유지하고, 숨김→복원은 DOM 노드가 바뀌는 전후 `scrollTop` 숫자 대신 첫 가시 key + offset으로 비교한다.

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

| #   | 사실                                                                                                                                                                                                                                    | 경로                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 가상화 분기 `treeNodes.length >= 300` 는 **root 노드 개수** 기준. `treeNodes` 는 `buildTreeFromElements` 의 root 목록이라 페이지마다 body 1개 → 실 문서에서 절대 켜지지 않는다                                                          | `panels/navigator/tree/LayerTree/LayerTree.tsx:214`, `useLayerTreeData.ts:123-141`                                                                                                                                                                |
| C2  | 분기 도입 커밋 `881e5e5d6` (2026-08-29) 이후 LayerTree 에서 가동된 적 없는 경로 (측정 Q4 — 존재 ≠ 가동)                                                                                                                                 | `git log -S'treeNodes.length >= 300'`                                                                                                                                                                                                             |
| C3  | 비가상 경로는 RAC `Tree` 에 전체 행 mount, `TreeBaseItem` 이 `TreeItem`/`TreeItemContent`/`Collection` 재귀                                                                                                                             | `tree/TreeBase/TreeBase.tsx:187-208`, `TreeBaseItem.tsx:33-56`                                                                                                                                                                                    |
| C4  | 선택마다 `selectedKeys: new Set(activeSelectedIds)` 새 Set + `LayersSection` 의 `expandedKeys` 새 Set → Tree 전체 재렌더 확정                                                                                                           | `LayerTree.tsx:193`, `LayersSection.tsx:151-152, 166-180`                                                                                                                                                                                         |
| C5  | RAC 1.20 `Virtualizer`가 `CollectionRendererContext.Provider`를 만들고 자손 `Tree`는 `CollectionRoot` / `isVirtualized` / `layoutDelegate` / `dropTargetDelegate`를 소비 — LayerTree 외부 wrapper 결선 가능                             | `apps/builder/node_modules/react-aria-components/dist/private/Virtualizer.mjs:24-46`, `Tree.mjs:215,239-240,269-280,382-386`                                                                                                                      |
| C6  | `Virtualizer` · `ListLayout` 은 RAC 패키지가 re-export (신규 의존 0). `ListLayoutOptions.rowSize`가 현행 fixed-row API이고 `rowHeight`는 deprecated alias. 사용자 overscan prop은 없으며 내부값은 viewport/3                            | `apps/builder/node_modules/react-aria-components/dist/{exports/Virtualizer.mjs,types/src/Virtualizer.d.ts}`, `apps/builder/node_modules/react-stately/dist/{types/src/layout/ListLayout.d.ts:7-75,private/virtualizer/OverscanManager.mjs:26-34}` |
| C7  | 행 높이는 CSS `min-height: var(--control-size)` (`calc(var(--text-2xl) + var(--spacing))`) — 숫자 상수 아님. tanstack 경로는 `itemHeight={28}` 하드코딩                                                                                 | `panels/navigator/NavigatorPanel.css:6-12`, `packages/shared/.../builder-system.css:45`                                                                                                                                                           |
| C8  | 패널 숨김/복원 스크롤 보존은 capture-phase `scroll` 리스너로 **임의 자손 스크롤 요소** 를 기억 — Virtualizer 스크롤 컨테이너도 자손이면 자동 대상 (착수 시 확인)                                                                        | `layout/PanelWorkspace.tsx:557-650`                                                                                                                                                                                                               |
| C9  | store `setSelectedElement` 는 2단 set (Phase 1 즉시: id/ids/idsSet, Phase 2 rAF: selectedElementProps) — 패널 재렌더가 프레임당 2회 일어날 수 있다                                                                                      | `stores/elements.ts:1194-1240`                                                                                                                                                                                                                    |
| C10 | RAC `Tree`가 자기 ref를 `Virtualizer.CollectionRoot`의 `scrollRef`로 넘기고 `useScrollView`가 그 ref에 inline overflow/content size를 적용한다. 현재 외부 `.section-content`도 `overflow-y:auto`라 명시적 단일 scroll owner 전환이 필요 | `apps/builder/node_modules/react-aria-components/dist/private/{Tree.mjs:382-386,Virtualizer.mjs:48-86}`, `apps/builder/node_modules/react-aria/dist/private/virtualizer/ScrollView.mjs:248-280`, `components/panel/SectionSplitStack.css:36-41`   |

### 2-4. 선택 구독자 인벤토리 (stores 밖 32 파일, `grep -rlE 'state\.selectedElementIds?|useDebouncedSelectedElementData\(|...'`)

| 군               | 파일 (대표)                                                                                                                      | 본 ADR 처리                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Navigator        | `LayersSection.tsx`, `NavigatorPanel.tsx`, `LayerTree.tsx`, `LayerTreeItemContent.tsx`, `FramesTab/*` (2)                        | **Phase 1~3** (FramesTab 은 scope 밖)                            |
| Properties       | `PropertiesPanel.tsx`, `CanvasSelectionShortcuts.tsx`, `components/property/*` (4)                                               | Phase 4 조건부                                                   |
| Styles           | `StylesPanel.tsx`, `styles/sections/*` (5), `styles/hooks/*` (3), `styles/components/*` (3)                                      | 155 Activity 가 숨김 시 차단 — 열림 시 비용은 G6 재측정으로 판정 |
| Canvas / overlay | `BuilderCanvas.tsx`, `skia/SkiaCanvas.tsx`, `overlay/index.tsx`, `ContextualActionBar.tsx`, `useCentralCanvasPointerHandlers.ts` | 대상 아님 (A/B "없음" 이 16.7 ms)                                |
| 기타             | `AIPanel.tsx`, `ComponentsPanel.tsx`, `InteractionsPanel.tsx`, `BuilderCore.tsx`, `services/*` (2), `commandMeta.ts`             | 대상 아님                                                        |

### 2-5. 착수 시 보강 (G0 — 코드 변경 전 1회)

- [x] **실 문서 root 수 — 확인 (2026-09-03, Chrome MCP, 사용자 프로젝트 "AAAA")**: 26 페이지 · 요소 98 · 현재 페이지 7 · `elements.filter(e => !e.parent_id)` = **1 (body)** → `treeNodes.length` 는 요소 수와 무관하게 1 이라 C1 이 사람이 만든 문서에서도 성립 (측정 Q1 충족). 당시 hidden 탭에서는 행 role/수 · `.layer-tree--virtualized` 유무를 읽지 못했으나, 바로 아래 전면 탭 기록에서 RAC 1.20 실 행이 `[role="row"]`임을 확정했다.
- [x] **현재 동작 체크리스트 — 기록 (2026-09-03, Chrome MCP 전면 탭 `visibilityState: visible`, 창 2699×1258 CSS px · DPR 1 · DevTools 미열림 = CPU throttle 없음, main 928058f2c)**. 프로젝트 "123" (대시보드 유일 — 이전 기록의 "AAAA" 는 목록에 없음), Pages 트리 25 행, **Components** 페이지 (body + 11 컨테이너 = 펼침 후 12 행, Form 펼침 시 15 행; Home 은 7 행). 실 DOM: RAC 1.20 `Tree` 는 `role="treegrid"` + 행 `role="row"` (`aria-label` / `aria-level` / `aria-posinset` / `aria-setsize` / `aria-selected` / `aria-expanded`, `data-key`, `data-level`) + 셀 `role="gridcell"` — ADR 의 `[role=treeitem]` 표기는 실 DOM 과 다르므로 이후 계측은 `[role="row"]` 로 센다. 초기 (body 접힘) 행 1, `.layer-tree--virtualized` 없음 (C1·C2 live 확정). 행 높이 28px (`.elementItem` min-height = `--control-size` = calc(1.5rem + 0.25rem)), 트리 `overflow: visible`, 스크롤 컨테이너 = `.section-content` (12 행에서 clientHeight 191 / scrollHeight 352).
  - 키보드: ↓↓ ListBoxItem → ListBox ✓ · ↑ ✓ · End → Card ✓ (section 스크롤 동반) · Home → body ✓ · typeahead `T` → Toolbar ✓.
  - 다중 선택 (실 포인터 클릭): ListBox 클릭 → shift+클릭 MenuItem → 선택 **[ListBox, MenuItem] 2 행** (구간 4 행이 아님 — 현재 값, 본 ADR 은 이 값을 대조군으로 쓴다) · meta+클릭 Form → 3 (토글 추가) · meta 재클릭 → 2 · 일반 클릭 → 1.
  - 캔버스 → 트리: 단일 클릭 → 최상위 MenuItem 선택 + 행 가시 ✓ · 더블 클릭 → 중첩 Text@3 선택, MenuItem 자동 펼침 ✓, **선택 행은 하단이 잘림** (row top 863 / box 684~875, scrollTop 81 유지) — 현재도 선택 행 자동 스크롤은 없다 (G3 대조군).
  - 우클릭 메뉴: `role=menu` 9 항목 (Copy · Paste · Duplicate · Bring to Front · Bring Forward · Send Backward · Send to Back · Detach component · Delete) ✓ · Escape 닫힘 ✓. 삭제 버튼: 선택 행 `.elementItemActions` 에 "Drag MenuItem" / "Delete MenuItem" ✓ (미실행).
  - DnD (실 포인터 드래그, HTML5 native): ① 형제 사이 — GridListItem → GridList 뒤 ✓ (Cmd+Z 복원 ✓) · ② 컨테이너 안으로 — Form 을 컨테이너에 "on" 드롭 → 자식으로 이동, 컨테이너 자동 펼침 없음 ✓ (Cmd+Z 복원 ✓) · ③ 무효 — Form → 자기 자식 TextField 위 드롭 → 순서 불변 ✓.
  - 패널 숨김 → 복원: `.section-content` scrollTop 120 → 헤더 × 숨김 → 좌측 레일 복원 → scrollTop **120** ✓ (C8 capture 리스너 경로 확인).

## §3 Phase 1 — 스파이크: RAC `Virtualizer` + `ListLayout` (G1)

목표: RAC Tree 를 그대로 두고 LayerTree에서만 창 렌더를 켠다. 공용 `TreeBase`는 변경하지 않고 LayerTree 결선 + 단일 scroll owner + fixed row 계약으로 범위를 닫는다.

| 파일                                       | 변경                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree/LayerTree/LayerTree.tsx`             | RAC `<TreeBase>` 경로만 `<Virtualizer layout={ListLayout} layoutOptions={{ rowSize: LAYER_TREE_ROW_SIZE_PX }}>`로 감싸고 TreeBase에 `className="layer-tree layer-tree--rac-virtualized"`를 준다. RAC에는 별도 overscan prop을 전달하지 않는다. Phase 1에서는 `>= 300` tanstack 분기를 유지한 뒤 Phase 2에서 제거 |
| `tree/LayerTree/virtualization.ts` (신규)  | `LAYER_TREE_ROW_SIZE_PX = 28`만 export. DOM query나 첫 render 뒤 상태 갱신 없이 ListLayout의 첫 layout부터 같은 숫자를 쓴다                                                                                                                                                                                      |
| `panels/navigator/NavigatorPanel.css`      | Layers section `.section-content`의 외부 overflow를 끄고 `.layer-tree--rac-virtualized`를 `flex: 1; min-height: 0`인 단일 scroll owner로 둔다. `.react-aria-TreeItem`과 `.elementItem`은 기존 `--control-size`를 유지하며 browser gate가 계산 높이 28px를 상수와 대조한다                                        |
| `panels/navigator/LayersSection.tsx`       | 구독/렌더 변경 없음. 실제 `data-section-id="navigator-layers"` 경계로 외부 scroll selector를 scope한다. 첫 render에서 RAC Tree의 clientHeight가 320px fixture 조건을 실제로 받는지 확인한다 (R5)                                                                                                                 |
| `tree/TreeBase/TreeBase.tsx`               | **변경 없음**. 공용 소비자 PageTree · FrameList · FrameElementTree까지 가상화가 확산되지 않도록 `Virtualizer`를 import/결선하지 않는다                                                                                                                                                                           |
| `tree/{PageTree,TreeBase}/`, `FramesTab/*` | 동작 변경 없음. G1에서 PageTree · FrameList · FrameElementTree의 RAC `TreeBase` 호출부가 wrapper 없이 유지되고 FrameElementTree의 기존 tanstack 조건 분기도 그대로임을 정적·browser 대조로 고정                                                                                                                  |

RED 먼저:

- [ ] browser vitest (`vitest.browser.config.ts`) `tree/LayerTree/LayerTree.virtualized.browser.test.tsx`: 600·5k 노드 (body 1 root + 나머지 자식, 펼침)를 각각 320px 높이로 렌더한다. `.layer-tree--rac-virtualized [role="row"]` idle 수는 `ceil((320 + 320/3) / 28) + focused/boundary 여유 2 = 18` 이하이고 두 규모의 차이는 1 이하(현재 코드는 600/5k → RED). settle 뒤 spy를 reset하고 `selectedKeys` 10회 변경 시 `renderContent` 증가량 ≤ 180.
- [ ] 같은 파일: `.react-aria-TreeItem`과 `.elementItem`의 계산 높이 === `LAYER_TREE_ROW_SIZE_PX`; `.section[data-section-id="navigator-layers"] > .section-content`는 스크롤하지 않고 `.layer-tree--rac-virtualized` 하나만 `overflow-y: auto`이며 clientHeight 320px.
- [ ] 정적 + browser 음성 대조: `TreeBase.tsx`의 `Virtualizer` 참조 0건, PageTree · FrameList · FrameElementTree의 RAC 호출부에는 wrapper가 없고 FrameElementTree의 기존 `VirtualizedTree` 조건 분기와 행 DOM/키보드/DnD 경로가 유지된다.

G1 측정 (Phase 1 종료 조건): `pnpm perf:baseline -- --lane frame --seed-count 600 --classes idle,select --duration-ms 3000` (both 패널, 기본값) 에서 select gap p50 ≤ 33 ms · 드롭 ≤ 5% · longtask 0, 그리고 `--seed-count 60` 에서 드롭 0. 결과 JSON 경로를 ADR Gates 에 기록.

실패 시: 대안 B (tanstack `VirtualizedTree` 총 행 수 기준 활성화) 를 **임시** 로 켜고 D1 debt (자체 `role="tree"` 유지) 를 ADR Risks 에 HIGH 로 등재.

## §4 Phase 2 — D1 parity + 정리 (G2 · G3)

- [ ] G2 (Chrome MCP, 실 builder): 가상화 전/후 같은 행의 `role` / `aria-selected` / `aria-expanded` / `aria-level` / `aria-posinset` / `aria-setsize` diff 0. 키보드 ↑↓ Home/End typeahead, shift/meta 다중 선택, 화면 밖 키보드 포커스 자동 스크롤, DnD 뒤 이동 행 포커스 유지. DnD 3 케이스 + drop indicator 위치.
- [ ] G3: 패널 숨김 전 `.layer-tree--rac-virtualized`의 첫 가시 row key + viewport top offset을 기록하고 복원 뒤 같은 key/offset(≤1px)을 확인한다. 캔버스 클릭은 조상 자동 펼침 + 선택 상태만 기준선과 동일하고, 선택 행 강제 자동 스크롤은 추가하지 않는다.
- [ ] `LayerTree.tsx` 의 `>= 300` 분기와 `VirtualizedTree` import 제거 (LayerTree 한정). `FramesTab` 은 손대지 않는다. `LayerTree.tsx:193` 의 `new Set(activeSelectedIds)` 는 `useMemo` 로 (가시 행만 재렌더돼도 Set 재생성은 불필요).
- [ ] `useFocusManagement` 의 `focusedKey` 가 가상화와 충돌하지 않는지 (화면 밖 키에 focus 요청 시 RAC `layoutDelegate` 경유 scrollIntoView).
- [ ] unit: `LayerTree.static.test.ts` — `VirtualizedTree` 참조 0건 가드 (FramesTab 제외).

## §5 Phase 3 — 규모 · 조건 재측정 + ratchet (G4)

- [ ] 5k 시드 1회를 **persistent** 프로젝트에 넣고 (`--project-url`) select p50 ≤ 50 ms. 시드 4분+ 이므로 격리 컨텍스트 재시드 금지 (메모리 `project-frame-drop-map-5k-baseline`).
- [ ] `--headed` 1회 (절대값) + 실 포인터 클릭 1회 (hit-test 경로 — 하니스 select 는 store 경로라 빠져 있다).
- [ ] 하니스: frame lane select 결과에 `.layer-tree--rac-virtualized [role="row"]` 수를 기록 (`RECORDER_SCRIPT` 종료 시 1회 `document.querySelectorAll` — Pages/Frames treegrid 행 혼입 방지). `[role="treeitem"]`은 RAC 1.20 실 DOM에 없으므로 사용 금지.
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

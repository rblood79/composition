# ADR-922 Phase 0: Panel workspace baseline

## 판정

**G0 PASS — 2026-08-18**

production panel state shape와 renderer는 v1을 유지한 채 다음 기준선을 고정했다.

- v1 schema와 직접 producer/consumer 20개 파일
- runtime에서 사용되지 않는 legacy host 3개와 barrel export
- Nodes, Properties, History, Settings, Monitor의 default/toggle/floating/snap/resize/refresh
- normal, compare, WebGL-off shell DOM 경로
- 양쪽 side anchor와 bottom panel이 열린 800x900 constrained viewport
- native-refresh 관측과 query-gated 5초 move/resize trace

이 문서는 Phase 1 이후 shadow/canary 결과와 비교할 oracle이다. 여기 기록된 현행 결함은
Phase 0에서 보정하지 않는다.

## 실행 환경

| 항목                 | 값                                                                   |
| -------------------- | -------------------------------------------------------------------- |
| 기준 commit          | `9c09585e174b29ec2ce4f0a698c122cde98ded70`                           |
| Builder              | `http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696` |
| WebGL-off 기준선     | `VITE_USE_WEBGL_CANVAS=false`, `http://127.0.0.1:5174`               |
| 기본 측정 viewport   | 초기 oracle 2579x1120/DPR 2, exact trace 2579x1064/DPR 1             |
| constrained viewport | 800x900                                                              |
| 브라우저             | authenticated Chrome session                                         |
| 상태 저장            | `composition-panel-layout` localStorage record                       |

5173 origin은 기존 사용자의 persisted layout을 유지한 채 refresh hydration을 검증했다.
5174 origin은 별도 localStorage를 사용하는 fresh default layout oracle로 사용했다.

## v1 state freeze

`PanelLayoutState`는 visibility, activity rail, placement, size를 다음 필드에 분산 저장한다.

| 필드                                                            | 현재 의미                            | 기본값                                |
| --------------------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `leftPanels` / `rightPanels` / `bottomPanels`                   | activity rail 순서와 side membership | left 6개, right 6개, bottom `monitor` |
| `activeLeftPanels` / `activeRightPanels` / `activeBottomPanels` | 활성 panel ID                        | `nodes`, `properties`, bottom 없음    |
| `showLeft` / `showRight` / `showBottom`                         | side 전역 표시 flag                  | true, true, false                     |
| `bottomHeight`                                                  | bottom anchored height               | 200                                   |
| `panelSizes`                                                    | panel별 마지막 width/height          | `{}`                                  |
| `modalPanels`                                                   | floating frame geometry와 z-index    | `[]`                                  |
| `panelClusters`                                                 | panel-relative column/stack 관계     | `[]`                                  |
| `nextModalZIndex`                                               | floating focus 순서 seed             | 1000                                  |

State owner는 Zustand `createPanelLayoutSlice`다. load 시 default merge와 field별 ad hoc
migration을 수행하고, 모든 mutation은 300ms debounce 후 같은 unversioned record에 쓴다.

## producer / consumer call graph

production source에서 `PanelLayoutState`, `usePanelLayout`, store field, runtime inset을 직접
참조하는 20개 파일을 freeze했다.

| 파일                                              | 분류                     | v1 역할                                                     |
| ------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `panels/core/types.ts`                            | schema owner             | state/action/default layout 계약                            |
| `stores/panelLayout.ts`                           | producer + persistence   | hydrate, migrate, set/reset, localStorage write             |
| `hooks/usePanelLayout.ts`                         | primary producer         | toggle/dock/float/place/snap/resize/fit action              |
| `panels/datatable/stores/dataTableEditorStore.ts` | direct producer          | `activeLeftPanels` 직접 갱신                                |
| `layout/PanelWorkspace.tsx`                       | host + producer/consumer | 13 frame mount, mode/geometry 계산, move/snap/resize commit |
| `components/overlay/CommandPalette.tsx`           | action consumer          | 대표 panel toggle                                           |
| `hooks/useGlobalKeyboardShortcuts.ts`             | action consumer          | Monitor bottom toggle                                       |
| `hooks/useActiveScope.ts`                         | state consumer           | active left/right panel로 focus scope 파생                  |
| `main/BuilderHeader.tsx`                          | action consumer          | Settings floating open                                      |
| `panels/styles/sections/TypographySection.tsx`    | action consumer          | Fonts panel toggle                                          |
| `workspace/utils/panelLayoutRuntime.ts`           | derived runtime          | show/active state + registered DOM width로 inset cache      |
| `workspace/scrollbar/CanvasScrollbar.tsx`         | runtime consumer         | scrollbar viewport에서 left/right inset 차감                |
| `workspace/hooks/useWorkspaceCanvasSizing.ts`     | runtime consumer         | panel toggle/ResizeObserver layout change 구독              |
| `workspace/canvas/skia/skiaOverlayHelpers.ts`     | runtime consumer         | right inspector width를 Skia overlay에 반영                 |
| `layout/PanelArea.tsx`                            | unused legacy host       | v1 side renderer 구현만 남음                                |
| `layout/BottomPanelArea.tsx`                      | unused legacy host       | v1 bottom renderer 구현만 남음                              |
| `layout/ModalPanelContainer.tsx`                  | unused legacy host       | v1 modal renderer 구현만 남음                               |
| `layout/index.ts`                                 | barrel only              | legacy host와 hook export; host runtime import 없음         |
| `hooks/index.ts`                                  | barrel only              | `usePanelLayout` export                                     |
| `stores/index.ts`                                 | store composition/export | slice 결합과 direct selector export                         |

`PanelArea`, `BottomPanelArea`, `ModalPanelContainer`는 정의와 barrel export 외 production
import가 0건이다. 제거는 rollback 경계인 G6까지 보류한다.

## 대표 panel 기준선

fresh WebGL-off origin의 default state에서 확인한 frame이다. registry의 13개 panel은 모두
`.panel-workspace` 아래 생성되고 inactive frame은 `data-mode="hidden"`과 `display:none`을
사용한다.

| Panel      | registry default           | fresh 활성 frame        | resize handle |
| ---------- | -------------------------- | ----------------------- | ------------- |
| Nodes      | left, min 233, height 520  | left anchored 233x520   | right/bottom  |
| Properties | right, min 233, height 520 | right anchored 233x520  | left/bottom   |
| History    | right, default 320x450     | right anchored 320x450  | left/bottom   |
| Settings   | left, default 400x500      | left anchored 400x500   | right/bottom  |
| Monitor    | bottom, default 600x240    | bottom anchored 600x200 | top           |

Monitor의 fresh height가 240이 아니라 200인 이유는 registry `defaultHeight`보다
`DEFAULT_PANEL_LAYOUT.bottomHeight`가 우선하기 때문이다.

### Toggle / floating / snap / resize / refresh

- 기존 5173 persisted layout에서 대표 5종을 모두 활성화해 frame 중복 없이 표시했다.
- History toggle off는 frame을 제거하지 않고 `data-active=false`, `display:none`, 0 rect로
  바꿨다. 재활성화 시 이전 292.72x615 geometry를 그대로 복원했다.
- History와 Properties를 panel-relative snap하면 정확히 4px gap의 2-column cluster가 됐다.
- History/Properties 인접 splitter drag 중 폭은 320/233에서 중간 312.33/240.66으로 동시에
  변했고, pointerup에는 280/273으로 저장됐다. 합산 폭은 보존됐다.
- Monitor는 placed floating frame에서 move/resize 후 같은 geometry로 복귀했다.
- refresh 뒤 History 280, Properties 273의 clustered placement와 Monitor 600x200 placement가
  다시 hydrate됐다.

## shell DOM 기준선

| 모드          | 현재 DOM 경로                                       | 기준선                                         |
| ------------- | --------------------------------------------------- | ---------------------------------------------- |
| normal WebGL  | `BuilderCore -> main.workspace -> canvas-container` | main 1개, overlay와 두 scrollbar 포함          |
| compare WebGL | `BuilderCore -> div.workspace--compare-mode`        | `main` 0개, left/right compare panel과 resizer |
| WebGL-off     | `BuilderCore -> main.workSpace -> iframe`           | `.workspace` 0개, `Workspace` wrapper 우회     |

세 모드는 아직 공통 actual main slot을 공유하지 않는다. 이것이 Phase 3/G3의 비교
기준이며 Phase 0에서는 구조를 바꾸지 않았다.

## constrained viewport 기준선

fresh layout에서 대표 5종을 열고 viewport를 800x900으로 줄였다.

- `.panel-workspace`: 800x852
- Properties: x=2290, right=2523
- History: x=1962, right=2282
- Monitor: x=989.5, right=1589.5, bottom=992
- WebGL-off `main.workSpace`: 1920x1080 유지

브라우저 document scroll overflow는 보고되지 않았지만 left/right/bottom frame이 viewport
밖에 남았다. v1에는 browser resize 시 anchor/cluster를 가용 bounds로 다시 푸는 공통
coordinator가 없다는 재현 증거다.

## native-refresh / interaction trace

### visible Monitor oracle

진단 코드를 붙이기 전 Realtime tab에서 idle은 121fps(Avg 121, Min 120, Max 121)였다.
121-point resize는 약 1121ms 동안 120fps, 541-point resize는 약 4583ms 동안
120fps(Avg 120, Min 119, Max 121), 541-point move는 약 4590ms 동안 같은 범위를
유지했다. 고정 60Hz가 아니라 약 8.26ms native cadence를 비교 기준으로 삼는다.

### query-gated exact trace

`?panelTrace=1`인 DEV route에만 rAF/pointer/solve/commit/long-task 진단을 mount했다. trace
수집 시 자동화 foreground tab cadence가 20ms(50Hz)로 낮아졌으므로, 이 수치는 위 120Hz
oracle을 대체하지 않고 event/solve/commit 상관관계를 고정하는 별도 계측으로 기록한다.

| 5초 trace | display period | rAF delivery            | pointer moves | solves | React frame commits         | long task |
| --------- | -------------- | ----------------------- | ------------- | ------ | --------------------------- | --------- |
| resize    | 20ms / 50Hz    | 250/250, missed 0, 100% | 224           | 221    | Monitor 221                 | 0         |
| move      | 20ms / 50Hz    | 250/250, missed 0, 100% | 250           | 250    | Monitor 250 + 다른 frame 12 | 0         |

move 중 다른 12 frame의 1회 commit은 `PanelSnapContext`의 dragged panel state를 구독하는
현행 구조에서 발생했다. `PanelWorkspaceContent` 자체 commit은 두 trace 모두 0이었다.
두 trace가 5초보다 긴 CUA drag의 중간에 종료돼 `interactionEndedAtMs`는 null이며, 이는
측정 구간 전체가 실제 pointer interaction 안에 있었음을 뜻한다.

진단 모듈은 `import.meta.env.DEV && panelTrace=1` 조건에서만 document listener,
PerformanceObserver, rAF를 생성한다. query가 없는 normal path에서는 즉시 no-op cleanup을
반환하며 persisted state와 frame geometry를 쓰지 않는다.

## G0 gate 결과

- [x] v1 schema와 producer/consumer/unused-host inventory
- [x] 대표 5-panel default/toggle/floating/snap/resize/refresh hydration
- [x] normal/compare/WebGL-off DOM 경로
- [x] 양쪽 side anchor + bottom이 열린 narrow viewport
- [x] native refresh oracle
- [x] 5초 move/resize의 pointer/solve/commit/long-task trace
- [x] production state shape 변경 0

Phase 1은 이 문서의 v1 oracle을 유지한 채 pure v2 schema/normalize/solve/migration과
rollback fixture만 추가해야 한다. production renderer와 primary v1 record는 G1 통과 전후
모두 그대로 유지한다.

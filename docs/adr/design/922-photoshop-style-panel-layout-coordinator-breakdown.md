# ADR-922 Design Breakdown: Photoshop식 패널 레이아웃 코디네이터 전환

## 1. 범위 확정

2026-08-18 사용자 확인으로 다음 전제를 잠근다.

1. **base / 응용 분류**: ADR-922는 ADR-035 전체의 응용 ADR이 아니다. ADR-035
   Phase 7의 panel inset/runtime 계약만 부분 대체하는 독립 후속 ADR이다.
2. **schema 직교성**: panel layout 저장 schema는 `CompositionDocument`, Canvas scene,
   component catalog schema와 직교한다. 교체 대상은 `PanelLayoutState`와 primary
   `composition-panel-layout` localStorage record 한 건이며, migration 동안 durable
   rollback backup record 한 건을 추가한다.
3. **선행 ADR 전제 reverse 검증**: ADR-035 Phase 2의 `ViewportController` SSOT와
   scrollbar direct-DOM update 계약은 유지한다. Phase 7의 등록 DOM +
   `ResizeObserver` inset 캐시만 coordinator-derived metrics로 대체한다.
4. **분리 판정**: 상태 model, coordinator, live resize, shell occupancy, Canvas-local sizing,
   persistence
   migration은 하나의 layout transaction 계약이다. 별도 ADR로 분리하지 않고 본
   breakdown의 Gate로 순차 반영한다.

### Domain 경계

- **D1 DOM/접근성**: panel grabber와 focusable splitter의 interaction/ARIA 계약.
  `useMove`와 React Aria hook을 우선하고, React Aria에 generic window splitter
  primitive가 없는 범위만 공유 `PanelSplitter` wrapper 한 곳에서 WAI-ARIA Window
  Splitter semantics를 제공한다. panel별 수동 ARIA 복제는 금지한다.
- **D2 Props/API**: public component prop 또는 RSP 호환 prop을 추가하지 않는다.
- **D3 시각 layout**: frame geometry, gap, rail 크기, column/stack 배치, workspace
  점유가 대상이다. 기존 Builder token과 panel config min/max를 유지한다.

### 범위 안

- 모든 등록 panel frame의 안정적인 mount 위치와 visibility lifecycle
- left/right/bottom/floating placement를 하나의 cluster graph로 표현
- panel-relative top/right/bottom/left snap
- column rail과 row splitter의 live adjacent resize
- 실제 rail/anchored cluster 기반 `occupiedInsets`의 shell-only 적용
- viewport 높이/너비 안으로 cluster fit
- normal/compare/WebGL-off가 공유하는 실제 main layout slot과 constrained viewport 정책
- localStorage v1 -> v2 migration, durable v1 backup, 구버전 rollback-safe validation
- 숨겨진 panel의 고비용 observer/timer/chart/data work 정지 계약
- Canvas scrollbar, Canvas sizing, Skia minimap의 실제 local content rect 전환

### 범위 밖

- 개별 panel의 `PanelHeader`, `Section`, content DOM/CSS 재설계
- panel 내부 기능, command palette, history snapshot 의미 변경
- `CompositionDocument`, component catalog, Preview/Publish schema 변경
- Photoshop custom element(`psw-*`, `ue-*`)의 복제
- cloud DB/Supabase persistence 도입
- Canvas renderer 또는 `ViewportController` 교체

## 2. 현재 구조 인벤토리

| 영역        | 현재 계약                                                                                        | 문제                                                                                 | ADR-922 목표                                                               |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| panel state | `left/right/bottomPanels`, `active*`, `show*`, `modalPanels`, `panelClusters`, `panelSizes` 혼합 | visibility, rail order, anchor, floating geometry가 중복 표현됨                      | visibility, rail order, placement graph를 분리한 v2 schema                 |
| panel host  | `PanelRegistry.getAllPanels()`를 `.panel-workspace`에서 모두 `PanelFrame`으로 생성               | 방향은 맞지만 frame mode 계산이 side 배열과 modal 목록에 의존                        | 모든 frame은 동일 host에 안정적으로 존재하고 snapshot 하나로 geometry 소비 |
| visibility  | React `Activity` + frame `display:none`                                                          | content 상태는 보존하지만 비활성 고비용 작업 정지 계약이 panel별로 다름              | frame visibility와 content activity/lifecycle을 공통 계약으로 결합         |
| snap        | visible frame DOM rect를 `querySelectorAll`/`getBoundingClientRect()`로 다시 수집                | pointer hot path에 강제 layout 위험, committed state와 visual state가 갈라짐         | coordinator snapshot geometry만으로 candidate 계산                         |
| resize      | frame local geometry + workspace local `resizePreviewLayout`                                     | source와 neighbor가 서로 다른 state surface를 읽을 수 있음                           | 하나의 interaction transaction이 변경 frame들을 같은 version으로 publish   |
| inset       | 숨겨진 `.panel-rail-measure-*`를 등록하고 `ResizeObserver`로 width cache                         | 실제 panel 점유와 별개의 측정 DOM, store toggle과 observer 완료 시점이 이원화        | visible rail + anchored cluster에서 순수 파생한 `occupiedInsets`           |
| main shell  | `.workspace`는 fixed이고 WebGL-off는 `BuilderCore`에서 `Workspace` wrapper를 우회                | normal/compare/fallback이 같은 Grid/Flex main track을 보장하지 못함                  | 세 모드가 동일한 actual main slot과 panel sibling을 공유                   |
| Canvas 소비 | 실제 canvas 영역 `containerSize`와 `measureWorkspacePanelInsets()`를 함께 사용                   | main을 실제 축소한 뒤 inset을 다시 차감하면 fit/scrollbar/minimap 좌표가 중복 축소됨 | shell은 inset 1회, Canvas는 실제 local rect만 소비                         |
| persistence | unversioned `composition-panel-layout`, field별 ad hoc migration                                 | 새로운 field가 누적되고 v2 write 뒤 구버전 reader가 default로 떨어질 수 있음         | versioned parse와 durable v1 backup을 갖는 one-way primary migration       |
| bottom      | `bottomPanels`, `showBottom`, `bottomHeight`, 별도 active 배열                                   | Monitor의 기본 위치와 panel subsystem이 결합                                         | Monitor는 일반 frame이고 `bottom`은 default anchor/placement               |

### 현재 코드 경로

- `apps/builder/src/builder/panels/core/types.ts`
- `apps/builder/src/builder/stores/panelLayout.ts`
- `apps/builder/src/builder/hooks/usePanelLayout.ts`
- `apps/builder/src/builder/hooks/useActiveScope.ts`
- `apps/builder/src/builder/panels/datatable/stores/dataTableEditorStore.ts`
- `apps/builder/src/builder/layout/PanelWorkspace.tsx`
- `apps/builder/src/builder/layout/PanelWorkspace.css`
- `apps/builder/src/builder/layout/panelSnap.ts`
- `apps/builder/src/builder/layout/panelStackLayout.ts`
- `apps/builder/src/builder/layout/PanelSnapContext.tsx`
- `apps/builder/src/builder/layout/PanelArea.tsx`
- `apps/builder/src/builder/layout/BottomPanelArea.tsx`
- `apps/builder/src/builder/layout/ModalPanelContainer.tsx`
- `apps/builder/src/builder/layout/index.ts`
- `apps/builder/src/builder/main/BuilderCore.tsx`
- `apps/builder/src/builder/workspace/Workspace.tsx`
- `apps/builder/src/builder/workspace/Workspace.css`
- `apps/builder/src/builder/workspace/components/WorkspaceCompareMode.tsx`
- `apps/builder/src/builder/workspace/utils/panelLayoutRuntime.ts`
- `apps/builder/src/builder/workspace/scrollbar/CanvasScrollbar.tsx`
- `apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.ts`
- `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.ts`

### Photoshop Online 관찰 기준선

2026-08-18 authenticated Photoshop Online에서 다음을 직접 관찰했다.

- `.doc-frame`의 실제 flex child가 toolbar, main content, panel container, taskbar를
  구성한다. panel container가 열리면 main content가 같은 layout pass에서 줄어든다.
- `psw-panel-container > ue-panel-dock > ue-panel-frame` 아래에 frame들이 안정적으로
  존재하며 비활성 frame은 `display:none`이다.
- `ue-panel-dock`은 `layout-type="floating"`, `col-limit="2"`, column min/max를
  가지며 frame의 absolute geometry와 splitter/rail을 소유한다.
- 활성 두 column은 4px gap으로 배치되고, 같은 column의 vertical stack도 4px
  gap을 가진다.
- row splitter drag에서 인접 두 frame geometry가 interaction 중 함께 바뀐다.
- stack 높이는 panel host 가용 높이를 넘지 않도록 clamp된다.
- grabber는 panel header와 분리되고, close action은 기존 header 안에 남는다.

참조 URL:

- https://photoshop.adobe.com/
- https://opensource.adobe.com/spectrum-web-components/components/split-view/
- https://react.dev/learn/preserving-and-resetting-state
- https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/

## 3. 목표 계약

### 3.1 DOM/layout ownership

```text
BuilderCore
└─ Builder workspace shell                # 실제 Grid/Flex track owner
   ├─ Workspace main slot                 # normal/compare/WebGL-off 공통 wrapper
   │  └─ Canvas mode content
   └─ PanelWorkspace                      # 모든 panel frame의 단일 host
      ├─ PanelActivityRail[left/right/bottom]
      └─ PanelLayoutHost
         ├─ PanelFrame*                   # registry 항목당 안정적인 frame 1개
         ├─ PanelSplitter*                # row/column 인접 관계에서 파생
         ├─ PanelResizeRail*              # cluster 외곽 resize
         └─ PanelSnapIndicatorLayer
```

- panel shell은 grabber, frame boundary, splitter/rail, geometry만 소유한다.
- 개별 panel은 기존 `PanelHeader`와 action/content DOM을 그대로 소유한다.
- frame은 `PanelRegistry` 항목당 정확히 하나만 생성한다.
- `BuilderCore`는 feature flag와 무관하게 동일한 workspace shell과 `Workspace` main slot을
  렌더링한다. normal/compare/WebGL-off는 main slot 내부 content만 바꾸며, direct
  `BuilderCanvas` sibling 경로를 두지 않는다. `PanelWorkspace`는 이 main slot의 sibling이다.
- workspace main content는 CSS Grid/Flex의 실제 layout child로 유지하고,
  coordinator snapshot의 left/right/bottom `occupiedInsets`를 같은 render
  transaction에서 track/inset으로 적용한다. panel이 main content 위를 덮은 뒤 사후
  translate하는 방식은 사용하지 않는다.
- `occupiedInsets`는 workspace shell 좌표계에서 정확히 한 번만 소비한다. Canvas의
  `containerSize`, fit, scrollbar world metrics, hit-test, minimap은 CSS layout 결과인 실제
  canvas-local rect를 사용하고 panel inset을 다시 빼지 않는다. compare 모드는 우측
  `canvasAreaRef`를 계속 실제 좌표계 기준으로 사용한다.
- `bottom`은 별도 renderer가 아니라 일반 cluster anchor다. Monitor는 일반 frame으로
  유지하되 default placement만 bottom이다.
- activity rail 위치와 panel placement는 독립이다. toggle button이 어느 rail에
  있는지는 panel의 현재 geometry를 결정하지 않는다.

### 3.2 persisted state

구체 타입명은 Phase 1에서 freeze하지만 의미 계약은 다음과 같다.

```ts
interface PanelWorkspaceLayoutV2 {
  version: 2;
  migrationSource?: { version: 1; migrationId: string };
  visibility: Partial<Record<PanelId, boolean>>;
  railOrder: Record<PanelRailSide, PanelId[]>;
  clusters: PanelClusterV2[];
  floatingFocusOrder: string[];
}

interface PanelClusterColumnV2 {
  id: string;
  width: number;
  rows: Array<{
    panelId: PanelId;
    height: number;
  }>;
}

type PanelClusterV2 =
  | {
      id: string;
      anchor: "left" | "right" | "bottom";
      columns: PanelClusterColumnV2[];
    }
  | {
      id: string;
      anchor: "floating";
      position: { x: number; y: number };
      columns: PanelClusterColumnV2[];
    };
```

불변식:

1. registry에 존재하는 panel만 저장한다.
2. `clusters`가 persisted placement와 size의 유일한 SSOT다. `PanelFrame` geometry는
   snapshot에서 파생하며 별도 persisted frame map을 두지 않는다.
3. visibility와 무관하게 모든 registry panel ID는 전체 cluster graph에서 정확히 한 번
   나타난다. 단일 panel도 1 column/1 row cluster로 표현한다.
4. 각 registry panel ID는 `railOrder` 전체에도 정확히 한 번 나타난다. rail side는
   activity button 위치일 뿐 cluster anchor를 변경하지 않는다.
5. `left`, `right`, `bottom` anchored cluster는 anchor별 최대 하나다. `floating` cluster는
   여러 개일 수 있고 `floatingFocusOrder`의 cluster ID 순서로 앞뒤를 결정한다.
6. side anchored cluster는 최대 2 column이며 각 row의 `height`가 panel 높이의 저장
   source다. column `width`가 해당 column panel 폭의 저장 source다.
7. floating cluster의 `position`만 workspace 좌표로 저장한다. anchored position은
   anchor와 inset 수식에서 파생하며 저장된 `position`을 사용하지 않는다.
8. normal viewport에서 모든 cluster는 panel min/max, 4px gap, workspace bounds 안으로
   normalize한다. constrained viewport의 derived presentation만 viewport fit을 위해 panel
   min보다 작아질 수 있으며 persisted preferred size는 변경하지 않는다.
9. `occupiedInsets`와 splitter 목록은 저장하지 않고 snapshot에서 파생한다.
10. `floatingFocusOrder`는 존재하는 floating cluster ID를 정확히 한 번 포함하며
    snapshot에서 cluster z-index를 파생한다.
11. v2 parse는 현재 registry를 입력으로 받아 removed/unknown ID를 제거하고, 기존 record에
    없는 known panel ID를 정확히 한 번 추가한다. 신규 known panel은 visibility `false`,
    `PanelConfig.defaultPosition` rail의 마지막 registry 순서로 추가하고, 같은 anchor
    cluster 첫 column의 마지막 hidden row로 배치한다. 해당 anchor cluster가 없으면
    1 column/1 row cluster를 생성한다. size는 현재 `defaultPanelSize`/
    `clampPanelSize` 규칙을 pure `resolvePanelDefaultSize`로 추출해 사용한다. 기존 known
    panel의 order/geometry는 보존한다. 이 registry-driven normalization은 app version이
    바뀐 v2 record에도 동일하게 적용한다.

anchor별 inset 수식은 다음으로 고정한다.

```text
sideClusterWidth = sum(column.width) + gap * (columnCount - 1)
left  = renderedLeftRailWidth  + (leftPresentation == anchored  ? gap + sideClusterWidth : 0)
right = renderedRightRailWidth + (rightPresentation == anchored ? gap + sideClusterWidth : 0)
bottom = renderedBottomRailHeight +
         (bottomPresentation == anchored ? gap + solvedBottomClusterHeight : 0)
mainContentRect = workspaceRect - { left, right, bottom }
```

normal viewport의 추가 제약은 다음과 같다.

```text
MIN_MAIN_CONTENT_WIDTH  = 320
MIN_MAIN_CONTENT_HEIGHT = 180
left + right + MIN_MAIN_CONTENT_WIDTH <= workspaceRect.width
bottom + MIN_MAIN_CONTENT_HEIGHT <= workspaceRect.height
```

- left/right demand가 width 제약을 넘으면 right anchor를 먼저 유지하고 left cluster를
  `constrained-overlay`로 전환한다. right 하나만으로도 제약을 넘으면 right도 overlay로
  전환한다. 이는 Properties/Styles authoring surface를 가능한 범위에서 우선 보존하는
  고정 순서이며 focus나 DOM 순서에 따라 달라지지 않는다.
- bottom demand가 height 제약을 넘으면 bottom cluster를 `constrained-overlay`로 전환한다.
- constrained overlay는 persisted anchor와 preferred row/column size를 바꾸지 않고
  `occupiedInsets`에 포함되지 않는다. frame geometry는 workspace 안으로 clamp하며,
  workspace 자체가 panel min보다 작을 때만 rendered width/height가 min 아래로 내려간다.
- 여러 constrained overlay가 동시에 생기면 back-to-front 순서는 bottom, left, right로
  고정하고 right를 최상단에 둔다. 이 순서는 snapshot z-index의 파생 입력이며 persisted
  `floatingFocusOrder`에 섞지 않는다.
- emergency clamp된 panel content는 공통 `min-width: 0`, `min-height: 0`, overflow 계약을
  사용한다. workspace가 다시 제약을 만족하면 같은 snapshot solve에서 원래 anchor와
  preferred size로 자동 복귀한다.
- `MIN_MAIN_CONTENT_*`보다 workspace 자체가 작은 경우 main rect는 rail을 제외한 가용
  크기까지 축소할 수 있지만 음수 width/height는 금지한다.

min/max 충돌 시 dragged boundary의 delta를 먼저 clamp하고, 같은 row/column의 인접 panel이
수용할 수 있는 delta까지만 전체 transaction을 적용한다. 남은 delta를 다른 panel이나
Canvas로 전파하지 않는다.

### 3.3 derived snapshot

```ts
interface PanelLayoutSnapshot {
  version: number;
  workspaceRect: { width: number; height: number };
  mainContentRect: { x: number; y: number; width: number; height: number };
  frameGeometries: ReadonlyMap<PanelId, PanelFrameGeometry>;
  occupiedInsets: {
    left: number;
    right: number;
    bottom: number;
  };
  splitters: readonly PanelSplitterGeometry[];
  visiblePanelIds: ReadonlySet<PanelId>;
}
```

`PanelFrameGeometry`는 `presentation: "anchored" | "floating" |
"constrained-overlay"`를 포함한다. `constrained-overlay`는 persisted anchor가 아니라 현재
workspace size에서 파생된 presentation이므로 store에 저장하지 않는다.

- committed Zustand layout과 workspace size를 입력으로 하는 순수 solver가 snapshot을
  만든다.
- actual workspace host의 `ResizeObserver`는 가용 viewport size만 제공할 수 있다.
  panel frame/숨겨진 measure DOM의 크기를 inset source로 사용하지 않는다.
- panel frame과 workspace shell은 같은 immutable snapshot version을 소비한다.
- shell은 snapshot의 `occupiedInsets`/`mainContentRect`를 실제 Grid/Flex track에 적용한다.
  `useWorkspaceCanvasSizing`은 그 결과로 생긴 actual canvas element를 관측해
  `{ shellLayoutVersion, width, height }`를 viewport store에 publish한다. Canvas-local
  consumer는 이 width/height를 쓰며 `occupiedInsets`를 직접 소비하지 않는다.
- normal mode는 main canvas element, compare mode는 우측 `canvasAreaRef`가 actual local
  rect의 source다. shell overlay에 남는 UI가 있으면 actual canvas rect를 shell 좌표로
  한 번 변환하며 panel inset을 별도로 더하거나 빼지 않는다.
- anchored cluster와 실제 rail만 `occupiedInsets`를 만든다. floating cluster는 Canvas
  위에 overlay되므로 inset에 포함하지 않는다.

### 3.4 interaction transaction

```text
pointer/keyboard start
  -> committed snapshot 고정
  -> transient session 생성
pointer move
  -> delta 누적
  -> requestAnimationFrame당 최대 1회 solve
  -> source + affected neighbors를 동일 snapshot version으로 publish
pointer end
  -> normalize/validate
  -> Zustand commit 1회
  -> persistence schedule 1회
pointer cancel/Escape
  -> committed snapshot 복원
```

- pointer hot path에서 DOM query나 frame별 `getBoundingClientRect()`를 호출하지 않는다.
- coordinator는 `getSnapshot()`/`subscribe()`를 가진 단일 immutable external snapshot
  store를 소유하고 RAF당 snapshot object를 최대 한 번 교체한다. frame/shell은
  `useSyncExternalStore` 기반 panel ID selector로 같은 published object를 읽는다.
  frame별 local geometry state, broad React tree state, 금지된 `useShallow` 패턴을
  도입하지 않는다.
- resize는 row splitter, column rail, cluster outer edge 모두 coordinator가 처리한다.
- row splitter delta는 source 증가량과 neighbor 감소량이 동일하고 각 panel min/max를
  동시에 만족해야 한다.
- cluster 전체 높이/너비는 workspace bounds와 gap을 포함해 clamp한다.

### 3.5 visibility와 고비용 work

- frame DOM과 panel local state는 visibility toggle 후에도 보존한다.
- hidden panel은 공통 `isPanelVisible`/Activity 경계를 통해 고비용 작업을 정지한다.
- 최소 정지 대상은 chart RAF, `ResizeObserver`, polling timer, memory/performance observer,
  network/data subscription이다.
- 단순 Zustand selector와 복구에 필요한 local form state는 유지할 수 있다.
- 다시 visible이 될 때 observer와 chart는 현재 frame width를 기준으로 재개한다.

### 3.6 accessibility

- move handle은 React Aria `useMove` 기반 키보드/포인터 이동을 유지한다.
- focusable splitter는 WAI-ARIA Window Splitter 계약에 따라 name, orientation,
  current/min/max value, controlled pane 관계를 노출한다.
- Arrow keys로 증감하고 Home/End로 min/max 이동한다. RTL column resize 방향도
  fixture로 고정한다.
- D1 속성은 공유 `PanelSplitter` 한 곳에서만 구성하며 panel별 수동 구현은 금지한다.
- pointer hit area와 focusable element는 같은 geometry owner를 사용한다.

## 4. 상태 모델과 마이그레이션

### 4.1 versioning

- primary key `composition-panel-layout`을 유지하되 root에 `version: 2`를 추가한다.
- backup key는 `composition-panel-layout.v1-backup`으로 고정하고
  다음 envelope를 저장한다.

```ts
interface PanelLayoutV1BackupEnvelope {
  sourceVersion: 1;
  migrationId: string;
  raw: string;
  state: "prepared" | "committed";
  updatedAt: string;
}
```

`migrationId`는 writer boundary의 injectable factory가 생성하며 production 구현은
`crypto.randomUUID()`를 사용한다. pure v1→v2 mapper는 ID 생성이나 storage write를 하지
않고 입력으로 받은 migrationId만 `migrationSource`에 복사한다.

- v1 parser와 v2 parser를 분리하고 `unknown` 입력을 validation 없이 cast하지 않는다.
- migration은 `parse v1 -> normalize IDs -> map -> fit -> validate v2` 순서의 순수
  함수로 작성한다.
- migration write protocol은 다음 순서를 지킨다.

  1. primary가 valid v1이면 현재 raw를 byte-equivalent source로 고정한다.
  2. backup이 없거나 `state: "prepared"`이고 `backup.raw !== primaryRaw`이면 새
     `migrationId`와 현재 raw로 backup을 prepare/refresh한다. 이 write 실패 시 primary를
     건드리지 않는다.
  3. prepared backup raw가 현재 primary v1과 byte-equivalent인지 다시 검증한 뒤 같은
     `migrationId`를 `migrationSource`에 기록한 validated v2를 primary에 쓴다.
  4. primary v2 write 성공 뒤 backup state만 `committed`로 잠근다. 이 마지막 write가
     실패해도 다음 load에서 valid primary v2와 prepared backup의 `migrationId` 일치를
     확인해 committed로 복구한다.
  5. primary가 v2인 동안 committed backup raw는 절대 덮어쓰지 않는다.

- primary v2 write 실패나 tab/process 종료가 2~4 사이에 발생하면 primary v1과 prepared
  backup을 유지한다. 이후 v1 UI에서 배치가 바뀌면 다음 migration 시 raw 불일치를 감지해
  새 migrationId와 최신 raw로 prepared backup을 갱신한다.
- Phase 1은 production renderer를 바꾸기 전에 v1 compatibility reader를 먼저 제공한다.
  이 reader는 primary가 v2이면 prepared/committed backup 중 validation된 raw v1을 읽는다.
  backup이 없는 valid v2-born record는 `projectV2ToLegacyView`로 visibility, rail side/order,
  anchored/floating membership, preferred size/position을 in-memory legacy view에 projection한다.
  이 adapter는 v1 primary를 쓰거나 dual-write하지 않으며 valid v2를 default layout으로
  떨어뜨리지 않는다.
- v2 production write가 시작되기 전 최소 rollback target은 이 reader가 포함된 Phase 1이다.
  v2-born write가 시작된 뒤 operational rollback target은 v2 schema를 직접 읽는 Phase 3
  이상으로 고정하고, Phase 1 projection은 emergency compatibility rehearsal에만 사용한다.
- backup과 v1 compatibility reader는 G6에서 자동 삭제하지 않는다. v2 production release,
  refresh, Phase 1 code rollback rehearsal을 통과한 뒤 별도 compatibility cleanup 승인으로
  제거한다.

### 4.2 v1 -> v2 mapping

| v1                                                   | v2                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `leftPanels/rightPanels/bottomPanels`                | `railOrder`의 초기 순서 + registry metadata                      |
| `active*Panels` + `show*`                            | `visibility`                                                     |
| side list에 있으나 `modalPanels`에 없는 active panel | 해당 side/bottom anchored cluster                                |
| `modalPanels.position/size/zIndex`                   | floating cluster position/row/column size + `floatingFocusOrder` |
| `panelClusters`                                      | normalized cluster column/row membership                         |
| `panelSizes`                                         | 해당 cluster row/column size의 migration fallback                |
| `bottomHeight`                                       | bottom anchored Monitor preferred height                         |
| `nextModalZIndex`                                    | 폐기; stable `floatingFocusOrder`로 정규화                       |

### 4.3 BC 수식화

- localStorage key가 있는 사용자 **100%**가 migration 함수를 한 번 통과한다.
- canonical project/DB 재직렬화 파일은 **0개**다.
- primary 변환 대상은 브라우저별 localStorage record **1개**이고 durable backup record를
  최대 **1개** 추가한다. canonical project/DB record는 늘지 않는다.
- invalid primary는 valid backup을 먼저 복원하고, 둘 다 invalid일 때만 default layout으로
  fallback한다. 원본 raw와 backup을 즉시 삭제하지 않는다.
- v1 fixture는 최소 default, left/right multi-active, Monitor bottom active, floating only,
  snapped two-column, invalid/removed panel ID의 6종을 고정한다.
- write failure fixture는 backup 성공 뒤 primary quota 실패, primary 성공 뒤 committed mark
  실패, prepared 이후 v1 raw 변경의 3종을 고정한다. 세 경우 모두 최신 valid v1 raw가
  old-code reader에서 복원돼야 한다.
- registry evolution fixture는 이전 v2 record에 신규 known panel 추가, removed panel 제거,
  add/remove 뒤 refresh의 3종을 고정한다. 기존 known panel geometry/order는 byte-equivalent로
  보존한다.
- backup 없는 v2-born fixture는 Phase 3 rollback에서 byte-equivalent 복원되고, Phase 1
  emergency projection에서도 panel ID/visibility/rail/anchor/floating/size 손실과 default
  fallback이 0이어야 한다.

## 5. 구현 단계

### Phase 0 — Baseline과 inventory freeze

- 현재 v1 schema와 모든 producer/consumer를 grep 기반으로 freeze한다.
- 최소 명시 소비자는 `usePanelLayout`, `useActiveScope`, DataTable editor panel activation,
  `PanelWorkspace`, scrollbar/minimap runtime이다. unused host는 `PanelArea`,
  `BottomPanelArea`, `ModalPanelContainer`, `layout/index.ts` export까지 call graph를 기록한다.
- representative panel 5종(Nodes, Properties, History, Settings, Monitor)의 default,
  toggle, floating, snap, resize, refresh hydration을 녹화한다.
- normal, compare, WebGL-off의 `BuilderCore -> Workspace main slot -> Canvas content` DOM 경로와
  양쪽 side anchor + bottom이 열린 narrow viewport를 baseline으로 기록한다.
- 60/120Hz 이상 가능한 장치에서 5초 move/resize trace를 수집하고 display refresh
  interval, pointer event 수, layout solve 수, React commit 수, long task를 기록한다.
- G0 통과 전에는 production state shape를 바꾸지 않는다.

#### 실행 기록 — G0 PASS (2026-08-18)

- [Phase 0 panel workspace baseline](./922-phase-0-panel-workspace-baseline.md)에 v1
  producer/consumer 20개 파일, unused legacy host, 대표 5-panel flow, 세 shell DOM 경로,
  constrained viewport와 native-refresh/5초 interaction trace를 고정했다.
- DEV query-gated 진단 외 production state shape와 renderer 변경은 0건이다.
- Phase 1은 별도 HIGH-risk 승인과 G1 검증 전까지 시작하지 않는다.

### Phase 1 — v2 model, solver, migration

- exact v2 cluster placement schema, anchor cardinality, inset/min-max/constrained-overlay 수식을
  freeze하고 순수 normalize/solve/migrate 함수를 추가한다.
- registry ID uniqueness, cluster membership uniqueness, size/bounds, max 2 column, gap,
  occupied inset, registry app-version evolution fixture를 작성한다.
- exact raw와 migrationId prepared/committed 상태를 가진 durable v1 backup writer와
  v2-primary-aware v1 compatibility reader를 먼저 추가하고 crash/quota sequence를
  검증하지만 UI는 아직 v1 renderer를 사용한다.
- G1 통과는 Phase 2 shadow model만 해제한다. production live store와 primary record는
  Phase 3 cutover 전까지 v1을 유지한다.

#### 실행 기록 — G1 PASS (2026-08-18)

- [Phase 1 model/migration evidence](./922-phase-1-model-migration-evidence.md)에 exact v2
  schema, registry normalization, constrained solver, 6종 migration, crash/quota/refresh
  backup sequence와 v2-born compatibility projection을 고정했다.
- 신규 모듈은 production store/renderer에서 import하지 않는다. live store와 primary
  `composition-panel-layout` record는 v1을 유지한다.
- Phase 2는 별도 승인과 G2a 검증 전까지 시작하지 않는다.

### Phase 2 — Layout Coordinator shadow snapshot

- workspace size + v2 layout으로 snapshot을 계산하는 coordinator를 추가한다.
- single immutable external snapshot store와 `useSyncExternalStore` selector를 추가한다.
- 현행 frame geometry와 shadow snapshot을 representative layout에서 비교한다.
- mismatch는 allowlist로 덮지 않고 model 또는 migration에서 해소한다.
- DOM query 없이 snapshot geometry로 candidate를 계산하는 pure interaction adapter를
  추가하고 현행 DOM candidate 결과와 trace에서 비교한다. Phase 2에서는 production
  pointer handler를 이 adapter로 교체하지 않는다.
- G2a는 pure solver/external store와 shadow geometry만 판정한다. 아직 실제 frame visual
  latency 또는 tearing을 통과했다고 간주하지 않는다.

#### 실행 기록 — G2a PASS (2026-08-18)

- [Phase 2 layout coordinator shadow evidence](./922-phase-2-layout-coordinator-evidence.md)에
  immutable snapshot, row/column splitter, `useSyncExternalStore` selector, RAF당 solve/publish
  1회와 DOM-query-free candidate를 고정했다.
- 대표 v1 5-panel geometry를 allowlist 없이 비교해 mismatch 0을 만들었고, 그 과정에서
  active side order/right-edge order와 hidden min-width 영향을 migration/normalization에서
  해소했다.
- production `PanelWorkspace`, pointer handler, live store와 primary record는 v1을 유지한다.
  G2b real-frame canary와 applied-version/native-refresh 검증은 Phase 3 별도 승인 전까지
  시작하지 않는다.

### Phase 3 — real-frame canary와 PanelWorkspace/interaction cutover

- G2a 통과 뒤 v1 primary를 바꾸지 않는 임시 canary route에서 representative stack의 기존
  `PanelFrame`/splitter를 in-memory v2 shadow snapshot consumer로 exclusive 전환한다. 같은
  panel의 v1/v2 frame을 두 개 mount하지 않으며 registry panel당 DOM frame 1개 불변식을
  유지한다. canary frame은 applied `data-layout-version`과 geometry style을 기록하며 장기
  dual renderer가 아니라 G2b 측정용 feature-gated 경로다.
- canary route의 pointer handler만 pure snapshot candidate adapter를 사용하고 DOM frame
  geometry query가 0인지 검증한다. non-canary production route는 G2b 통과 전까지 기존
  handler를 유지한다.
- G2b에서 source/neighbor의 applied DOM version 일치, input-to-applied-frame latency와
  native frame delivery를 통과한 뒤 canary gate를 제거하고 전체 frame consumer를
  coordinator로 전환한다.
- 현재 raw와 byte-equivalent이고 migrationId가 고정된 prepared backup write 성공을 선행
  조건으로 live store hydration과 primary record를 v2로 전환하고, 성공 뒤 backup을
  committed로 잠근다.
- 모든 `PanelFrame`이 snapshot geometry와 visibility를 소비하도록 전환한다.
- move, detach, top/right/bottom/left snap을 transaction으로 통합한다.
- row splitter/column rail/outer edge resize가 affected frame을 같은 version으로
  publish하도록 한다.
- Monitor bottom anchor와 viewport height clamp를 포함한다.
- G2b 통과 전에는 기존 resize commit path를 삭제하거나 primary v2를 write하지 않는다.

#### 실행 기록 — G2b PASS / Phase 3 cutover (2026-08-18)

- [Phase 3 real-frame production cutover evidence](./922-phase-3-real-frame-cutover-evidence.md)에
  exclusive canary의 applied version/native-refresh 결과와 production cutover 경계를 기록했다.
- canary는 registry panel당 frame 1개를 유지한 채 통과했으며, 통과 뒤 query gate와 canary
  controller를 제거했다. production `PanelWorkspace`의 모든 frame과 resize handle은 동일한
  coordinator snapshot version을 소비한다.
- live Zustand SSOT와 `composition-panel-layout` primary는 durable v1 backup protocol 뒤
  v2로 전환됐다. legacy `PanelLayoutState`는 Phase 6 unused host 제거 전 read-only projection만
  유지한다.
- `.panel-rail-measure-*`, `panelLayoutRuntime`, Canvas inset consumer는 Phase 4 rollback
  경계이므로 이번 phase에서 제거하지 않았다.

### Phase 4 — 실제 workspace occupancy와 Canvas consumer cutover

- `BuilderCore`가 실제 workspace Grid/Flex shell을 소유하고 `Workspace` wrapper를
  normal/compare/WebGL-off 모두에 항상 렌더링하도록 전환한다. feature flag는 main slot
  내부 Canvas content만 선택하며 `PanelWorkspace`는 main slot의 sibling으로 유지한다.
- visible activity rail과 anchored cluster에서 `occupiedInsets`를 파생한다.
- shell만 `occupiedInsets`를 Grid/Flex track에 적용한다. `useWorkspaceCanvasSizing`은 actual
  local canvas rect를 관측하고, `CanvasScrollbar`와 Skia minimap은 panel inset을 재차
  차감하지 않는 Canvas-local metrics로 전환한다.
- normal/compare/WebGL-off 각각에서 shell layout version과 actual canvas rect publication을
  검증한다. 양쪽 side anchor와 bottom demand가 main reservation을 넘을 때 constrained
  overlay, non-negative main rect, viewport fit, 확장 후 anchor 자동 복귀도 검증한다.
- `.panel-rail-measure-*`, `registerPanelElement`, DOM width cache를 제거한다.
- G3에서 toggle/resize 중 shell layout version에 대응하는 actual canvas rect mismatch와
  panel inset 이중 차감이 0인지 확인한다.

#### 실행 기록 — G3 PASS / Phase 4 cutover (2026-08-18)

- [Phase 4 workspace occupancy/Canvas-local evidence](./922-phase-4-workspace-occupancy-evidence.md)에
  공통 main slot, anchored/floating/constrained viewport, normal/compare/WebGL-off와
  scrollbar/minimap/hit-test 소비 경계를 기록했다.
- `PanelWorkspace` host가 coordinator snapshot의 `occupiedInsets`를 Grid track에 한 번
  적용한다. frame overlay와 main content는 같은 host-local 좌표계와 layout version을 쓴다.
- `BuilderCore`의 WebGL-off 우회 경로를 제거하고 renderer mode는 단일 `Workspace` 내부
  content만 선택한다. compare의 Skia pane은 그 안의 실제 local rect를 계속 관측한다.
- `.panel-rail-measure-*`, `registerPanelElement`와 Canvas consumer의
  `panelLayoutRuntime` import를 제거했다. runtime 파일과 legacy host 자체 삭제는 Phase 6
  call-graph cleanup 범위로 유지한다.

### Phase 5 — visibility lifecycle와 접근성

- React `Activity`가 이미 처리하는 Effect cleanup과 별도로, Activity 밖에서 생성되거나
  수동 수명주기를 가진 observer/DOM callback만 inventory한다. 필요한 고비용 hook에만
  공통 panel visibility context를 연결한다.
- Monitor chart/observer/timer를 대표 fixture로 삼고 다른 panel observer를 inventory한다.
- shared `PanelSplitter`의 pointer/keyboard/ARIA contract test를 추가한다.
- panel header/action/content DOM이 변하지 않았음을 static/component/browser로 고정한다.

### Phase 6 — legacy 제거와 최종 전환

- v1 state field와 compatibility action/method 이름을 제거한다.
- `panelLayoutRuntime.ts`, unused `PanelArea`, `BottomPanelArea`, `ModalPanelContainer`, 관련
  CSS/export, empty bottom rail DOM을 call graph 확인 후 제거한다. bottom placement 기능과
  Monitor default는 유지한다.
- v1 parser는 정의한 compatibility window가 끝나기 전까지 read-only boundary로만
  유지한다.
- G0, G1, G2a, G2b, G3~G5 evidence와 rollback rehearsal이 모두 통과하면 ADR 상태 승격
  후보가 된다.

## 6. 변경 파일 경계

| 영역            | 예상 파일                                                                                                                     | 변경 원칙                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| model/types     | `panels/core/types.ts`, 신규 `layout/panelWorkspaceLayout*.ts`                                                                | single placement graph v2 type와 pure solver를 UI에서 분리                           |
| store/migration | `stores/panelLayout.ts`, store tests                                                                                          | versioned parser, validated one-way migration, commit 1회                            |
| actions         | `hooks/usePanelLayout.ts`, `hooks/useActiveScope.ts`, DataTable editor store                                                  | side-specific mutation과 legacy active-array consumer를 v2 command/visibility로 전환 |
| panel host      | `layout/PanelWorkspace.tsx`, `PanelWorkspace.css`                                                                             | registry frame 안정 mount, snapshot selector, real rail/host geometry                |
| main shell      | `main/BuilderCore.tsx`, `workspace/Workspace.tsx`, `workspace/Workspace.css`, `workspace/components/WorkspaceCompareMode.tsx` | 세 Canvas 모드가 공유하는 실제 Grid/Flex main slot과 panel sibling ownership         |
| interaction     | `panelSnap.ts`, `panelStackLayout.ts`, `PanelSnapContext.tsx`                                                                 | DOM geometry 제거, transaction solver로 흡수/축소                                    |
| Canvas metrics  | `workspace/utils/panelLayoutRuntime.ts`, `CanvasScrollbar.tsx`, `useWorkspaceCanvasSizing.ts`, `skiaOverlayHelpers.ts`        | shell inset과 Canvas-local actual rect 분리, inset 이중 적용 제거                    |
| lifecycle       | Monitor chart/observer hooks와 발견된 고비용 panel hooks                                                                      | visibility false에서 work stop, state preservation                                   |
| legacy          | `PanelArea.tsx`, `BottomPanelArea.tsx`, `ModalPanelContainer.tsx`, 관련 CSS, `layout/index.ts`                                | call graph 0 확인 후 unused host/export만 제거; bottom placement 유지                |
| docs            | ADR-922, breakdown, README, 구현 완료 시 `docs/CHANGELOG.md`                                                                  | Proposed 생성 시 README만, 사용자 가시 cutover 시 CHANGELOG                          |

예상 production 변경은 약 20~26파일이다. Phase 0 inventory가 39파일 이상으로
증가하면(상한 대비 1.5배) scope inflation 규칙에 따라 design을 다시 freeze한다.

## 7. 검증 계획

### 7.1 unit/property fixtures

- v1 -> v2 migration 6종 및 idempotent v2 parse
- exact raw + migrationId prepared/committed backup, 두 write 사이 crash/quota, v1 변경 후
  prepared refresh, v2 primary refresh, Phase 1 v1 compatibility reader rollback
- backup 없는 v2-born primary의 Phase 3 byte-equivalent rollback과 Phase 1 read-only legacy
  projection(default fallback 0)
- unknown/removed/duplicate panel ID 제거와 기존 v2에 신규 known panel ID default 추가
- panel placement 정확히 1회, anchor별 cluster cardinality, row height/column width 보존
- cluster max 2 column, 4px gap, min/max size, viewport fit과 anchor별 inset 수식
- 800px viewport에서 DataTable Editor left + Properties right + 양 rail 조합의 left
  constrained-overlay, main width non-negative, 확장 후 persisted anchor/size 자동 복귀
- bottom demand가 180px main reservation을 침범할 때 constrained-overlay와 viewport height fit
- top/right/bottom/left snap insertion과 detach
- paired resize delta 보존 및 neighbor min/max clamp
- visible anchored cluster만 occupied inset에 반영
- hidden panel이 cluster order/last geometry를 잃지 않음
- interaction cancel 후 committed snapshot byte-equivalent 복원
- single publish에서 source/neighbor/shell snapshot object identity와 version 일치
- shell inset 적용 1회, Canvas-local visible width/height에서 panel inset 차감 0회

### 7.2 static/component tests

- 모든 `PanelRegistry` config가 `.panel-workspace` 아래 frame 1개를 가짐
- `.panel-rail-measure`와 `panelLayoutRuntime` import 0건
- `useActiveScope`와 DataTable editor의 legacy `active*Panels` 접근 0건
- panel shell이 `PanelHeader`/close action을 복제하지 않음
- bottom은 placement로 존재하되 별도 panel renderer를 만들지 않음
- resize handle이 shared splitter primitive를 사용
- hidden Activity에서 content state 보존
- `BuilderCore`가 normal/compare/WebGL-off 모두에서 같은 `Workspace` main wrapper를 렌더링하고
  direct `BuilderCanvas` sibling 경로를 만들지 않음
- applied frame/splitter에 같은 `data-layout-version`이 기록됨

### 7.3 browser flow

1. default layout에서 Nodes/Properties 표시와 shell inset 1회 적용 확인
2. History/Settings toggle 왕복 후 scroll/form state 유지
3. 패널을 다른 패널 상/하/좌/우에 snap하고 다시 detach
4. 두 column + vertical stack 생성 후 전체 viewport bounds 확인
5. row/column splitter drag 중 인접 panel 동시 resize 확인
6. browser resize 중 stack reflow, 320x180 main reservation, constrained overlay와 원래 anchor
   자동 복귀 확인
7. Monitor bottom anchor toggle/resize와 chart text 비왜곡 확인
8. refresh 후 visibility/cluster/size/floating focus order 복원
9. normal/compare/WebGL-off 모드에서 fit 중심, hit-test, horizontal/vertical scrollbar,
   minimap offset 확인
10. panel toggle/resize 직후 Canvas width/height가 실제 local rect와 일치하고 inset이 중복
    차감되지 않는지 확인
11. DataTable editor 자동 표시와 panel shortcut scope 확인
12. keyboard move/splitter Arrow/Home/End/focus-visible/label 확인
13. 800px 이하에서 DataTable Editor left + Properties right + bottom Monitor를 동시에 열어
    main rect 음수 0, panel viewport overflow 0, persisted placement mutation 0 확인

### 7.4 performance gate 측정

- interaction 전 idle RAF 2초의 중앙값으로 `displayPeriod`를 측정하고 60Hz를 고정 목표로
  사용하지 않는다.
- pointer event는 RAF당 최대 한 solve/publish transaction으로 합친다.
- G2a shadow store는 publish transaction과 geometry 결과만 측정한다. G2b canary와 production
  trace에서는 source, neighbor, splitter의 applied `data-layout-version` 불일치 frame이
  0건이어야 한다.
- `expectedPeriods = floor(activeDuration / displayPeriod)`로 두고 각 visual RAF interval의
  `max(0, round(delta / displayPeriod) - 1)` 합을 `missedPeriods`로 기록한다.
  `frameDelivery = 1 - missedPeriods / expectedPeriods`이며 baseline 대비 저하가 5
  percentage point를 넘으면 실패다.
- pointer input timestamp부터 affected frame 모두의 geometry style과
  `data-layout-version`이 commit된 뒤 처음 도달하는 presentation RAF까지를
  `inputToAppliedFrame`으로 기록한다. p95는 `2 * displayPeriod` 이하여야 하며 store
  publish timestamp나 snapshot을 읽기만 한 RAF를 종점으로 사용하지 않는다. 5초 연속
  move/resize에서 panel interaction에 기인한 50ms 이상 long task는 0건이어야 한다.
- per-move localStorage write는 0건, successful end commit/write schedule은 각각 1건이다.
- hidden Monitor에서 chart RAF/ResizeObserver/polling callback은 0회여야 한다.

### 7.5 명령 gate

- 변경 모듈 인접 Vitest
- `pnpm run codex:guard`
- `pnpm run codex:typecheck`
- `git diff --check`
- `pnpm run codex:preflight`
- populated authenticated Builder browser smoke

## 8. 롤백 계획

- Phase 1~2는 production renderer를 바꾸지 않아 이전 UI로 즉시 돌아갈 수 있다.
- Phase 3~4 cutover는 commit 경계를 분리하되 한 phase 안에서 v1/v2를 장기 dual-write하지
  않는다.
- Phase 1에서 v1 compatibility reader, `projectV2ToLegacyView`, prepared/committed backup
  protocol을 renderer보다 먼저 land한다. v2 production write 전에는 해당 commit이 최소
  code rollback target이다.
- 최초 v2 primary write 전에 현재 v1 raw와 prepared backup의 byte-equivalent 일치를 확인한다.
  primary v1인 동안 raw가 바뀌면 prepared backup을 갱신하고, v2 primary 성공 뒤에만
  committed로 잠근다. persisted v2 -> v1 역변환은 구현하지 않고 Phase 1 reader가 backup
  raw 또는 read-only legacy projection을 hydrate한다.
- backup prepare 뒤 primary 실패, primary 성공 뒤 committed mark 실패, prepared 이후 v1
  변경을 각각 강제한 rollback rehearsal에서 최신 valid v1 raw가 복원돼야 한다.
- migrated-v1은 브라우저 refresh 뒤 v2 primary를 남긴 채 Phase 1 build에서 exact backup을
  복원한다. backup 없는 v2-born layout은 Phase 3 operational rollback에서 byte-equivalent로
  복원하고 Phase 1 emergency projection에서도 default fallback이나 panel ID/visibility/
  placement 손실을 허용하지 않는다. v2 write 시작 뒤 일반 rollback target은 Phase 3
  이상이다.
- G3 실패 시 panel frame cutover는 유지할 수 있지만 Canvas metrics는 이전 DOM cache로
  부분 되돌리지 않는다. Phase 3까지 전체 rollback하거나 metrics 문제를 해결한다.
  hybrid inset contract를 릴리스 상태로 남기지 않는다.
- legacy host 제거는 모든 Gate와 rollback rehearsal 후 마지막에 수행한다. backup과 v1
  compatibility reader 제거는 G6에 포함하지 않고 별도 승인된 cleanup으로 남긴다.

## 9. 완료 체크리스트

- [x] Phase 0 inventory와 native-refresh baseline이 기록됐다.
- [x] exact v2 single cluster placement/anchor/inset 수식이 freeze됐다.
- [x] 320x180 main reservation, constrained overlay, narrow viewport 자동 anchor 복귀 수식이
      freeze됐다.
- [x] exact raw + migrationId prepared/committed backup 1건의
      crash/quota/refresh/old-code rollback fixture가
      통과했다.
- [x] v2 registry add/remove normalization이 기존 known panel geometry를 보존한다.
- [x] backup 없는 v2-born layout이 Phase 1 emergency projection에서 default로 떨어지지
      않는다.
- [x] backup 없는 v2-born layout의 Phase 3 operational rollback이 byte-equivalent다.
- [x] G2a shadow frame/splitter가 하나의 immutable snapshot version을 사용한다.
- [x] G2a pure candidate의 panel DOM geometry query와 대표 shadow mismatch가 0이다.
- [x] frame/shell이 같은 immutable snapshot을 쓰고 Canvas는 actual local rect만 쓴다.
- [x] G2a shadow store가 통과했다.
- [x] G2b real-frame applied-version/native-refresh gate가 통과했다.
- [x] normal/compare/WebGL-off가 동일한 `Workspace` main slot과 panel sibling을 사용한다.
- [x] move/snap/resize hot path에 panel DOM geometry query가 없다.
- [x] 인접 panel은 drag 중 동시에 resize된다.
- [x] 세로 stack은 workspace 높이를 넘지 않는다.
- [x] Monitor bottom placement와 toggle/persistence가 유지된다.
- [ ] hidden panel의 고비용 work가 중단되고 local state는 보존된다.
- [ ] splitter pointer/keyboard/screen reader 계약이 검증됐다.
- [x] `.panel-rail-measure-*`와 `panelLayoutRuntime` production 소비가 제거됐다.
- [ ] `useActiveScope`/DataTable activation이 v2로 전환되고 기존 side/mode compatibility
      state와 unused legacy host/export가 최종 phase에서 제거됐다.
- [ ] focused tests, type-check, preflight, populated browser smoke가 통과했다.
- [ ] 사용자 가시 cutover가 `docs/CHANGELOG.md`에 기록됐다.

# ADR-922: Photoshop식 패널 레이아웃 코디네이터 전환

## Status

Implemented — 2026-08-18

진행: Phase 0 / G0 PASS — [panel workspace baseline](../design/922-phase-0-panel-workspace-baseline.md),
Phase 1 / G1 PASS — [v2 model/migration evidence](../design/922-phase-1-model-migration-evidence.md),
Phase 2 / G2a PASS — [layout coordinator shadow evidence](../design/922-phase-2-layout-coordinator-evidence.md),
Phase 3 / G2b PASS — [real-frame production cutover evidence](../design/922-phase-3-real-frame-cutover-evidence.md),
Phase 4 / G3 PASS — [workspace occupancy/Canvas-local evidence](../design/922-phase-4-workspace-occupancy-evidence.md),
Phase 5 / G4·G5 PASS — [visibility/accessibility evidence](../design/922-phase-5-visibility-accessibility-evidence.md),
Phase 6 / G6 PASS — [legacy removal/final cutover evidence](../design/922-phase-6-legacy-removal-evidence.md).
Production frame, interaction, live store와 primary persisted state는 v2 coordinator로 전환됐다.
workspace occupancy, Canvas-local consumer, hidden lifecycle, splitter 접근성, legacy host/state
제거와 rollback rehearsal까지 완료했다. v1 parser와 durable backup은 정의된 compatibility
window 동안 read-only boundary로 유지한다.

## Context

Composition Builder의 panel workspace는 최근 모든 등록 panel을
`.panel-workspace` 아래 `PanelFrame`으로 생성하고, panel-relative snap과
column/stack resize를 추가했다. 이 방향은 Photoshop Online의 단일 panel layout
host와 가깝지만, state와 Canvas layout 계약에는 viewport dock 시대의 구조가 남아
있다.

- `PanelLayoutState`가 `left/right/bottomPanels`, `active*Panels`, `show*`,
  `modalPanels`, `panelClusters`, `panelSizes`로 visibility, activity rail order,
  anchored placement, floating geometry를 중복 표현한다.
- `PanelWorkspace.tsx`는 숨겨진 `.panel-rail-measure-left/right`를 별도로 생성해
  실제 panel frame이 아닌 고정 rail 폭을 등록한다.
- ADR-035 Phase 7에서 도입한 `panelLayoutRuntime.ts`는 등록 DOM의
  `ResizeObserver` cache와 Zustand toggle을 결합해 inset을 산출한다.
- `CanvasScrollbar.tsx`, `useWorkspaceCanvasSizing.ts`,
  `skiaOverlayHelpers.ts`가 이 DOM-derived runtime을 직접 소비한다.
- `.workspace`는 현재 `position: fixed`이고 WebGL-off에서는 `BuilderCore`가 `Workspace`
  wrapper를 우회해 `BuilderCanvas`를 직접 렌더링한다. compare도 별도 DOM 경로이므로 세
  Canvas 모드가 같은 actual Grid/Flex main slot을 공유하지 않는다.
- move hot path는 visible panel DOM rect를 다시 조회하고, resize는 frame local
  geometry와 workspace preview layout을 함께 사용한다. 이 때문에 interaction 중
  source/neighbor/Canvas가 서로 다른 update 시점을 볼 수 있다.

2026-08-18 authenticated Photoshop Online 직접 관찰에서는 다음 구조가 확인됐다.

- 실제 main content, panel container, taskbar가 같은 flex layout에 참여한다.
- `psw-panel-container > ue-panel-dock > ue-panel-frame` 아래에 panel frame들이
  안정적으로 존재하고, inactive frame은 `display:none`으로 전환된다.
- `ue-panel-dock`은 `layout-type="floating"` host로 frame geometry, 최대 2 column,
  row splitter, column rail, viewport fit을 한 곳에서 소유한다.
- 4px gap의 column/vertical stack과 인접 panel live resize가 같은 layout update에서
  처리된다.

Adobe Spectrum Web Components의 Split View도 두 pane의 available space 분배,
horizontal/vertical 배치, min/max, pointer/keyboard resize를 하나의 splitter
component가 소유한다. React는 component state를 render tree의 위치에 연결하므로,
panel frame을 안정적인 위치에 유지하면 toggle 후 local state를 보존할 수 있다.

참조:

- [Photoshop Online](https://photoshop.adobe.com/)
- [Adobe Spectrum Web Components Split View](https://opensource.adobe.com/spectrum-web-components/components/split-view/)
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [WAI-ARIA Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)

### 선행 ADR과의 관계

- ADR-922는 [ADR-035](035-workspace-canvas-refactor.md) 전체의 응용 ADR이
  아니다.
- ADR-035 Phase 2의 `ViewportController` SSOT와 scrollbar direct update 계약은
  유지한다.
- ADR-035 Phase 7의 등록 DOM + `ResizeObserver` panel inset 계약만 부분 대체한다.
- panel layout 저장 schema는 `CompositionDocument`, Canvas scene, component catalog와
  직교한다.
- panel state, coordinator, live resize, Canvas inset, persistence migration은 하나의
  transaction 계약이므로 별도 ADR로 분리하지 않는다.

2026-08-18 사용자가 위 관계와 단일 ADR 범위를 명시적으로 확인했다.

### SSOT domain

이 결정은 **D1 DOM/접근성**과 **D3 시각 layout**의 경계를 교차한다.

- D1: grabber와 focusable splitter의 pointer/keyboard/ARIA 계약. React Aria
  `useMove`와 hook 기반 interaction을 우선하며, generic window splitter에서 필요한
  WAI-ARIA semantics는 공유 primitive 한 곳으로 제한한다.
- D2: public component prop/RSP API는 변경하지 않는다.
- D3: frame geometry, column/stack, gap, rail, workspace 점유. 기존 Builder
  token과 `PanelRegistry` min/max를 사용한다.

개별 panel의 `PanelHeader`, `Section`, content DOM/CSS는 본 ADR의 변경 대상이 아니다.
panel shell은 이동·resize·placement만 소유한다.

### Hard Constraints

1. `PanelRegistry`의 모든 panel은 단일 `.panel-workspace` host 아래 frame을 정확히
   하나 가지며 toggle로 재생성되지 않아야 한다.
2. move/resize interaction은 `requestAnimationFrame`당 최대 한 번 solve/publish하고,
   source와 모든 affected neighbor가 같은 snapshot version을 소비해야 한다.
3. pointer move hot path에서 panel frame `querySelectorAll()`이나
   `getBoundingClientRect()`로 snap/resize geometry를 재수집하지 않아야 한다.
4. anchored cluster와 activity rail이 만드는 `occupiedInsets`는 layout state에서
   순수 파생하고, workspace shell이 실제 main content Grid/Flex track에 정확히 한 번
   반영해야 한다. Canvas-local `containerSize`는 이렇게 축소된 실제 canvas 영역이며
   scrollbar world metrics, fit, hit-test, compare pane은 여기서 panel inset을 다시
   차감하지 않아야 한다. 숨겨진 measure DOM, panel element width cache, 사후 translate
   보정은 사용하지 않아야 한다.
5. normal viewport에서는 vertical/horizontal cluster가 gap과 panel min/max를 포함해
   workspace 가용 width/height를 넘지 않아야 한다. side anchored cluster의 column 상한은
   2다. left/right/bottom anchored demand와 rail을 합친 뒤에도 main content는 최소
   320x180px를 보장한다. 이 제약을 만족할 수 없는 viewport에서는 persisted placement와
   preferred size를 바꾸지 않고 deterministic `constrained-overlay` presentation으로
   전환한다. 이때 viewport fit이 panel min보다 우선하며 workspace가 다시 넓어지면 원래
   anchor로 자동 복귀한다.
6. 기존 `composition-panel-layout` record가 있는 사용자의 100%가 versioned migration을
   통과한다. canonical project/DB 재직렬화는 0개다. 최초 v2 write 전에 현재 v1 raw와
   `migrationId`를 `composition-panel-layout.v1-backup`의 `prepared` record로 보존한다.
   primary가 아직 v1이고 raw가 backup raw와 다르면 새 migrationId로 prepared backup을
   최신 raw로 갱신하며, primary v2
   write 성공 뒤 `committed`로 잠근다. committed backup은 refresh와 구버전 code rollback
   rehearsal을 통과한 별도 compatibility cleanup 전에는 덮어쓰거나 삭제하지 않아야 한다.
   backup이 없는 v2-born layout은 valid v2를 이해하는 Phase 3 이상을 operational rollback
   target으로 사용하며, Phase 1 emergency reader도 valid v2를 default로 버리지 않고
   read-only legacy view로 projection해야 한다.
7. Monitor의 bottom 기본 배치, 기존 activity toggle, panel size/position/cluster의
   refresh 복원은 유지해야 한다.
8. hidden panel은 local UI state를 보존하되 chart RAF, observer, polling, data
   subscription 같은 고비용 work를 실행하지 않아야 한다.
9. resize 성능은 고정 60Hz가 아니라 idle RAF에서 측정한 실제 display refresh period를
   기준으로 측정한다. 5초 interaction trace에서 panel 작업에 기인한 50ms 이상 long
   task 0건, missed display period로 계산한 frame delivery의 baseline 대비 저하 5
   percentage point 이내, pointer input부터 모든 affected frame의 동일 layout version이
   DOM geometry에 적용된 뒤 첫 presentation RAF까지의 p95 2 display period 이내를 통과
   조건으로 둔다. store publish만으로 visual 적용 성공을 판정하지 않는다.
10. focusable splitter는 accessible name/orientation/current/min/max를 제공하고
    Arrow/Home/End keyboard resize를 지원해야 한다.

### Soft Constraints

- 기존 `PanelRegistry`, `PanelFrame`, `PanelHeader`, `Section`, React Aria interaction,
  Zustand store/factory 패턴을 재사용한다.
- Photoshop custom element와 inline style 구현을 복사하지 않고 관찰된 ownership과
  interaction 계약만 Composition 구조에 적용한다.
- 장기간 v1/v2 dual-write 또는 부분적인 DOM inset fallback을 남기지 않는다.
- 외부 docking library는 현재 React/React Aria/token 체계보다 명확한 이점이 검증되지
  않는 한 도입하지 않는다.

## Alternatives Considered

### 대안 A: 현행 hybrid 패널 구조의 점진 보강

- 설명: side 배열, `modalPanels`, `panelClusters`, DOM inset runtime을 유지한 채
  발견되는 snap/resize/inset 문제를 개별 수정한다.
- 근거: 현재 구조가 이미 panel-relative snap과 cluster resize 일부를 제공하므로 초기
  변경량은 가장 작다.
- 위험:
  - 기술: **HIGH** — 동일 panel이 side/modal/cluster에 중복 표현되고 interaction
    source가 frame state와 workspace state로 계속 분리된다.
  - 성능: **HIGH** — snap DOM geometry query와 observer/store update 시점 차이를 hot
    path에서 제거할 수 없다.
  - 유지보수: **HIGH** — 새 요구마다 side별 action과 migration branch가 증가한다.
  - 마이그레이션: **LOW** — persisted schema를 거의 바꾸지 않는다.

### 대안 B: 단일 Panel Layout Coordinator 직접 전환

- 설명: 모든 frame을 안정적으로 mount하고 visibility, rail order, placement graph를
  분리하되 v2 hydration, frame renderer, workspace occupancy, Canvas consumer를 한 cutover
  window에서 직접 교체한다.
- 근거: Photoshop Online의 `ue-panel-dock` 관찰, Adobe Split View의 pane/splitter
  ownership, React의 render-tree state preservation 원칙과 정합한다.
- 위험:
  - 기술: **HIGH** — persisted geometry, atomic snapshot publication, shell/Canvas 좌표계를
    한 번에 교체하므로 결함을 어느 boundary에서 만들었는지 격리하기 어렵다.
  - 성능: **HIGH** — stable mount와 전체 renderer cutover가 동시에 활성화돼 baseline
    회귀 시 interaction publish와 hidden work 원인을 분리하기 어렵다.
  - 유지보수: **MEDIUM** — 초기 전환 비용 뒤에는 geometry와 Canvas occupancy의
    owner가 한 곳으로 수렴한다.
  - 마이그레이션: **HIGH** — 같은 key를 v2로 덮어쓴 뒤 구버전 code rollback을 하면
    v1 reader가 새 schema를 복원할 수 없다.

### 대안 C: CSS Grid/Flex document flow 중심 재구성

- 설명: panel을 일반 Grid/Flex child로 배치하고 브라우저 layout만으로 main content와
  panel size를 분배한다.
- 근거: Adobe Split View처럼 고정된 두 pane/vertical stack은 available space를
  단순하고 접근 가능하게 분배할 수 있다.
- 위험:
  - 기술: **HIGH** — arbitrary floating, panel-relative four-edge snap, multi-column
    cluster를 document flow만으로 표현하기 어렵다.
  - 성능: **MEDIUM** — 정적 split은 효율적이나 floating 전환과 전체 Grid 재배치가
    큰 style/layout 범위를 만들 수 있다.
  - 유지보수: **HIGH** — anchored flow와 floating overlay를 위한 두 번째 geometry
    체계가 다시 필요하다.
  - 마이그레이션: **HIGH** — 기존 floating/cluster 위치를 flow track으로 손실 없이
    변환하기 어렵다.

### 대안 D: Gate-locked 단일 coordinator 전환

- 설명: 최종 architecture는 대안 B와 동일하게 전 항목을 단일 coordinator로 통일한다.
  다만 v2 schema/solver와 crash-safe durable v1 backup을 먼저 고정하고, immutable shadow
  snapshot, real-frame canary, panel interaction, shell occupancy, Canvas-local metrics를
  Gate별로 전환한다. production owner를 장기간 dual 운영하지 않고 Gate 실패 시 phase
  경계 전체를 되돌린다.
- 근거: Photoshop식 최종 ownership을 축소하지 않으면서 좌표계, migration, publish,
  lifecycle 위험을 각각 독립적으로 검증할 수 있다.
- 위험:
  - 기술: **MEDIUM** — schema, constrained viewport, shell 좌표계 계약을 production
    cutover 전에 fixture로 고정한다.
  - 성능: **MEDIUM** — shadow snapshot 뒤 실제 frame canary에서 applied layout version과
    native-refresh baseline을 검증하고 atomic publish만 production에 승격한다.
  - 유지보수: **MEDIUM** — phase 동안 adapter가 추가되지만 Gate가 끝난 compatibility
    boundary만 남기고 legacy owner를 제거한다.
  - 마이그레이션: **MEDIUM** — exact raw + migrationId prepared/committed backup protocol과
    refresh/old-code rollback rehearsal을 v2 primary write의 선행 조건으로 둔다.

### Risk Threshold Check

| 대안                            |  기술  |  성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------------- | :----: | :----: | :------: | :----------: | :--------: |
| A. 현행 hybrid 보강             |  HIGH  |  HIGH  |   HIGH   |     LOW      |     3      |
| B. 단일 coordinator 직접 전환   |  HIGH  |  HIGH  |  MEDIUM  |     HIGH     |     3      |
| C. CSS flow 중심                |  HIGH  | MEDIUM |   HIGH   |     HIGH     |     3      |
| D. Gate-locked coordinator 전환 | MEDIUM | MEDIUM |  MEDIUM  |    MEDIUM    |     0      |

A~C 모두 HIGH를 가져 추가 대안 루프를 수행했다. 대안 D는 대안 B의 Photoshop식 최종
architecture를 유지하면서 durable rollback과 Gate-locked cutover를 architecture의 필수
부분으로 포함해 HIGH+ residual risk를 회피한다. 아래 Risks 표의 `고유 영향`은 보호 장치가
실패했을 때의 영향이고, 이 표는 각 대안의 필수 보호 장치 적용 후 residual risk를 같은
기준으로 비교한다.

## Decision

**대안 D: Gate-locked Photoshop Online-aligned 단일 Panel Layout Coordinator 전환**을
선택한다. 최종 panel architecture의 범위는 기존 대안 B와 동일하며, 차이는 durable
rollback과 phase별 단일-owner cutover를 선택 조건으로 격상한 것이다.

이는 일부 시각 동작만 Photoshop에 맞추는 결정이 아니다. 다음 항목 전체를 하나의
architecture로 통일한다.

- panel 생성 위치와 안정 mount
- visibility와 고비용 work lifecycle
- activity rail order와 placement의 분리
- anchored/floating column/stack state
- four-edge panel-relative snap과 detach
- row/column/outer-edge live resize
- 실제 activity rail/anchored cluster 기반 workspace occupancy
- shell workspace occupancy와 Canvas-local sizing/scrollbar/minimap metrics의 좌표계 분리
- viewport fit과 persisted layout migration
- normal/compare/WebGL-off가 공유하는 실제 workspace main slot
- constrained viewport의 deterministic overlay presentation과 자동 anchor 복귀

선택 근거:

1. panel geometry와 shell occupancy는 동일 snapshot을 소비하고, Canvas는 실제로
   축소된 local content rect만 소비해 interaction/drop 시점의 보정과 inset 이중 적용을
   제거한다.
2. stable frame tree가 panel local state를 보존하면서 toggle 재생성 비용을 피한다.
3. transient interaction은 RAF-batched coordinator가 맡고 persisted Zustand state는
   interaction 종료 시 한 번 commit해 hot path를 분리한다.
4. `bottom`을 일반 placement anchor로 모델링해 Monitor 기능을 유지하면서 별도 bottom
   panel subsystem을 제거할 수 있다.
5. v1 layout은 project data가 아니며 primary record를 v2로 쓰기 전에 현재 raw와
   byte-equivalent인 prepared backup을 남기고 같은 migrationId를 v2에 기록한 뒤
   committed로 잠가, 중간 write 실패와
   구버전 code rollback에서도 최신 사용자 배치를 복원할 수 있다.

위험 수용 근거:

- pure model/solver와 migration을 production UI보다 먼저 완성하고 Gate별로 전환한다.
- Canvas consumer cutover 실패 시 DOM cache와 혼합한 채 릴리스하지 않고 해당 phase
  전체를 되돌린다.
- hidden work suspension과 native-refresh trace를 구현 완료 조건으로 두어 stable mount의
  memory/CPU 비용을 관찰 가능하게 만든다.

기각 사유:

- **대안 A 기각**: 초기 변경량은 작지만 상태/DOM measurement의 복수 owner를 유지해
  이번 문제의 근본 원인을 보존한다.
- **대안 B 기각**: 최종 architecture는 적합하지만 migration, interaction, shell/Canvas
  좌표계를 한 cutover window에서 교체해 HIGH residual risk가 남는다.
- **대안 C 기각**: 고정 split pane에는 적합하지만 Composition이 요구하는 floating,
  panel-relative snap, detach를 표현하려면 별도 overlay geometry가 필요해 다시 hybrid가
  된다.

> 구현 상세: [922-photoshop-style-panel-layout-coordinator-breakdown.md](../design/922-photoshop-style-panel-layout-coordinator-breakdown.md)

## Risks

| ID  | 위험                                                                                                     | 고유 영향 | Gate 후 잔여 | 대응                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------- | :-------: | :----------: | -------------------------------------------------------------------------------------------------------------- |
| R1  | v1 migration/구버전 rollback에서 panel 누락·중복·위치 손실                                               |   HIGH    |    MEDIUM    | exact v2 schema, pure migration 6종, migrationId backup, refresh/old-code rollback을 G1/G6에서 검증            |
| R2  | coordinator가 frame별 state를 따로 publish하거나 전체 React tree를 commit해 tearing/native cadence 저하  |   HIGH    |    MEDIUM    | immutable snapshot, RAF당 publish 1회, applied-version/native-refresh trace를 G2a/G2b에서 검증                 |
| R3  | shell이 줄인 main content에서 Canvas가 inset을 다시 차감해 fit/scrollbar/minimap/compare 좌표가 어긋남   |   HIGH    |    MEDIUM    | shell-only inset 적용, Canvas-local actual rect, double-subtraction fixture와 compare browser flow를 G3에 연결 |
| R4  | stable mount된 hidden panel의 chart/observer/subscription이 CPU·memory를 계속 소비                       |   HIGH    |     LOW      | 공통 visibility lifecycle + Monitor 대표 callback 0회 fixture를 G4에서 검증                                    |
| R5  | custom splitter가 pointer만 지원하거나 ARIA range/keyboard 의미가 불완전                                 |   HIGH    |     LOW      | shared React Aria/WAI-ARIA primitive와 Arrow/Home/End/RTL/browser smoke를 G5에서 검증                          |
| R6  | shell이 title/close action을 다시 소유해 기존 `PanelHeader` layout 회귀                                  |  MEDIUM   |     LOW      | shell/content ownership static test와 대표 panel header screenshot 비교                                        |
| R7  | legacy 제거에서 Monitor 또는 `useActiveScope`/DataTable panel activation consumer가 누락됨               |   HIGH    |     LOW      | producer/consumer inventory와 bottom/shortcut/editor fixture 후 마지막 phase에서만 legacy 제거                 |
| R8  | placement geometry와 anchor uniqueness가 불명확해 migration 또는 pure solver가 비결정적임                |   HIGH    |    MEDIUM    | single cluster placement graph, row height, anchor cardinality, inset/min-max 수식을 G1 전에 freeze            |
| R9  | fixed/compare/WebGL-off가 서로 다른 shell 경로를 유지해 일부 모드에서 occupied inset이 적용되지 않음     |   HIGH    |     LOW      | `BuilderCore`가 공통 main slot을 소유하고 세 모드가 같은 `Workspace` shell을 통과하는 static/browser gate      |
| R10 | 양쪽 anchored panel min width와 rail 합이 viewport를 넘어 main rect가 음수 또는 panel이 viewport 밖이 됨 |   HIGH    |    MEDIUM    | 320x180 main reservation, deterministic constrained overlay, emergency viewport clamp와 narrow fixture         |
| R11 | backup 성공과 primary v2 write 사이 실패 뒤 write-once backup이 최신 v1 배치보다 오래됨                  |   HIGH    |     LOW      | exact raw + migrationId prepared/committed protocol, crash/quota sequence와 rollback fixture                   |
| R12 | shadow snapshot만으로 실제 React frame의 version tearing과 visual 적용 latency를 통과 판정함             |   HIGH    |     LOW      | G2a store 검증과 G2b real-frame canary를 분리하고 applied DOM version을 presentation RAF에서 측정              |
| R13 | 기존 v2 record가 새 registry panel ID를 몰라 invariant 실패 또는 default layout 전체 복원으로 떨어짐     |  MEDIUM   |     LOW      | registry-driven missing-known-ID normalization과 app-version add/remove refresh fixture                        |
| R14 | v2 출시 뒤 생성된 backup 없는 layout이 Phase 1 rollback에서 default로 떨어져 전체 배치를 잃음            |   HIGH    |     LOW      | v2-capable Phase 3 operational rollback target + Phase 1 read-only legacy projection fixture                   |

## Gates

| Gate                    | 시점                               | 통과 조건                                                                                                                                               | 실패 시 대안                                            |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G0 Baseline             | production state 변경 전           | v1 producer/consumer/unused-host inventory, representative 5-panel flow, 세 shell 모드, idle refresh period와 5초 move/resize trace 확보                | inventory/baseline을 보강하고 구현 진입 금지            |
| G1 Model/Migration      | v2 hydration 전                    | R1/R8/R10/R11/R13/R14: exact schema/constrained 수식, 6종 v1→v2, registry evolution, migrationId failure, v2-born legacy projection, project write 0    | v1 renderer 유지, schema/migrator 재설계                |
| G2a Coordinator Store   | real-frame canary 전               | R2: pure solver/candidate의 DOM query 0, single immutable publish, RAF당 solve/publish 최대 1, shadow geometry mismatch 0                               | shadow coordinator 수정, production consumer 진입 금지  |
| G2b Applied Interaction | 전체 panel renderer cutover 전     | R2/R12: canary frame 중복·pointer DOM query·applied version mismatch 0, applied-frame p95 ≤2 periods, long task 0, delivery baseline 대비 -5pp 이내     | canary 제거, v1 renderer 유지, publish/apply model 수정 |
| G3 Workspace Occupancy  | DOM inset runtime 제거 전          | R3/R9/R10: 공통 main slot에 inset 1회, Canvas-local 차감 0, normal/compare/WebGL-off와 constrained viewport의 fit·scrollbar·minimap·hit-test mismatch 0 | Phase 4 전체 rollback; DOM/state hybrid 릴리스 금지     |
| G4 Hidden Work          | visibility lifecycle phase 종료 전 | R4: Activity Effect cleanup 외부의 hidden Monitor chart RAF/ResizeObserver/poll callback 0, local UI state toggle 왕복 보존                             | 고비용 panel lifecycle 보강 후 재검증                   |
| G5 Accessibility/UI     | legacy shell 제거 전               | R5/R6: move/splitter pointer+keyboard+focus+ARIA 검사 통과, 대표 panel header/action DOM 중복 0                                                         | shared primitive 또는 shell boundary 수정               |
| G6 Cutover/Removal      | 완료 판정 전                       | G0/G1/G2a/G2b/G3~G5 evidence, refresh, bottom Monitor, migrated-v1/v2-born rollback, narrow viewport 복귀, test/typecheck/preflight/browser smoke 통과  | legacy 제거 보류 또는 v2-capable Phase 3으로 rollback   |

## Consequences

### Positive

- `PanelWorkspace`가 frame geometry, snap, resize, placement의 단일 owner가 된다.
- shell이 `occupiedInsets`를 실제 main track에 한 번 적용하고 Canvas는 panel DOM이나
  panel inset이 아닌 실제 local content rect를 소비한다.
- 인접 panel resize가 pointerup이 아니라 drag 중 같은 layout transaction에서 보인다.
- panel stack이 workspace bounds를 넘지 않고 browser resize에 정규화된다.
- panel toggle 후 scroll/form/local state를 보존하면서 hidden 고비용 work를 정지한다.
- Monitor bottom 기능을 별도 subsystem 없이 일반 placement로 유지한다.
- side별 mutation branch와 ad hoc storage migration을 versioned model로 축소한다.

### Negative

- panel state/store/hook/workspace/Canvas consumers를 동시에 건드리는 다단계 전환이다.
- pure solver, transient interaction session, per-panel subscription이라는 새 추상화가
  추가된다.
- 모든 frame을 안정 mount하므로 DOM/memory baseline은 mount/unmount 방식보다 높을 수
  있다.
- v1 compatibility parser와 durable backup record를 별도 cleanup이 승인될 때까지
  유지해야 한다.
- v2 write가 시작된 뒤 operational code rollback은 v2 schema를 읽는 Phase 3 이상으로
  제한되며 Phase 1은 emergency read-only projection 경로로만 남는다.
- pointer, keyboard, accessibility, persistence, Canvas inset을 포함한 browser 검증 비용이
  증가한다.

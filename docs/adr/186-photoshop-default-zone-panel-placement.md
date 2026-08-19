# ADR-186: Photoshop 기본 및 Pencil 9-zone 패널 배치 정책

## Status

Accepted — 2026-08-19

## Context

ADR-922는 panel frame, visibility, activity rail order, column/row cluster, splitter,
coordinator snapshot과 persistence를 하나의 workspace owner로 통합했다. 그러나
2026-08-19 amendment 이후 production placement는 모든 side/bottom cluster를
`anchor: "floating"`으로 승격하고 `{ x, y }`를 persist한다. drag가 어떤 snap target에도
닿지 않으면 마지막 자유 좌표가 그대로 committed layout이 된다.

현재 경로는 다음과 같이 arbitrary floating을 구조적으로 허용한다.

- `panelWorkspaceLayoutV2.ts::PanelWorkspaceFloatingClusterV2`가 persisted `position`을
  필수로 갖고 parser도 임의의 finite x/y를 허용한다.
- `panelWorkspaceLayoutV2.ts::floatAnchoredPanelWorkspaceClusters()`가 left/right/bottom
  rail cluster를 floating 좌표로 변환한다.
- `panelWorkspaceLayoutInteraction.ts::detachPanelToFloatingCluster()`가 drag geometry를
  새 cluster의 persisted position으로 복사한다.
- `PanelWorkspace.tsx`의 `useMove` 경로가 move마다 runtime layout을 갱신하고,
  `onMoveEnd`가 유효한 snap이 없어도 `runtime.endInteraction()` 결과를 commit한다.
- `panelWorkspaceLayoutInteraction.ts::snapPanelWorkspacePanel()`은 floating cluster의
  horizontal 구조가 바뀔 때 `position.x`를 증감 보정해야 하므로 right-aligned cluster가
  우측으로 밀리는 회귀를 만들 수 있다.

사용자가 제시한 Photoshop Online live DOM과 2026-08-19 직접 관찰에서는 panel frame이
`ue-panel-dock` 하나 아래에서 right/top 기준의 column/row로 정렬되고, dock 자체는 부모
panel container의 공통 4px 여백 안에서 가용 높이를 소비한다. 자유 좌표에 놓인 독립
window가 아니라 dock graph가 geometry를 파생한다.

같은 날 사용자가 확인한 Pencil/Pen의 panel placement는 화면의 네 corner, 네 edge,
center로 구성된 9-zone만 최종 위치로 허용한다. 본 ADR은 이 interaction vocabulary를
가져오되 별도 Pencil mode를 만들지 않는다. Photoshop식 rail activation을 기본 정책으로
유지하면서 사용자가 9-zone에 cluster를 옮길 수 있고, 이후 다른 panel을 그 cluster의
가능한 면에 snap할 수 있게 한다.

Adobe Spectrum Web Components Split View는 horizontal/vertical pane의 available space,
min/max와 pointer/keyboard splitter를 한 owner에서 관리한다. 이는 zone이 cluster origin을
소유하고 cluster 내부 row/column resize는 기존 splitter owner가 유지해야 한다는 경계를
뒷받침한다.

참조:

- [Photoshop Online](https://photoshop.adobe.com/)
- [Pen](https://www.pen.dev/) — 사용자가 직접 확인한 9-zone interaction reference
- [Adobe Spectrum Web Components Split View](https://opensource.adobe.com/spectrum-web-components/components/split-view/)
- [ADR-922](completed/922-photoshop-style-panel-layout-coordinator.md)

### ADR-922 fork 전제

2026-08-19 사용자가 다음 네 전제와 ADR 제목을 명시적으로 확인했다.

1. **base / 응용**: ADR-922가 coordinator/cluster/resize base이고 ADR-186은 placement
   specialization이다.
2. **schema 관계**: v3 `placementZone`은 v2 `floating.position`과 직교하지 않고 이를
   대체한다.
3. **reverse dependency**: 의존 방향은 `ADR-186 -> ADR-922` 단방향이다. ADR-922의 다른
   계약은 ADR-186을 요구하지 않는다.
4. **전제 잠금**: 자유 XY는 drag preview에만 존재한다. valid drop만 zone/cluster graph로
   commit하고 invalid drop은 시작 layout으로 복귀한다.

ADR-186이 Implemented되기 전까지 ADR-922의 현 production placement가 유효하다.
Implemented 승격 시 ADR-922 전체가 아니라 persisted arbitrary floating과 unsnapped drop
commit 의미만 부분 대체한다.

### SSOT domain

이 결정은 **D3 Builder chrome layout**과 domain 밖 **builder-system state/persistence**에
해당한다.

- D1: 기존 grabber와 splitter의 RAC/WAI-ARIA semantics를 유지한다. 9-zone과 snap guide는
  drag 중 `aria-hidden` presentation이며 새 수동 ARIA를 만들지 않는다.
- D2: public component props와 React Spectrum API는 변경하지 않는다.
- D3: placement surface 4px inset, zone alignment, snap/resize line의 color/thickness를
  Builder panel token에서 단일화한다.
- builder-system: local panel layout v3와 v2 compatibility migration을 소유한다.

component catalog/spec/Generator와 Canvas Skia/Preview/Publish 시각 consumer는 변경하지
않는다. 따라서 Spec/Generator 확장과 CSS-Skia cross-check 대상이 아니다.

### Hard Constraints

1. 성공한 drop 뒤 persisted v3 cluster의 100%가 아홉 `placementZone` 중 하나를 가지며,
   primary JSON의 cluster에 `position`, `x`, `y`, `anchor: "floating"`이 0건이어야 한다.
2. 자유 pointer 좌표는 interaction session에만 존재한다. pointer move 중 persistence write
   0회, valid pointerup당 최대 1회, invalid/Escape/cancel drop은 0회여야 한다.
3. activity rail identity와 placement를 분리한다. cross-rail/zone snap 전후 panel의
   `railOrder` membership 변화는 0건이며 rail reopen은 마지막 placement를 복원한다.
4. 기본 mapping은 `left -> top-left`, `right -> top-right`, `bottom -> bottom`이다. right
   cluster는 top-down stack 후 높이 부족 시 왼쪽에 새 column을 만들고, left는 오른쪽에
   만든다.
5. placement surface는 workspace에 CSS 4px inset을 정확히 한 번 적용한다. 9-zone edge와
   실제 workspace edge의 간격은 DPR 1/2에서 `4px +/- 0.5px`여야 한다.
6. cluster 구조 변경·resize 뒤 zone anchor 오차는 `<= 0.5 CSS px`다. 특히 top-right
   horizontal snap 뒤 right edge, top zone의 top edge, bottom zone의 bottom edge가
   이동하지 않아야 한다.
7. panel-relative candidate는 snapshot상 실제 가능한 outer face만 최대 하나 표시한다.
   horizontal/vertical snap line은 resize hover bar와 같은 color token과 각각 같은
   height/width를 사용한다.
8. shared column resize는 ADR-922 paired resize를 유지한다. pointerdown `startLayout`을
   기준으로 매 move를 재계산해 min/max clamp 왕복 drift가 0이어야 한다.
9. v2 local layout 보유자의 100%가 actual placement surface rect를 입력으로 받는
   deterministic v2 -> v3 migration을 통과한다. 최초 v3 write 전 exact v2 raw를 보존하고,
   `prepared -> primary -> committed` 각 write 경계의 crash recovery에서 panel
   ID/visibility/rail membership 누락·중복은 0건이어야 한다. operational rollback은
   v3-aware Phase 2 recovery build 이상만 지원한다. migration 직후 무편집 record는 exact v2
   raw를, v3-born 또는 migration 이후 편집된 record는 current v3 -> valid v2 projection을
   사용하며 direct pre-v3 build rollback은 지원하지 않는다. `CompositionDocument`, project
   file, IndexedDB project row, Supabase row 재직렬화는 0개다.
10. move/resize hot path는 panel DOM geometry query 0, solve/publish RAF당 최대 1회를
    유지하고 5초 native-refresh delivery가 ADR-922 baseline 대비 5pp 넘게 하락하지
    않아야 한다.

### Soft Constraints

- 현행 v2 column/row graph와 panel size preference를 재사용해 구현 범위를 placement에
  한정한다.
- 9-zone overlay는 Builder panel chrome의 기존 token과 snap line 어법을 재사용한다.
- v2 arbitrary 좌표의 정확한 픽셀 위치는 의도적으로 보존하지 않지만 panel과 size/order는
  최대한 보존한다.
- 외부 docking library나 Photoshop/Pen 내부 코드를 복사하지 않고 관찰된 interaction
  계약만 적용한다.

## Alternatives Considered

### 대안 A: v2 arbitrary XY 유지 + drop 종료 시 zone 좌표로 보정

- 설명: `floating.position`을 계속 정본으로 두고 zone drop일 때만 계산된 x/y로 덮어쓴다.
  zone 밖 drop은 현재처럼 자유 위치를 허용한다.
- 근거: desktop floating window와 snap-to-grid를 함께 제공하는 일반 docking UI처럼
  기존 behavior를 가장 많이 보존한다.
- 위험:
  - 기술: **MEDIUM** — 구현량은 작지만 zone identity를 좌표 역추론해야 한다.
  - 성능: **LOW** — 현행 solver와 persistence를 유지한다.
  - 유지보수: **HIGH** — 자유 XY와 zone alignment가 같은 `position`을 공유해 right/top
    anchor 보정과 viewport resize drift가 계속 조건 분기로 남는다.
  - 마이그레이션: **LOW** — schema를 바꾸지 않는다.

### 대안 B: zone-only v3 직접 전환

- 설명: persisted position을 제거하고 9-zone schema, solver, interaction과 migration을 한
  cutover에서 production owner로 전환한다.
- 근거: Pen의 제한된 placement vocabulary와 Photoshop의 dock-derived geometry를 가장
  직접적으로 표현한다.
- 위험:
  - 기술: **MEDIUM** — 목표 모델은 단순하지만 schema/solver/interaction을 동시에
    교체한다.
  - 성능: **LOW** — 좌표 보정이 줄고 pure zone solve만 남는다.
  - 유지보수: **MEDIUM** — 최종 owner는 하나다.
  - 마이그레이션: **HIGH** — v2 사용자의 100%가 arbitrary 위치를 잃는 전환에서 parser,
    collision, rollback을 production UI와 동시에 검증해야 한다.

### 대안 C: Photoshop mode와 Pencil mode 이원화

- 설명: 설정 또는 panel별 flag로 Photoshop rail dock과 Pencil 9-zone을 별도 layout
  mode/runtime으로 운영한다.
- 근거: 두 reference product의 interaction을 각각 원형에 가깝게 보존할 수 있다.
- 위험:
  - 기술: **HIGH** — panel-relative snap 뒤 어느 mode가 cluster를 소유하는지 전이 상태가
    추가되고 cross-mode snap이 제3의 경로가 된다.
  - 성능: **MEDIUM** — 두 solver/candidate가 drag 중 함께 평가될 가능성이 있다.
  - 유지보수: **HIGH** — activation, resize, migration, reset, browser QA가 두 배로 갈라진다.
  - 마이그레이션: **MEDIUM** — mode default와 기존 record 해석 규칙이 필요하다.

### 대안 D: gate-locked zone-owned cluster + Photoshop 기본 정책

- 설명: 최종 schema는 대안 B처럼 zone-only로 통일하되, v3 pure model/migration과 exact
  v2 backup, zone solver/common placement surface, transient drag transaction을 Gate별로
  검증한 뒤 production owner를 전환한다. Photoshop rail mapping은 default insertion
  policy이고 Pencil 9-zone은 같은 graph의 추가 drop surface다.
- 근거: Photoshop의 single dock ownership, Pen의 9-zone vocabulary, Spectrum Split
  View의 single resize owner를 현재 ADR-922 coordinator에 specialization한다.
- 위험:
  - 기술: **MEDIUM** — v2 graph를 유지한 채 placement 축만 단계적으로 교체한다.
  - 성능: **LOW** — free position mutation을 presentation session으로 격리하고 final solver는
    순수 zone origin을 사용한다.
  - 유지보수: **MEDIUM** — compatibility window 동안 v2 reader가 남지만 production owner와
    writer는 하나다.
  - 마이그레이션: **MEDIUM** — exact v2 backup과 collision fixture를 v3 primary write의
    선행 조건으로 둔다.

### Risk Threshold Check

| 대안                      |  기술  |  성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------- | :----: | :----: | :------: | :----------: | :--------: |
| A. v2 XY + zone 보정      | MEDIUM |  LOW   |   HIGH   |     LOW      |     1      |
| B. zone-only 직접 전환    | MEDIUM |  LOW   |  MEDIUM  |     HIGH     |     1      |
| C. 두 mode 이원화         |  HIGH  | MEDIUM |   HIGH   |    MEDIUM    |     2      |
| D. gate-locked 단일 graph | MEDIUM |  LOW   |  MEDIUM  |    MEDIUM    |     0      |

A~C가 모두 HIGH를 가져 대안 D를 추가했다. D는 자유 XY를 최종 architecture에서 제거하면서
schema, migration, geometry, interaction을 서로 다른 Gate에서 검증해 HIGH+ 비교 위험을
회피한다.

## Decision

**대안 D: gate-locked zone-owned cluster + Photoshop 기본 정책**을 선택한다.

결정 계약은 다음과 같다.

1. `railOrder`는 activity rail identity를, cluster `placementZone`은 현재 위치를 소유한다.
   snap/drop은 rail identity를 변경하지 않는다.
2. v3 persisted schema는 9-zone과 column/row size graph만 저장한다. arbitrary x/y는 drag
   session의 preview geometry로만 존재한다.
3. rail activation은 Photoshop 정책을 따른다. left/right panel은 각각 top-left/top-right에
   top-down stack하고, 높이가 부족하면 workspace 안쪽 방향으로 두 번째 column을 만든다.
4. 사용자는 빈 9-zone에 panel을 놓을 수 있다. 이후 panel-relative snap은 target cluster의
   zone을 승계하며 가능한 outer face 하나만 활성화한다.
5. placement surface의 공통 CSS 4px inset을 geometry boundary로 삼고 solver는 그 local
   rect에서 zone origin을 파생한다. per-edge gap 보정은 두지 않는다.
6. valid drop만 graph를 한 번 commit한다. invalid, Escape, pointer cancel은 시작 graph로
   복귀하고 persistence를 쓰지 않는다.
7. v2 record는 actual placement surface가 측정된 뒤 exact backup과 deterministic v3
   migration을 수행하고 compatibility window 동안 v2 reader와 v3-aware recovery boundary를
   유지한다. operational rollback은 Phase 2 이상 recovery build가 primary를 valid v2로
   복구한 뒤에만 pre-v3 build를 실행한다. migration 직후 무편집 record는 exact v2 raw를
   복원하고, v3-born 또는 migration 이후 편집 record는 current v3 graph를 v2 floating
   geometry로 projection한다. dual-write는 하지 않는다.
8. zone은 alignment anchor이며 독립적인 non-overlap cell이 아니다. 큰 cluster가 인접 zone
   cluster와 겹치면 자동 밀어내지 않고 `clusterFocusOrder`로 z-order만 결정한다.

위험 수용 근거:

- R1~R3의 migration/geometry/transaction 위험을 production cutover보다 앞선 pure fixture와
  browser Gate로 분리한다.
- 기존 ADR-922 coordinator, column/row graph, splitter와 visibility lifecycle을 재사용해
  새 architecture의 변수를 placement 한 축으로 제한한다.
- arbitrary XY 정밀도 손실은 요구된 정책 변화다. exact v2 backup은 migration 직후
  byte-exact 복구를, v3 -> v2 projection은 v3-born/post-edit rollback을 담당하며 둘 다
  Phase 2 이상 recovery build에서만 실행한다. project/canonical data에는 영향이 없다.

기각 사유:

- **대안 A 기각**: zone identity가 좌표에 종속되어 자유 XY를 제거한다는 전제와 right/top
  anchor 불변 문제를 해결하지 못한다.
- **대안 B 기각**: 최종 모델은 맞지만 v2 사용자의 100% migration과 drag transaction을
  한 번에 교체해 rollback과 원인 격리가 어렵다.
- **대안 C 기각**: 사용자가 요구한 것은 두 mode가 아니라 Photoshop default와 9-zone이
  결합된 한 graph다. 두 runtime은 snap/resize/activation owner를 다시 중복시킨다.

> 구현 상세: [186-photoshop-default-zone-panel-placement-breakdown.md](design/186-photoshop-default-zone-panel-placement-breakdown.md)

## Risks

| ID  | 위험                                                                                                  | 심각도 | 대응                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | v2 arbitrary cluster를 9-zone으로 양자화할 때 위치·cluster 경계가 예상과 다르게 합쳐짐                |  HIGH  | `panelWorkspaceLayoutV2.ts` parser/solver, v3 migration, persistence backup을 G1에서 collision/10+ cluster/rollback fixture로 검증                         |
| R2  | snap/resize 뒤 zone anchor가 흔들려 top-right panel이 우측으로 밀리거나 top/bottom 4px gap이 사라짐   |  HIGH  | `solvePanelWorkspaceLayoutV2()`의 사후 clamp를 zone origin 선계산으로 대체하고 `snapPanelWorkspacePanel()`/placement surface를 G2 브라우저 geometry로 검증 |
| R3  | 자유 preview geometry가 committed graph로 유출되거나 invalid drop이 마지막 좌표를 저장함              |  HIGH  | `PanelWorkspace.tsx::useMove`, `panelWorkspaceRuntime.ts::begin/end/cancelInteraction`, persistence writer를 G3 write-count/rollback gate로 묶음           |
| R4  | zone 이동 또는 cross-rail snap이 `railOrder`를 바꿔 rail button 위치와 reopen 정책이 변함             |  HIGH  | `railSideForPanel()`, `activatePanelWorkspacePanel()`, zone/snap mutation의 membership 불변식을 G4에서 전 zone 검증                                        |
| R5  | hidden-only cluster가 zone을 예약한 상태에서 duplicate cluster 또는 duplicate row가 생성됨            | MEDIUM | zone cardinality 1 + normalize uniqueness + dormant merge fixture                                                                                          |
| R6  | candidate 이원 판정과 preview publish가 pointer hot path를 늘려 native cadence가 저하됨               |  HIGH  | snapshot-only candidate, DOM query 0, RAF당 solve/publish <=1, 5초 trace를 G3/G5에 연결                                                                    |
| R7  | custom 9-zone overlay가 grabber/splitter focus와 ARIA semantics를 가로챔                              |  LOW   | overlay `aria-hidden`, pointer presentation 한정, 기존 D1 primitive 무변경                                                                                 |
| R8  | snap line과 resize hover bar가 다시 별도 색/두께 literal로 갈라짐                                     | MEDIUM | shared CSS custom property + static/computed style fixture                                                                                                 |
| R9  | 9-zone cluster가 좁은 viewport에서 겹치거나 min size가 surface를 넘음                                 | MEDIUM | fit-before-origin, existing constrained presentation, narrow/DPR fixture                                                                                   |
| R10 | v3 primary 뒤 pre-v3 build가 v3 또는 backup을 읽지 못하거나 stale v2 backup으로 post-edit 상태를 잃음 |  HIGH  | Phase 2+ recovery build만 rollback target으로 허용하고 exact restore/v3-born·post-edit projection/crash matrix를 G1/G2/G5에서 검증                         |

## Gates

| Gate                | 시점                         | 통과 조건                                                                                                                                                                                                                                  | 실패 시 대안                                          |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| G0 Contract Freeze  | production state 변경 전     | v2 placement producer/consumer 전수화, current worktree와 HEAD 분리, default/9-zone/invalid/resize/migration fixture 고정                                                                                                                  | baseline을 보강하고 구현 진입 금지                    |
| G1 Model/Migration  | v3 hydration 전              | R1/R5/R10: measured surface 입력, anchored/floating/collision/mixed-rail 10+ cluster/malformed deterministic, panel/rail/visibility 누락·중복 0, migration write 경계 crash recovery, project write 0                                      | v2 runtime 유지, migrator/recovery 재설계             |
| G2 Zone Geometry    | interaction 전환 전          | R2/R9/R10: 9-zone 9/9 edge 오차 <=0.5px, common actual gap 4px +/-0.5px, top-right snap right drift 0, resize anchor drift 0, v3-born/post-edit v3 -> v2 projection                                                                        | v2 interaction 유지, solver/surface/recovery 수정     |
| G3 Drag Transaction | free-position writer 제거 전 | R3/R6/R8: move persistence 0, valid drop 1, invalid/Escape/cancel 0+base rollback, active candidate <=1, DOM query 0, RAF당 publish <=1, snap/resize visual 동일                                                                           | transient session/candidate 경로 수정, v2 writer 유지 |
| G4 Policy/Identity  | compatibility 제거 전        | R4/R5: default stack/overflow, 9-zone relative snap, cross-rail membership 변화 0, hide/reopen/reset, paired resize 전건 PASS                                                                                                              | activation/normalize policy 수정                      |
| G5 Cutover          | Implemented 승격 전          | G0~G4 evidence + focused tests/typecheck/preflight + local Builder reload/browser trace, native delivery baseline -5pp 이내, v3 persisted XY 0, Phase 2 recovery build로 exact/migrated-post-edit/v3-born old-code rollback rehearsal PASS | v3 production cutover rollback, v2 compatibility 유지 |

## Consequences

### Positive

- panel 최종 위치가 9개의 이름 있는 zone과 cluster graph로 설명되어 viewport마다
  deterministic하게 다시 계산된다.
- Photoshop식 right/top stack과 Pencil 9-zone을 mode 분기 없이 같은 coordinator가
  처리한다.
- horizontal snap으로 cluster 폭이 바뀌어도 zone anchor가 다시 계산되어 우측 밀림을
  없앤다.
- 공통 CSS placement surface가 top/bottom/left/right 4px 여백과 resize max boundary를
  하나로 만든다.
- invalid drop이 persisted 자유 위치를 남기지 않고, rail identity와 current placement가
  독립돼 rail button 동작이 예측 가능해진다.

### Negative

- 기존 사용자의 arbitrary floating pixel 위치는 v3에서 보존되지 않고 nearest zone으로
  양자화된다.
- compatibility window 동안 v2 parser/backup, v3 production writer와 Phase 2+ downgrade
  projection/recovery boundary가 함께 존재한다.
- zone cardinality, dormant cluster, collision migration과 cluster focus order 규칙이 새
  model complexity로 추가된다.
- 9-zone overlay와 panel-edge candidate의 우선순위를 실제 pointer interaction으로 계속
  회귀 검증해야 한다.

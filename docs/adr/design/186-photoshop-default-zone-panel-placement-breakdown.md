# ADR-186 구현 상세 — Photoshop 기본 및 Pencil 9-zone 패널 배치 정책

## 0. 범위와 전제 잠금

2026-08-19 사용자 확인으로 다음 전제를 구현 단계 전에 고정했다.

1. **base / 응용 분류**: ADR-922는 panel coordinator, immutable snapshot,
   column/row graph, resize, visibility, activity rail과 persistence lifecycle의 base다.
   ADR-186은 그 위에서 persisted placement policy만 specialization하는 후속 ADR이다.
2. **schema 직교성**: 두 schema는 직교하지 않는다. v3의 `placementZone`은 v2
   `anchor: "floating" + position`을 대체한다. 따라서 ADR-186이 ADR-922보다 먼저
   성립할 수 없다.
3. **reverse dependency 검증**: ADR-922는 ADR-186을 요구하지 않는다. ADR-186만
   ADR-922의 coordinator와 cluster graph를 요구한다. 의존 방향은
   `ADR-186 -> ADR-922` 단방향이다.
4. **전제 결함 선차단**: 자유 XY를 하나의 허용 모드로 남겨두지 않는다. pointer의
   자유 좌표는 drag preview에만 존재하고, 성공한 drop 뒤 persisted cluster는 정확히
   하나의 zone을 소유한다. 유효한 drop target이 없으면 시작 layout으로 복귀한다.

ADR-186이 Implemented로 승격될 때 ADR-922의 다음 placement 의미만 부분 대체한다.

- persisted arbitrary floating `position`
- drag 종료 시 snap되지 않은 자유 좌표 commit
- `left/right/bottom` anchor를 floating XY로 승격하는 runtime amendment

다음 ADR-922 계약은 그대로 유지한다.

- stable panel frame mount와 visibility lifecycle
- `railOrder`와 panel content ownership
- column/row graph, 4px inter-panel gap, column 상한 2
- row/column/shared splitter resize와 min/max
- immutable coordinator snapshot, RAF-batched publish, DOM geometry query 0
- activity rail overlay와 Canvas-local sizing

개별 panel의 `PanelHeader`, `Section`, content/actions와 activity rail의 화면 위치는
범위 밖이다.

## 1. 목표 상태 계약

### 1.1 두 개의 독립 축

| 축                     | 정본                          | 의미                                                        |
| ---------------------- | ----------------------------- | ----------------------------------------------------------- |
| activity rail identity | `railOrder.left/right/bottom` | rail button의 위치, 기본 활성화 정책, reset 기본값          |
| current placement      | cluster의 `placementZone`     | 현재 cluster가 placement surface의 어느 기준점에 정렬되는가 |

panel을 다른 zone 또는 다른 rail 소속 panel에 snap해도 `railOrder` membership은
바뀌지 않는다. rail button 클릭으로 다시 열 때는 마지막 cluster/row placement를
복원한다. 명시적인 workspace reset만 registry의 `defaultPosition`과 기본 zone 매핑을
다시 적용한다.

### 1.2 기본 Photoshop 정책

| rail side | 기본 zone   | 활성화/overflow 방향                                         |
| --------- | ----------- | ------------------------------------------------------------ |
| `left`    | `top-left`  | 위에서 아래로 stack, 높이 부족 시 새 column을 오른쪽에 생성  |
| `right`   | `top-right` | 위에서 아래로 stack, 높이 부족 시 새 column을 왼쪽에 생성    |
| `bottom`  | `bottom`    | 기존 bottom panel 순서를 유지해 bottom-center cluster에 삽입 |

숨겨진 panel은 row placement를 보존하되 solve 수요에서는 제외한다. 마지막 visible
panel이 숨겨진 cluster도 zone reservation과 row 구조를 유지해 reopen 시 원위치로
복원한다.

### 1.3 Pencil 9-zone 정책

허용 zone은 다음 아홉 개뿐이다.

```
top-left      top      top-right
left          center   right
bottom-left   bottom   bottom-right
```

- 빈 zone에 drop하면 source panel로 새 zone-owned cluster를 만든다.
- visible cluster가 있는 zone에서는 zone surface 대신 그 cluster의 유효한 panel edge만
  drop target이 된다.
- hidden-only cluster가 zone을 예약한 상태에서 해당 zone에 drop하면 dormant cluster에
  기본 삽입 정책으로 합친다. 같은 zone의 두 번째 cluster는 만들지 않는다.
- panel-relative snap은 target cluster의 zone을 승계한다. source panel의 rail identity는
  보존한다.
- 유효한 panel edge 또는 zone candidate가 없는 drop은 시작 layout으로 복귀한다.

### 1.4 공통 placement surface

`.panel-workspace-placement-surface`를 panel frame의 유일한 containing block으로 둔다.
이 surface는 CSS `inset: var(--panel-workspace-gap)`으로 workspace 안쪽에 배치한다.
solver는 이미 inset된 surface의 local `width/height`만 소비하며 개별 edge마다 4px를
더하거나 빼지 않는다.

따라서 surface local 좌표의 `(0, 0)`은 실제 workspace의 `(4px, 4px)`이고,
`(width, height)` 경계도 실제 workspace의 right/bottom에서 4px 떨어져 있다. top/bottom
resize 상한 역시 같은 surface rect를 소비한다.

## 2. 데이터 모델

목표 schema는 다음과 같다. 이름은 구현 시 기존 export 충돌을 피하되 의미를 바꾸지
않는다.

```ts
type PanelWorkspacePlacementZone =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

interface PanelWorkspaceClusterV3 {
  id: string;
  placementZone: PanelWorkspacePlacementZone;
  columns: PanelWorkspaceColumnV3[];
}

interface PanelWorkspaceLayoutV3 {
  version: 3;
  migrationSource?: { version: 2; migrationId: string };
  visibility: Partial<Record<PanelId, boolean>>;
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>;
  clusters: PanelWorkspaceClusterV3[];
  clusterFocusOrder: string[];
}
```

v3 persisted JSON에는 `position`, `x`, `y`, `anchor: "floating"`을 두지 않는다.
`clusterFocusOrder`는 **bottommost -> topmost** 순서이며 배열의 마지막 ID가 topmost다.
focus된 cluster는 배열 끝으로 이동한다. 이 순서는 현행 v2 `floatingFocusOrder`와
`PanelWorkspace.tsx`의 큰 index = 큰 z-index 의미를 그대로 계승한다. focus order는 겹침 시
z-order만 결정하며 geometry에는 관여하지 않는다. zone은 non-overlap grid cell이 아니라
alignment anchor다. 큰 cluster끼리 인접 zone 경계를 넘어 겹칠 수 있으며 자동
밀어내기로 위치를 바꾸지 않는다. activity rail로 모든 cluster를 다시 활성화할 수 있게 한다.

### 2.1 normalize 불변식

1. 등록된 panel ID는 세 `railOrder` 중 정확히 한 곳에 존재한다.
2. 등록된 panel ID는 cluster row에 정확히 한 번 존재한다.
3. non-empty cluster는 정확히 하나의 `placementZone`을 갖는다.
4. 하나의 zone은 최대 하나의 cluster를 소유한다.
5. cluster는 최대 두 column을 갖고, column과 row는 빈 배열로 persist하지 않는다.
6. `clusterFocusOrder`에는 모든 non-empty cluster ID가 정확히 한 번 존재한다. parser가
   누락 ID를 복구할 때는 기존 유효 순서를 보존하고 `clusters` index 순으로 배열 앞에
   추가해 bottommost로 둔다. activation/focus로 새로 생긴 cluster는 배열 끝에 추가한다.
7. width/height는 registry min/max와 placement surface의 실제 가용 크기로 normalize한다.
8. visibility는 placement와 독립이다. hidden row를 normalize 과정에서 삭제하지 않는다.

### 2.2 transient drag state

자유 좌표는 persisted layout이 아니라 interaction session에만 둔다.

```ts
type PanelDropCandidate =
  | { kind: "panel-edge"; panelId: PanelId; edge: PanelSnapEdge }
  | { kind: "zone"; zone: PanelWorkspacePlacementZone }
  | null;

interface PanelWorkspaceDragSession {
  panelId: PanelId;
  baseLayout: PanelWorkspaceLayoutV3;
  previewGeometry: PanelFrameGeometry;
  candidate: PanelDropCandidate;
}
```

`previewGeometry`는 coordinator presentation input일 뿐 persistence input이 아니다.
`baseLayout`은 Escape, pointer cancellation, invalid drop의 rollback 정본이다.

## 3. solver와 interaction 계약

### 3.1 zone geometry

placement surface 크기를 `W x H`, fit 후 cluster 크기를 `w x h`라 하면 origin은 다음
순수식으로 계산한다.

| zone           |             x |             y |
| -------------- | ------------: | ------------: |
| `top-left`     |           `0` |           `0` |
| `top`          | `(W - w) / 2` |           `0` |
| `top-right`    |       `W - w` |           `0` |
| `left`         |           `0` | `(H - h) / 2` |
| `center`       | `(W - w) / 2` | `(H - h) / 2` |
| `right`        |       `W - w` | `(H - h) / 2` |
| `bottom-left`  |           `0` |       `H - h` |
| `bottom`       | `(W - w) / 2` |       `H - h` |
| `bottom-right` |       `W - w` |       `H - h` |

fit과 min/max를 먼저 적용한 뒤 origin을 계산한다. origin을 먼저 만들고 사후 clamp해
anchor가 흔들리는 순서를 금지한다.

이 계약으로 `top-right` cluster에 horizontal panel을 추가해 전체 폭이 바뀌어도
`originX = W - newWidth`가 다시 계산되므로 cluster의 right edge는 움직이지 않는다.
기존 `position.x +=/-=` 보정은 사용하지 않는다.

### 3.2 candidate 판정 우선순위

한 frame에서 active candidate는 최대 하나다.

1. snapshot adjacency가 허용하는 `panel-edge`
2. empty 또는 hidden-only reserved `zone`
3. `null`

panel edge 후보는 모든 panel의 네 면을 일괄 활성화하지 않는다.

- top/bottom은 해당 column의 first/last visible row에서만 노출한다.
- left/right은 해당 cluster의 outermost column face에서만 노출한다.
- column 상한 2, min size, placement surface fit을 위반할 face는 후보에서 제외한다.
- source panel과 source cluster가 차지하던 자리는 `baseLayout`에서 source를 제외한
  가상 graph를 기준으로 판정한다.

zone 후보는 placement surface의 normalized 3x3 hit region으로 판정한다. 경계에서
candidate가 흔들리지 않도록 현재 candidate에 screen-pixel hysteresis를 적용하되,
최종 drop은 pointerup 시점 snapshot으로 다시 검증한다.

### 3.3 drop transaction

- `panel-edge`: source를 detach한 뒤 target cluster에 row/column으로 삽입하고 target
  `placementZone`을 유지한다.
- `zone`: source를 detach한 뒤 해당 zone의 새 cluster를 만들거나 hidden-only cluster에
  기본 정책으로 삽입한다.
- `null` 또는 재검증 실패: `baseLayout`을 coordinator에 다시 publish하고 persistence
  write 없이 종료한다.
- valid drop: normalize 성공 뒤 committed layout을 정확히 한 번 publish/persist한다.

move 중에는 `previewGeometry`로 presentation snapshot만 갱신한다. 매 move마다
`detachPanelToFloatingCluster()`를 호출하거나 v3 layout을 복제해 자유 좌표를 넣지 않는다.

### 3.4 Photoshop stack/column insertion

- right 기본 cluster의 첫 column은 rightmost column이다. overflow column은 배열상 앞에
  삽입해 시각적으로 왼쪽에 생긴다.
- left 기본 cluster의 overflow column은 배열상 뒤에 삽입해 오른쪽에 생긴다.
- top/bottom edge snap은 target column의 first/last visible boundary에 row를 삽입한다.
- left/right edge snap은 cluster outer face에 column을 삽입한다. 두 column이면 후보를
  만들지 않는다.
- shared column splitter는 ADR-922의 paired resize를 유지한다. cluster 총폭은 고정하고
  두 column을 반대 방향으로 조정하며, min/max에 닿은 방향만 멈춘다.

### 3.5 resize

- resize pointerdown의 `startLayout`과 시작 pointer 좌표를 reference frame으로 고정한다.
- 매 move는 reference에서 다시 계산하고 clamp한다. 이전 clamped 결과에 incremental
  delta를 누적하지 않는다.
- zone anchor point는 resize 동안 고정된다. 예를 들어 `top-right`는 top/right edge가,
  `bottom`은 bottom/center가 고정된다.
- top/bottom 최대 높이는 config 상수가 아니라 placement surface 실제 높이다.
- CSS surface inset 때문에 별도의 top/bottom gap 산술을 추가하지 않는다.

### 3.6 visual contract

- snap line은 active candidate의 실제 가능한 face 하나에만 표시한다.
- snap line 색은 panel resize hover bar와 동일한 CSS custom property를 사용한다.
- horizontal snap line의 height와 horizontal resize hover bar의 height가 같아야 한다.
- vertical snap line의 width와 vertical resize hover bar의 width가 같아야 한다.
- 9-zone overlay는 drag 중에만 mount하고 `aria-hidden="true"` presentation으로 둔다.
- grabber, splitter, focus/keyboard semantics는 ADR-922 계약을 유지한다.

## 4. migration과 persistence

### 4.1 v2 -> v3

1. 현행 v2 parser/normalizer로 input을 먼저 검증한다.
2. migrator는 실제 `.panel-workspace-placement-surface`의 non-zero local rect를 필수 입력으로
   받는다. store 초기화 시 임의 viewport 상수로 migration하지 않으며, primary는 v2로 parse한
   뒤 surface 최초 측정 전까지 v3 write를 보류한다. fixture는 같은 v2 raw, registry,
   migrationId와 surface rect에 byte-identical JSON을 요구한다.
3. `left/right/bottom` anchored record는 각각 `top-left/top-right/bottom`으로 매핑한다.
4. floating cluster는 입력 surface rect로 현행 v2 solver geometry를 한 번 산출한 뒤 cluster
   center와 아홉 zone anchor의 normalized 거리가 가장 가까운 zone을 선택한다.
5. v2 `floatingFocusOrder`와 v3 `clusterFocusOrder`는 모두 bottommost -> topmost이며 tail이
   topmost다. zone collision 배정은 focus index 내림차순, 즉 tail부터 순회한다. focus order에
   없는 cluster는 원본 `clusters` index 오름차순으로 그 뒤를 잇고, 같은 거리에서는 고정 zone
   enum 순서를 사용한다. output `clusterFocusOrder`는 원래 bottommost -> topmost 상대 순서를
   보존한다.
6. non-empty cluster가 9개를 넘으면 미배정 cluster를 cluster 단위로 임의 zone에 넣지 않는다.
   각 row의 rail side는 registry `defaultPosition`이 아니라 persisted `railOrder` membership으로
   결정한다. 미배정 cluster의 `(cluster index, column index, row index)` 오름차순으로 row를
   flatten하고 `left -> top-left`, `right -> top-right`, `bottom -> bottom`에 route한다. target
   zone cluster의 merge column은 left=마지막 column, right=첫 column, bottom=첫 column이며,
   없으면 하나를 만든다. row는 stable 순서로 끝에 append하고 column width는 source/target
   preference의 큰 값으로 normalize한다. 두 column 상한은 넘기지 않는다. 이 fallback은 panel
   ID, visibility, rail membership, row height와 stable order를 보존하지만 overflow source의
   cluster/column 경계는 의도적으로 보존하지 않는다.
7. 모든 panel ID가 정확히 한 row/rail에 존재하는지 normalize하고 v3를 만든다.

G1에는 tail-topmost collision winner와 10번째 mixed-rail cluster를 포함한 기대 JSON을
고정한다. 같은 input에서 zone winner, row route와 output focus order가 모두 같아야 한다.

### 4.2 durable migration

primary key는 현행 `composition-panel-layout`을 유지하고 production cutover 뒤
`version: 3`으로 쓴다. migration envelope는 exact v2 raw와 `migrationId`,
`state: "prepared" | "committed"`를 `composition-panel-layout.v2-backup`에 저장한다.

write 순서는 고정한다.

1. exact v2 raw를 matching `migrationId`의 `prepared` backup으로 쓴다.
2. primary가 여전히 같은 v2 raw인지 재확인한 뒤 같은 `migrationId`를
   `migrationSource`에 가진 v3 primary를 쓴다.
3. primary v3와 backup raw를 재검증한 뒤 backup marker를 `committed`로 쓴다.

hydration/recovery는 다음 상태표를 따른다.

| primary                        | v2 backup                             | 처리                                                                           |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------ |
| valid v2                       | matching prepared/committed 또는 없음 | v2 runtime 유지; actual surface 측정 뒤 migration 시작/재시도                  |
| valid v3                       | matching prepared                     | v3와 migrationId를 검증하고 marker commit 재시도; 성공 전 hydration ready 금지 |
| valid v3                       | matching committed                    | 정상 v3 hydration                                                              |
| malformed/missing              | parse 가능한 matching backup          | exact v2 raw를 primary로 복원하고 v2 runtime 유지                              |
| v3와 backup migrationId 불일치 | any                                   | fail closed memory fallback; stale backup/default를 primary에 쓰지 않음        |

`setItem` 세 경계마다 crash/quota fault를 주입하고 재실행 결과가 위 표와 같아야 한다. v2
reader는 compatibility window 동안 read-only boundary로 유지하고 dual-write는 하지 않는다.

### 4.3 operational rollback

direct pre-v3 build 배포는 rollback 절차가 아니다. 지원되는 최소 target은 v3 primary와 두
backup envelope를 이해하고 actual placement surface rect를 소비하는 **Phase 2 recovery
build**다. 이 build가 primary를 valid v2로 만든 뒤에만 pre-v3 build를 실행할 수 있다.

rollback source는 다음처럼 구분한다.

- **migration 직후 무편집**: backup raw를 같은 surface rect와 migrationId로 다시 migrate한
  결과가 current v3 primary와 byte-identical하면 exact v2 raw를 복원한다.
- **migration 이후 편집**: stale v2 backup을 복원하지 않는다. current v3를
  `projectPanelWorkspaceLayoutV3ToV2()`로 projection한다.
- **v3-born**: v2 backup이 없으므로 current v3 projection만 허용한다.

projection은 `placementZone`을 actual surface rect의 v2 floating `position`으로 변환하고
column/row, panel ID, visibility, `railOrder`, width/height, bottommost -> topmost focus order를
보존한다. v2에 없는 zone identity만 좌표로 손실된다. primary를 덮어쓰기 전에 exact current
v3 raw를 `composition-panel-layout.v3-rollback-backup`의 `prepared` envelope로 저장하고,
valid v2 primary write 뒤 `committed`로 바꾼다. rollback write 경계 crash는 다음 상태표로
recovery한다.

| rollback primary             | v3 rollback backup | 처리                                                                                        |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| original valid v3            | matching prepared  | backup raw와 primary 동등성을 확인하고 rollback 재시도 또는 명시적 중단; primary write 없음 |
| projected/restored valid v2  | matching prepared  | v2 parse와 panel 불변식을 검증하고 marker를 `committed`로 repair                            |
| projected/restored valid v2  | matching committed | rollback 완료; pre-v3 build 실행 허용                                                       |
| malformed 또는 backup 불일치 | any                | fail closed; stale v2/default write 금지                                                    |

v3 raw와 v2 projection이 모두 parse되지 않으면 fail closed한다.

영향 범위는 v2 local layout record 보유자의 100%에서 record 1개 migration이다.
`CompositionDocument`, project file, IndexedDB project row, Supabase row 재직렬화는 0개다.

## 5. 구현 단계

### Phase 0 — current contract와 fixture freeze

- 현재 HEAD와 사용자 보유 worktree diff를 구분해 production baseline을 고정한다.
- v2 parser/solver/runtime/persistence와 drag/snap/resize producer-consumer를 전수화한다.
- right/top default, 9-zone, invalid drop, paired resize, hidden reopen, 10+ floating cluster
  migration fixture를 만든다.
- **G0** 통과 전 production owner를 바꾸지 않는다.

#### 실행 기록 — G0 PASS (2026-08-19)

- [Phase 0 panel placement baseline](186-phase-0-panel-placement-baseline.md)에 기준 HEAD,
  v2 producer/consumer 12개 파일, browser hydration과 fixture oracle을 기록했다.
- `panelWorkspaceAdr186.testFixtures.ts`와 `panelWorkspaceAdr186Baseline.test.ts`에서
  default/9-zone/invalid/resize/reopen/10+ cluster 계약을 고정했다.
- focused Vitest 6 files, 59 tests가 통과했고 production owner/state/renderer 변경은 0개다.
- Phase 1의 R1/R10은 HIGH이므로 사용자 확인 전에는 v3 migration 구현에 진입하지 않는다.

### Phase 1 — v3 model, pure migration, durable backup

- v3 types/parser/normalizer/default layout을 추가한다.
- surface rect를 명시적으로 받는 v2 -> v3 migration, prepared/committed v2 backup과 recovery
  상태표를 구현한다.
- malformed, collision, registry add/remove, tail-topmost, mixed-rail 10+ cluster, migration
  write-boundary crash fixture를 통과한다.
- **G1** 통과 전 runtime hydration을 v3로 전환하지 않는다.

#### 실행 기록 — G1 PASS (2026-08-19)

- [Phase 1 v3 model and durable migration](186-phase-1-v3-model-migration.md)에 v3
  schema/normalize, measured-surface migration, prepared/committed recovery와 crash matrix를
  기록했다.
- focused Vitest 9 files, 78 tests와 `pnpm type-check`가 통과했다.
- local Builder primary는 계속 `version: 2`이고 v2 backup key는 생성되지 않았다. 신규 v3
  module은 production store/runtime/renderer에 연결하지 않았다.
- Phase 2의 R2/R10은 HIGH이므로 사용자 확인 전에는 zone surface와 rollback recovery build
  구현에 진입하지 않는다.

### Phase 2 — zone solver와 placement surface

- 9-zone origin pure solver를 추가한다.
- common CSS inset placement surface를 실제 containing block으로 전환한다.
- v3 -> v2 projection과 `v3-rollback-backup` recovery를 추가해 Phase 2 build를 최소
  operational rollback target으로 만든다.
- right-edge/top-edge/bottom-edge 불변, resize fit, narrow viewport, migrated-post-edit와
  v3-born rollback fixture를 통과한다.
- **G2** 통과 전 drag interaction을 전환하지 않는다.

#### 실행 기록 — G2 PASS (2026-08-19)

- [Phase 2 zone solver, placement surface, and rollback target](186-phase-2-zone-solver-placement-surface.md)에
  fit-before-origin 9-zone geometry, common actual 4px surface와 v3 -> v2 rollback crash
  matrix를 기록했다.
- panel workspace focused Vitest 21 files, 156 tests, typecheck와 preflight를 통과했다.
- local Builder에서 top/right/bottom/left inset 4px, dock-surface edge 오차 0px와 visible
  frame containing block 3/3 일치를 실측했다.
- production drag/runtime/state는 계속 v2이며 G2 전에 금지된 Phase 3 candidate/drop
  transaction은 시작하지 않았다.

### Phase 3 — transient drag와 candidate/drop transaction

- free XY를 `PanelWorkspaceDragSession.previewGeometry`로 격리한다.
- panel adjacency와 zone candidate를 하나의 resolver 결과로 합친다.
- valid drop 1 commit, invalid/Escape/cancel 0 commit + base rollback을 구현한다.
- snap/resize bar token과 thickness를 단일화한다.
- **G3** 통과 전 v2 free-position path를 제거하지 않는다.

### Phase 4 — activation, resize, reset 정책

- rail activation의 Photoshop 기본 stack/overflow를 v3 zone cluster에 연결한다.
- hidden reopen, cross-rail snap 시 rail identity 보존, explicit reset을 검증한다.
- reference-frame resize와 paired shared splitter를 전 zone에서 검증한다.
- **G4** 통과 전 compatibility path 제거를 시작하지 않는다.

### Phase 5 — production cutover와 v2 free-XY 제거

- coordinator/runtime/persistence의 production type을 v3로 전환한다.
- `floatAnchoredPanelWorkspaceClusters`, persisted floating position writer,
  unsnapped drop commit을 제거한다.
- focused tests, type-check, preflight와 실제 Builder move/resize/snap/reload/reset smoke를
  통과하고 evidence를 남긴다.
- Phase 2 recovery build로 migration 직후 exact restore, migrated-post-edit projection,
  v3-born projection을 각각 실행한 뒤 pre-v3 build가 valid v2 primary를 hydrate하는 old-code
  rollback rehearsal을 통과한다.
- **G5** 통과 뒤 ADR-186을 Implemented로 승격하고 ADR-922의 placement 부분 대체 링크를
  추가한다.

## 6. 파일 경계

| 파일/모듈                                                         | 책임                                                             | 예상 변경         |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| `panelWorkspaceLayoutV3.ts`                                       | v3 schema, normalize, default mapping, 9-zone solver             | 신규              |
| `panelWorkspaceLayoutV3Migration.ts`                              | v2 geometry quantization, collision 처리                         | 신규              |
| `panelWorkspaceLayoutV2Persistence.ts` 또는 후속 persistence 모듈 | v2 backup, v3 primary, v3 -> v2 rollback projection/recovery     | 수정/이름 정리    |
| `stores/panelLayout.ts`                                           | surface 측정 전 migration 보류, v2/v3 hydration과 rollback 진입  | 수정              |
| `panelWorkspaceLayoutCoordinator.ts`                              | v3 committed graph + transient preview snapshot                  | 수정              |
| `panelWorkspaceRuntime.ts`                                        | drag session, valid commit/invalid rollback                      | 수정              |
| `panelWorkspaceLayoutInteraction.ts`                              | zone placement, panel-relative graph mutation, activation/resize | 수정              |
| `panelWorkspaceZoneDrop.ts`                                       | 9-zone hit-test와 candidate union                                | 신규              |
| `panelWorkspaceDockDrop.ts`, `panelSnap.ts`                       | adjacency 가능한 face만 candidate로 제공                         | 수정              |
| `PanelWorkspace.tsx`                                              | placement surface, zone overlay, 단일 active snap line           | 수정              |
| `PanelWorkspace.css`                                              | common 4px inset, snap/resize shared token/thickness             | 수정              |
| 인접 `*.test.ts(x)`                                               | model/migration/solver/interaction/static regression             | 추가/수정         |
| `docs/CHANGELOG.md`, ADR 문서군                                   | 사용자-가시 cutover와 evidence                                   | 구현 완료 시 갱신 |

사용자 worktree의 기존 panel 변경을 구현 착수 전에 별도 baseline으로 확정한다. ADR-186
구현이 무관한 변경을 되돌리거나 포맷하지 않는다.

## 7. 검증 매트릭스

| 축            | 필수 케이스                                                     | 통과 조건                                                                        |
| ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| default       | left/right/bottom 첫 활성화                                     | `top-left/top-right/bottom`, surface edge 오차 <= 0.5px                          |
| stack         | right panel 3개 활성화                                          | 아래 stack, overflow column은 왼쪽, right edge 오차 <= 0.5px                     |
| zones         | 아홉 zone 순회 drop                                             | 성공 layout 9/9에 `placementZone`, persisted XY 0건                              |
| relative snap | 각 zone에서 top/right/bottom/left                               | 가능한 outer face만 표시, target zone 승계                                       |
| invalid       | zone/edge 밖 release, Escape, pointer cancel                    | base geometry/graph 복귀, persistence write 0                                    |
| rail identity | right panel을 left/center panel에 snap                          | rail button은 right 유지, reopen은 last placement                                |
| hidden        | cluster 전부 hide 후 reopen/zone drop                           | reservation 유지, duplicate zone/row 0                                           |
| resize        | 9 zone outer/shared edge, min/max 왕복                          | anchor drift <= 0.5px, clamp 복귀 drift 0                                        |
| migration     | anchored/floating/collision/mixed-rail 10+/malformed/tail focus | measured surface 입력, panel ID 누락·중복 0, exact v2 backup, deterministic JSON |
| rollback      | write-boundary crash, exact/migrated-post-edit/v3-born          | Phase 2 recovery 뒤 valid v2 primary, panel/rail/visibility/size/order 손실 0    |
| viewport      | 320x180 경계, resize, DPR 1/2                                   | surface 이탈 0, top/bottom actual gap 4px                                        |
| visual        | snap line/resize hover bar                                      | 동일 color token, horizontal height/vertical width 동일                          |
| performance   | 5초 pointer move                                                | DOM geometry query 0, solve/publish RAF당 <=1, baseline delivery -5pp 이내       |
| persistence   | valid/invalid drop 후 reload                                    | valid 1회 복원, invalid write 0, project/DB write 0                              |

## 8. 완료 조건

- G0~G5 evidence가 `docs/adr/design/`에 기록돼 있다.
- v3 primary JSON에 arbitrary `position/x/y`가 없다.
- production drag의 자유 좌표가 interaction session 밖으로 유출되지 않는다.
- Photoshop 기본 rail placement와 Pencil 9-zone, panel-relative cluster snap이 하나의
  coordinator graph를 소비한다.
- right/top/bottom zone anchor, common 4px surface, snap/resize visual contract가 브라우저
  실측으로 고정돼 있다.
- 모든 v2 migration fixture에서 panel/rail/visibility 누락이 0이다. Phase 2 recovery build가
  migration 직후 exact restore와 migrated-post-edit/v3-born projection을 valid v2 primary로
  만들고 old-code rollback rehearsal을 통과한다.
- focused Vitest, `pnpm run codex:typecheck`, `pnpm run codex:preflight`, local Builder smoke가
  통과한다.
- ADR-922는 전체 폐기하지 않고 placement 부분에 ADR-186 후속 링크만 추가한다.

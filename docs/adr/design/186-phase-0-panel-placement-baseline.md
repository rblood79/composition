# ADR-186 Phase 0: Panel placement contract baseline

## 판정

**G0 PASS — 2026-08-19**

production panel owner와 persisted schema는 v2를 유지한 채 ADR-186 진입 기준선을
고정했다.

- 기준 HEAD와 사용자 worktree를 분리해 확인했다.
- v2 parser/solver/runtime/persistence 및 drag/snap/resize producer-consumer 12개
  production 파일을 전수화했다.
- Photoshop 기본 rail-to-zone 매핑, Pencil 9-zone origin, invalid drop rollback,
  paired resize, hidden reopen, mixed-rail 10+ floating migration 입력을 test-only fixture로
  고정했다.
- production source 변경은 0개다.

이 문서는 Phase 1 이후 v3 model/migration 결과와 비교할 oracle이다. v2의 persisted
arbitrary floating XY와 unsnapped move commit은 현행 결함으로 기록하되 Phase 0에서
보정하지 않는다.

## 실행 환경

| 항목              | 값                                                                   |
| ----------------- | -------------------------------------------------------------------- |
| 기준 commit       | `01ca1829d`                                                          |
| 기준 branch       | `main`, `origin/main`과 일치                                         |
| 기준 worktree     | Phase 0 착수 전 clean                                                |
| Builder           | `http://localhost:5173/builder/9a089720-8f73-40ea-916a-bf58c2f49599` |
| 브라우저 viewport | 1280x720, `.panel-workspace` 1272x664                                |
| persisted record  | `composition-panel-layout`, `version: 2`                             |
| schema build 상태 | `.claude/.spec-rebuild-pending` 없음, `packages/specs/dist` 존재     |

브라우저 검증은 격리된 Playwright profile에서 수행했다. 이 profile에는 지정 route의
IndexedDB project/documents row가 없어 Builder가 빈 문서 fallback으로 열렸고, 해당
read-miss error 2건은 panel contract와 별개의 환경 제한으로 기록했다. panel shell과 v2
localStorage hydration은 정상적으로 관측했다.

## v2 state contract freeze

`PanelWorkspaceLayoutV2`는 다음 필드를 production persistence의 정본으로 사용한다.

| 필드                 | 현재 의미                                                      |
| -------------------- | -------------------------------------------------------------- |
| `version: 2`         | persisted layout schema 식별자                                 |
| `visibility`         | panel별 표시 상태; hidden row의 placement는 보존               |
| `railOrder`          | left/right/bottom activity rail identity와 기본 순서           |
| `clusters`           | anchor/floating cluster의 최대 2-column, column/row graph      |
| `cluster.anchor`     | `left`, `right`, `bottom`, `floating`                          |
| `cluster.position`   | floating cluster만 갖는 persisted arbitrary workspace-local XY |
| `floatingFocusOrder` | bottommost -> topmost 순서; 배열 tail이 topmost                |

현재 runtime은 anchored cluster를 presentation 시 floating geometry로 승격할 수 있다.
실제 browser DOM에서 v2 record의 `anchor:left`/`anchor:right`는 각각 `data-anchor="floating"`,
`data-mode="placed"`인 Nodes/Properties frame으로 표현됐다. 이는 ADR-922의 현행
compatibility path이며 Phase 5 이전에는 제거하지 않는다.

## producer / consumer inventory

production source에서 v2 layout을 직접 생산하거나 소비하는 12개 파일을 freeze했다.

| 파일                                              | 분류                    | 현재 역할                                                    |
| ------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `layout/panelWorkspaceLayoutV2.ts`                | schema/parser/solver    | v2 type, parse, normalize, default, snapshot geometry        |
| `layout/panelWorkspaceLayoutV2Migration.ts`       | migration producer      | legacy v1 -> v2 pure migration                               |
| `layout/panelWorkspaceLayoutV2Persistence.ts`     | persistence owner       | primary/backup envelope, load/write/recovery                 |
| `stores/panelLayout.ts`                           | state owner             | hydrate, runtime set, 300ms debounced v2 write               |
| `layout/panelWorkspaceRuntime.ts`                 | transaction owner       | begin/end/cancel, move/snap/resize/activation transaction    |
| `layout/panelWorkspaceLayoutInteraction.ts`       | graph mutation producer | detach, snap, drop, activate, resize, visibility, focus      |
| `layout/panelWorkspaceLayoutCoordinator.ts`       | snapshot consumer       | v2 solve 결과를 immutable presentation snapshot으로 publish  |
| `layout/PanelWorkspace.tsx`                       | host + gesture producer | pointer preview, snap candidate, commit/cancel, frame render |
| `layout/panelWorkspaceDockDrop.ts`                | candidate consumer      | current graph/snapshot 기반 panel-edge drop target 계산      |
| `hooks/usePanelLayout.ts`                         | action facade           | panel toggle/reset/placement action을 store/runtime에 연결   |
| `panels/datatable/stores/dataTableEditorStore.ts` | direct action producer  | DataTable Editor panel activation 경로                       |
| `layout/types.ts`                                 | public type consumer    | panel workspace snapshot/layout contract 재노출              |

## fixture와 current behavior oracle

| 계약                   | 고정한 기준                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| Photoshop default      | left -> `top-left`, right -> `top-right`, bottom -> `bottom`               |
| Pencil zones           | 9개 zone vocabulary와 1200x800 surface, 200x100 cluster의 exact origin 9/9 |
| current unsnapped move | v2 runtime이 `{x:720,y:96}` arbitrary floating position을 commit           |
| invalid/cancel         | interaction cancel은 시작 graph의 byte-equivalent layout을 복원            |
| hidden reopen          | History off/on 뒤 row와 `railOrder.right` 중복 0                           |
| paired resize          | Properties +30, History -30; 총 row height 970 유지                        |
| migration stress input | 10 floating cluster, 12 panel, mixed left/right/bottom cluster, hidden row |
| focus order            | mixed cluster bottommost, `bottom-right` cluster tail/topmost              |

fixture는 `panelWorkspaceAdr186.testFixtures.ts`에만 있고 production module에서 import하지
않는다. 10+ migration fixture는 Phase 1 v2 -> v3 migrator의 panel/rail/visibility/cluster
무손실 oracle로 재사용한다.

## Browser baseline

- v2 localStorage record는 13개 registry panel을 세 rail에 정확히 한 번 보유했다.
- visible panel은 Nodes와 Properties였고 hidden panel row도 cluster에 남아 있었다.
- `.panel-workspace`는 1272x664였다.
- Nodes는 x=56, y=52, 233x320, Properties는 x=999, y=52, 233x520이었다.
- 두 frame 모두 `data-mode="placed"`, presentation `data-anchor="floating"`였다.
- 지정 route의 project row 부재로 Canvas/project content smoke는 수행하지 않았고 panel
  layout shell/hydration만 G0 browser evidence로 사용했다.

## G0 gate 결과

- [x] 기준 HEAD `01ca1829d`, clean main, `origin/main` 일치 확인
- [x] v2 placement producer/consumer 12개 production 파일 inventory
- [x] right/top default와 9-zone 9/9 origin fixture
- [x] current arbitrary XY commit과 invalid/cancel rollback fixture
- [x] paired resize와 hidden reopen fixture
- [x] mixed-rail 10+ floating cluster migration 입력 fixture
- [x] focused Vitest 6 files, 59 tests PASS
- [x] local Builder v2 hydration과 active frame geometry 관측
- [x] production owner/state/renderer 변경 0
- [x] CSS/Skia cross-check N/A — test/docs only, generated spec dist fresh

## Phase 1 진입 제약

Phase 1은 이 기준선을 유지한 채 신규 v3 model/parser/normalizer/default, measured-surface
v2 -> v3 pure migration, prepared/committed v2 backup과 recovery만 추가해야 한다. production
store/runtime hydration과 primary v2 writer는 G1 통과 전 전환하지 않는다. R1과 R10은
HIGH이므로 Phase 1 착수 전에 사용자 확인이 필요하다.

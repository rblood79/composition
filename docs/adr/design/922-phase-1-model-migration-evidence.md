# ADR-922 Phase 1: v2 model, solver, migration evidence

## 판정

**G1 PASS — 2026-08-18**

Phase 1은 v2 layout을 production에 활성화하지 않고 다음 read-only/pure 경계를 먼저
고정했다.

- exact `PanelWorkspaceLayoutV2` schema와 registry-driven normalization
- anchored/floating placement graph와 constrained presentation solver
- v1 parse 및 v1→v2 pure migration
- exact raw `prepared`/`committed` backup protocol
- v2-primary-aware v1 compatibility reader와 v2-born projection

기존 `stores/panelLayout.ts`, `PanelWorkspace`, Canvas/Preview/Publish 경로는 변경하지 않았다.
Production live store와 `composition-panel-layout` primary record는 계속 v1이다.

## 구현 경계

| 계층         | 파일                                   | 책임                                                                       |
| ------------ | -------------------------------------- | -------------------------------------------------------------------------- |
| model/solver | `panelWorkspaceLayoutV2.ts`            | schema, input validation, registry normalization, inset/constrained solve  |
| migration    | `panelWorkspaceLayoutV2Migration.ts`   | v1 parser, six-shape migration, lossless compatibility metadata projection |
| persistence  | `panelWorkspaceLayoutV2Persistence.ts` | injected storage를 사용하는 crash-safe write protocol과 compatibility read |

세 모듈은 기존 production source에서 import되지 않는다. storage API도 browser global을 직접
읽지 않고 `PanelWorkspaceStorage`를 주입받는다. 따라서 Phase 1 code는 test/rehearsal에서만
실행되고 project DB, Supabase, canonical document를 읽거나 쓰지 않는다.

## v2 model 불변식

fixture에서 다음을 검증했다.

- registry panel은 placement graph와 전체 rail order에 각각 정확히 한 번 존재한다.
- unknown/removed/duplicate panel ID를 제거한다.
- anchor별 cluster는 최대 한 개, column은 최대 두 개다.
- row height와 column width를 registry min/max로 검증한다.
- valid v2 parse는 idempotent하다.
- registry에 panel이 추가되면 hidden/default anchor row와 default rail 끝에만 추가한다.
- removed panel은 geometry를 포함한 모든 surface에서 제거한다.
- registry evolution 전후 기존 known panel의 order/geometry는 유지한다.

## constrained solver

고정 수식은 breakdown의 다음 값을 그대로 사용한다.

- panel/column gap: 4px
- minimum main content: 320x180
- width 충돌 순서: left를 먼저 overlay하고 right를 가능한 한 anchored로 유지
- height 충돌: bottom을 overlay
- constrained presentation은 persisted anchor/preferred size를 변경하지 않음
- viewport가 panel min보다 작을 때만 rendered geometry를 min 아래로 emergency clamp
- 확장 solve는 같은 persisted input에서 원 anchor/preferred size로 복귀

800x900의 DataTable Editor left + Properties right fixture는 left만
`constrained-overlay`로 전환하고 main width를 non-negative로 유지한다. 1400x900에서는
persisted layout mutation 없이 left가 다시 `anchored`가 된다. 200x120 emergency fixture도
Monitor frame과 main rect가 viewport 밖이나 음수로 내려가지 않는다.

## v1 migration matrix

| Fixture                      | 고정 결과                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| default                      | Nodes/Properties visibility, 모든 registry placement 1회         |
| left/right multi-active      | 각 active panel visibility 보존                                  |
| Monitor bottom active        | bottom anchor와 `bottomHeight` 보존                              |
| floating only                | position/size/focus order 보존                                   |
| snapped two-column           | column 순서/폭/row membership 보존                               |
| invalid/removed/duplicate ID | invalid 제거, missing known panel default 추가                   |
| legacy singular active field | `activeLeftPanel`/`activeRightPanel`을 current visibility로 승격 |

Pure mapper는 ID를 생성하거나 storage를 쓰지 않는다. writer가 주입한 `migrationId`만
`migrationSource`에 복사하고 cluster/column ID는 입력과 anchor/panel ID에서 결정적으로
파생한다.

## backup / rollback rehearsal

| Sequence                       | 결과                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| 정상                           | prepared backup → primary v2 → committed backup                  |
| backup write 실패              | primary v1 byte-equivalent 유지                                  |
| primary write 실패             | primary v1 + prepared backup 유지                                |
| committed mark 실패            | primary v2 + prepared 유지, 다음 load에서 committed 복구         |
| prepare 뒤 primary 변경        | primary write 중단, 다음 실행에서 최신 raw/migrationId로 refresh |
| prepared backup 변조           | primary write 전 재검증 실패로 중단                              |
| invalid primary + valid backup | exact backup v1 복원 후 migration                                |
| primary v2 + committed backup  | backup write 0                                                   |
| migrated v2 compatibility read | 같은 migrationId와 동일 migration 결과인 exact backup v1 사용    |
| v2-born/unrelated backup       | stale backup을 거부하고 read-only projection 사용                |
| primary/backup 모두 invalid    | 이 경우에만 explicit default view                                |

Compatibility projection은 legacy `PanelLayoutState`와 함께 별도 metadata에 rail order,
actual anchor/floating membership, preferred sizes를 보존한다. v1이 rail과 anchor를 같은
배열에 겹쳐 표현하는 한계를 metadata로 분리해 v2-born record를 조용히 default로 버리지
않는다. 이 projection은 emergency rehearsal용이며 operational rollback target은 설계대로
Phase 3 이상이다.

## production isolation / cross-check

- 기존 store의 `panelWorkspaceLayoutV2*` import: 0
- Spec/CSS/Skia/Preview/Canvas import 및 변경: 0
- canonical project/DB/Supabase 접근: 0
- `.spec-rebuild-pending`: 없음, `packages/specs/dist`: 존재
- authenticated Builder smoke: frame 13개, v2 DOM marker 0개
- History v1 toggle: placed frame 표시 → 같은 stable frame의 hidden/display-none 복귀
- browser console error: 0

## 검증

- G1 fixture: 3 files, 32 tests
- panel regression fixture 포함: 8 files, 57 tests
- targeted ESLint: 0 error
- `pnpm type-check`: 신규 violation 0, repository baseline 43건 유지
- `pnpm run codex:guard`, `git diff --check`, `pnpm run codex:preflight`

Phase 2는 이 schema를 입력으로 immutable shadow snapshot store와 DOM-query-free candidate
adapter만 추가해야 한다. G2a 전까지 production renderer/store/persistence는 v1을 유지한다.

# ADR-922 Phase 3: real-frame production cutover evidence

## 판정

**G2b PASS / Phase 3 production cutover — 2026-08-18**

Phase 3는 G2a shadow coordinator를 실제 panel frame과 interaction의 유일한 geometry
publisher로 전환했다. G2b를 먼저 통과하기 전에는 production renderer와 primary v1을
유지했고, 통과 뒤에만 canary gate를 제거하고 live store/persistence를 v2로 전환했다.

Phase 4 대상인 실제 workspace `occupiedInsets` 적용과 Canvas consumer 전환은 포함하지
않는다. 기존 `.panel-rail-measure-*`와 `panelLayoutRuntime` bridge는 rollback 경계를 지키기
위해 유지한다.

## G2b real-frame canary

authenticated Builder의 기존 `.panel-workspace`에서 representative 2-frame stack만
exclusive snapshot consumer로 사용했다. 같은 panel의 v1/v2 DOM을 중복 mount하지 않았고,
native RAF interaction transaction을 5초 측정한 뒤 다음 결과를 얻었다.

| 지표                                 |               결과 |                    Gate |
| ------------------------------------ | -----------------: | ----------------------: |
| registry frame / canary active frame |             13 / 2 |            frame 중복 0 |
| display period                       | 8.3ms, 약 120.48Hz |          고정 60Hz 아님 |
| input-to-applied-frame p95           |             15.9ms |             16.6ms 이하 |
| applied version mismatch             |                  0 |                       0 |
| pointer DOM geometry query           |                  0 |                       0 |
| interaction long task                |                  0 |                       0 |
| interaction frame delivery           |              0.995 | baseline 대비 -5pp 이내 |
| baseline frame delivery              |             0.1946 |               비교 기준 |
| `passesG2b`                          |             `true` |                    PASS |

측정 종점은 store publish가 아니라 source와 affected neighbor frame의 geometry style 및
`data-layout-version`이 모두 commit된 뒤 presentation RAF에 도달한 시점이다. 브라우저 제어
표면이 연속 trusted pointer drag를 제공하지 않아 canary의 5초 부하는 동일 production
runtime mutation을 native RAF에서 구동했다. production source 검증은 move/resize handler가
이 runtime만 호출하고 `querySelectorAll`/`getBoundingClientRect`를 갖지 않는 정적 fixture로
보완했다.

## production frame / interaction cutover

- `PanelRegistry.getAllPanels()`의 각 config는 `.panel-workspace` 아래
  `SnapshotPanelFrame` 하나에 고정된다.
- hidden frame도 동일한 React tree 위치를 유지하고 `Activity`로 content lifecycle을
  전환한다.
- frame geometry, visibility와 resize handle marker는 per-panel external-store selector의
  동일 immutable snapshot version에서 나온다.
- move는 panel을 floating cluster로 detach한 뒤 transient geometry를 publish하고, 종료
  시 snapshot target에 top/right/bottom/left snap한다.
- row/column boundary resize는 source와 neighbor의 paired delta를 한 transaction에 반영하고,
  min/max에서 delta 전체를 clamp한다.
- floating left/top outer resize는 반대쪽 edge가 움직이지 않도록 position과 size를 함께
  갱신한다.
- interaction start의 committed layout을 runtime이 보존하며 pointer cancel은 그 raw와
  byte-equivalent인 v2 layout으로 복원한다.
- pointer hot path는 storage를 쓰지 않고, successful end만 Zustand commit과 300ms debounce
  write를 예약한다.

## live store / persistence cutover

production Zustand slice의 SSOT는 `panelWorkspaceLayout: PanelWorkspaceLayoutV2`다.
`PanelLayoutState`는 Phase 6 unused legacy host 제거 전까지 v2에서 투영한 read-only
compatibility view로 유지한다.

| 입력 상태             | production 동작                                           |
| --------------------- | --------------------------------------------------------- |
| v1 primary            | exact raw prepared backup → v2 primary → committed backup |
| prepared + v2 primary | migrationId/raw 검증 뒤 committed recovery                |
| write/commit 실패     | 1회 retry 뒤 v1 compatibility memory fallback             |
| primary 없음          | backup 없는 v2-born default 생성                          |
| valid v2-born primary | primary byte를 다시 쓰지 않고 직접 hydrate                |
| storage read 실패     | memory fallback으로 renderer 계속 동작                    |

panel visibility, cluster graph, preferred size와 floating focus order는 v2 primary 한 건으로
refresh 복원된다. project document/DB/Supabase write는 추가하지 않았다.

## production browser smoke

`http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696`를 canary query 없이
hard navigation해 HMR의 이전 Zustand instance를 배제했다.

- `.panel-workspace`: 1
- `.workspace-panel-frame`: 13, toggle 전후 동일
- History: visible → hidden → visible
- History 재표시 transaction의 active frame version: 모두 `3`, mismatch 0
- hard refresh 뒤 History: visible / placed / version `0`, v2 persistence 복원
- canary marker: 0
- panel shell과 Canvas 화면의 즉시 시각 회귀: 관찰 0

## cross-check

| layer                                | Phase 3 변경                                   | 판정           |
| ------------------------------------ | ---------------------------------------------- | -------------- |
| Panel shell DOM                      | snapshot frame/resize marker와 stable Activity | PASS           |
| panel content CSS/DOM                | 변경 없음                                      | not applicable |
| Spec / Factory / shared CSS Renderer | 변경 없음                                      | not applicable |
| Skia / Preview / Publish             | 변경 없음                                      | not applicable |
| Canvas inset runtime                 | 기존 rail measure bridge 유지                  | Phase 4 대기   |
| canonical project/DB                 | 변경 없음                                      | PASS           |

`.spec-rebuild-pending`는 생성되지 않았다. Phase 3의 browser screenshot에서도 기존 Skia
Canvas와 panel content 자체의 크기·폰트·색상 렌더 경로는 변경되지 않았다.

## 검증

- ADR-922 panel fixture + Canvas consumer cross-check: 16 files, 126 tests
- production browser hard-refresh/toggle/persistence smoke
- targeted ESLint: error 0
- `pnpm type-check`: 신규 violation 0, repository baseline 43건 유지
- `git diff --check`
- `pnpm run codex:guard`
- `pnpm run codex:preflight`

## 잔존 위험과 다음 Gate

- `occupiedInsets`는 아직 실제 main Grid/Flex track을 소유하지 않는다. 숨겨진 rail measure
  DOM과 Canvas inset consumer를 이번 phase에서 부분 제거하지 않았다.
- normal/compare/WebGL-off 공통 main slot, Canvas local rect, scrollbar/minimap/hit-test는
  Phase 4 G3에서 함께 전환해야 한다.
- shared keyboard splitter primitive와 hidden Monitor callback 0 검증은 이후 phase gate에
  남아 있다.

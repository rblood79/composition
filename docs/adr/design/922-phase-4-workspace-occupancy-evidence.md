# ADR-922 Phase 4: workspace occupancy와 Canvas-local metrics evidence

## 판정

**G3 PASS / Phase 4 production cutover — 2026-08-18**

Phase 4는 coordinator snapshot의 `occupiedInsets`를 실제 main Grid track에 한 번 적용하고,
Canvas/scrollbar/minimap이 그 결과인 actual local rect를 다시 보정하지 않도록 전환했다.

visibility lifecycle, shared keyboard splitter와 unused legacy host/file 제거는 각각 Phase 5,
Phase 6 범위이며 이번 cutover에 섞지 않았다.

## 공통 workspace host

`PanelWorkspace`는 다음 sibling을 하나의 `.panel-workspace-host`에서 소유한다.

1. `.panel-workspace-main`: coordinator snapshot의 left/right/bottom inset이 적용되는 Grid cell
2. `.panel-workspace`: 같은 host-local 좌표계의 activity rail, frame, resize handle overlay

root와 main cell은 같은 `data-layout-version`을 기록한다. frame과 splitter marker도 같은
coordinator external snapshot version을 소비한다. transient panel interaction 중 root snapshot
구독이 main track만 갱신하도록 panel overlay는 memoized boundary로 분리했다.

anchored component fixture의 1600×852 workspace 결과는 다음과 같다.

| surface      |                                  결과 |
| ------------ | ------------------------------------: |
| left track   | 48 rail + 4 gap + 490 cluster = 542px |
| right track  | 48 rail + 4 gap + 320 cluster = 372px |
| bottom track |                                  48px |
| main rect    |                        x 542, 686×804 |

## renderer mode 단일화

`BuilderCore`는 feature flag에 따라 `BuilderCanvas`를 직접 sibling으로 만들지 않는다.
항상 `PanelWorkspace > Workspace` 한 경로를 렌더링하고 `Workspace` 내부에서만 다음 content를
선택한다.

| mode      | 공통 root        | 내부 content                             |
| --------- | ---------------- | ---------------------------------------- |
| WebGL     | `main.workspace` | Skia `BuilderCanvas` + overlay/scrollbar |
| Compare   | `main.workspace` | Preview iframe + Skia pane               |
| WebGL-off | `main.workspace` | Preview `BuilderCanvas`                  |

component fixture에서 WebGL-off → WebGL → Compare 전환 뒤에도 동일한 `main.workspace` DOM
node identity가 유지됐다. legacy Preview의 중첩 `main`은 `div.workSpace`로 바꿔 단일 main
landmark를 유지한다.

## Canvas-local consumer cutover

| consumer               | 이전                                              | Phase 4                                        |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------- |
| sizing                 | panel toggle subscription + measure DOM 완료 시점 | actual Workspace/Compare pane `ResizeObserver` |
| scrollbar              | containerSize에서 left/right inset 재차 차감      | full Canvas-local containerSize                |
| horizontal pan         | panel left inset을 viewport x에 재가산            | local origin `-viewport.x / scale`             |
| minimap                | cached inspector width를 `screenRight`에 가산     | actual Skia canvas 우측 edge + 기본 16px       |
| hit-test/visible pages | local `containerSize` 소비                        | 동일, 별도 panel 보정 없음                     |

production consumer의 `panelLayoutRuntime`, `measureWorkspacePanelInsets`,
`subscribeToPanelLayoutChanges`, `registerPanelElement` import는 0건이다. 파일 자체와 legacy host
삭제는 Phase 6에 남긴다.

## browser G3 smoke

authenticated Builder
`http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696`에서 hard refresh 후
측정했다.

### normal 1800×988

| surface      |                         actual |                 snapshot/data |
| ------------ | -----------------------------: | ----------------------------: |
| host         |                 1800×940, y 48 |                     version 0 |
| insets       | left 48 / right 48 / bottom 48 |                 snapshot 동일 |
| main         |                 x 48, 1704×892 |        expected 48 / 1704×892 |
| Canvas local |                 x 48, 1704×892 | published 1704×892, version 0 |
| panel frame  |                13 stable frame |                        중복 0 |

floating panel toggle로 shell version이 1로 증가했지만 main size가 바뀌지 않는 경우에도
host/main/Canvas marker가 모두 version 1로 동기화됐다.

### Compare

- `main.workspace`: 1
- `.panel-workspace-host`: 1
- compare content root: 1
- main: 1704×892
- Skia local pane: published 1288.828125×892, actual 1288.8359375×892
- subpixel 차이: 0.0078125px, 기존 0.01px noise tolerance 이내
- shell/Canvas version: 1 / 1

### constrained 800×600

- host: 800×552, y 48
- main/Canvas: x 48, 704×504, snapshot/published/actual 일치
- active floating DataTable: right 597.16 ≤ 800, bottom 560 ≤ 600
- main rect 음수: 0
- shell/Canvas version: 2 / 2
- console error: 0

viewport override와 panel visibility는 검증 뒤 원래 상태로 복원했다.

## cross-check

| layer                         | 변경/검증                                                   | 판정           |
| ----------------------------- | ----------------------------------------------------------- | -------------- |
| Spec / Factory                | component visual contract 변경 없음                         | not applicable |
| shared CSS / Preview renderer | component style/prop 변경 없음                              | not applicable |
| Builder DOM/CSS               | common Grid host와 single main landmark                     | PASS           |
| Skia                          | minimap이 actual Skia canvas local size/right edge 사용     | PASS           |
| Canvas input                  | sizing/scrollbar/hit-test가 같은 local `containerSize` 사용 | PASS           |
| Compare                       | right pane 자체를 observer target으로 유지                  | PASS           |
| WebGL-off                     | common Workspace root component fixture                     | PASS           |

`.spec-rebuild-pending`는 없고 package Spec/CSS renderer를 수정하지 않아 specs rebuild는
필요하지 않다.

## 검증

- ADR-922 panel/workspace/Canvas/scrollbar/minimap/hit-test fixture: 28 files, 188 tests
- targeted ESLint: 0 error
- `pnpm type-check`: 신규 violation 0, repository baseline 43건 유지
- authenticated browser normal/Compare/800px smoke, console error 0
- `git diff --check`
- `pnpm run codex:guard`
- `pnpm run codex:preflight`

## 잔존 위험과 다음 Gate

- React `Activity` 밖에서 실행되는 hidden panel 고비용 observer/timer는 Phase 5 G4에서
  별도 inventory한다.
- pointer resize의 keyboard/focus/ARIA 계약과 panel header/action DOM 불변식은 Phase 5 G5
  대상이다.
- `panelLayoutRuntime.ts`, unused `PanelArea`/`BottomPanelArea`/`ModalPanelContainer`와 legacy
  projection은 G3 rollback 가능성을 유지하기 위해 아직 삭제하지 않았다.

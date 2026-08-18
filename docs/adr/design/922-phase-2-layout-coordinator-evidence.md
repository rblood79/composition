# ADR-922 Phase 2: layout coordinator shadow snapshot evidence

## 판정

**G2a PASS — 2026-08-18**

Phase 2는 production frame/pointer/store/persistence를 전환하지 않고 다음 shadow 경계를
추가했다.

- workspace size + v2 layout을 하나의 immutable snapshot으로 계산하는 coordinator
- row/column splitter와 frame geometry가 같은 layout version을 갖는 derived snapshot
- 같은 display frame의 input을 최신 값으로 합치는 RAF-batched external store
- `useSyncExternalStore` 기반 root/frame selector
- observed v1 frame과 shadow frame을 allowlist 없이 비교하는 mismatch adapter
- snapshot geometry만 사용하는 DOM-query-free snap candidate adapter

기존 `PanelWorkspace`, `stores/panelLayout.ts`, primary `composition-panel-layout` record는
새 coordinator를 import하지 않는다. 실제 panel DOM과 production pointer handler는 계속
v1이며 G2b real-frame canary를 통과했다고 판정하지 않는다.

## immutable snapshot 계약

`panelWorkspaceLayoutCoordinator.ts`는 다음 surface를 한 snapshot object로 publish한다.

| surface                   | 계약                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `version`                 | successful RAF publish마다 1 증가                                |
| `workspaceRect`           | solve 입력 workspace의 frozen copy                               |
| `mainContentRect`         | 같은 solve에서 파생된 frozen shell rect                          |
| `frameGeometries`         | mutation method가 없는 frozen `ReadonlyMap` view                 |
| `visiblePanelIds`         | mutation method가 없는 frozen `ReadonlySet` view                 |
| `occupiedInsets`          | 같은 solve의 frozen inset                                        |
| `splitters`               | visible row/column 인접 관계에서 파생한 frozen geometry          |
| frame/splitter version    | 모두 root `version`과 같은 `layoutVersion`                       |
| `panelOrder`              | registry order를 고정해 candidate tie order를 DOM과 독립화       |
| constrained overlay order | Phase 1 solver의 bottom → left → right 순서를 frozen copy로 유지 |

Map/Set은 `Object.freeze(new Map())`처럼 mutation method를 남기지 않고 내부 source를 노출하지
않는 read-only view로 감쌌다. frame, splitter geometry와 배열도 snapshot 생성 시 clone/freeze해
publisher 외부에서 같은 version의 일부만 바꿀 수 없다.

## external store / RAF transaction

`createPanelWorkspaceLayoutCoordinator()`는 최초 input을 동기 solve해 version 0 snapshot을
만든다. 이후 `queueInput()`은 다음 규칙을 따른다.

1. 같은 display frame에 여러 input이 들어오면 pending input을 최신 값으로 교체한다.
2. scheduler에는 RAF callback을 최대 한 개만 둔다.
3. callback에서 solve를 정확히 한 번 실행한다.
4. 성공하면 root/frame/splitter가 같은 version인 snapshot object를 한 번 교체하고 모든
   subscriber를 한 번 호출한다.
5. validation/solve 실패 시 기존 snapshot object와 version을 유지하고 publish하지 않는다.
6. `destroy()`는 pending RAF와 subscriber를 모두 정리한다.

Frame scheduler와 solver는 fixture에서 주입 가능하지만 기본 production scheduler는 native
`requestAnimationFrame`/`cancelAnimationFrame`이다. timeout이나 고정 60Hz throttle은
도입하지 않았다.

## shadow geometry mismatch 해소

Phase 1 migration의 최초 mapping은 side rail의 hidden panel을 같은 column에 먼저 넣어
DataTable Editor의 490px min width가 visible Nodes 233px frame까지 넓힐 수 있었다. 또한
right multi-active panel을 left-to-right로 그대로 배치하면 현행 right-edge offset 순서와
반대가 됐다.

G2a에서는 allowlist를 두지 않고 model/migration에서 다음처럼 해소했다.

- anchored migration의 leading column은 rail order가 아니라 현행 `active*Panels` order를
  따른다.
- left는 active order, right는 현재 right-edge offset과 같은 reverse active order로 최대
  두 column을 만든다.
- hidden/나머지 panel은 preferred width가 가장 가까운 column row에 보존한다.
- column width validation은 visible row를 우선하고, 전체 hidden이면 첫 row를 사용한다.
  따라서 hidden panel min width가 현재 visible frame을 변경하지 않는다.
- visible panel이 세 개 이상이면 v2의 고정 2-column 상한에 따라 나머지를 가까운 column의
  row stack으로 결정적으로 배치한다.

1400x900 workspace, left/right/bottom rail 48px의 대표 v1 fixture에서 mismatch는 0이다.

| Panel      | observed v1 geometry    | shadow geometry |
| ---------- | ----------------------- | --------------- |
| Nodes      | 52,4 / 233x520          | 동일            |
| Settings   | 289,4 / 400x500         | 동일            |
| History    | 791,4 / 320x450         | 동일            |
| Properties | 1115,4 / 233x520        | 동일            |
| Monitor    | 400,650 / 600x200 float | 동일            |

1px 차이는 panel/field 단위 mismatch로 보고하며 allowlist나 silent tolerance 확장은 없다.
기본 비교 tolerance는 subpixel noise만 위한 0.01px이다.

## candidate adapter

`resolvePanelSnapFromSnapshot()`은 source의 transient geometry와 snapshot의 visible target
geometry만 사용한다. target 순서는 snapshot의 registry `panelOrder`이고 기존 pure
`resolvePanelSnap()`을 재사용한다.

- `querySelector` / `querySelectorAll`: 0
- `getBoundingClientRect`: 0
- `document` / `window` geometry read: 0
- 대표 trace의 기존 pure snap oracle과 candidate mismatch: 0
- production `PanelWorkspace.findPanelSnapCandidate()` 교체: 아직 0

## production isolation / cross-check

| 경로                            | Phase 2 변경/소비 |
| ------------------------------- | ----------------- |
| `PanelWorkspace` frame/pointer  | 0                 |
| Zustand `stores/panelLayout.ts` | 0                 |
| primary/backup localStorage     | 0                 |
| Spec/Factory/CSS                | 0                 |
| Skia/Canvas/Preview/Publish     | 0                 |
| canonical project/DB/Supabase   | 0                 |
| `.spec-rebuild-pending`         | 없음              |

렌더링 layer를 바꾸지 않은 logic/store-only phase이므로 CSS↔Skia 시각 parity 항목은
not applicable이다. Phase 3 전까지 actual frame 적용 latency, tearing, native-refresh
delivery는 통과 주장 대상이 아니다.

## browser smoke

`http://localhost:5173/builder/8e92598a-99ae-4408-b905-b9531968c696`에서 확인했다.

- `.panel-workspace`: 1
- `.workspace-panel-frame`: 13
- `[data-layout-version]`: 0
- History: `hidden → placed → hidden`, frame 재생성 없이 v1 toggle 왕복
- console error: 0
- route의 project lookup warning 1건은 있었지만 panel workspace와 13개 frame은 정상 생성됨

v2 marker 0은 Phase 2 production isolation의 기대값이다. marker와 real-frame geometry 적용은
Phase 3 G2b canary에서만 활성화한다.

## 검증

- coordinator + shadow adapter: 2 files, 12 tests
- G1 model/migration/persistence 포함: 5 files, 47 tests
- 기존 panel regression 포함: 10 files, 71 tests
- targeted ESLint: 0 error
- `pnpm type-check`: 신규 violation 0, repository baseline 43건 유지
- `pnpm run codex:guard`, `git diff --check`, `pnpm run codex:preflight`

## 잔존 위험과 다음 Gate

- R2의 pure store 부분은 G2a에서 해소했지만 actual React frame의 applied-version tearing과
  presentation latency는 아직 측정하지 않았다.
- R12는 의도적으로 미통과다. shadow publish 성공을 visual 적용 성공으로 간주하지 않는다.
- 다음 Phase 3는 v1 primary를 유지하는 exclusive canary부터 시작해야 하며 registry panel당
  DOM frame 1개, pointer DOM query 0, applied version mismatch 0과 native-refresh 기준을 G2b로
  통과한 뒤에만 전체 renderer/persistence cutover를 진행할 수 있다.

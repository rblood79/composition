# ADR-186 Phase 3: transient drag and candidate/drop transaction

## 판정

**G3 PASS — 2026-08-19**

production persistence는 v2 compatibility writer에 유지한 채 free XY를 drag session의
transient preview로 격리하고, panel adjacency와 Pencil 9-zone을 단일 candidate/drop
transaction으로 연결했다. valid drop만 한 번 commit하며 invalid/Escape/pointer cancel은
committed graph를 바꾸지 않고 byte-equivalent base로 돌아간다.

- 기준 commit은 Phase 2 완료 commit `ff01f1a5c`다.
- committed production layout과 persistence payload는 계속 `PanelWorkspaceLayoutV2`다.
- v3 graph는 drag session의 candidate 계산과 valid drop 결과에만 사용하고, commit 시 기존
  v2 writer로 projection한다.
- 기존 v2 `movePanel`/resize/activation compatibility path는 유지했다.
- Phase 4 activation/resize/reset과 Phase 5 v3 production cutover/free-XY 제거는 시작하지
  않았다.

## drag transaction 계약

`panelWorkspaceZoneDrop.ts`는 pointerdown 시 committed v2를 한 번 v3 graph로 읽고 source를
제외한 candidate snapshot을 만든다. pointermove hot path는 이 snapshot과 전달받은 local
pointer/preview geometry만 사용한다.

| 단계                  | graph/persistence 계약                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| begin                 | immutable `baseLayout`, source-hidden candidate graph와 initial preview를 한 번 생성 |
| move                  | `previewGeometry`만 free XY를 보유하고 committed layout 및 storage write 0           |
| resolve               | 가능한 outer panel face를 zone보다 우선하며 candidate는 최대 1개                     |
| valid end             | candidate graph revalidation 뒤 commit count 1, rail identity 보존                   |
| invalid end           | commit count 0, byte-equivalent base 반환                                            |
| Escape/pointer cancel | preview/candidate 폐기, commit count 0, base 반환                                    |

panel top/bottom은 visible column의 첫/마지막 row에만, left/right는 visible cluster의
outermost column에만 제공한다. row/column min-fit과 최대 2-column 조건을 통과하지 못한
face는 candidate에서 제외한다. panel edge가 없는 위치에서만 9-zone candidate를 만들고
6px hysteresis로 경계 흔들림을 억제한다.

## transient presentation과 overlay

coordinator는 committed snapshot과 transient preview snapshot을 분리한다.
`queuePreview`는 solve나 persisted graph mutation 없이 최신 geometry만 보관하고, 같은 RAF의
여러 입력을 하나의 publish로 합친다. `clearPreview`는 같은 committed snapshot으로 복원한다.

drag 중에만 placement surface 위에 `aria-hidden`/`pointer-events: none`인 3x3 zone overlay를
mount한다. panel adjacency가 활성화되면 해당 outer face의 snap line 하나만 표시한다. 기존
모든 면을 동시에 활성화하던 pointer dropper DOM은 제거했으며 dock rail presentation은
유지했다.

snap line과 resize hover bar는 공통 CSS 변수
`--panel-interaction-line-color: var(--focus-ring)`과 `2px` thickness를 사용한다. 가로 방향은
height, 세로 방향은 width가 동일하다.

## G3 검증 매트릭스

| 계약                  | fixture / 실제 결과                                               | 판정 |
| --------------------- | ----------------------------------------------------------------- | ---- |
| 9-zone hit-test       | 9/9 zone이 panel edge가 없을 때 단일 zone candidate               | PASS |
| candidate 우선순위    | panel outer edge > empty/hidden-only zone > null                  | PASS |
| inner face 차단       | 같은 column 내부 row edge는 candidate 미노출                      | PASS |
| valid panel edge      | target cluster commit 1, `railOrder` byte-equivalent              | PASS |
| valid zone            | zone graph commit 1, persisted `position`/`x`/`y` 0건             | PASS |
| invalid drop          | commit 0, v2 committed graph byte-equivalent                      | PASS |
| Escape/pointer cancel | preview/session 폐기, commit 0, base rollback                     | PASS |
| pointer hot path      | 300회 candidate update, `getBoundingClientRect` 0회               | PASS |
| coordinator publish   | 같은 RAF preview coalesce, solve 0, listener publish <= 1/RAF     | PASS |
| visual line           | panel edge별 active line 1개, snap/resize 색상과 2px 축 두께 동일 | PASS |

## 실제 Builder 검증

route:
`/builder/9a089720-8f73-40ea-916a-bf58c2f49599`

| 항목                    | 결과                                                       |
| ----------------------- | ---------------------------------------------------------- |
| placement surface       | `(4, 52) 1272 x 664`                                       |
| idle / drag overlay     | idle 0개, drag 중 overlay 1개와 target cell 9개            |
| active candidate        | zone drag active cell 1개, panel-edge active snap line 1개 |
| Escape rollback         | `{x:523.5,y:304,w:233,h:160}`로 exact 복원, overlay 0개    |
| valid bottom-right drop | `{x:1043,y:556,w:233,h:160}`, surface right/bottom gap 0   |
| reload                  | bottom-right geometry가 같은 값으로 재수화                 |
| vertical line           | snap/resize 모두 `oklch(0.707 0.165 254.624)`, width `2px` |
| horizontal line         | snap/resize 모두 같은 색상, height `2px`                   |

실제 pointer 5초 trace 결과는 다음과 같다.

| metric                               | 값                 |
| ------------------------------------ | ------------------ |
| duration / pointer moves             | `5001.2ms` / `147` |
| solve count                          | `0`                |
| presentation commits / RAF samples   | `147` / `601`      |
| pointer DOM geometry query           | `0`                |
| applied version mismatch / long task | `0` / `0`          |
| input-to-applied-frame p95           | 약 `8.4ms`         |
| 기존 diagnostic gate                 | `passesG2b: true`  |

위 `presentation commits`는 diagnostic의 legacy `workspaceCommitCount` 필드가 세는 React
presentation commit이며 persistence transaction 수가 아니다. persistence 계약은 unit/runtime
fixture의 valid drop commit 1, invalid/cancel commit 0으로 별도 검증했다.

clean reload 뒤 application console error는 0건이었다. 별도 실행에서 발생한 Supabase refresh
token `ERR_INTERNET_DISCONNECTED` 반복은 sandbox network 제한이며 panel runtime error로
분류하지 않았다.

## 테스트와 cross-check

- panel workspace layout Vitest: 21 files, 173 tests PASS
- `pnpm run codex:typecheck`: PASS, Builder baseline 43 known errors 대비 신규 violation 0
- `pnpm run codex:preflight`: PASS
- D1 DOM/accessibility: 기존 React Aria `useMove`, move button, splitter role/ARIA 계약을 유지하고
  zone overlay는 accessibility tree와 pointer hit-test에서 제외했다.
- D2 spec/catalog: 변경 없음. panel workspace shell은 component spec/catalog surface가 아니다.
- D3 CSS: snap/resize shared token과 horizontal/vertical 2px 축 두께를 computed style로 확인했다.
- D4 Skia/Canvas: renderer command와 Skia visual spec 변경 0건이다. Canvas는 기존
  `.panel-workspace-main` local rect를 그대로 소비한다.
- D5 Preview/publish: iframe runtime, DOM Preview, public spec/export 변경 0건이다.

## 위험 잔여

| 위험                 | G3 처리                                                     | 잔여 Gate                     |
| -------------------- | ----------------------------------------------------------- | ----------------------------- |
| R2 zone anchor drift | candidate commit 전 v3 revalidation과 실제 edge/reload 확인 | G4 resize/activation 전 zone  |
| R5 dormant placement | session-only XY와 valid candidate-only commit               | G4 hidden reopen/reset        |
| R8 pointer 성능      | snapshot hot path, solve/DOM query 0, RAF coalesce          | G4 resize trace               |
| R10 rollback         | invalid/Escape/cancel base rollback, v2 writer 유지         | G5 cutover rollback rehearsal |

다음 단계는 별도 사용자 요청 뒤 Phase 4 activation, resize, reset 정책으로 진행한다.

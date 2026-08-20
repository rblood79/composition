# ADR-186 Phase 4: activation, identity, resize, reset policy

## 판정

**G4 PASS — 2026-08-19**

production persistence를 v2 compatibility writer에 유지한 채 activation, resize와 reset의
정본 계산을 v3 zone policy로 전환했다. Photoshop 기본 rail은 아래 stack 후 안쪽 두 번째
column으로 overflow하고, Pencil 9-zone에 배치된 panel은 rail identity와 dormant placement를
독립적으로 보존한다.

- 기준 commit은 Phase 3 완료 commit `76eecb1d0`이다.
- production storage payload와 coordinator public layout은 계속 `PanelWorkspaceLayoutV2`다.
- runtime은 activation/resize/reset 경계에서 v2를 v3로 읽고 policy mutation 뒤 valid v2로
  projection한다.
- drag의 v3 candidate/drop transaction과 기존 stable panel frame/ARIA 계약은 유지했다.
- Phase 5 production v3 persistence cutover, `floatAnchoredPanelWorkspaceClusters` 제거와 legacy
  free-XY path 제거는 시작하지 않았다.

## 정책 계약

`panelWorkspacePolicyV3.ts`가 다음 세 operation을 순수 graph mutation으로 소유한다.

| operation                        | 계약                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `activatePanelWorkspacePanelV3`  | left/right 기본 zone에서 visible row를 아래로 stack하고 높이가 부족하면 left는 오른쪽, right는 왼쪽에 최대 두 번째 column을 만든다 |
| `resizePanelWorkspaceBoundaryV3` | outer resize와 paired row/column resize를 pointerdown reference layout 기준으로 계산하고 각 zone anchor와 paired total을 고정한다  |
| `resetPanelWorkspaceLayoutV3`    | registry의 default rail/zone/size를 복원하되 현재 visibility는 보존한다                                                            |

hidden row/column은 graph와 선호 size를 유지하지만 surface fit 수요에서는 제외한다. 따라서
hide/reopen은 row를 삭제하거나 다른 zone으로 이동하지 않으며, hidden-only cluster도 dormant
reservation으로 남는다.

runtime의 `beginInteraction()`은 committed v2와 함께 v3 policy base를 한 번 만든다. 이후 모든
pointermove는 같은 immutable v3 base와 시작 pointer delta에서 다시 계산한다. max/min clamp를
넘긴 뒤 경계 안으로 돌아와도 이전 clamped 결과에 incremental delta를 더하지 않으므로 drift가
생기지 않는다.

## identity와 compatibility boundary

activity rail identity와 placement zone은 계속 별도 축이다.

- panel-relative cross-rail snap은 target cluster의 `placementZone`만 승계한다.
- `railOrder.left/right/bottom` JSON은 byte-equivalent로 유지한다.
- hide/reopen은 마지막 cluster/column/row를 복원하고 panel row를 중복 생성하지 않는다.
- explicit reset만 registry의 `defaultPosition`과 기본 zone mapping을 다시 적용한다.

v3 -> v2 projection 뒤 다음 interaction에서 zone을 다시 잃지 않도록 migration은
`zone:${zone}` projection ID와 legacy `anchor:left/right/bottom` floating compatibility ID를
인식한다. 이 bridge는 Phase 5 cutover 전 production v2 저장 형식을 유지하기 위한 한정 경계다.

## G4 검증 매트릭스

| 계약                  | fixture / 결과                                                   | 판정 |
| --------------------- | ---------------------------------------------------------------- | ---- |
| right 기본 활성화     | Properties/Styles 아래 stack, overflow History column은 왼쪽     | PASS |
| left 기본 활성화      | Nodes/Components 아래 stack, overflow Settings column은 오른쪽   | PASS |
| hidden reopen         | center zone row/size와 right rail identity 유지, duplicate row 0 | PASS |
| cross-rail snap       | target `top-left` zone 승계, `railOrder` byte-equivalent         | PASS |
| explicit reset        | default rail/zone/size 복원, visibility 유지                     | PASS |
| outer resize          | 9/9 zone x left/right/top/bottom 36개 조합에서 anchor point 고정 | PASS |
| paired row resize     | 9/9 zone에서 두 row 합계와 cluster anchor 고정                   | PASS |
| paired column resize  | 9/9 zone에서 두 column 합계와 cluster anchor 고정                | PASS |
| clamp 왕복            | overrun 뒤 reference delta 20/0 복귀, drift 0                    | PASS |
| runtime compatibility | activation/reset/resize 결과를 valid v2 graph로 projection       | PASS |

## 실제 Builder 검증

route:
`/builder/9a089720-8f73-40ea-916a-bf58c2f49599`

1200px headed viewport에서 실제 placement surface와 우측 기본 rail을 확인했다.

| 항목                | 결과                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| placement surface   | `(4, 52) 1192 x 888`, right `1196`, bottom `940`                                          |
| rightmost column    | Properties `(963, 52) 233 x 520`, History `(963, 576) 233 x 364`                          |
| overflow column     | Styles `(726, 52) 233 x 520`; rightmost column과 4px gap                                  |
| right/bottom anchor | Properties/History right `1196`, History bottom `940`; surface edge 오차 0px              |
| hidden reopen       | History off/on 뒤 세 frame geometry가 byte-equivalent 값으로 복원                         |
| paired row resize   | End에서 Properties/History `724/160`, 합계 `884` 고정, gap 4px와 bottom anchor 유지       |
| resize 원복/reload  | Arrow reference resize로 `520/364` 복원 뒤 reload geometry 동일                           |
| paired column clamp | 두 column이 각각 현재 min `233`이라 End 요청이 0-delta clamp; total/right anchor 불변     |
| storage             | `composition-panel-layout`은 `version: 2`; right `railOrder`와 projected column 순서 유지 |

초기 fixture load에서 존재하지 않는 project/document에 대한 두 console error는 empty fallback
baseline이었다. reload 뒤 application console은 error 0, warning 1이었고 panel runtime error는
없었다.

## 테스트와 cross-check

- panel workspace layout Vitest: 22 files, 235 tests PASS
- `pnpm run codex:typecheck`: PASS, Builder baseline 43 known errors 대비 신규 violation 0
- `pnpm run codex:preflight`: PASS
- D1 DOM/accessibility: 기존 React Aria `useMove`와 shared `PanelSplitter`의
  separator/keyboard/ARIA 계약을 변경하지 않았다. runtime reset operation은 새 UI primitive를
  추가하지 않는다.
- D2 spec/catalog: 변경 없음. public component spec과 catalog surface가 아니다.
- D3 CSS: 변경 없음. Phase 3에서 고정한 snap/resize shared token과 2px thickness를 유지한다.
- D4 Skia/Canvas: renderer command와 Canvas sizing 변경 0건이다. actual common placement surface
  geometry와 panel anchor만 브라우저에서 재검증했다.
- D5 Preview/publish: iframe runtime, DOM Preview, public export 변경 0건이다.

## 위험 잔여

| 위험                 | G4 처리                                                              | 잔여 Gate                     |
| -------------------- | -------------------------------------------------------------------- | ----------------------------- |
| R2 zone anchor drift | 9-zone outer/paired resize와 actual right/bottom anchor 고정         | G5 v3 primary reload          |
| R5 dormant placement | hidden fit 제외, reopen duplicate 0, explicit reset 분리             | G5 production reset smoke     |
| R8 resize 성능       | interaction 시작 시 v3 base 1회 cache, move는 reference graph 재사용 | G5 production v3 trace        |
| R10 rollback         | production primary와 coordinator public type을 v2로 유지             | G5 cutover rollback rehearsal |

다음 단계는 별도 사용자 요청 뒤 Phase 5 production v3 cutover와 v2 free-XY 제거로 진행한다.

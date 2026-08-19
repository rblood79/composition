# ADR-186 Phase 5: production v3 cutover와 free-XY 제거

## 판정

**G5 PASS — 2026-08-19**

panel workspace의 production store, coordinator, runtime과 persistence를
`PanelWorkspaceLayoutV3`로 전환했다. 최종 persisted state는 9-zone
`placementZone`과 column/row size graph만 소유하며 arbitrary `position`, `x`, `y`는
drag session preview 밖으로 나가지 않는다.

- 기준 commit은 Phase 4 완료 commit `1562184a1`이다.
- v2 parser, exact backup과 v3-aware rollback projection은 compatibility/recovery
  boundary로만 유지한다.
- production v2 projection, free-XY writer, unsnapped drop commit과 anchored-to-floating
  승격 helper는 제거했다.
- 실제 Builder에서 move, resize, panel-edge snap, reload와 explicit reset을 exercise했다.

## production owner 전환

| 경계        | Phase 5 production 계약                                                                    |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Zustand     | `panelWorkspaceLayout: PanelWorkspaceLayoutV3                                              | null`; 측정된 placement surface 뒤 v1/v2를 v3로 migrate하거나 v3를 직접 hydrate |
| persistence | primary key는 v3만 기록하고 정상 mutation/reset 때 `migrationSource`와 persisted XY를 제거 |
| coordinator | v3 solver snapshot과 transient drag preview만 publish                                      |
| runtime     | v3 graph에서 activate/resize/reset/drag transaction을 직접 수행                            |
| React shell | v3 snapshot의 zone geometry, cluster focus, shared splitter를 소비                         |
| recovery    | exact v2 backup과 v3 -> valid v2 projection은 Phase 2+ rollback build에 한정               |

다음 legacy production writer를 제거했다.

- `floatAnchoredPanelWorkspaceClusters`
- `panelWorkspaceLayoutInteraction.ts`의 detached floating `position` mutation
- `panelWorkspaceDockDrop.ts`의 v2 drop projection
- candidate가 없는 drag end의 layout commit
- frame mode의 dead `anchored` presentation과 관련 CSS selector

invalid, Escape, pointer cancel은 coordinator preview만 지우고 committed v3 graph와
storage를 쓰지 않는다. valid panel-edge/zone candidate만 한 번 graph commit한다.

## explicit reset

runtime에만 있던 reset operation을 실제 Builder command로 연결했다. header menu의
`Reset Panel Layout`은 store가 보관한 actual measured surface와 registry default를 사용해
v3 default graph를 즉시 primary에 기록한다. 현재 visibility는 유지하고 placement와 size만
registry default로 복원한다. 활성 panel은 Photoshop 기본 rail mapping에 따라 left는
`top-left`, right는 `top-right`, bottom은 `bottom`에서 시작한다.

## rollback rehearsal

Phase 2 recovery build 계약을 production v3 fixture에 다시 적용했다.

| rehearsal             | 결과                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| migration 직후 무편집 | committed exact v2 backup raw를 byte-identical하게 primary로 복원                      |
| migrated-post-edit    | 현재 v3 graph의 zone/column/row geometry를 valid v2 floating graph로 projection        |
| v3-born               | exact backup 없이 현재 v3 graph를 valid v2 primary로 projection                        |
| old-code hydration    | rollback 뒤 v2 primary parse/normalize 성공; 후속 v2 편집과 재실행도 valid v2로 수렴   |
| write-boundary crash  | prepared backup, primary write, committed marker 각 fault 뒤 재실행 시 valid v2로 수렴 |

rollback은 v3-aware recovery build가 valid v2 primary를 만든 뒤에만 pre-v3 build를 실행하는
운영 순서를 유지한다. production은 dual-write하지 않는다.

## 실제 Builder 검증

route:
`/builder/9a089720-8f73-40ea-916a-bf58c2f49599?panelTrace=1`

1200 x 940 headed viewport에서 actual pointer로 검증했다.

| 항목               | 결과                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| placement surface  | `(4, 52) 1192 x 888`; common outer margin 4px                                                                      |
| 9-zone move/reload | Properties를 `bottom-right`에 drop하고 reload 뒤 zone/right/bottom anchor 동일                                     |
| resize/reload      | left edge resize 뒤 width `360 -> 420`; surface right `1196` 고정, reload 동일                                     |
| panel-edge snap    | Properties drag 중 History `bottom` snap line 1개만 active; commit 뒤 같은 `top-right` column, y `52/506`, gap 4px |
| snap reload        | History `360 x 450`, Properties `360 x 434`; reload 뒤 동일 stack                                                  |
| reset              | header `Reset Panel Layout` 실행 뒤 visible panel을 유지하며 default `top-right` graph와 size 복원                 |
| persistence        | primary `version: 3`; recursive `position/x/y` key 0                                                               |
| console            | 최종 reload와 reset flow에서 application error 0, warning 1                                                        |

존재하지 않는 local project/document fixture 때문에 page counter는 `0/0`이고 warning 1이 남지만,
panel runtime error나 hydration fallback은 발생하지 않았다.

## native-cadence performance Gate

5초 actual pointer drag trace는 keyboard automation이 아닌 `page.mouse` move 표본이다.

| 지표                       |               결과 | Gate                   |
| -------------------------- | -----------------: | ---------------------- |
| display period             | 8.3ms, 약 120.48Hz | native cadence 표본    |
| pointer moves              |                100 | 실제 pointer 입력      |
| expected periods           |                602 | 기준                   |
| missed periods             |                  1 | PASS                   |
| frame delivery             |             99.83% | PASS                   |
| baseline 대비              |            -0.17pp | `>= -5pp` PASS         |
| input-to-applied-frame p95 |              7.9ms | 한 display period 이내 |
| long task                  |                  0 | PASS                   |
| DOM geometry query         |                  0 | PASS                   |
| version mismatch           |                  0 | PASS                   |

presentation commit은 pointer preview publish이며 persistence write가 아니다. drag end의 valid
candidate에서만 v3 graph를 저장한다.

## 테스트와 cross-check

- panel workspace focused Vitest: 24 files, 234 tests PASS
- `pnpm run codex:typecheck`: PASS, Builder baseline 43 known errors 대비 신규 violation 0
- `pnpm run codex:preflight`: PASS
- D1 DOM/accessibility: stable panel frame, React Aria move, separator keyboard/ARIA를 유지했고
  reset command는 기존 RAC menu action으로 노출했다.
- D2 spec/catalog: 변경 없음. public component spec과 catalog binding이 아니다.
- D3 CSS: dead `anchored` selector만 제거했다. Phase 3의 snap/resize token과 2px thickness는
  유지된다.
- D4 Skia/Canvas: renderer command, layout spec과 Canvas sizing 변경 0건이다. panel overlay의
  actual placement surface만 browser geometry로 재검증했다.
- D5 Preview/publish: iframe runtime, DOM Preview와 public export 변경 0건이다.

따라서 CSS/Skia component parity 대상은 없으며 5-layer 영향 0건으로 cross-check를 닫는다.

## 위험 종결

| 위험                       | G5 결과                                                         |
| -------------------------- | --------------------------------------------------------------- |
| R1/R5 migration uniqueness | measured surface migration과 normalize fixture PASS             |
| R2/R9 zone anchor          | move/resize/snap/reload에서 right/bottom/common 4px anchor PASS |
| R3 free preview leak       | persisted XY 0, invalid/cancel 0 commit PASS                    |
| R4 rail identity           | v3 `railOrder`와 placement zone 분리 fixture PASS               |
| R6 hot path                | native delivery baseline -0.17pp, DOM query/long task 0 PASS    |
| R8 visual split            | shared color/thickness 정적·computed 계약 유지                  |
| R10 rollback               | exact/post-edit/v3-born/old-code rehearsal PASS                 |

G0~G5가 모두 통과했으므로 ADR-186을 Implemented로 승격한다. ADR-922의 coordinator,
stable frame, column/row resize와 visibility lifecycle은 base로 유지하고 persisted placement와
production interaction 부분만 ADR-186이 대체한다.

# ADR-186 Phase 1: v3 model and durable migration

## 판정

**G1 PASS — 2026-08-19**

production hydration/runtime/writer를 v2에 유지한 채 v3 pure model, measured-surface
v2 -> v3 migration, exact v2 backup과 prepared/committed recovery protocol을 추가했다.

- 기준 commit은 Phase 0 완료 commit `e4d5064e4`다.
- 기존 production owner 파일은 수정하지 않았다.
- 신규 v3 production module은 서로만 참조하며 `stores/panelLayout.ts`, runtime,
  coordinator, React renderer에서 import하지 않는다.
- G1 fixture는 malformed input, registry add/remove, tail-topmost collision,
  mixed-rail 10+ cluster, 세 write boundary crash를 고정한다.

## v3 model contract

`panelWorkspaceLayoutV3.ts`는 다음 계약을 소유한다.

| 계약           | 결과                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| schema         | `version: 3`, 9개 `placementZone`, bottommost -> topmost `clusterFocusOrder`         |
| default        | left -> `top-left`, right -> `top-right`, bottom -> `bottom`                         |
| persisted 좌표 | `position`, `x`, `y`, `anchor` 필드 0건                                              |
| zone ownership | zone당 non-empty cluster 최대 1개                                                    |
| column         | cluster당 최대 2개, empty column/cluster 제거                                        |
| panel identity | registry panel은 row와 rail에 각각 정확히 1회                                        |
| visibility     | placement와 독립이며 hidden row도 보존                                               |
| surface fit    | registry min/max를 우선하고 v2 solver와 같은 emergency fit으로 actual surface에 축소 |

parser는 raw JSON 구조를 먼저 검증한 뒤 normalizer를 실행한다. 중복 zone/row/rail,
3번째 column, 누락 focus ID와 registry add/remove를 deterministic하게 정규화한다.
surface width/height가 finite non-zero가 아니면 parse/default/migration을 거부한다.

## deterministic v2 -> v3 migration

`panelWorkspaceLayoutV3Migration.ts`는 actual placement surface rect와 non-empty
`migrationId`를 필수 입력으로 받는다.

1. 현행 v2 parser/normalizer로 입력을 검증한다.
2. 현행 v2 solver를 measured surface에 한 번 실행한다.
3. anchored left/right/bottom은 `top-left`/`top-right`/`bottom`으로 직접 매핑한다.
4. floating cluster는 solved center와 normalized 9-zone anchor의 거리를 비교한다.
5. collision은 v2 focus-order tail, 즉 topmost cluster부터 배정하고 동률은 고정 zone enum
   순서로 결정한다.
6. 9개를 넘는 cluster는 원본 cluster/column/row 순서로 flatten하고 persisted rail
   membership에 따라 left/right/bottom default zone에 route한다.
7. output focus order는 원래 bottommost -> topmost 상대 순서를 보존한다.

Phase 0의 10+ mixed-rail fixture 결과는 9개 cluster로 정규화되며 overflow row는
`top-left`의 마지막 column, `top-right`와 `bottom`의 첫 column에 stable append된다.
전체 registry panel의 row/rail/visibility 누락과 중복은 0건이고 같은 input의 JSON은
byte-identical하다.

## durable backup and recovery

`panelWorkspaceLayoutV3Persistence.ts`는 primary key를 유지하고
`composition-panel-layout.v2-backup`에 exact v2 raw envelope를 보존한다.

| primary / backup 상태                           | 결과                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| valid v2 / 없음                                 | prepared backup -> v3 primary -> committed marker          |
| valid v2 / matching prepared                    | 같은 migrationId로 migration 재시도                        |
| valid v3 / matching prepared                    | primary write 없이 committed marker만 repair               |
| valid v3 / matching committed                   | write 없는 `already-v3`                                    |
| malformed 또는 missing / parse 가능한 v2 backup | exact v2 primary만 복원하고 같은 실행에서 migrate하지 않음 |
| migrationId 또는 re-migration 결과 불일치       | primary write 없이 fail closed                             |
| primary/backup read fault                       | `read-primary`/`read-backup`에서 fail closed               |

세 `setItem` 경계에 fault를 주입한 결과는 다음과 같다.

| fault 경계             | 잔존 primary | 잔존 backup | 재실행 결과             |
| ---------------------- | ------------ | ----------- | ----------------------- |
| prepared backup write  | v2           | 없음        | 새 migration 가능       |
| v3 primary write       | v2           | prepared    | 같은 migrationId 재시도 |
| committed marker write | v3           | prepared    | marker-only repair      |

storage test가 관측한 write key는 primary와 v2 backup 두 개뿐이다. `CompositionDocument`,
IndexedDB project/document, Supabase write 경로는 import하지 않으므로 project/DB write는
0건이다. Phase 2의 v3 -> v2 projection과 v3 rollback backup은 이번 Gate 범위가 아니다.

## 검증 결과

- focused Vitest: 9 files, 78 tests PASS
- `pnpm type-check`: PASS, Builder baseline 43 known errors 대비 신규 violation 0
- local Builder shadow smoke:
  - route: `http://localhost:5173/builder/9a089720-8f73-40ea-916a-bf58c2f49599`
  - `.panel-workspace`: 1272x664
  - primary localStorage: `version: 2`
  - `composition-panel-layout.v2-backup`: 없음
  - panel frame 13개, Nodes/Properties는 기존 `placed` + presentation `floating`
- 격리 Playwright profile에는 지정 route의 IndexedDB project/documents row가 없어 빈 문서
  fallback error 2건이 발생했다. Phase 0과 같은 환경 제한이며 panel shell과 localStorage
  검증에는 영향을 주지 않는다.
- CSS/Skia cross-check: D3/CSS/Skia/Preview/catalog/spec 등록 변경 0, specs pending flag 없음,
  `packages/specs/dist` 존재. Phase 1은 render path 비연결 pure schema 작업이다.

## 위험 잔여

| 위험                           | G1 처리                                                | 잔여 Gate                                              |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| R1 migration quantization      | collision, tail-topmost, 10+ mixed-rail exact fixture  | G2 browser geometry                                    |
| R5 dormant/duplicate placement | normalize에서 duplicate zone/row 제거, hidden row 보존 | G3/G4 interaction lifecycle                            |
| R10 rollback/crash             | exact v2 backup과 forward migration crash matrix       | G2 v3 projection/recovery build, G5 rollback rehearsal |

Phase 2는 common placement surface와 rollback recovery build를 production 경계에 연결하는
HIGH 위험 단계다. 별도 사용자 확인 전에는 착수하지 않는다.

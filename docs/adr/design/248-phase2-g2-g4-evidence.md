# ADR-248 Phase 2 / G2 및 독립 G4 검증

2026-09-28, HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`. 사용자 Phase 2 별도 지시에 따른 **제품 미연결** `apps/builder/src/builder/catalogRuntime/` 검증이다. 기존 staged 삭제 132개와 `.gitignore` 및 다른 dirty 파일은 변경하지 않았다.

## 선행 gate와 경계

- [G0 gate](248-baseline/g0-gate.json)는 `G0_PASS`, `remainingG0=[]`; 비교 정본 18개, 허용 기능군 10개 FROZEN, Preview/Compare 1개 DEFERRED다. G0의 `phase1Eligible=false`는 과거 별도 지시 대기 표시로 유지한다.
- [G1 근거](248-phase1-g1-evidence.md)는 독립 모델 29/29 PASS다. Phase 1의 typed graph/validator/index/transaction을 재구현하지 않았다.
- Builder 제품 entry/barrel/store/history/panels/`incrementalDocuments.ts`와 기존 IDB data SSOT에는 새 runtime import·수정 0. `collections`·`api_endpoints`·project variables는 graph에 typed ID 참조만 두고 기존 별도 저장/history를 유지한다. 새 DB 이름은 `composition-catalog-projects-v1`이며 구 namespace reader·canonical adapter·dual-write는 없다.

## 계약별 결과

| 계약                            | 코드·oracle                                                                                                                                                                                                                                                                                                                                                                                                                      | 판정                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| G2 편집과 단일 history          | `controller.ts`가 한 dispatch를 한 undo entry로 기록한다. `phase2.test.ts`에서 create/move/delete/style/reset/clone/paste/detach, library override set/reset, binding ID 편집, nested descendant patch의 forward→inverse→redo로 관계·순서·의미 graph를 비교했다. Undo/Redo는 같은 `applyCatalogTransaction` validator/reducer를 사용한다.                                                                                        | PASS                              |
| G2 실패 원자성·project/revision | invalid multi-op 및 stale revision에서 graph·네 index·history·revision·dirty·runtime pending/history/subscriber가 불변. project 전환 중 save는 호출 시점 projectId/revision에 고정된다.                                                                                                                                                                                                                                          | PASS                              |
| delta 소비                      | `changedIds/removedIds`를 변경 record JSON/tombstone, 영향 closure(`collectAffectedIds`), resolver cache 무효화 및 ID/필드 subscriber에 직접 공급한다. 관계 삭제로 사라질 역참조를 포함하려고 변경 전·후 closure의 합집합을 쓴다. leaf 변경은 관련 node만 알리고 무관 subscriber 0. definition override 편집·제거는 두 관련 instance만 통지한다. layout input 소비는 Phase 3 전까지 **UNVERIFIED**.                              | G2 PASS / layout UNVERIFIED       |
| leaf 비용                       | leaf dispatch 중 `exportDocument()`를 강제 실패시켜 미호출 확인. graph metric은 전체 entries traversal 0, entries table clone 0, record replacement 1. 저장 payload는 changed record 1개만 직렬화한다. full export·초기 create·구조 clone은 cold path다.                                                                                                                                                                         | PASS                              |
| G4 IDB 저장 부분                | `storage.ts`는 serialization/yield 뒤 IDB transaction을 열고 head + changed records/tombstone을 같은 transaction에 기록한다. `oncomplete` 뒤에만 durable revision/pending/dirty를 갱신한다. create→edit→Undo/Redo→save→restart/load, tombstone, 실패 전/transaction 내부 abort와 retry, 중단 후 fresh writer, 동시 save 순서, 탭 revision 충돌 및 저장 중 project 전환을 `fake-indexeddb`로 검증했다.                            | 독립 경로 PASS                    |
| G4 교환 부분                    | 새 format JSON strict import/export와 content-addressed folder part→revision manifest→active manifest 순서, 실패 시 이전 manifest 유지·hash 검증을 독립 테스트했다. 직접 Pencil frame/text 부분집합 왕복은 PASS; `ref`·slot·descendants·imports·rectangle/name 등 미지원 필드는 명시 오류다. G0 Pencil 5 fixture 전체 의미 동등성은 아직 **UNVERIFIED**다. 구 canonical JSON/folder는 `UNSUPPORTED_PROJECT_FORMAT`으로 거부한다. | JSON/folder PASS, Pencil 부분검증 |
| 제품 격리                       | 제품 소스의 `catalogRuntime`/신규 graph import 검색 0, Builder dist의 `CatalogRuntime`/새 DB marker/`applyCatalogTransaction` 0. 기존 Builder build와 격리 WebKit frame smoke 통과.                                                                                                                                                                                                                                              | PASS                              |

## 실행

- `pnpm --dir apps/builder exec vitest run src/builder/catalogRuntime/__tests__/phase2.test.ts` — 14/14 PASS.
- `pnpm --dir apps/builder exec eslint src/builder/catalogRuntime` — PASS.
- `pnpm run codex:typecheck` — PASS.
- `pnpm --dir apps/builder build` — PASS. 기존 Vite/CSS/chunk 경고만 출력.
- `node apps/builder/scripts/adr248-webkit-smoke.mjs --out /private/tmp/adr248-g2-old-builder-smoke.json` — 기존 Builder frame 240×120, Canvas 1, 오류 0.
- 새 runtime 제품 import 및 dist marker 검색 0; scoped Prettier, `pnpm run codex:guard`, `git diff --check` PASS.

## 남은 gate

전체 G4는 **UNVERIFIED**다. G0 Pencil ref/slot/descendant/import/rectangle fixture 전체 교환, 새 제품 root에서의 save/refresh 및 H1 data store 명령 통합, Preview iframe stale/gap, Publish 진입점 명시 실패는 Phase 3/4 경계에서 검증한다. G3 Canvas/DOM parity와 G5 예산도 미검증이다. Phase 3 제품 소비자 조립은 시작하지 않았다.

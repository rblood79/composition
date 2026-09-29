# ADR-248 Phase 1 / G1 독립 모델 검증

2026-09-28, HEAD `2a5c970994cb9de2f824a729b29c08cdcd647d7b`. 사용자 별도 Phase 1 지시에 따른 **graph 기반 독립 모듈**의 G1 판정이다. Builder 제품 진입점 교체와 Phase 2 runtime 연결을 뜻하지 않는다.

## 선행 G0와 입력

- [G0 gate](248-baseline/g0-gate.json): `G0_PASS`, `remainingG0=[]`. `phase1Eligible=false`는 별도 지시 대기 당시 값 그대로 보존했다. 그 값을 PASS 근거로 사용하지 않았다.
- [scenario freeze](248-baseline/scenario-freeze-audit.json): 비교 정본 18개, 허용 기능군 FROZEN 10개, Preview/Compare DEFERRED 1개.
- G1 fixture는 [구 자손 우선순위](248-baseline/descendant-precedence.json)와 [페이지 저작](248-baseline/page-authoring/baseline.json)의 포맷 독립 조작·기대 의미를 읽는다. 구 문서 JSON을 새 graph 입력으로 복제하지 않는다. G1 결과는 새 앱의 Canvas/DOM 시각 비교가 아니다.

## 계약별 판정

| 계약                                    | 구현·검증 근거                                                                                                                                                                                                                                                   | 판정         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| typed graph, ID·schema·library contract | `document/types.ts`, `document/validation.ts`, `document/graph.ts`; project entries만 저장하고 `lib:*`/`data:*`는 별도 ID. 알 수 없는 kind/field, alias, 버전·중복·dangling을 거부                                                                               | G1 PASS      |
| immutable library와 갱신                | `document/library.ts`의 deep-frozen 복제 및 private read-only lookup, builder 인증; 같은 contract의 library revision 변경이 프로젝트 snapshot 없이 의미값을 바꾸며 미등록 binding/token을 거부                                                                   | G1 PASS      |
| 소유·참조·slot·cycle                    | `graph.ts`와 `resolution/address.ts`; 단일 owner, 정의·template cycle, typed nested instance path, 실제 slot 대상 검사. 동일 원본 2개 인스턴스의 독립 편집 확인                                                                                                  | G1 PASS      |
| 값과 실행 선언                          | props/visual/sizing의 `set`/`mask`/키 삭제 `remove`, `set(null)` 및 state/user override 우선순위; preset, token type/value/use, 실행 binding/opcode, 외부 data ID 참조와 state action value 검증. `frameClip.ts`가 clip을 단일 overflow로 정규화하고 충돌을 거부 | G1 PASS      |
| transaction·원자성                      | `transactions/transaction.ts`는 검증 후 `{forward,inverse,changedIds,removedIds,revision}` 반환. 실패한 다중 op에서 graph·네 역인덱스·history·revision·dirty-set·계측값 불변. leaf inverse도 전체 put이 아닌 필드 op                                             | G1 PASS      |
| 증분 인덱스·leaf 비용                   | `graph.ts`의 definition→instance, owner→child, token→consumer, collection→binding 및 library definition 의존 closure. 관계별 독립 테스트와 무관 sibling 제외. leaf edit/undo에서 export 호출 0, 전체 entries 순회 0, entries table clone 0, record 교체 1        | G1 PASS      |
| clone·독립 fixture                      | `document/clone.ts`, `document/fixture.ts`, `document/__tests__/g1.test.ts`; owned node와 귀속 상태 변수·interaction ID 재매핑, library·프로젝트 definition 참조 유지, Tree/Slider definition override 전파와 충돌 거부, 정상·불법 입력 29개 테스트              | G1 PASS      |
| 제품 격리                               | Builder/Publish source entry/barrel/store/history/panels/IDB의 신규 모듈 import 0, Builder dist JS/CSS의 `CatalogGraph`/`applyCatalogTransaction`/format marker 0. Builder build와 격리 WebKit frame smoke 통과                                                  | Phase 1 PASS |

## 실행 검증

- `pnpm --dir packages/shared exec vitest run src/catalog/document/__tests__/g1.test.ts` — 29/29 PASS.
- `pnpm --dir packages/shared exec eslint src/catalog/document src/catalog/transactions src/catalog/resolution` — PASS.
- `pnpm run codex:typecheck` — PASS.
- `pnpm --dir apps/builder build` — PASS. CSS 문법 및 chunk 경고는 출력됐으나 빌드 실패는 없었다.
- `node apps/builder/scripts/adr248-webkit-smoke.mjs --out /private/tmp/adr248-g1-old-builder-smoke.json` — 기존 Builder 격리 프로젝트의 frame 240×120, Canvas 1, console/page error 0.
- `git diff --check` — PASS. 제품 import 및 dist marker 검색 0.

## 다음 gate에 남긴 검증

`changedIds/removedIds`의 실제 resolver 구독·selector·layout·persistence 소비, Builder history 및 data history 통합은 Phase 2 G2 **UNVERIFIED**다. 실제 catalog의 전체 등록 type/variant·Canvas/DOM parity, Preview 금지 surface, 저장·refresh 왕복, G5 paired 성능·byte·bundle 예산은 G3~G5 **UNVERIFIED**다. 기존 Builder 제품 경로는 이번 Phase에서 전환하지 않았다. Phase 2는 별도 사용자 지시 전 시작하지 않는다.

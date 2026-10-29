# ADR-291 design breakdown — 데이터 층 조회 · 어휘 · 계산 필드

> 본문: [291-data-query-vocabulary-computed-fields.md](../291-data-query-vocabulary-computed-fields.md). Phase 2 (열 편집기 · 격자 파일) 는 ADR-289 Implemented 뒤 — Phase 0 · 1 · 3 은 그 파일을 건드리지 않아 먼저 간다 (2026-10-29 `/execute-adr 291`). 검토 원문: [JSON_FORMULA_COMPUTED_FIELDS_2026-10.md](../../explanation/research/JSON_FORMULA_COMPUTED_FIELDS_2026-10.md).

## 0. 전제 lock-in (fork 4 질문 — ADR-284 결정 10 의 「수식 언어 배제」 를 바꾸는 새 ADR)

1. **base / 응용**: ADR-284 (보기 entry · 조건 트리 · 묶기 · 집계 · 참조 · 직렬화) 가 base, 이 ADR 은 그 평가기 · 직렬화에 **행 안 계산 (계산 필드)** 과 **서버 조회 범위** 를 더하는 응용. 284 Implemented (2026-10-27) 가 선행. ADR-285 (코드 보기 역변환) · 286 (정의 = 문서 entry) · 289 (열 편집기) 는 이 ADR 의 소비자 · 자리 — 286 · 289 가 먼저 닫힌다.
2. **schema 직교성**: `CatalogDataField.formula?: string` 선택 필드 하나 — 결과 타입은 기존 `type` (리뷰 m3, contract 51 그대로) · `SerializationWarningCode` 에 `COMPUTED` · `body` 형식의 요청 모양에 `group` · `page`. ADR-284 의 `ViewEntry` · 조건 트리 · 집계 어휘 · ADR-286 의 entry 3 종은 그대로 — 계산 필드는 schema 의 **필드** 이지 보기가 아니다.
3. **선행 ADR 전제 reverse 검증**: ADR-284 결정 10 「자유 코드 · 수식 언어 · 전용 DSL 배제」 는 **사용자가 2026-10-29 에 닫힌 식 언어에 한해 바꿨다** (본문 Status 확인 항목 1). 자유 코드 · DSL 배제는 유지 — json-formula 는 닫힌 어휘 (함수 목록 · 임의 JS 없음) 라 「스크립트 escape 금지」 와 양립. ADR-284 결정 6 (평가기 한 모듈 — Preview · Publish) 는 유지, Canvas 는 보증 대상에서 뺀다 (확인 항목 2 — 결정 6 의 「Canvas · Preview · Publish 같은 모듈」 중 Canvas 는 모양 확인용으로 같은 모듈을 쓰되 결과 게이트는 Preview · Publish 사이). ADR-257 「Virtualizer 쓰지 않는다」 는 이 ADR 이 건드리지 않는다 (대량 표시 상한은 엔진 ADR 의 몫).
4. **판독 라운드에 미루지 않음**: 위 1 ~ 3 은 사용자 원문 (2026-10-29 — 「계산 필드 포함」 `/create-adr` · 「퍼블리시는 canvas 로 하지 않는다」 · 「결론은?」 뒤 도입 확정) 으로 확정.

**추정 규모** ~22 파일 — shared 14 (`collections/formula/` 새 모듈 3 · `evaluate.ts` · `comparison.ts` · `serialize.ts` · `dataBinding.ts` · `catalogPreviewSession.ts` · `document/types.ts` · `validation.ts` · `codeView` 생성기 · 역변환 · golden · `package.json`) · builder 8 (`fieldTypes.ts` · `ColumnEditorPopover.tsx` · `DataGrid.*` · `codeView.ts` · i18n 2 · bench). Phase 0 에서 줄 번호와 함께 freeze (1.5 배 이상이면 보강 커밋 · 사후 보고).

## 1. Phase 0 — inventory · RED · 측정 (G0) — **완료 2026-10-29**

착수 HEAD `00b90f6cc`. 줄 번호는 그 HEAD 의 파일 (spike 가 없는 모양) 기준.

### 1a. 쓰기 · 읽기 지점 전수 (R1 · R8) — freeze

| 경로 (HEAD `00b90f6cc`)                                                                                                                                                                                                                           | 종류                                 | 이 ADR 뒤                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/catalog/document/types.ts:1329` `CatalogDataField` · `validation.ts:442` `dataFields` (exact 키 9 — spike 가 `formula` 를 더함)                                                                                              | 필드 정의 · 검증                     | `formula?: string` (+ `type` = 결과 타입) + 검증 (문법 · 루트 식별자 id 존재 · 순환 · 값 컨텍스트 추적 · 분류 불가 거절) |
| `apps/builder/src/types/builder/data.types.ts:29` `DataFieldType` (ADR-292 로 6 종 + reference) · `panels/datatable/utils/fieldTypes.ts:35` `FIELD_TYPES`                                                                                         | 타입 어휘 · 패널 표                  | 타입 추가 없음 — 격자 머리글 아이콘만 `formula` 유무로 `Sigma`                                                           |
| `collections/view/evaluate.ts:37` `ViewRunField.read` · `:78` `viewRunSchema` · `:164` `viewFieldOf` · `:196` `cellOf` · `:583` `runViewQueries`                                                                                                  | 평가기 schema · `read` 훅            | formula 필드에 `read` (compile 캐시 · 날짜 다리 · 오류 `null`)                                                           |
| `catalog/runtime/dataBinding.ts:203` `served` 분기 · `:268` `ref.query` 분기 · `:382` `runBindingView` → `runViewQueries`                                                                                                                         | 행 소스                              | 계산 필드는 보기 · 서버 답과 무관하게 행 읽기 단계에서 적용 (보기 없는 바인딩은 지금 평가기를 타지 않는다)               |
| `collections/view/serialize.ts:56 ~ 72` 경고 코드 · `:85` `body` 모양 `{ where, sort }` · `:233` body 분기 · `:318` `GROUP`                                                                                                                       | 서버 조회 직렬화 · 보고              | `COMPUTED` 코드 · `body` 에 `group` · `page` · `suffix` 페이지 · 전체 수                                                 |
| `catalog/runtime/catalogPreviewSession.ts:491` `totalPath` · `:1144` `loadPage` · `:1213` `serverView` · `:1252` 묶기 · 집계는 로컬                                                                                                               | Preview · Publish 세션의 요청 · 응답 | 집계 응답 → 결과 schema · 전체 수 · 「전체 N 행」 로드 + 상한 · `served.mode`                                            |
| `apps/builder/src/builder/catalogRuntime/codeView.ts:74 ~ 79` `codeViewDataOf` (id · key · type · reference 만) · `packages/shared/src/codeView/{generate.ts,inverse.ts}` (코드 보기는 `./data/<name>` 행 import 만 — 필드 정의 출력은 아직 없다) | 코드 보기 schema 투영 · 역변환       | `formula` 키 (이름 표기) · 역변환은 치환 모듈로 id                                                                       |
| `panels/datatable/grid/ColumnEditorPopover.tsx` · `DataGrid.*` · `grid/cellValue.ts` (289)                                                                                                                                                        | 열 편집기 · 격자                     | 「계산 열」 토글 · 식 입력 · Type = 결과 타입 · 오류 줄 · 읽기 전용 열 값 — **Phase 2 · 289 뒤**                         |
| `types.ts:1395` `ProjectVariableEntry.transform` · `apps/builder/src/builder/catalogRuntime/catalogDataStore.ts:127` · `:185` (복사만 — 실행자 0)                                                                                                 | 죽은 식 자리                         | 사용자 결정 2 (삭제 권고)                                                                                                |
| `apps/builder/src/builder/stores/utils/dataChange.ts:700 ~ 707` 필드 rename (`renameRowsKey` — 행의 key 만 옮긴다 · id 유지)                                                                                                                      | 정의 쓰기                            | rename 은 id 유지 → 식 불변 (G1)                                                                                         |

실측 vs 추정: 추정 ~22 파일 그대로 (코드 보기의 필드 정의 출력이 없어 Phase 2 의 생성기 · 역변환 작업이 「키 하나」 보다 크다 — 필드 정의 블록 출력 자체를 더한다. 1.5 배 미만).

### 1b. 소비 경로 (Q4 — grep 3)

`viewFieldOf` → `cellOf` → ① 조건 `judge` (`evaluate.ts:388`) ② 집계 `aggregateOf` (`:499` · `:548`) ③ 정렬 `sortOf` (`:610`) · 행 결과 → `boundRowsOf` → `{field}` 템플릿 (`fieldTemplate.ts`) · Chart `budgetAggregate` · Table 셀 (`readRowCells`). 계산값이 세 소비처에 같은 객체로 닿는지 Phase 2 테스트가 단언한다.

### 1c. 측정 표 (G0 — 사용자 결정 4 의 입력) — 실측 2026-10-29

조건: Apple M4 Pro · macOS 27.0.1 · node v24.22.1 · Chrome (사용자 브라우저, Chrome MCP 탭 — **CPU throttle 없음**: MCP 로 throttle 을 걸 수 없다, 사용자 4x 환경 값은 미측정 — ×4 를 가정하지 않는다). 행 = 생성 합성물 12 열 (**규모 전용 — Q1**, 분포 인용 금지). 보기 = 조건 5 AND (`status equals` · `age gte` · `score lt` · `name contains "1"` (Collator) · `active equals`) + 정렬 (`score desc`) / + 묶기 `city` · 집계 3 (count · sum price · mean score). 중앙값 5 회 (Worker 3 회). 대조군 (Q3) = 같은 행에 손 코드 (`filter` · `toSorted` · `Map.groupBy`). 평가기 번들 = `evaluate.ts` (HEAD + 미커밋 spike — formula 필드 없는 경로는 `schema.filter` 한 번뿐). 스크립트 · 결과: 세션 scratchpad `g0/` (`bench.mjs` · `index.html` · `formula-bench.mjs` · `wasm-compile.mjs`, 로컬 전용).

**현 평가기 `runViewQueries` (ms)**

| 행        | 보기                 | node 메인 | node 손 코드 | Chrome 메인 | Chrome 손 코드 | 매치   | Worker 왕복 (복제 + 실행 + spawn) node / Chrome | Worker 안 실행 node / Chrome |
| --------- | -------------------- | --------: | -----------: | ----------: | -------------: | ------ | ----------------------------------------------: | ---------------------------: |
| 10,000    | 조건 5 + 정렬        |       2.7 |          0.2 |         3.3 |            0.1 | 255    |                                     28.4 / 35.6 |                   5.4 / 15.7 |
| 10,000    | 조건 5 + 묶기 · 집계 |       2.7 |          0.1 |         3.9 |            0.1 | 5 묶음 |                                     27.5 / 77.2 |                   5.5 / 36.9 |
| 100,000   | 조건 5 + 정렬        |      26.5 |          1.2 |        29.7 |            1.1 | 3,372  |                                    141.7 / 96.8 |                  30.9 / 29.0 |
| 100,000   | 조건 5 + 묶기 · 집계 |      26.8 |          1.3 |        25.6 |            0.9 | 5 묶음 |                                    138.5 / 95.6 |                  30.2 / 28.8 |
| 1,000,000 | 조건 5 + 정렬        |     272.4 |         25.5 |       257.5 |           21.2 | 41,046 |                               1,350.9 / 1,075.2 |                288.8 / 258.3 |
| 1,000,000 | 조건 5 + 묶기 · 집계 |     278.1 |         23.5 |       262.5 |           20.0 | 5 묶음 |                               1,315.0 / 1,074.5 |                298.6 / 268.4 |

읽기: ① 평가기는 손 코드의 **~10 ×** (조건마다 `viewFieldOf` 경로 조회 · `viewCompare` 분기 · Collator — 행마다). ② 10만 행 = 한 프레임 ~1.6 (26 ms), 100만 행 = ~270 ms 메인 블로킹. ③ Worker 는 **행 복제가 지배** — 100만 행 왕복 1.1 ~ 1.35 s 중 실행은 0.26 ~ 0.3 s. 요청마다 행을 넘기는 Worker 는 손해이고, 행을 한 번 넘겨 상주시키는 Worker (`load` 뒤의 소스가 Worker 안에 산다) 만 이득이다. ④ 묶기 · 집계는 조건 · 정렬과 비용이 같다 (지배 항은 조건 5).

**계산 필드 해석기 (json-formula 2.1.0 — 식 5: 산술 `price * qty` · 문자열 `name & " — " & city` · 날짜 차 `datedif(toDate("2020-01-01"), toDate(joined), "d")` · 조건 `if(score > 50, "high", "low")` · 배열 합 `sum(tags[*].length(@))`, compile 1 회 · run 행마다, node)**

| 행     | 식 5 합계 (중앙값 5) | 셀당 µs | 산술 | 문자열 | 날짜 차 | 조건 | 배열 합 (µs/행) |
| ------ | -------------------: | ------: | ---: | -----: | ------: | ---: | --------------: |
| 1,000  |              6.85 ms |    1.37 | 1.62 |   1.29 |    2.05 | 0.66 |            1.24 |
| 10,000 |             40.82 ms |    0.82 | 0.47 |   0.60 |    1.66 | 0.56 |            0.79 |

읽기: 1,000 행 × 식 5 = ~7 ms (G6 상한 16 ms 안 — 불리 케이스는 날짜 차 2 µs/행). warm 뒤 0.5 ~ 1.7 µs/셀 → 10만 행 × 식 5 ≈ 0.4 s (메인에서 못 돌린다 — 「없음 + Worker」 의 범위도 10만 행 위는 아니다). 함정 실측: json-formula 의 **문자열 리터럴은 쌍따옴표** (`"high"`), 홑따옴표는 식별자 (`'fld_a'`) — `'d'` 를 넘기면 필드 참조라 `""` 가 된다 (패널 안내 · 검증 메시지에 적는다).

**후보 wasm 엔진 (npm 실측 — scratchpad 에 tarball 만, 제품 코드 0)**

| 후보        | 버전                                            | 라이선스     | 크기 (gzip)                                                                                                                   | `WebAssembly.compile` (node, 3 회)                                                         | 계산 열 식 언어                                                             | 집계 어휘 (count · sum · mean · min · max) | Worker 모델                            |
| ----------- | ----------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| Perspective | `@finos/perspective` 3.8.0                      | Apache-2.0   | `perspective-js.wasm` 211 KB + `perspective-server.wasm` 2,248 KB (+ js 13.7 KB) · `perspective.inline.js` 단일 번들 2,559 KB | < 1 ms (둘 다 — node 는 지연 컴파일이라 **로드 시간이 아니다**, 브라우저 로드 시간 미측정) | 자체 식 언어 (ExprTK 계열 — `"a" * "b"` 열 참조 · 문자열 · 날짜 함수)       | 전부 + median · var · 피벗                 | 자체 Web Worker (`perspective.worker`) |
| DuckDB-WASM | `@duckdb/duckdb-wasm` 1.33.1-dev57.0 (`latest`) | MIT          | wasm 8,114 (eh) · 8,183 (coi) · 9,256 (mvp) KB + browser js 277 KB + worker 206 KB                                            | 38 ~ 48 ms                                                                                 | SQL                                                                         | SQL 전부                                   | 자체 Worker (`AsyncDuckDB`)            |
| Arquero     | `arquero` 8.0.3                                 | BSD-3-Clause | 74 KB (`arquero.min.js`) — wasm 없음 (순수 JS 열 지향)                                                                        | —                                                                                          | JS 식 문자열 (`d => d.a * d.b`) · `op` 표 — 닫힌 어휘가 아니다 (임의 JS 식) | count · sum · mean · min · max · median …  | 없음 (메인 — 직접 Worker 에 둬야 한다) |

읽기 (사용자 결정 4 의 재료): Preview initial 상한 320 KB (ADR-201) 대비 Perspective 2.4 MB · DuckDB 8 MB+ 는 publish lazy 라도 첫 조회 전 로드가 무겁다. Arquero 는 작지만 식이 임의 JS 라 「스크립트 escape 금지」 와 충돌 (계산 열은 json-formula 로 두고 Arquero 는 집계만 쓰는 조합이면 가능). 현 평가기 + 상주 Worker (복제 1 회) 면 10만 행은 한 프레임 안팎 · 100만 행은 0.3 s — 그 위가 엔진의 자리.

### 1d. RED (`it.fails` → Phase 뒤 `it`) — 2026-10-29 8/8 + 1/1 expected fail

`packages/shared/src/collections/view/__tests__/adr291Red.test.ts` (①~⑥ · ⑧ ×2) · `apps/builder/src/builder/catalogRuntime/__tests__/adr291Red.test.ts` (⑦). 식은 전부 **id 형** (`'f-price' * 'f-qty'`) — spike 의 key 참조로는 통과하지 않는다.

1. schema 에 `formula` 필드 → `runViewQueries` 결과 행에 그 key 의 값 20 · 22 (지금: 없음).
2. 보기 없는 바인딩 (`ref.query` 없음) 의 `catalogBoundRows` 행 `values.total` (지금: 평가기 미실행).
3. 서버가 답한 행 (`served`) 에 계산값.
4. 필드 rename (`price` → `unitPrice`, id 유지) 뒤 식의 값 불변.
5. 계산 필드 조건 + `body` endpoint → `COMPUTED` · `groupBy(raw) + sum(total)` → `COMPUTED` + 본문에 `group` 없음 + 로컬 42 (리뷰 h1).
6. `body` 형식 endpoint 의 원시 필드 묶기 · 집계 → 요청 본문 `group: { by: ["city"], aggregates: [{fn, field, as}] }` · `GROUP` 경고 없음 (지금: `GROUP` · 로컬).
7. 코드 보기 투영 `codeViewDataOf` 가 `formula` 를 보존하고 같은 식의 `type: "number"` · `"string"` 열이 둘로 남는다 (리뷰 m3 — 지금: 키 탈락).
8. 치환 범위: `sum('f-items'[*].price)` = 30 (루트 `items` 만) · `@.'f-price' * 'f-qty'` = 20 이고 rename 뒤에도 20 (Round 2 h2) · 정의 검증 — 모르는 루트 id → `FORMULA_*` 거절 · 함수 결과 위 투영 `sum(values(@)[*].price)` → `FORMULA_SCOPE_UNSUPPORTED` (지금: `formula` 키 자체가 없다).

### 1e. spike 증거 (2026-10-29, 미커밋 6 파일)

`packages/shared/package.json` (+ lockfile) · `catalog/document/types.ts` (`formula?: string`) · `validation.ts` (키 1) · `collections/view/evaluate.ts` (`withFormulaFields` — 정적 import · key 참조) · `catalog/runtime/dataBinding.ts` (보기 없는 분기) · builder `src/types/json-formula.d.ts` + `tsconfig.tests.json` (289 세션이 type-check 를 풀려고 둔 shim). Compare Mode: Canvas · Preview 둘 다 `total` 20 · 22 · 0 (dev 5176 · 콘솔 0). 이 모양은 R1 (key 참조) · R5 (정적 import) 를 그대로 가지므로 제품 코드가 아니다 — **원복은 하지 않았다** (Phase 0 실행 중 `git checkout` 이 차단돼 미커밋 변경을 지우지 않음): Phase 1 이 같은 6 파일을 제품 모양 (id 참조 · lazy import · `collections/formula/`) 으로 다시 쓰고, RED ①~⑧ 이 id 형이라 spike 모양으로는 GREEN 이 되지 않는다.

## 2. Phase 1 — 저장 형식 · 식 모듈 (G1 · G2) — **완료 2026-10-29** (§8)

- `CatalogDataField.formula?: string` · 결과 타입 = `type` (number · string · boolean · date · datetime — 그 밖의 `type` 과 `formula` 의 조합은 검증 거절) · 검증: 문법 (`compile` 성공) · **루트 범위** 식별자 전부 같은 collection 의 필드 id (`'fld_…'`) 또는 `$var_<id>` · 순환 0 (루트 식별자 의존 그래프) · 숨긴 함수 0 (`Function` 노드 `name`) · 토큰 ↔ AST 범위 다중집합 일치 (불일치 = 지원하지 않는 문법으로 거절).
- `packages/shared/src/collections/formula/` — `engine.ts` (lazy `import("@adobe/json-formula")` · 인스턴스 하나 · `stringToNumber` 날짜 다리 · compile 캐시 Map<expression, ast>) · `scope.ts` (**값 컨텍스트 추적** — AST 를 걸으며 각 노드가 평가되는 값을 `root` · `sub` · `made` 로 전달: 시작 `root`; `Identifier` · `QuotedIdentifier` 는 컨텍스트가 `root` 일 때만 필드 참조; `Identity` (`@`) 는 컨텍스트 유지; `ChainedExpression` 은 왼쪽을 지금 컨텍스트로 평가한 뒤 오른쪽을 「왼쪽이 낸 컨텍스트」 로 — 왼쪽이 `@` · 괄호 안 `@` · 루트를 유지하는 파이프면 `root`, 식별자 · 함수 · 리터럴이면 `sub`, 객체 · 배열 생성이면 `made`; `Projection` · `ValueProjection` · `FilterProjection` 의 오른쪽 · 조건과 `ExpressionReference` 아래는 `sub` (원소); `Pipe` 오른쪽 = 왼쪽이 낸 컨텍스트; `KeyValuePair` 키는 참조 아님, 값은 지금 컨텍스트; `Function` 인자는 지금 컨텍스트. 분류 못 하는 모양 (함수 결과 위 투영 · 다단 파이프 · 식 참조를 받지 않는 자리의 `&`) 은 `FORMULA_SCOPE_UNSUPPORTED` 로 거절 — 조용한 통과 0. 같은 추적을 토큰 걷기에 적용해 `start` 위치 목록을 내고, 두 루트 식별자 다중집합이 같을 때만 치환 — 리뷰 Round 2 h2 (`@.price * qty` 의 `price` 는 루트)) · `names.ts` (이름 ↔ id 치환 — `scope.ts` 가 고른 토큰만 교체, 그 밖 문자 보존 — 리뷰 h2) · `result.ts` (`resultType` 강제 변환 — date 는 epoch 일수 → ISO · 오류 → `{ value: null, error }`) · `allowed.ts` (함수 목록 스냅샷 = 설치본 `functions.js` export 이름 − 숨김 4 → 정적 테스트가 drift 를 잡는다).
- 날짜 입력: `read` 전처리가 schema 의 `date` · `datetime` 필드 값을 `@internationalized/date` `parseDate` · `parseAbsolute` 로 epoch 일수 (소수부 시각) 로 바꿔 넘긴다. `today` · `now` 는 `ViewRunInput.today` 를 전역 `$today` 로 (결정적).
- 의존: `packages/shared/package.json` `@adobe/json-formula: 2.1.0` 고정 (catalog 선언) · `json-formula.d.ts` 타입 shim (spike 것 다듬기 — gitignore 밖 자리로).
- 테스트: G1 (rename · 순환 · 숨김) · G2 (타입 · 날짜 fixture — 손계산 oracle) · RED ① ④ ⑧ → `it`.

## 3. Phase 2 — 평가 자리 · 패널 · 코드 보기 (G6) — **ADR-289 Implemented 뒤**

- `viewRunSchema` 가 formula 필드에 `read` 를 붙인다 (`viewFieldOf` 안 — 참조 필드와 같은 함수). 동기 경로라 lazy 엔진은 **행 소스 진입 전** 에 준비한다 — `catalogBoundRows` · Preview 세션이 formula 필드가 있는 문서를 열 때 엔진을 await 하고 그동안 `loadingState: "loading"` (ADR-284 Phase 4 의 상태 통로). Canvas 도 같은 준비 (mock 모양 확인).
- `catalogBoundRows` 의 보기 없는 분기 · `served` 분기 둘 다 행 읽기 단계에서 적용 (spike 의 임시 분기를 행 소스 하나로). RED ② ③ → `it`.
- 데이터 패널: 열 편집기 (289 의 절 구조) 에 「계산 열」 토글 → 식 입력 (이름 표기 · 자동완성은 필드 이름 · 함수 목록 — CodeMirror 없이 TextArea + 목록 · 안내 「글자는 쌍따옴표」) · Type Select 는 결과 타입 (number · string · boolean · date · datetime 만 활성) · 오류 한 줄. 격자 머리글 아이콘은 `formula` 유무로 `Sigma` (`FIELD_TYPES` 표에 타입 추가 없음) (정의 오류 코드 → i18n) · 격자 읽기 전용 열 (값 · 머리글 툴팁에 식 · 셀 오류 표지).
- 코드 보기: 생성기가 `./data/<name>` 에 **필드 정의 블록** (지금은 행 import 만 — §1a) 을 내고 거기 `formula: "…"` (이름) · 역변환 (`inverse`) 은 `names.ts` 로 id · golden 6 (formula collection) · strict 왕복. RED ⑦ → `it`.
- G6 bench (`collections/formula/__tests__/adr291G6.bench.test.ts`, `ADR291_G6=1`) — §1c 예상 1,000 행 × 식 5 ≈ 7 ms.

## 4. Phase 3 — 서버 조회 범위 · 조회용 보고 (G4 · G5) — **완료 2026-10-29** (§8)

- `serialize.ts`: `body` 형식 요청 `{ where, sort, group: { by, aggregates }, page: { cursor | offset, limit }, total: true }` · `suffix` 형식은 페이지 (`_page` · `_limit` — endpoint 표로 이름) · 전체 수 (`X-Total-Count` 또는 `totalPath`) 만 · 묶기 · 집계 · 계산 필드 조건은 보고 (`GROUP` → 「전체 N 행」 · `COMPUTED`). **`COMPUTED` 판정 입력** = 조건 필드 · 정렬 필드 · `groupBy` · `aggregates[].field` · 각 필드의 의존 전이 (계산 필드 → 읽는 루트 필드 → 참조 경로 대상 필드 → …, `scope.ts` 의 루트 식별자 그래프). 하나라도 있으면 그 보기 사슬의 요청은 **원시 행 모드** (조건 · 묶기 · 집계 전부 로컬 · 요청 본문에 `group` 없음), 없으면 **서버 집계 모드** — 세션이 두 모드를 `served.mode` 로 들고 섞지 않는다 (리뷰 h1). RED ⑤ ⑥ → `it`.
- Preview · Publish 세션: 집계 응답을 보기 결과 schema 로 (`ViewRunResult.schema` 모양 — 서버가 답한 묶음 행) · 「전체 N 행」 로드는 `loadMore` 를 끝까지 (상한 — 사용자 결정 3) 뒤 로컬 평가 · 상한 초과 = 거부 + 안내 (행 0).
- 패널 (ADR-284 의 경고 3 시점 그대로): 조건 저작 · 원본 변경 · 형식 변경 때 「서버로 보낼 수 없음 · 전체 N 행」.
- G5 mock 서버: `apps/builder/scripts` 의 json-server 류 하니스에 body 형식 어댑터 (묶기 · 집계 · 페이지 · 전체 수) — 로컬 평가기 결과와 동치 단언 (손계산 fixture 포함).

## 5. Phase 4 — publish 런타임 · 엔진 결정 입력 — 사용자 결정 4 = **없음 + 상주 Worker** (2026-10-29)

- **경계 확인 (2026-10-29)**: `runViewQueries` 의 입력은 전부 직렬화 가능하다 — 행 (JSON) · `queries` (JSON) · `schema` (`viewRunSchema` — `formula` 포함, JSON) · `resolve` 는 `catalogRowQueryResolve(query)` = `query.values` 맵 (JSON) · `today` (문자열) · `references` 는 `viewRunReferences(sources)` = collection 들 (JSON). 출력 `rows` · `schema` · `broken` · `applied` 도 JSON. 엔진 (json-formula) 은 Worker 안에서 같은 `loadFormulaEngine` 으로 lazy 로드. 따라서 Worker 는 **서버처럼** 선다: 세션이 `load` 뒤 행을 한 번 보내고 (상주 — §1c ③), 보기 요청마다 `{ query, schema, sources }` 를 보내 결과 행을 받아 `served` (`mode: rows | aggregate`) 로 바인딩에 넘긴다 — Phase 3 의 서버 답 경로 그대로라 resolver 는 바뀌지 않는다.
- 구현 (다음): `collections/view/viewWorker.ts` (Worker 본체 — `rows` · `run` 메시지) · `viewWorkerClient.ts` (상주 클라이언트 — `setRows(collectionId, rows)` · `run(request) → Promise`) · 세션 (publish 런타임만 — Builder Preview 는 메인 그대로) 이 `useMockData` 가 아니고 행이 임계 (§1c — 1만 행) 를 넘는 collection 의 보기를 Worker 로 · 번들은 publish lazy chunk (G3). 100만 행 위는 별도 ADR.

- 평가 (`runViewQueries` + 계산 필드) 를 publish 런타임에서 Worker 로 옮길 수 있는 경계 확인 — 입력은 직렬화 가능 (행 · `ViewQuery` · 값) · `references` 콜백만 메시지로 바꾼다. §1c ③ 의 실측대로 **행은 한 번만 넘기는 상주 Worker** 여야 한다 (요청마다 복제하면 100만 행 1 s). 실제 Worker 도입은 사용자 결정 4 (「없음 + Worker」 를 고르면 이 Phase, 엔진을 고르면 별도 ADR).
- §1c 측정 표를 사용자에게 보고 → 사용자 결정 4.

## 6. Phase 5 — 번들 · 문서 · live (G3 · G7 · G8)

- G3 번들 (착수 HEAD `00b90f6cc` 대비) · formula 없는 문서 요청 0.
- G7 live 시나리오 (본문 Gates) — 별도 dev 서버 (5174 ~ 5176 중 비어 있는 것).
- 문서: `.claude/rules/state-management.md` §4 (계산 필드 한 항 · 표시용 / 조회용) · `docs/CHANGELOG.md` · README · `docs:stale-symbols`.
- G8 사용자 확인 → Implemented (`### Live Exercise`).

## 7. 범위 밖 (이 ADR 이 열지 않는다)

- 식 → 서버 조회 번역 (SQL · PostgREST 식) — 실증 뒤 별도.
- publish 로컬 조회 엔진 자체 (Perspective · DuckDB-WASM) — 사용자 결정 4 뒤 별도 ADR.
- react-spectrum-charts (Recharts + Canvas 대칭 교체) — 별도 ADR.
- 대량 표시 (Virtualizer · 표시 상한) — ADR-257 유지.
- 계산 변수 (`transform` 대체) — 사용자 결정 2 가 「교체」 일 때만 이 ADR phase 에 추가.

## 8. 기록

- **2026-10-29 Phase 0 완료 (G0)** — 사용자 `/execute-adr 291` → Accepted (리뷰 Round 2 pending 0). inventory freeze (§1a, HEAD `00b90f6cc`) · RED 8 + 1 expected fail (§1d) · 측정 표 (§1c — node · Chrome 메인 / Worker · 1만 · 10만 · 100만 · 해석기 5 식 · wasm 후보 3) · spike 기록 (§1e, 원복 대신 Phase 1 이 덮어쓴다). Phase 2 는 289 Implemented 뒤. ADR-289 는 G5 사용자 확인 대기라 Phase 0 · 1 · 3 만 먼저 간다 (파일 겹침 없음).
- **2026-10-29 Phase 1 완료 (G1 · G2)** — `collections/formula/{engine,scope,names,compute,validate,allowed}.ts` + `json-formula.d.ts` (gitignore 예외 · `engine.ts` 가 `/// <reference>`) · `validation.ts` 가 엔진 로드 시 정의 검사 + 순환 검사 · `evaluate.ts` 의 spike 블록을 `withComputedCells` 호출로 교체 · spike shim 2 (`apps/builder/src/types/json-formula.d.ts` · gitignored `packages/shared/src/json-formula.d.ts`) 는 `rm` 이 차단돼 빈 파일로 비활성화 — **삭제는 사용자 승인 뒤**. 실측으로 바뀐 설계: `today()` · `now()` 는 전역 `$today` 대신 custom 함수 override (이름 유지 · run 의 `today` 읽음) · `toDate()` 도 UTC 다리로 override (내장은 로컬 시간대라 필드 글자와 어긋남 — R4) · 날짜 입력 전처리 없음 (`stringToNumber` 훅이 산술 자리에서 변환). 테스트 36 PASS · RED ① ④ ⑧ GREEN · type-check PASS. Phase 2 는 289 뒤 — 다음은 Phase 3.
- **2026-10-29 사용자 결정 2 · 3 · 4 · 6** — 전부 권고안 (삭제 · 10,000 · 없음 + 상주 Worker · body 전부 + suffix 페이지 · 전체 수).
- **2026-10-29 Phase 3 완료 (G4 · G5)** — `serialize.ts` (`computedViewUses` · `COMPUTED` → 전송 0 + `load: "all"` · body `group` · `page` · `total` · suffix `pageSize` 페이지 · `GROUP` + `load: "all"` · `VIEW_LOCAL_LOAD_CAP`) · `executeCollectionEndpoint.ts` (`X-Total-Count` · 번호 페이지 cursor) · `catalogPreviewSession.ts` (`uniqueView` / `serverView` 분리 · `viewRequest(page)` · `loadAll` · `refuseView` · `viewRefusals` · `served.mode`) · `viewQuery.ts` (`served.mode`) · `dataBinding.ts` (보기 없는 · served 행의 계산 셀 · aggregate 모드 결과 schema · memo 키) · schema 투영 4곳에 `formula` (QueryFormatSection · 세션 · 코드 보기 생성기 · `codeViewDataOf`) · `CatalogFilterField.formula` · i18n GROUP 재작성 + COMPUTED (서식 함수) · `transform` 삭제 (사용자 결정 2). 설계에서 바뀐 것: suffix + 묶기는 조건을 보내고 전체를 불러온다 (Decision 6 의 「조건은 서버」 — COMPUTED 만 전송 0) · 상한 초과의 안내는 세션 `viewRefusals` + 콘솔 경고 (패널 표시는 Phase 2 의 격자 · 보기 패널과 함께). 테스트: G4 3 (세션 하니스 `adr280Harness`) · G5 4 (`mock-query-server.mjs` 독립 oracle + 손계산) · RED 9/9 GREEN · shared · builder 전체 PASS · type-check PASS. 남은 것: Phase 2 (289 뒤 — 패널 · 격자 · 코드 보기 필드 정의 블록 · 엔진 preload) · Phase 4 (상주 Worker — 사용자 결정 4) · Phase 5 (G3 번들 · G7 live · G8).
- **2026-10-29 live 1회 (Chrome MCP · 5174 dev 서버 · 새 프로젝트 「ADR291 live」)** — dev handle `addCollection` 로 Orders (price · qty · `total = 'f-price' * 'f-qty'` · due · `left = 'f-due' - today()`) 를 넣고 팔레트 Table → Data source Orders → 열 Label 을 `total` · `left` 로 (ADR-241 열 key = text): Canvas 셀 **20 · 22 · 0 / 5 · 1 · 0** (today 2026-10-29 — 날짜 다리 · `today()` override) · 엔진 lazy 로드 뒤 자동 재읽기 (`onFormulaEngineLoaded`) · 새로고침 (저장 → 재로드 → 첫 읽기에서 로드) 뒤 같은 값 · 콘솔 오류 0. Preview (publish blob 탭) 은 그 서버의 낡은 dep 최적화 (shared 에 json-formula 가 더해진 뒤 React 두 벌 — `Cannot read properties of null (reading 'useContext')` in RAC Table) 로 열리지 않아 **미검증** — 서버 재시작 뒤 G7 에서. 같은 날 추가: `onFormulaEngineLoaded` (engine.ts) · `withComputedCells` 가 미로드 때 로드를 시작 · Builder (`CatalogBuilderCore`) · Preview 세션이 로드 뒤 `refreshRows`.

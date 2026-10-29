# ADR-291 design breakdown — 데이터 층 조회 · 어휘 · 계산 필드

> 본문: [291-data-query-vocabulary-computed-fields.md](../291-data-query-vocabulary-computed-fields.md). 착수는 ADR-289 Implemented 뒤 (열 편집기 · 격자 파일 겹침). 검토 원문: [JSON_FORMULA_COMPUTED_FIELDS_2026-10.md](../../explanation/research/JSON_FORMULA_COMPUTED_FIELDS_2026-10.md).

## 0. 전제 lock-in (fork 4 질문 — ADR-284 결정 10 의 「수식 언어 배제」 를 바꾸는 새 ADR)

1. **base / 응용**: ADR-284 (보기 entry · 조건 트리 · 묶기 · 집계 · 참조 · 직렬화) 가 base, 이 ADR 은 그 평가기 · 직렬화에 **행 안 계산 (계산 필드)** 과 **서버 조회 범위** 를 더하는 응용. 284 Implemented (2026-10-27) 가 선행. ADR-285 (코드 보기 역변환) · 286 (정의 = 문서 entry) · 289 (열 편집기) 는 이 ADR 의 소비자 · 자리 — 286 · 289 가 먼저 닫힌다.
2. **schema 직교성**: `CatalogDataField.formula?: string` 선택 필드 하나 — 결과 타입은 기존 `type` (리뷰 m3, contract 51 그대로) · `SerializationWarningCode` 에 `COMPUTED` · `body` 형식의 요청 모양에 `group` · `page`. ADR-284 의 `ViewEntry` · 조건 트리 · 집계 어휘 · ADR-286 의 entry 3 종은 그대로 — 계산 필드는 schema 의 **필드** 이지 보기가 아니다.
3. **선행 ADR 전제 reverse 검증**: ADR-284 결정 10 「자유 코드 · 수식 언어 · 전용 DSL 배제」 는 **사용자가 2026-10-29 에 닫힌 식 언어에 한해 바꿨다** (본문 Status 확인 항목 1). 자유 코드 · DSL 배제는 유지 — json-formula 는 닫힌 어휘 (함수 목록 · 임의 JS 없음) 라 「스크립트 escape 금지」 와 양립. ADR-284 결정 6 (평가기 한 모듈 — Preview · Publish) 는 유지, Canvas 는 보증 대상에서 뺀다 (확인 항목 2 — 결정 6 의 「Canvas · Preview · Publish 같은 모듈」 중 Canvas 는 모양 확인용으로 같은 모듈을 쓰되 결과 게이트는 Preview · Publish 사이). ADR-257 「Virtualizer 쓰지 않는다」 는 이 ADR 이 건드리지 않는다 (대량 표시 상한은 엔진 ADR 의 몫).
4. **판독 라운드에 미루지 않음**: 위 1 ~ 3 은 사용자 원문 (2026-10-29 — 「계산 필드 포함」 `/create-adr` · 「퍼블리시는 canvas 로 하지 않는다」 · 「결론은?」 뒤 도입 확정) 으로 확정.

**추정 규모** ~22 파일 — shared 14 (`collections/formula/` 새 모듈 3 · `evaluate.ts` · `comparison.ts` · `serialize.ts` · `dataBinding.ts` · `catalogPreviewSession.ts` · `document/types.ts` · `validation.ts` · `codeView` 생성기 · 역변환 · golden · `package.json`) · builder 8 (`fieldTypes.ts` · `ColumnEditorPopover.tsx` · `DataGrid.*` 읽기 전용 열 · `codeView.ts` · i18n 2 · bench). Phase 0 에서 줄 번호와 함께 freeze (1.5 배 이상이면 보강 커밋 · 사후 보고).

## 1. Phase 0 — inventory · RED · 측정 (G0)

### 1a. 쓰기 · 읽기 지점 전수 (R1 · R8)

| 경로 (실측 2026-10-29)                                                                                                     | 종류                                 | 이 ADR 뒤                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/catalog/document/types.ts:1320` `CatalogDataField` · `validation.ts:441` `dataFields` (exact 키 8)    | 필드 정의 · 검증                     | `formula?: string` (+ `type` = 결과 타입) + 검증 (문법 · 루트 식별자 id 존재 · 순환 · 값 컨텍스트 추적 · 분류 불가 거절) |
| `apps/builder/src/types/builder/data.types.ts:27` `DataFieldType` · `panels/datatable/utils/fieldTypes.ts` `FIELD_TYPES`   | 타입 어휘 · 패널 표                  | 타입 추가 없음 — 격자 머리글 아이콘만 `formula` 유무로 `Sigma`                                                           |
| `collections/view/evaluate.ts:78` `viewRunSchema` · `:164` `viewFieldOf` · `:196` `cellOf`                                 | 평가기 schema · `read` 훅            | formula 필드에 `read` (compile 캐시 · 날짜 다리 · 오류 `null`)                                                           |
| `catalog/runtime/dataBinding.ts:268 ~ 292` `catalogBoundRows` (`ref.query` 분기 · `served` 분기)                           | 행 소스                              | 계산 필드는 보기 · 서버 답과 무관하게 행 읽기 단계에서 적용                                                              |
| `collections/view/serialize.ts:60 ~ 80` 경고 코드 · `:318` `GROUP`                                                         | 서버 조회 직렬화 · 보고              | `COMPUTED` 코드 · `body` 에 `group` · `page` · `suffix` 페이지 · 전체 수                                                 |
| `catalog/runtime/catalogPreviewSession.ts` `serverView` · `loadPage` · `totalPath`                                         | Preview · Publish 세션의 요청 · 응답 | 집계 응답 → 결과 schema · 전체 수 · 「전체 N 행」 로드 + 상한                                                            |
| `apps/builder/src/builder/catalogRuntime/codeView.ts:74` · `packages/shared/src/codeView/**` (생성기 · `inverse/parse.ts`) | 코드 보기 schema 출력 · 역변환       | `formula` 키 (이름 표기) · 역변환은 치환 모듈로 id                                                                       |
| `panels/datatable/grid/ColumnEditorPopover.tsx` · `DataGrid.*` · `grid/cellValue.ts` (289 dirty)                           | 열 편집기 · 격자                     | 「계산 열」 토글 · 식 입력 · Type = 결과 타입 · 오류 줄 · 읽기 전용 열 값                                                |
| `packages/shared/src/catalog/document/types.ts:1384` `ProjectVariableEntry.transform` · `catalogDataStore.ts:127`          | 죽은 식 자리                         | 사용자 결정 2 (삭제 권고)                                                                                                |
| 커맨드 `commands/data.ts` `setDataEntries` · 필드 rename 경로 (`DataChange` `rename_field` op → 명령)                      | 정의 쓰기                            | rename 은 id 유지 → 식 불변 (G1)                                                                                         |

### 1b. 소비 경로 (Q4 — grep 3)

`viewFieldOf` → `cellOf` → ① 조건 `judge` ② 집계 `aggregateOf` ③ 정렬 `sortOf` · 행 결과 → `boundRowsOf` → `{field}` 템플릿 (`fieldTemplate.ts`) · Chart `budgetAggregate` · Table 셀 (`readRowCells`). 계산값이 세 소비처에 같은 객체로 닿는지 Phase 2 테스트가 단언한다.

### 1c. 측정 표 (G0 — 사용자 결정 4 의 입력)

- 현 평가기 (`runViewQueries`) 를 생성 행 1만 · 10만 · 100만 (열 12 · 규모 전용 — Q1) × 보기 (조건 5 AND + 정렬 + 묶기 1 · 집계 3) 로 node 와 브라우저 (메인 스레드 · Worker) 에서 중앙값 5 회 · 기기 · 4x throttle 병기. 대조군 = 같은 행에 `Array.filter · toSorted` 손 코드.
- 계산 필드 해석기 비용: 같은 행에 식 5 (산술 · 문자열 연결 · 날짜 차 · `if` · 배열 합) — 행당 µs · 1,000 행 · 1만 행.
- 후보 wasm 엔진 표: Perspective · DuckDB-WASM · Arquero — wasm · JS 크기 (gz) · 로드 시간 · 계산 열 식 언어 · 집계 어휘 대응 (count · sum · mean · min · max) · 라이선스 · Worker 모델. 설치 · 실행은 scratchpad (제품 코드 0).
- 결과는 이 문서 §1c 에 표로 남긴다 (evidence 폴더는 로컬 전용).

### 1d. RED (`it.fails` → Phase 뒤 `it`)

1. schema 에 `formula` 필드 → `runViewQueries` 결과 행에 그 key 의 값 (지금: 없음).
2. 보기 없는 바인딩 (`ref.query` 없음) 의 `catalogBoundRows` 행에 계산값 (지금: 평가기 미실행).
3. 서버가 답한 행 (`served`) 에 계산값.
4. 필드 rename 뒤 식의 값 불변 (지금: 식이 key 를 읽으면 깨진다 — spike 모양).
5. 계산 필드 조건 + 페이지 endpoint → `serializeViewQueries` 경고에 `COMPUTED` (지금: 코드 없음). 같은 RED 안에 `groupBy(raw) + sum(total)` → `COMPUTED` + 요청 본문 `group` 없음 (리뷰 h1).
6. `body` 형식 endpoint 의 묶기 · 집계 보기 → 요청 본문에 `group` (지금: `GROUP` 경고 · 로컬).
7. 코드 보기: formula collection → `{ key, type: "number", formula: "price * qty" }` 와 같은 식의 `type: "string"` 열 → 역변환이 둘을 구분해 문서에 id 식 + `type` 그대로 (지금: 키 없음 — 리뷰 m3).
8. 치환 범위: `sum(items[*].price)` (`items` 배열 필드 · 최상위 `price` 도 있음) → 치환 뒤 설치 엔진 값 30 (전부 치환하면 0 — 리뷰 h2 probe `.agent/runs/2026-10-29-review-adr291/probe.mjs`) · `@.price * qty` → 20 이고 `price` → `unitPrice` rename 뒤에도 20 (첫 자식 규칙이면 0 — Round 2 `repair-probe.mjs`) · 분류 불가 구문 → 검증 거절 코드.

### 1e. spike 증거 (2026-10-29, 미커밋 6 파일 — Phase 0 에서 기록 뒤 원복)

`packages/shared/package.json` (+ lockfile) · `catalog/document/types.ts` (`formula?: string`) · `validation.ts` (키 1) · `collections/view/evaluate.ts` (`withFormulaFields` — 정적 import · key 참조) · `catalog/runtime/dataBinding.ts` (보기 없는 분기) · `json-formula.d.ts`. Compare Mode: Canvas · Preview 둘 다 `total` 20 · 22 · 0 (dev 5176 · 콘솔 0). 스크린샷은 세션 scratchpad. 이 모양은 R1 (key 참조) · R5 (정적 import) 를 그대로 가지므로 제품 코드가 아니다.

## 2. Phase 1 — 저장 형식 · 식 모듈 (G1 · G2)

- `CatalogDataField.formula?: string` · 결과 타입 = `type` (number · string · boolean · date · datetime — 그 밖의 `type` 과 `formula` 의 조합은 검증 거절) · 검증: 문법 (`compile` 성공) · **루트 범위** 식별자 전부 같은 collection 의 필드 id (`'fld_…'`) 또는 `$var_<id>` · 순환 0 (루트 식별자 의존 그래프) · 숨긴 함수 0 (`Function` 노드 `name`) · 토큰 ↔ AST 범위 다중집합 일치 (불일치 = 지원하지 않는 문법으로 거절).
- `packages/shared/src/collections/formula/` — `engine.ts` (lazy `import("@adobe/json-formula")` · 인스턴스 하나 · `stringToNumber` 날짜 다리 · compile 캐시 Map<expression, ast>) · `scope.ts` (**값 컨텍스트 추적** — AST 를 걸으며 각 노드가 평가되는 값을 `root` · `sub` · `made` 로 전달: 시작 `root`; `Identifier` · `QuotedIdentifier` 는 컨텍스트가 `root` 일 때만 필드 참조; `Identity` (`@`) 는 컨텍스트 유지; `ChainedExpression` 은 왼쪽을 지금 컨텍스트로 평가한 뒤 오른쪽을 「왼쪽이 낸 컨텍스트」 로 — 왼쪽이 `@` · 괄호 안 `@` · 루트를 유지하는 파이프면 `root`, 식별자 · 함수 · 리터럴이면 `sub`, 객체 · 배열 생성이면 `made`; `Projection` · `ValueProjection` · `FilterProjection` 의 오른쪽 · 조건과 `ExpressionReference` 아래는 `sub` (원소); `Pipe` 오른쪽 = 왼쪽이 낸 컨텍스트; `KeyValuePair` 키는 참조 아님, 값은 지금 컨텍스트; `Function` 인자는 지금 컨텍스트. 분류 못 하는 모양 (함수 결과 위 투영 · 다단 파이프 · 식 참조를 받지 않는 자리의 `&`) 은 `FORMULA_SCOPE_UNSUPPORTED` 로 거절 — 조용한 통과 0. 같은 추적을 토큰 걷기에 적용해 `start` 위치 목록을 내고, 두 루트 식별자 다중집합이 같을 때만 치환 — 리뷰 Round 2 h2 (`@.price * qty` 의 `price` 는 루트)) · `names.ts` (이름 ↔ id 치환 — `scope.ts` 가 고른 토큰만 교체, 그 밖 문자 보존 — 리뷰 h2) · `result.ts` (`resultType` 강제 변환 — date 는 epoch 일수 → ISO · 오류 → `{ value: null, error }`) · `allowed.ts` (함수 목록 스냅샷 = 설치본 `functions.js` export 이름 − 숨김 4 → 정적 테스트가 drift 를 잡는다).
- 날짜 입력: `read` 전처리가 schema 의 `date` · `datetime` 필드 값을 `@internationalized/date` `parseDate` · `parseAbsolute` 로 epoch 일수 (소수부 시각) 로 바꿔 넘긴다. `today` · `now` 는 `ViewRunInput.today` 를 전역 `$today` 로 (결정적).
- 의존: `packages/shared/package.json` `@adobe/json-formula: 2.1.0` 고정 (catalog 선언) · `json-formula.d.ts` 타입 shim (spike 것 다듬기).
- 테스트: G1 (rename · 순환 · 숨김) · G2 (타입 · 날짜 fixture — 손계산 oracle).

## 3. Phase 2 — 평가 자리 · 패널 · 코드 보기 (G6)

- `viewRunSchema` 가 formula 필드에 `read` 를 붙인다 (`viewFieldOf` 안 — 참조 필드와 같은 함수). 동기 경로라 lazy 엔진은 **행 소스 진입 전** 에 준비한다 — `catalogBoundRows` · Preview 세션이 formula 필드가 있는 문서를 열 때 엔진을 await 하고 그동안 `loadingState: "loading"` (ADR-284 Phase 4 의 상태 통로). Canvas 도 같은 준비 (mock 모양 확인).
- `catalogBoundRows` 의 보기 없는 분기 · `served` 분기 둘 다 행 읽기 단계에서 적용 (spike 의 임시 분기를 행 소스 하나로).
- 데이터 패널: 열 편집기 (289 의 절 구조) 에 「계산 열」 토글 → 식 입력 (이름 표기 · 자동완성은 필드 이름 · 함수 목록 — CodeMirror 없이 TextArea + 목록) · Type Select 는 결과 타입 (number · string · boolean · date · datetime 만 활성) · 오류 한 줄. 격자 머리글 아이콘은 `formula` 유무로 `Sigma` (`FIELD_TYPES` 표에 타입 추가 없음) (정의 오류 코드 → i18n) · 격자 읽기 전용 열 (값 · 머리글 툴팁에 식 · 셀 오류 표지).
- 코드 보기: 생성기 `formula: "…"` (이름) · 역변환 (`inverse`) 은 `names.ts` 로 id · golden 6 (formula collection) · strict 왕복.
- G6 bench (`collections/formula/__tests__/adr291G6.bench.test.ts`, `ADR291_G6=1`).

## 4. Phase 3 — 서버 조회 범위 · 조회용 보고 (G4 · G5)

- `serialize.ts`: `body` 형식 요청 `{ where, sort, group: { by, aggregates }, page: { cursor | offset, limit }, total: true }` · `suffix` 형식은 페이지 (`_page` · `_limit` — endpoint 표로 이름) · 전체 수 (`X-Total-Count` 또는 `totalPath`) 만 · 묶기 · 집계 · 계산 필드 조건은 보고 (`GROUP` → 「전체 N 행」 · `COMPUTED`). **`COMPUTED` 판정 입력** = 조건 필드 · 정렬 필드 · `groupBy` · `aggregates[].field` · 각 필드의 의존 전이 (계산 필드 → 읽는 루트 필드 → 참조 경로 대상 필드 → …, `scope.ts` 의 루트 식별자 그래프). 하나라도 있으면 그 보기 사슬의 요청은 **원시 행 모드** (조건 · 묶기 · 집계 전부 로컬 · 요청 본문에 `group` 없음), 없으면 **서버 집계 모드** — 세션이 두 모드를 `served.mode` 로 들고 섞지 않는다 (리뷰 h1).
- Preview · Publish 세션: 집계 응답을 보기 결과 schema 로 (`ViewRunResult.schema` 모양 — 서버가 답한 묶음 행) · 「전체 N 행」 로드는 `loadMore` 를 끝까지 (상한 — 사용자 결정 3) 뒤 로컬 평가 · 상한 초과 = 거부 + 안내 (행 0).
- 패널 (ADR-284 의 경고 3 시점 그대로): 조건 저작 · 원본 변경 · 형식 변경 때 「서버로 보낼 수 없음 · 전체 N 행」.
- G5 mock 서버: `apps/builder/scripts` 의 json-server 류 하니스에 body 형식 어댑터 (묶기 · 집계 · 페이지 · 전체 수) — 로컬 평가기 결과와 동치 단언 (손계산 fixture 포함).

## 5. Phase 4 — publish 런타임 · 엔진 결정 입력

- 평가 (`runViewQueries` + 계산 필드) 를 publish 런타임에서 Worker 로 옮길 수 있는 경계 확인 — 입력은 직렬화 가능 (행 · `ViewQuery` · 값) · `references` 콜백만 메시지로 바꾼다. 실제 Worker 도입은 사용자 결정 4 (「없음 + Worker」 를 고르면 이 Phase, 엔진을 고르면 별도 ADR).
- §1c 측정 표를 사용자에게 보고 → 사용자 결정 4.

## 6. Phase 5 — 번들 · 문서 · live (G3 · G7 · G8)

- G3 번들 (착수 HEAD 대비) · formula 없는 문서 요청 0.
- G7 live 시나리오 (본문 Gates) — 별도 dev 서버 (5174 ~ 5176 중 비어 있는 것).
- 문서: `.claude/rules/state-management.md` §4 (계산 필드 한 항 · 표시용 / 조회용) · `docs/CHANGELOG.md` · README · `docs:stale-symbols`.
- G8 사용자 확인 → Implemented (`### Live Exercise`).

## 7. 범위 밖 (이 ADR 이 열지 않는다)

- 식 → 서버 조회 번역 (SQL · PostgREST 식) — 실증 뒤 별도.
- publish 로컬 조회 엔진 자체 (Perspective · DuckDB-WASM) — 사용자 결정 4 뒤 별도 ADR.
- react-spectrum-charts (Recharts + Canvas 대칭 교체) — 별도 ADR.
- 대량 표시 (Virtualizer · 표시 상한) — ADR-257 유지.
- 계산 변수 (`transform` 대체) — 사용자 결정 2 가 「교체」 일 때만 이 ADR phase 에 추가.

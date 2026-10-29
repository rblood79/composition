# 계산 필드 엔진 검토 — json-formula (2026-10-29)

> 사용자 지시 「지금 검토해」 (2026-10-29). 전제: 빌더가 개발 중이라 계산 필드가 **아직** 없는 것이고, 참조 제품 (Airtable · Notion · Framer CMS) 은 전부 formula 필드를 가진다 — 「필요해지면」 으로 미루지 않고 데이터 층 설계에 지금 넣는다 (메모리 `feedback-design-whole-scope-upfront-no-deferral`). 이 문서는 **엔진 선택과 끼울 자리** 를 실측으로 판정한다. ADR 은 사용자 `/create-adr` 로 — 여기서는 쓰지 않는다.
>
> 실측 기준: main `51fe50daa` · `@adobe/json-formula` 2.1.0 (npm tarball 직접 받아 측정) · spec 2.1.0 (opensource.adobe.com) · 저장소 `adobe/json-formula` main.

## 0. 판정

| 항목                                | 판정                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계산 필드를 데이터 층 범위에 넣는가 | **넣는다** — 조건 · 집계 · 조인 (ADR-284 · 데이터 층 연구 §8) 과 같은 층. 행 단위 식 (`price * qty` · 조건식 · 날짜 차) 은 지금 어휘로 표현할 수 없다                                                               |
| 엔진                                | **json-formula 채택 후보 1순위** — 닫힌 어휘 (함수 ~90 · 임의 JS 아님) · spreadsheet 어법 · JSON 경로 · compile/run 분리 · 의존 0 · Apache-2.0 · Adobe 유지                                                         |
| 끼울 자리                           | 평가기의 `ViewRunField.read` 훅 — **참조 필드 (ADR-284 결정 4) 가 이미 쓰는 자리**. 평가기 코드 변경 최소 (셀 읽기 하나)                                                                                            |
| 평가 자리 (10-29 사용자 전제) | Canvas = mock 모양 확인 (JS 평가기) · **대량 재가공 = publish 된 RAC 웹** (`useAsyncList.load` 뒤 · Worker · 규모별 엔진) · 두 쪽 적합성 게이트 — §3-5 |
| 번들                                | gzip **41.4 KB** (src 12 파일 합) — Builder initial 은 이미 상한 초과 (1,450,889 > 1,390,000) · Preview ≤ 320,000 → **lazy chunk 필수**, 계산 필드가 있는 문서만 불러온다                                           |
| Rust 판                             | **없다** — 저장소 (Cargo · .rs 0) · crates.io · 검색 어디에도 없다. 이전 메모 「Rust판도 있다」 는 **정정**. 현재 Rust 엔진은 레이아웃 전용이라 통합 이득도 없다                                                    |
| 바로 쓸 수 없는 것 (다리 필요)      | ① 날짜 = epoch 일수 **숫자** (행은 ISO 문자열) ② 식 → 문자열 역변환 없음 (이름 ↔ id 치환은 Lexer 토큰 위치로 자체 구현) ③ 서버 조회 (`serialize.ts`) 는 계산 필드를 모른다 (기존 「보낼 수 없음」 보고 경로로 처리) |

## 1. json-formula 실측

### 1-1. 패키지

- `@adobe/json-formula` **2.1.0** · Apache-2.0 · `dependencies` 0 · `"type": "module"` · `main: src/json-formula.js` · `files: ["src"]` — dist 없이 **src 를 그대로 배포** (번들러가 묶는다. Node ≥ 18).
- 크기 (tarball 실측): src 12 파일 raw 192,018 B · **gzip -9 41,432 B**. `functions.js` 가 112,712 B 로 절반 이상 (함수 ~90 의 구현 · 시그니처).
- 파서: 손으로 쓴 Lexer (`Lexer.js` 14 KB) + Parser (`Parser.js` 17 KB, JMESPath 계열 Pratt) · 저장소의 `antlr/` 는 spec 문법 문서 생성용 (런타임은 antlr 를 쓰지 않는다 — devDependency 뿐).
- Rust · 다른 언어 판: 저장소 트리 · npm · crates.io · 검색 결과 어디에도 없다.

### 1-2. 문법 (spec 2.1.0)

- **JMESPath + OpenFormula** 혼합. 식별자 `[a-zA-Z_$][a-zA-Z0-9_$]*`, 그 밖 (공백 · 한글 · 기호) 은 **홑따옴표** — `'단가' * '수량'`. 없는 필드 → `null` (오류 아님).
- 연산자: `+ - * /` · `&` (문자열 연결) · `= == != <> < <= > >=` · `&& || !` · `~` (합집합) · `|` (파이프) · 단항 `-`. 등호 비교는 **타입 강제 없음** (다른 타입이면 그냥 다르다).
- 함수 (알파벳순, ~90): abs · acos · and · asin · atan2 · avg · avgA · casefold · ceil · codePoint · contains · cos · datedif · datetime · day · debug · deepScan · endsWith · entries · eomonth · exp · false · find · floor · fromCodePoint · fromEntries · fround · hasProperty · hour · if · join · keys · left · length · log · log10 · lower · map · max · maxA · merge · mid · millisecond · min · minA · minute · mod · month · not · notNull · now · null · or · power · proper · random · reduce · register · registerWithParams · replace · rept · reverse · right · round · search · second · sign · sin · sort · sortBy · split · sqrt · startsWith · stdev · stdevA · stdevp · stdevpA · substitute · sum · tan · time · toArray · toDate · today · toNumber · toString · trim · true · trunc · type · unique · upper · value · values · weekday · year · zip.
- 타입: number · string · boolean · array · object · null + `&expr` (식 인자 — `map` · `sortBy` 등에). **날짜 = 숫자** — 「1970-01-01 UTC 부터의 일수, 소수부 = 하루 안 시각」. `datetime()` · `toDate()` · `today()` · `now()` 가 만든다.
- 강제 변환: 문자열 → 숫자는 빈 문자열 0 · 비정형이면 `TypeError`. `null` → 0 · `""` · `false`. 빈 문자열 · 빈 배열 · 빈 객체는 falsy.
- 전역: `$name` (기본 전역은 `@` 하나). `compile(expr, allowedGlobalNames)` 가 허용 이름을 받는다.
- 오류 4 종: `SyntaxError` (컴파일) · `TypeError` · `FunctionError` (모르는 함수 · 잘못된 인자) · `EvaluationError` (0 나눗셈 · slice step 0). 생성자의 `debug` 배열에 오류 · 경고가 쌓인다.
- 호스트 확장 (spec §10): 전역 주입 · 사용자 `toNumber` (`stringToNumber` 인자 — 통화 · 날짜 문자열용으로 명시) · 사용자 함수 (`{ _func, _signature: [{ types: [TYPE_NUMBER …] }] }`, 타입 상수는 `dataTypes.js` export) · `language` (BCP-47 — 숫자 · 날짜 locale).

### 1-3. API (`src/json-formula.js`)

```js
const jf = new JsonFormula(
  (customFunctions = {}),
  (stringToNumber = null),
  (debug = []),
);
const ast = jf.compile(expression, (allowedGlobalNames = [])); // SyntaxError 는 여기서
const value = jf.run(ast, json, (language = "en-US"), globals); // 행마다
```

- AST = 평범한 객체 (`type` + `name` | `value` | `children`). 필드 참조는 `Identifier` · `QuotedIdentifier` 노드 (`name`), 점 경로는 `ChainedExpression`, 전역은 `Global` 노드. → **식이 읽는 필드 목록을 AST 순회로 뽑을 수 있다** (의존 그래프 · 순환 검출 · 이름 변경 영향 범위).
- AST → 문자열 역변환 **없음**. 그러나 `Lexer.tokenize()` 가 토큰에 `start` (문자 위치) 를 둔다 → 이름 ↔ id 치환은 토큰 자리 치환으로 구현 가능 (파서를 건드리지 않는다).
- AST 는 JSON 직렬화 가능한 모양이지만 **저장은 식 문자열** 로 (아래 §3-2) — AST 는 run 캐시.

## 2. Composition 의 자리 실측

| 자리                  | 현재 (파일)                                                                                                                                                                                                                                                                                         | 계산 필드가 닿는 방식                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 필드 정의             | `CatalogDataField { id?, key, type?, label?, required?, defaultValue?, children?, reference? }` (`packages/shared/src/catalog/document/types.ts:1320`) · `DataFieldType` 11 종 (`apps/builder/src/types/builder/data.types.ts:27`) · 패널 표 `FIELD_TYPES` (`panels/datatable/utils/fieldTypes.ts`) | `type: "formula"` + `formula: { expression: string; resultType: "number" \| "string" \| "boolean" \| "date" }` 한 칸     |
| 이름 변경             | rename 은 `key` 만 바꾸고 `id` 유지 (`DataField.id` 주석 — ADR-152)                                                                                                                                                                                                                                 | 식은 id 로 저장하면 rename 에 안전 (§3-2)                                                                                |
| 셀 읽기               | `cellOf(row, field)` 하나 (`collections/view/evaluate.ts:196`) — `field.read` 훅이 있으면 그것을 호출. **참조 필드가 이 훅으로 다른 collection 행을 읽는다** (`viewFieldOf`)                                                                                                                        | `read: row => jf.run(ast, row, lang, globals)` — 조건 · 집계 · 정렬 전부 자동으로 계산 필드를 본다                       |
| 평가 순서             | 조건 → 묶기 · 집계 → 정렬 (`runQuery`) · 소비자 6 파일이 `runViewQueries` 하나를 쓴다 (Canvas · Preview · Publish · Table binding)                                                                                                                                                                  | 계산 필드는 조건 **앞** 에 값으로 존재 → 「계산 필드로 거르기 · 집계」 가 추가 코드 없이 성립                            |
| 집계 어휘             | `ViewAggregateFn = count · sum · mean · min · max · applied` (Chart `budgetAggregate` 와 공유)                                                                                                                                                                                                      | 집계 입력에 계산 필드 포함 — 어휘 무변경                                                                                 |
| 날짜 비교             | `comparison.ts` `viewDay` — ISO 문자열 · Date · timestamp → `YYYY-MM-DD`                                                                                                                                                                                                                            | 식 결과 `resultType: "date"` 는 ISO 문자열로 되돌려 넣는다 (§3-3)                                                        |
| 서버 조회             | `serialize.ts` — `suffix` · `body` · `none`, 보낼 수 없는 조건은 **보고** (R1 「조용히 떨어뜨리지 않는다」)                                                                                                                                                                                         | 계산 필드 조건 = 서버가 모르는 필드 → 같은 보고 경로 (「서버로 보낼 수 없음」) · 로컬 평가로만 적용                      |
| 변수                  | `!var.<id>` 참조 → `resolve()` (`ViewRunInput`) · 프로젝트 변수 `ProjectVariableEntry`                                                                                                                                                                                                              | json-formula `$` 전역으로 주입 (`allowedGlobalNames` = 식이 쓰는 변수 id)                                                |
| 코드 보기             | `codeViewDataOf` 가 schema 를 `{id, key, type, reference}` 로 내보냄 (`catalogRuntime/codeView.ts:74`)                                                                                                                                                                                              | 같은 자리에 `formula` 문자열 — 식은 그대로 왕복 (ADR-285 golden)                                                         |
| 행 상한               | `CATALOG_COLLECTION_ROW_LIMIT = 1000` (ADR-286 사용자 결정 1)                                                                                                                                                                                                                                       | 식 1 × 행 1,000 × 필드 n — JS 로 충분 (측정은 G 에서)                                                                    |
| 번들                  | Builder initial 1,450,889 B gz (상한 1,390,000 이미 초과 — ADR-285 Phase 0) · Preview ≤ 320,000                                                                                                                                                                                                     | json-formula 41 KB gz → **동적 import** (문서에 formula 필드가 있을 때만)                                                |
| 이미 있는 「식」 흔적 | `Variable.transform?: string` — 「변환 함수 코드 `(value, context) => transformedValue`」 (`data.types.ts:384`) · `ProjectVariableEntry.transform` 으로 문서에 그대로 옮겨짐 (`types.ts:1384`) · **실행하는 코드 0** (grep — `catalogDataStore.ts:127` 복사만)                                      | 임의 JS 문자열 자리 = 「스크립트 escape 금지」 와 충돌. 계산 필드 도입 때 **같은 식 언어로 교체 또는 삭제** 를 함께 결정 |
| Rust 엔진             | `packages/engine/src` = block · flex · grid · cascade · display … (레이아웃만)                                                                                                                                                                                                                      | 데이터 평가와 무관 — 통합 안 함                                                                                          |

## 3. 설계 항목 (ADR 에 들어갈 것 — 자리와 판정)

### 3-1. 필드 종류

`DataFieldType` 에 `"formula"` 추가 · `CatalogDataField.formula?: { expression: string; resultType: … }`. 패널 `FIELD_TYPES` 에 한 줄 (아이콘 `Sigma` 또는 `Calculator`). 계산 필드는 **쓰기 불가** (격자 셀 편집 · paste · import 대상 아님 — `pasteGrid.ts` · `importPlan.ts` 가 건너뜀).

### 3-2. 저장 형식 — 식은 id 로, 표시는 이름으로

- 저장: `'fld_a1b2' * 'fld_c3d4'` (필드 id 를 홑따옴표 식별자로). 변수는 `$var_<id>`.
- 표시 · 편집: Lexer 토큰 위치로 id → `key` 치환 (`'단가' * '수량'`), 입력 저장 때 역치환. 모르는 이름은 저장 거절 (오류 표시).
- 왜 id: rename 이 `key` 만 바꾸는 현재 규칙 (ADR-152) 과 맞고, 참조 필드 경로 (`DataFieldPath = DataFieldId[]`) 와 같은 원칙.
- AST 는 저장하지 않는다 — compile 은 결정적이고 spec 버전이 바뀌면 AST 모양이 바뀔 수 있다.

### 3-3. 타입과 날짜

- `resultType` 은 저자가 고른다 (추론 금지 — null 행에서 추론이 흔들린다). 평가 결과를 `resultType` 으로 강제 변환해 셀에 넣는다: number → `toNumber`, string → `toString`, boolean → truthiness, **date → epoch 일수 숫자를 ISO 문자열로** 되돌린다.
- 입력 날짜: 행의 ISO 문자열은 json-formula 에 숫자가 아니다 → `stringToNumber` 훅 또는 `read` 전처리로 `date · datetime` 필드 값을 epoch 일수로 바꿔 넘긴다. **훅 하나로 양방향 다리** — 저자는 `datedif('마감', today(), 'd')` 처럼 그냥 쓴다.
- 비교 · 정렬은 `resultType` 으로 `viewFieldKind` 를 결정 (`comparison.ts` 무변경).

### 3-4. 오류 표시

- 컴파일 오류 (`SyntaxError` · 모르는 이름 · `FunctionError` 의 arity) 는 **정의 때** 패널 입력 아래 (`FieldError` 모양). 저장은 되되 필드가 「깨짐」 표시 — 조건의 `broken` 과 같은 어법.
- 행 오류 (`TypeError` · `EvaluationError` — 0 나눗셈 · 비정형 문자열) 는 **셀 값 `null`** + 셀 오류 표지 (Airtable `#ERROR!` 대응). 행 하나의 오류가 보기 전체를 멈추지 않는다 (`debug` 배열로 수집해 패널에 세어 보인다).
- 순환 참조 (A → B → A) 는 AST 순회로 정의 때 거절.

### 3-5. 평가 위치와 성능 — 2026-10-29 사용자 전제로 다시 쓴다

사용자 전제 (같은 날, 메모리 `user-customer-profile-large-data-sort-chart-filter`): 고객 대부분은 **대량 데이터를 가져와 정렬 · 차트 · 다중 조건 필터로 조회** 한다. 재가공은 **Canvas 가 아니라 publish 된 RAC 컴포넌트 웹 (와 같은 런타임의 Preview)** 에서 한다 — Canvas 는 레이아웃 디자인 도구라 mock 행 (≤ 1,000) 으로 모양만 보인다.

- **Canvas**: `viewRunSchema` 가 `formula` 필드에 `read` 를 붙인다 — 참조 필드와 같은 함수 (`viewFieldOf`) 안. 평가기 본문 무변경. compile 은 스키마당 1회, run 은 행마다 (1,000 × n — 모양 확인 용도라 충분).
- **Publish (RAC 웹)**: 데이터는 `useAsyncList` 의 `load` 로 들어온다 (`domBinding.runtime.ts:263` `loadMore` — 페이지 · `loadingState`). 계산 필드는 `load` 가 돌려주는 item 에 덧붙이는 **표시용** 이 기본 (불러온 페이지 위, 서버 결과 `served` 에도 적용). 계산 필드로 **거르기 · 정렬 · 묶기** 하려면 (a) 서버가 그 계산을 해 주거나 (b) 전체를 불러와 로컬 엔진에서 해야 한다 — 「표시용 / 조회용」 을 정의에서 구분하고 조회용은 「서버로 보낼 수 없음 · 전체 N 행을 불러옵니다」 를 저자에게 보인다 (`serialize.ts` R1 보고 경로).
- **대량 로컬 재가공은 식 엔진이 아니라 조회 엔진 문제**: 현재 평가기는 행 객체 · 메인 스레드 JS 라 수만 행이 상한이고, **묶기 · 집계 · 페이지는 서버로 안 간다** (`serialize.ts:71` `GROUP` 경고). publish 런타임 안에서 (Worker · lazy) ① 수만 행까지 JS 평가기 + json-formula AST → JS 코드 생성 (트리 해석기 그대로는 느리다) ② 그 위는 열 지향 wasm 엔진 (Perspective — 피벗 · 집계 · 계산 열 식 언어 · 대시보드용 / DuckDB-WASM — SQL · 조인) 으로 `ViewQuery` 를 **번역** — RAC 컴포넌트는 `useAsyncList.load` 뒤의 소스를 모른다. 임계는 측정 선행 (C 등급 — 1만 · 10만 · 100만 행 bench, ADR-286 G2 틀).
- **검증 자리 (사용자 10-29 「퍼블리시는 canvas 로 하지 않는다」)**: publish = DOM + RAC (`apps/publish`), Canvas = Skia 레이아웃 도구. 데이터 의미 (조회 · 집계 · 계산 결과) 의 정본은 publish 런타임이고, 저자가 실제 결과를 확인하는 자리는 **Preview (같은 런타임을 iframe 으로)** 다. Canvas 의 mock 행 보기는 레이아웃 확인용이라 publish 결과를 보증하지 않는다 — Canvas 에 조회 엔진을 싣지 않고, 「Canvas = Publish 결과 동일」 게이트도 두지 않는다 (ADR-284 결정 6 의 「한 모듈」 은 Preview · Publish 사이에서만 유지). Canvas 평가기가 보여 주는 것과 Preview 가 다르면 그것은 **레이아웃 미리보기의 한계** 로 패널에 표시 (「실제 결과는 Preview 에서」).

### 3-6. 번들

- `@composition/shared` 에 `collections/formula/` 모듈 — `import("@adobe/json-formula")` 동적. 문서에 formula 필드가 0 이면 요청 0. Builder · Preview 둘 다 lazy. 게이트: initial Δ ≤ +1 KB gz (ADR-285 · 286 과 같은 `adr209-bundle-closure.mjs`).
- `files: ["src"]` 라 ESM src 가 그대로 들어온다 — tree-shaking 은 `functions.js` 한 덩어리라 기대하지 않는다 (41 KB 전부).

### 3-7. 코드 보기 · 어휘

- 코드 보기: `./data/users` 의 필드 정의에 `formula: "…"` 문자열 그대로 (ADR-285 닫힌 어휘에 **키 하나** 추가 — 왕복 golden 에 formula 있는 collection 1 추가).
- 저자에게 보이는 어휘는 json-formula 함수 이름 그대로 (`sum` · `if` · `datedif` …) — 참조 제품 (Airtable `IF` · `DATETIME_DIFF`) 과 대응하고, 새 어휘를 만들지 않는다. 함수 선택 UI 는 `register` · `registerWithParams` · `debug` · `random` 을 **숨긴다** (저자 어휘 밖 — 결정성 깨짐).

### 3-8. 함께 정리할 것

- `ProjectVariableEntry.transform` (임의 JS 문자열 · 실행자 0) — 계산 필드 도입 때 삭제 또는 같은 식 언어로 교체 결정 (삭제는 사용자 승인).

## 4. 대안 대조

| 후보                        | 판정                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **json-formula** (Adobe)    | **채택 후보** — 위 §1. 약점: 날짜 숫자 모델 (다리 1) · 역변환 없음 (토큰 치환 1) · 문서가 spec 하나 (튜토리얼 · 플레이그라운드 있음)                                                                                  |
| HyperFormula (Handsontable) | Excel 셀 그래프 모델 (A1 참조 · 시트) 이라 **행 단위 필드 식과 모양이 다르다** · GPLv3 또는 상용 · 크다 (수백 KB). 기각                                                                                               |
| 자체 작성                   | 산술 + 함수 20개면 작지만 (~5 KB) 날짜 · 문자열 · 배열 · 오류 · locale 을 결국 다시 짠다 — 참조 제품 수준 (함수 ~90) 까지 가면 json-formula 를 재작성하는 셈. 기각 (「불가 → escape 금지」 원칙상 어휘가 넓어야 한다) |
| `formula` (npm)             | JSON · spreadsheet 식 범용 — 유지 · 문서 · 라이선스 확인 전. json-formula 보다 출처 신뢰가 낮다. 보류                                                                                                                 |

## 5. 사용자 결정이 필요한 것 (결정 지점 4 — scope)

1. **ADR 자리**: 권고 **새 ADR — 데이터 층 조회 · 어휘** 로 한 묶음: ① 서버 push 범위 확장 (묶기 · 집계 · 페이지 — 보낼 수 없을 때 「전체 N 행」 표시) ② publish 런타임의 로컬 조회 엔진 (Worker · 규모별 — Phase 0 bench) ③ 적합성 게이트 (Canvas mock = Publish 실데이터) ④ 계산 필드 (json-formula — 표시용 먼저 · 조회용은 서버 push 또는 전체 로드) ⑤ 조건 트리 · 조인 (데이터 층 연구 §8). ADR-286 은 「정의의 집」 이라 축이 다르다.
2. **저자 어휘 노출**: 함수 이름 영어 그대로 (권고 — 참조 제품 대응 · 코드 보기 왕복) vs 패널에서 한국어 별칭 표시.
3. `transform` 문자열 필드 처리 (§3-8).

## 6. 출처

- 저장소 <https://github.com/adobe/json-formula> · API `src/json-formula.js` · spec 2.1.0 <https://opensource.adobe.com/json-formula/doc/output/json-formula-specification-2.1.0.html>
- npm `@adobe/json-formula@2.1.0` (tarball 실측 — scratchpad `jf-dl/`)
- Composition: `packages/shared/src/collections/view/{evaluate,comparison,serialize}.ts` · `packages/shared/src/catalog/document/types.ts` (CatalogDataField · CollectionEntry · ViewAggregateFn) · `apps/builder/src/builder/panels/datatable/utils/fieldTypes.ts` · `apps/builder/src/builder/catalogRuntime/codeView.ts` · ADR-284 · 285 · 286 · 메모리 `project-data-layer-rac-examples-research-2026-10`

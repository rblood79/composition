# ADR-313 breakdown — 외부 데이터 가져오기 표준

> 본문: [313-external-data-intake-standard.md](../313-external-data-intake-standard.md). 이 문서의 새 이름은 제안이다. 코드 인용은 main `3b9d7fb45` 기준이다.

## 1. 전제

- 기존 ADR 을 나누거나 합치지 않는다 — 새 주제다. ADR-212 · 286 · 284 · 309 의 결정 위에 얹고, 바꾸는 것은 본문 「선행 결정」 의 둘 (진입 값 · `fieldMappings`) 뿐이다.
- ADR-312 (Chart 데이터 포맷) 와 겹치지 않는다 — 312 는 Chart 가 행의 열을 **읽는** 역할이고 이 ADR 은 행이 **들어오는** 값이다. 두 ADR 이 각자 contract 를 한 번 올리므로 번호만 착수 순서로 정한다.
- 사용자 확정: 네트워크 없이 동작 (본문 Status).

## 2. 표준의 정의

### 2.1 값 표현 (`encoding`)

필드의 선택 속성. 「원본이 이 필드를 JSON 에 어떻게 싣는가」 만 적는다. 저장 값은 늘 타입의 정규 값이다.

| 필드 타입 | `encoding.kind`   | 인자                                     | 원본 예                      | 저장 값                  | 되돌리기 (서버가 읽는 표현)                                 |
| --------- | ----------------- | ---------------------------------------- | ---------------------------- | ------------------------ | ----------------------------------------------------------- |
| boolean   | `flag`            | `true` · `false` (표기 — JSON 타입 포함) | `"Y"` / `"N"` · `1` / `0`    | `true` / `false`         | 선언한 표기 그대로                                          |
| number    | `numberText`      | —                                        | `"4500000.00"`               | `4500000`                | 가장 짧은 십진 글자 `"4500000"`                             |
| date      | `epochMs`         | `wire`: `number` · `string`              | `1793928600000`              | `"2026-11-06T01:30:00Z"` | 밀리초 — `wire` 의 JSON 타입                                |
| date      | `epochSec`        | `wire`: `number` · `string`              | `1793928600`                 | `"2026-11-06T01:30:00Z"` | 초 (밀리초는 버림) — `wire` 의 JSON 타입                    |
| date      | `compactDate`     | `wire`: `string` · `number`              | `"20261106"` · `20261106`    | `"2026-11-06"`           | 8 자리 — `wire` 의 JSON 타입                                |
| date      | `compactDateTime` | `wire`: `string` · `number`              | `"20261106103000"`           | `"2026-11-06T10:30:00"`  | 14 자리 — `wire` 의 JSON 타입                               |
| date      | `dateParts`       | `precision`: `date` · `dateTime`         | `[2026, 11, 6, 10, 30]`      | `"2026-11-06T10:30:00"`  | `date` 는 3 칸, `dateTime` 은 5 칸 + 0 이 아닌 초 · 초 아래 |
| string    | `bigInt`          | —                                        | `9007199254740993` (숫자)    | `"9007199254740993"`     | 따옴표 없는 숫자 literal                                    |
| (없음)    | —                 | —                                        | JSON 값 그대로 (ISO 글자 등) | 그대로                   | 그대로                                                      |

- 타입과 맞지 않는 종류 (`number` 필드에 `flag`) 와 모르는 인자는 문서 검증이 거절한다.
- 종류는 닫힌 목록이다. 형식 문자열 (`yyyy/MM/dd`) 은 받지 않는다 — 필요해지면 종류를 더한다.
- 이미 정규 값인 셀 (작성 행 · 다시 들어온 값) 은 그대로 둔다 — 읽기는 멱등이다.
- 읽기 실패 (선언과 다른 값) 는 그 셀을 `null` 로 두고 열마다 센다.

**왕복의 보장 범위 (HC7)** — 보장하는 것은 「되돌린 표현을 서버가 같은 값으로 읽는다」 이다: 같은 JSON 타입 · 같은 값.

| 종류                              | 보장                                | 보장하지 않는 것                                                           |
| --------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `flag`                            | 표기와 JSON 타입 그대로             | —                                                                          |
| `numberText`                      | 같은 수 (글자 타입)                 | 소수 자릿수 · 앞의 0 · 지수 표기 (`"4500000.00"` → `"4500000"`)            |
| `epochMs` · `epochSec`            | 같은 시각 · 선언한 JSON 타입        | `epochSec` 의 초 아래 자리                                                 |
| `compactDate` · `compactDateTime` | 같은 날짜 (일시) · 선언한 JSON 타입 | 표현보다 정밀한 부분 (날짜 표현에 시각이 있는 값을 되돌리면 시각을 버린다) |
| `dateParts`                       | 같은 날짜 (일시)                    | 배열의 길이 — 쓰기 규칙은 Jackson 과 같게 두고 Phase 0 표본으로 확인한다   |
| `bigInt`                          | 같은 정수 · 숫자 타입               | —                                                                          |

- **값을 잃는 읽기는 하지 않는다.** `numberText` 는 글자가 수로 정확히 옮겨질 때만 읽는다 — 글자 → 수 → 가장 짧은 십진 글자가 원문과 같은 수여야 한다. 안전 범위 밖 정수 (`"9007199254740993"`) 나 유효 숫자가 넘치는 소수는 읽기 실패다 (`null` + 「정밀도를 잃는 값」 으로 센다). 감지기는 표본에 그런 값이 하나라도 있으면 `numberText` 후보를 내지 않는다 (열은 `string` 으로 남는다).
- epoch 표현의 저장 값은 절대 시각 (`Z`) 이다. 되돌릴 값이 offset 없는 일시나 날짜뿐이면 (작성 행 · 사용자가 고른 조건 값) UTC 로 읽어 되돌린다.
- JSON body 에 `bigInt` 를 쓸 때는 큰 정수를 보존하는 쓰기를 쓴다 — `JSON.rawJSON` 을 기능 감지로 쓰고, 없으면 자리 표시 글자를 넣어 직렬화한 뒤 literal 로 바꾼다. 지금의 `JSON.stringify(body)` (`executeCollectionEndpoint.ts:166`) 는 따옴표를 붙인다.

### 2.2 key 필드 (`keyField`)

- collection 의 선택 속성. 값은 필드 `id` 다 (이름 변경에 안전 — ADR-152).
- 항목 key 순서: 바인딩 `fieldMap.value` → collection `keyField` → 행의 `id` · `key` · `value` → `row-N`.
- key 필드는 `required` 로 본다. 진입에서 key 가 비거나 겹치는 행 수를 센다 (행을 버리지 않는다).
- 다른 collection 의 `reference.keyField` 를 고를 때 대상 collection 의 `keyField` 가 기본 후보다.

### 2.3 진입과 출구

**원본 종류** — 진입이 변환기에 알려 준다 (값을 보고 추측하지 않는다).

| 원본 종류 | 해당하는 것                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| JSON      | JSON 붙여넣기 · JSON 파일 · API 응답 (Builder 실행 · Preview/Publish 조회) · 기존 표로 가져오기의 JSON 원본 |
| 글자      | CSV · 탭 표 붙여넣기 · 기존 표로 가져오기의 CSV · 탭 원본 · 격자 입력 · Form 값                             |

**셀 규칙** — 변환은 「선언된 값 표현」 과 「글자 셀 읽기」 둘뿐이다.

| 필드              | JSON 원본                                                                                    | 글자 원본                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 값 표현 선언 있음 | 선언대로 읽는다. 이미 정규 값이면 그대로. 못 읽으면 `null` + 셈                              | 글자를 선언의 표기로 읽고, 아니면 열 타입의 글자 읽기. 못 읽으면 `null` + 셈            |
| 선언 없음         | 그대로 둔다. JSON 타입이 열 타입과 다르면 「타입과 다른 셀」 로 세고 값 표현 후보를 제안한다 | 열 타입의 글자 읽기 (`coerceCellValue` — 지금의 가져오기와 같다). 못 읽으면 `null` + 셈 |

- 글자 원본은 파싱 단계에서 타입을 정하지 않는다 — Papa 의 `dynamicTyping` 을 끄고 탭 표의 `coerceCell` 을 없앤다. 타입은 감지기가 열 단위로 정하고 (§2.5) 변환기가 그 타입으로 읽는다.
- 글자 원본의 열 타입 감지는 값 표현이 아니다 — `42` 가 숫자 열이 되는 것은 타입의 기본 선택이고 선언을 요구하지 않는다.

**길마다의 처리**

| 길                                         | 지금                                                                               | 표준                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| (a) 생성 — JSON 붙여넣기 · 파일            | 파싱 값 그대로 (`DataTableCreator.tsx:399`)                                        | 큰 정수 보존 파싱 → JSON 규칙 → 저장                                                       |
| (a) 생성 — CSV · 탭 표                     | 파싱 단계가 셀마다 타입을 정함 (`DataTableCreator.tsx:208` · `pasteRows.ts:75-82`) | 글자로 읽기 → 감지 → 글자 규칙 → 저장                                                      |
| (b) 기존 표로 가져오기                     | 원본과 무관하게 글자로 바꿔 강제 (`importPlan.ts:83-88`)                           | 원본 종류의 규칙                                                                           |
| (c) Builder API 실행                       | 응답 그대로 (`dataActions.ts:714` → `:768`)                                        | 큰 정수 보존 파싱 → JSON 규칙 → `setRuntimeRows`                                           |
| (d) Preview · Publish 조회                 | 응답 그대로 (`executeCollectionEndpoint.ts:119` · `:152`)                          | 큰 정수 보존 파싱 → JSON 규칙 → 세션 항목                                                  |
| 격자 입력 · Form 값 · 목록 편집 값         | 타입의 글자 읽기 (`cellValue.ts:17` · `catalogPreviewSession.ts:950`)              | 글자 규칙 (선언의 표기도 받는다)                                                           |
| 출구 — 보기 조건 직렬화 (쿼리)             | `String(value)` (`view/serialize.ts:149`)                                          | 되돌린 표현의 글자                                                                         |
| 출구 — 보기 조건 직렬화 (body) · Form 제출 | 값 그대로 · `JSON.stringify(body)` (`executeCollectionEndpoint.ts:166`)            | 되돌린 표현의 JSON 값 (타입 유지 · 큰 정수 보존 쓰기). 제출은 대상 collection 을 아는 것만 |
| 출구 — 조회 load 인자 (정렬 등)            | 열 → 필드 key                                                                      | 값이 없어 대상 아님 (검사 목록에만 둔다)                                                   |

**전후 표** — 이 ADR 로 값이 달라지는 경우의 전부다 (HC5). G0 가 「지금」 열을 실행으로 확인하고 G1 · G2 가 「표준」 열을 정답으로 쓴다.

| #   | 원본                                        | 필드 (선언 없음) | 길           | 지금                                | 표준                             | 비고                                       |
| --- | ------------------------------------------- | ---------------- | ------------ | ----------------------------------- | -------------------------------- | ------------------------------------------ |
| 1   | JSON `"Y"`                                  | boolean          | (b)          | `true`                              | `"Y"` + 타입과 다른 셀           | 미리보기가 `flag` 후보 제안. 고르면 `true` |
| 2   | JSON `"42"`                                 | number           | (b)          | `42`                                | `"42"` + 타입과 다른 셀          | `numberText` 후보                          |
| 3   | JSON `42`                                   | string           | (b)          | `"42"`                              | `42` + 타입과 다른 셀            | (c)(d) 는 지금도 `42`                      |
| 4   | JSON `"abc"`                                | number           | (b)          | `null`                              | `"abc"` + 타입과 다른 셀         | 값을 지우지 않는다                         |
| 5   | JSON `"Y"` · `"42"` · `42`                  | 위와 같음        | (a)(c)(d)    | 원본 그대로                         | 원본 그대로                      | 달라지지 않는다 — 셈만 는다                |
| 6   | JSON `9007199254740993`                     | number · string  | (a)(b)(c)(d) | `9007199254740992`                  | 글자 `"9007199254740993"`        | `bigInt` 후보가 기본 선택                  |
| 7   | CSV · 탭 `01234`                            | (생성 — 감지)    | (a)          | `1234` (number 열)                  | `"01234"` (string 열)            | 0 으로 시작하면 숫자 후보에서 뺀다         |
| 8   | CSV · 탭 한 열에 `42` · `abc`               | (생성 — 감지)    | (a)          | 값 `42` · `"abc"` 가 섞인 number 열 | `"42"` · `"abc"` (string 열)     | 셀 타입이 열 타입과 같다                   |
| 9   | CSV · 탭 `42` · `true` 만 있는 열           | (생성 — 감지)    | (a)          | `42` · `true`                       | `42` · `true`                    | 달라지지 않는다                            |
| 10  | 붙여넣기 (탭 · 쉼표 CSV) `9007199254740993` | (생성 — 감지)    | (a)          | `9007199254740992`                  | `"9007199254740993"` (string 열) | Papa 의 CSV 파일 경로는 지금도 글자로 보존 |
| 11  | CSV · 탭 → 기존 표                          | 임의 타입        | (b)          | 대상 타입의 글자 읽기               | 대상 타입의 글자 읽기            | 달라지지 않는다                            |

- 사용자 결정 8 은 권고안으로 확정됐다 (2026-11-17) — 1 ~ 5 행의 「표준」 열이 그대로 정답이다. 택하지 않은 대안 (열 타입으로 읽는 것을 모든 길에) 은 1 ~ 5 행을 `true` · `42` · `"42"` · `null` 로 바꾸고 (a)(c)(d) 까지 달라지게 한다.
- 큰 정수 보존 파싱: `JSON.parse` 의 원문 접근 (`context.source`) 을 기능 감지로 쓰고, 없으면 원문을 한 번 훑어 안전 범위 밖 정수 literal 을 글자로 바꾼 뒤 `JSON.parse` 한다 (글자 안은 건너뛴다). 안전 범위 안의 수는 지금과 같은 값이다.
- 변환기는 순수 함수다. 필드에 선언이 없고 큰 정수가 없는 JSON 원본은 받은 행 배열을 그대로 돌려준다 (HC6).

### 2.4 스키마 가져오기 — 받는 것

| JSON Schema · OpenAPI                           | `DataField`                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `type: "string"`                                | `string`                                                                   |
| `format: "date"` · `"date-time"` · `"time"`     | `date`                                                                     |
| `format: "email"`                               | `string` + `format: "email"`                                               |
| `format: "uri"` · `"url"`                       | `string` + `format: "url"`                                                 |
| `type: "integer"` · `"number"`                  | `number` (`int64` 는 사용자 결정 5)                                        |
| `type: "boolean"`                               | `boolean`                                                                  |
| `type: "string"` + `enum` 이 두 값 (`Y`/`N` 류) | `boolean` + `flag` **후보** (확정은 사용자)                                |
| `type: "object"` + `properties`                 | `object` + `children`                                                      |
| `type: "array"` + `items`                       | `array` (+ `children` — 항목이 객체일 때)                                  |
| 객체의 `required` 배열 + null 을 허용하지 않음  | `required: true`                                                           |
| `type: [..., "null"]` · 3.0 `nullable: true`    | `required: false`                                                          |
| `default`                                       | `defaultValue`                                                             |
| `title` → 없으면 `description` (짧을 때)        | `label` (springdoc 은 `@Schema(description = "사용자 ID")` 를 여기에 낸다) |
| `$ref: "#/..."`                                 | 문서 안에서 해소                                                           |
| `allOf`                                         | `properties` · `required` 를 합친다 (Java 상속)                            |
| `properties` 의 적힌 순서                       | 열 순서 (정수형 이름이 있으면 보고에 경고)                                 |

보고에 적고 가져오지 않는 것:

- 구성: `oneOf` · `anyOf` · `not` · `discriminator` · `patternProperties` · `additionalProperties` (스키마 값) · 외부 `$ref` (URL · 다른 파일) · 순환 참조 (깊이 8 에서 끊는다 — `dataFields` 의 깊이 한도와 같다).
- 제약: `enum` (두 값 후보 밖) · `minimum` · `maximum` · `exclusive*` · `multipleOf` · `pattern` · `minLength` · `maxLength` · `minItems` · `maxItems` · `uniqueItems` · `const`.
- 고르기: OpenAPI 문서는 `components.schemas` 의 객체 스키마와 `paths` 의 성공 응답 스키마를 목록으로 보인다. 고른 스키마가 포장 (`{code, message, data}`) · 페이지 (`content` · `totalElements`) 면 행 배열까지의 경로 후보를 낸다 (지금의 `utils/responseSchema.ts` 와 같은 규칙을 스키마에 적용) — 그 경로가 endpoint 의 `dataPath` · 전체 수 경로 초안이다 (사용자 결정 2).

### 2.5 감지 — 후보 규칙

- 열 = 모든 표본 행의 키 합집합 (첫 등장 순). 지금은 첫 행의 키뿐이다.
- 타입 = `null` 이 아닌 표본 값 전부 (상한 200 행) 의 일치. 지금은 5 행이고 처음 5 행이 `null` 이면 `string` 이다.
- 타입의 기본 선택은 지금 감지기가 내던 범위 그대로다 — 숫자 · `true`/`false` · ISO 날짜 글자 · 이메일 · URL · 이미지 · 글자. 아래 후보는 기본 선택이 아니다.
- 후보 (제안만 — 미리보기에서 사용자가 정한다. 고르면 타입과 값 표현이 함께 정해진다):
  - 값이 두 종류이고 알려진 짝 (`Y`/`N` · `1`/`0` · `T`/`F` · `true`/`false` 글자) → `boolean` + `flag`.
  - (JSON 원본) 모든 값이 숫자 글자이고 0 으로 시작하지 않고 수로 정확히 옮겨짐 (§2.1) → `number` + `numberText`. 글자 원본의 숫자 글자는 후보가 아니라 타입의 기본 선택이다 (0 으로 시작하는 값이 있으면 `string`).
  - 모든 값이 8 자리 숫자이고 달력 날짜로 읽힘 → `date` + `compactDate`. 14 자리 → `compactDateTime`. `wire` 는 표본의 JSON 타입이다 (글자 원본은 `string`).
  - 모든 값이 정수이고 2000 ~ 2100 년의 epoch 밀리초 (13 자리) · 초 (10 자리) 범위 + 열 이름이 날짜를 암시 (`_DT` · `_DTM` · `_TS` · `_DATE` · `At` · `Time` …) → `date` + `epochMs` · `epochSec`. 이름 조건이 없으면 후보를 내지 않는다.
  - 정수 원문이 안전 범위를 넘음 → `string` + `bigInt` (이 경우만 기본 선택).
- key 후보: 이름이 `id` · `*_ID` · `*Id` 이고 값이 모두 있고 서로 다름. 스키마를 가져왔고 `required` 인 첫 `*_ID` 도 후보다.
- 스키마와 표본이 둘 다 있으면 스키마의 선언이 타입을 정하고 표본은 값 표현 후보와 「선언과 다른 셀 수」 를 낸다.

### 2.6 JSON Schema 내보내기

- 대상: collection 의 저장 값 (정규 값). `$schema` 는 2020-12.
- `date` 는 `type: "string"` 이고 `format` 을 쓰지 않는다 (offset 없는 일시가 `date-time` 검사에서 탈락한다 — F9). 정밀도는 `x-composition-type: "date"` 주석으로 싣는다.
- `required: true` → 객체의 `required` 배열. 그 밖의 필드는 `type: [T, "null"]`.
- `x-composition-id` (필드 id) · `x-composition-order` · `x-composition-key` (key 필드) · `x-composition-encoding` · `x-composition-reference` · `x-composition-formula`. 주석을 무시해도 스키마가 성립한다.
- 계산 필드 (`formula`) 는 `readOnly: true`.

## 3. 현재 인벤토리 (2026-11-16)

### 3.1 스키마 · 행을 다루는 자리

| 자리                        | 파일                                                                                                     | 이 ADR 에서                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 필드 형                     | `packages/shared/src/catalog/document/types.ts:1561` · `apps/builder/src/types/builder/data.types.ts:45` | `encoding` 추가                          |
| collection 형               | `types.ts:1580`                                                                                          | `keyField` 추가                          |
| 문서 검증                   | `document/validation.ts:510-531` · `:2384-2398`                                                          | 허용 키 · 종류 검사                      |
| DataChange 스키마 (zod)     | `packages/shared/src/schemas/dataChange.ts:34-95` · `:187-207`                                           | `encoding` · `keyField` op               |
| 적용기                      | `apps/builder/src/builder/stores/utils/dataChange.ts` (`reduceDataOps`)                                  | 새 속성 통과 · 표현 변경 시 작성 행 규칙 |
| 감지기                      | `panels/datatable/utils/columnDetector.ts`                                                               | 2.5                                      |
| 붙여넣기 파싱               | `panels/datatable/utils/pasteRows.ts:36-45`                                                              | 큰 정수 보존 파싱                        |
| 생성 창                     | `panels/datatable/editors/DataTableCreator.tsx:141` · `:197-212` · `:302` · `:372-401`                   | 방법 「Schema」 · 미리보기               |
| 가져오기 계획               | `panels/datatable/utils/importPlan.ts` · `grid/cellValue.ts:17`                                          | 변환기로 합침                            |
| 열 편집 팝오버              | `panels/datatable/grid/ColumnEditorPopover.tsx`                                                          | 값 표현 칸 · key 필드                    |
| API 편집기                  | `panels/datatable/editors/ApiEndpointEditor.tsx:972`                                                     | 같은 감지 · 같은 미리보기                |
| Builder API 실행            | `stores/utils/dataActions.ts:700-770`                                                                    | 파싱 · 변환기                            |
| shared 조회 · 제출          | `packages/shared/src/collections/executeCollectionEndpoint.ts:95-185`                                    | 파싱 · 변환기 · 되돌리기                 |
| 보기 직렬화                 | `packages/shared/src/collections/view/serialize.ts:149`                                                  | 되돌리기                                 |
| Preview 세션                | `packages/shared/src/catalog/runtime/catalogPreviewSession.ts:140-145` · `:950`                          | `keyField` · 편집 값                     |
| 항목 key                    | `packages/shared/src/collections/resolveCollectionItems.ts:328`                                          | `keyField` 순서                          |
| AI 경로                     | `services/ai/tools/bindCollection.ts:75` · `services/ai/data/pasteProposal.ts:102`                       | 같은 감지 (후보 가운데 기본 선택만 적용) |
| 내보내기 (Publish snapshot) | `toRuntimeCollection` · `ExportedProjectSchema`                                                          | 새 속성 통과                             |
| 죽은 선언                   | `data.types.ts:180` · `packages/shared/src/types/collection.types.ts:119` (`fieldMappings`)              | 삭제                                     |

### 3.2 Phase 0 에서 다시 잰 것 (2026-11-17, main `62d56d224`)

- **새 속성을 통과시켜야 하는 곳** — 필드를 키 하나씩 옮기는 곳은 둘이다: Code 보기의 collection 투영 (`catalogRuntime/codeView.ts:74-80` — `id` · `key` · `type` · `reference` · `formula` 만) 과 보기 결과 schema (`editors/QueryFormatSection.tsx:82`). 나머지 (문서 검증 `validation.ts:516` · DataChange zod `schemas/dataChange.ts:69` · Publish snapshot `toRuntimeCollection` (`collectionSnapshot.ts:40` — schema 를 통째로) · store 투영) 는 필드 객체를 통째로 옮기거나 허용 키 목록을 갖는다 — 허용 키 목록 둘 (필드 · collection) 은 Phase 1 이 고친다. Code 보기는 `encoding` · `keyField` 를 쓰지 않는다 — 코드는 저장 값 (TS 타입 = 필드 타입) 과 행의 key 를 읽고, 값 표현 · key 필드는 진입 설정이다 (`fieldCoverage.ts` 의 `notInCode`, Phase 1).
- **`CATALOG_DATA` 의 행** — `CatalogPreviewFrame.tsx:118-123` 이 store 의 `runtimeRows` (= (c) `setRuntimeRows` 의 결과) 를 그대로 보낸다. (c) 가 변환하면 Preview 는 다시 변환하지 않아도 된다 — 변환기는 멱등이라 다시 지나도 값은 같다 (비용만).
- **작성 행 (`mockData`) 이 변환기를 지나는 시점** — 진입 때 한 번이다. 생성 (`create_collection` 의 `mockData`) · 가져오기 (`insert_rows` · `replace_rows`) · 격자 입력 (`coerceCellValue` → 셀 쓰기) 이 모두 DataChange op 를 만들기 전에 값을 정한다. 문서의 `mockData` 는 정규 값이고 Preview · Publish 는 그것을 변환 없이 읽는다. 값 표현을 나중에 바꿀 때만 (사용자 결정 6) 적용기 (`reduceDataOps`) 가 작성 행을 다시 읽는다.
- **Form 제출이 대상 collection 을 아는 경우** — 제출은 `callEndpoint(endpointId, body)` 하나이고 (`dispatcher.ts:672` → `catalogPreviewInteractions.ts:555` → `submitCollectionEndpoint`) collection 을 모른다. 아는 경우는 endpoint 의 `targetCollectionId` 가 있을 때 하나다 (조회 겸 제출 endpoint). 목록 편집 (`append` · `update` · `remove`) 은 collection 을 안다 (`catalogPreviewSession.ts:950` `itemFields`). Phase 2 의 되돌리기: 목록 편집 · 보기 직렬화는 collection schema, 제출은 `targetCollectionId` 가 있을 때만.
- **`JSON.parse` 원문 접근 · `JSON.rawJSON`** — Chromium 156 · WebKit 27.2 (Playwright) · Node 24 모두 둘 다 있다 (기능 감지 + 대체 경로 전제는 그대로 — 더 오래된 Safari).

## 4. 모듈 배치 (제안)

- `packages/shared/src/collections/intake/` — `encoding.ts` (종류 · 읽기 · 되돌리기) · `normalizeRows.ts` · `parseJsonLossless.ts`. 의존 0, 순수 함수. `collections` barrel 로 내보내지 않는다 (Preview initial 이 늘어난 선례 — ADR-284 Phase 2).
- `apps/builder/src/builder/panels/datatable/schemaImport/` — `readSchemaDocument.ts` (OpenAPI 3.0 · 3.1 · JSON Schema → 고를 수 있는 스키마 목록) · `schemaToFields.ts` · `importReport.ts`. 생성 창이 lazy 로 읽는다.
- `apps/builder/src/builder/panels/datatable/utils/fieldsToJsonSchema.ts` — 내보내기.
- 패널 UI 는 [panel-structure.md](../../../.claude/rules/panel-structure.md) 를 따른다 — 생성 방법은 지금의 방법 목록에 하나, 미리보기의 열 표는 `fieldset.properties-aria`, 고르기는 `PanelSelect`, 파일은 RAC `FileTrigger` · `DropZone` (지금 CSV/JSON 방법과 같은 부품).

## 5. 사용자에게 보이는 흐름

1. Data 패널 → 새 표 → 방법 「Schema」 → `api-docs.json` 을 놓거나 붙여넣는다.
2. 스키마 목록에서 하나를 고른다 (이름 · 필드 수). 포장 · 페이지 스키마면 행 배열 경로 후보를 고른다.
3. 열 표: 이름 · 타입 · 필수 · key. 「가져오지 않은 것 N」 을 펼치면 구성 · 제약 목록.
4. (선택) 표본 응답을 붙여넣으면 열마다 값 표현 후보와 「선언과 다른 셀 N」 이 붙는다.
5. 만들기 → 표 편집기. 열 편집 팝오버에서 타입 · 값 표현 · key 를 나중에 바꿀 수 있다.
6. 표 메뉴 → 「Copy JSON Schema」.

방법 「Paste」 · 「CSV / JSON」 · 「From API」 도 3 ~ 5 의 같은 열 표를 쓴다 (스키마 없이 감지 후보만).

## 6. 검증

### 6.1 측정 설계 (`.claude/rules/measurement-validity.md` §1)

| 질문           | 답                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 출처        | 응답 · OpenAPI 표본은 사용자 제공 (사용자 결정 1) 이 우선. 없으면 Spring Boot 기본 설정을 가정해 손으로 쓴 표본 — 형식 판정에만 쓰고 빈도 · 분포를 인용하지 않는다. 1 만 행 fixture 는 생성물 — 규모 전용 |
| Q2 불리한 경우 | 모든 열에 값 표현이 선언된 1 만 행 × 20 열 (전 셀 변환) 과 큰 정수가 행마다 있는 응답을 잰다. 변환 0 인 응답만 재지 않는다                                                                                |
| Q3 대조군      | 같은 fixture · 같은 기기에서 수정 전 (`response.json()`) 과 후를 교대로 잰다. 시간은 방향만, 판정은 카운트 (새 행 객체 수 · 변환 호출 수)                                                                 |
| Q4 소비 경로   | 네 진입 · 출구가 실제로 변환기를 부르는지 정적 검사 (import → 호출) 와 live 로 확인. 형 선언만 있고 안 읽는 `fieldMappings` (F7) 같은 상태를 만들지 않는다                                                |
| Q5 oracle 독립 | 정답표는 손으로 쓴다 (변환기 출력으로 만들지 않는다). 내보낸 스키마는 다른 구현 (zod `fromJSONSchema`) 이 읽는다. 큰 정수 파싱은 `JSON.parse` 와 차등                                                     |

측정 조건: production build · 기기 · CPU throttle (사용자 Chrome 4x 병기) · revision.

### 6.2 검사 목록

- 단위: 표현 종류 × (읽기 · 되돌리기 · 실패 · 멱등) · 대조쌍 (§2.1 — 원문이 다른 같은 수 · JSON 타입이 다른 같은 날짜 · 정밀도를 잃는 숫자 글자) · 원본 종류 × 선언 유무의 셀 규칙 (§2.3) · 큰 정수 보존 쓰기 · 변환 불필요 identity · 큰 정수 (경계 2^53 ± 1 · 음수 · 지수 · 소수 · 글자 안 숫자 · 깊은 중첩) · `keyField` 순서.
- 정적: 진입 경로의 직접 파싱 0 (허용 목록) · 출구 목록 = 되돌리기 호출 · 가져오기 모듈의 네트워크 호출 0 · `intake` 가 barrel 에 없음 · 패널 정적 게이트 (`nativeControls` · `builderPopupList` · `reservedPrefix`).
- 통합: 같은 원본 종류 · 같은 스키마의 fixture 가 네 진입에서 같은 행 · 전후 표 (§2.3) 11 행의 기대값 · JSON 원본의 선언 없는 필드 전후 동일 · 보기 조건의 요청 URL · body 에 되돌린 표현 (JSON 타입 포함) · 원복 RED (변환기를 빼면 F4 재현 테스트가 다시 실패).
- live: 네트워크를 끊고 본문 G5 흐름. Canvas · Preview · Publish.

## 7. Phase

각 Phase 끝은 커밋 가능한 상태다.

| Phase | 내용                                                                                                                                                                           | Gate |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0     | 인벤토리 고정 (§3.2) · 표본 fixture 와 정답표 · F4 · F5 재현 테스트 (RED 로 고정) · 기준선 (진입 시간 · 번들) · 사용자 결정 1                                                  | G0   |
| 1     | `intake` 모듈 (값 표현 · 변환기 · 큰 정수 보존 파싱) · entry 형 (`encoding` · `keyField`) · 문서 검증 · DataChange 스키마 · contract +1 · `fieldMappings` 삭제                 | G1   |
| 2     | 네 진입 연결 · 출구 되돌리기 · 항목 key 순서 · 세션 · Publish snapshot 통과 · 성능                                                                                             | G2   |
| 3     | 감지기 (§2.5) · 생성 미리보기 열 표 (타입 · 값 표현 · key · 어긋난 셀 수) · 열 편집 팝오버의 값 표현 칸 · key 필드 · API 편집기의 같은 표 · AI 경로 · 사용자 결정 5 · 6        | G3   |
| 4     | 스키마 가져오기 (§2.4) — 방법 「Schema」 · 고르기 · 보고 · 네트워크 0 검사 · lazy chunk · 사용자 결정 2 (endpoint 초안) · 3 (YAML) · 4 (제약)                                  | G4   |
| 5     | JSON Schema 내보내기 (§2.6) · 독립 구현 검사 · live (네트워크 끊음) · 규칙 문서 (`data-interaction.md` §4 — 진입 변환 · 값 표현 · key 필드) · CHANGELOG · README · 사용자 확인 | G5   |

추정 규모: shared 12 ~ 16 · builder 18 ~ 24 파일 + 테스트. Phase 0 인벤토리가 추정과 다르면 이 표를 고친다 (새 ADR 사유가 아니다).

## 8. 기록

- 2026-11-17 **Phase 5 (G5 — 사용자 확인 대기)** — JSON Schema 내보내기 · 규칙 문서 · live.
  - 내보내기 `panels/datatable/utils/fieldsToJsonSchema.ts` (§2.6): 2020-12 · 제목 = 표 이름 · 필수 = `required` 배열 + 타입 하나 (key 필드는 늘 필수) · 그 밖은 `[T, "null"]` · `date` 는 `string` + `x-composition-type: "date"` (`format` 없음 — F9) · email · uri · 객체 · 배열 `children` · `default` · 계산 필드 `readOnly` · `x-composition-id` · `order` · `encoding` · `reference` · `formula` · 루트 `x-composition-key`. 저장 값 (정규 값) 을 기술하고 원본 표기는 주석뿐. 격자의 Export 메뉴 「Copy JSON Schema」 · 「Download JSON Schema」.
  - 규칙 문서 `.claude/rules/data-interaction.md` §4 — 진입 변환 한 곳 · 값 표현 · key 필드 · 출구 되돌리기 · 직접 파싱 금지.
  - 검사: `fieldsToJsonSchema.test.ts` 4 — 모양 · 독립 구현 (zod `fromJSONSchema`) 이 정답표의 저장 값 행을 받음 · 어긋난 행 (원본 표기 `"Y"` · 빈 key · 타입이 다른 값) 탈락 · 계산 필드 · 중첩. 원복 RED 4/4 — (a) key 필드 필수 끔 2 · (b) `encoding` 주석 끔 1 · (c) date 에 `format: date-time` 2 · (d) 루트 key 주석 끔 1.
  - 최종 회귀 (main `62d56d224` + 미커밋): shared 8 파일 · builder unit 7 파일 실패 = Phase 0 착수 전 HEAD worktree 와 같은 목록 (새 실패 0). 마지막 실행이 잡은 새 실패 2 를 고쳤다 — (1) ko-KR `datatable.methodSchema` 가 영어 「Schema」 로 남아 같은 영어의 다른 번역 「스키마」 와 갈림 (`sharedActionVocabulary`) · (2) Phase 4 에서 바꾼 변수 이름 (`importedSource`) 을 정적 게이트 `adr313Wiring` 이 옛 이름으로 찾음 (동작 무변경). 번들 (production closure, gzip) Builder 1,573,132 (기준선 +1,481) · Preview 170,278 (+3) B.
  - live (Chrome MCP · dev 5173 · 새 프로젝트 「ADR313 live」 — 69 이하 문서는 열리지 않아 새로 만듦): 표 (USER_ID 큰 정수 key · USE_YN `Y`/`N` · JOIN_DT `YYYYMMDD`) → Export 「Copy JSON Schema」 → 클립보드 JSON `required: ["USER_ID"]` · `x-composition-key` · 열마다 `x-composition-encoding` · JOIN_DT `x-composition-type: "date"` · 상태 줄 「Copied the JSON Schema of "New table".」 → ListBox 를 이 표에 연결 (Canvas) → Preview → Publish 탭: 항목 key `9007199254740993` · `1001` (keyField — 큰 정수 그대로) · 외부 요청 0 (`performance` resource) → 격자 필터에 `9007199254740993` → 그 1 행만 (1001 제외). 앞 Phase 의 live: 스키마 가져오기 (네트워크 요청 0, Phase 4) · 붙여넣기 → 후보 · key 확정 (Phase 3) · 저장 → 새로고침 재열기 (Phase 2).
  - exercise 하지 못한 것: 보기 정렬 (격자 머리글 클릭은 정렬이 아니고 정렬은 보기 설정 몫 — 단위 검사 `view/evaluate` 만) · 네트워크를 실제로 끊은 상태 (요청 기록 0 으로 대신). 사용자 확인 때 함께 본다.
- 2026-11-17 **Phase 4 종결 (G4)** — 사용자 결정 2 (표 + endpoint 초안) · 3 (JSON 만) · 4 (제약은 보고만) 권고안.
  - 모듈 `panels/datatable/schemaImport/schemaImport.ts` (생성 창이 방법을 고를 때 lazy import): `readSchemaDocument` (OpenAPI 3.0 · 3.1 — `paths` 의 성공 응답 스키마 + 객체 컴포넌트, JSON Schema — 루트 + `$defs` · `definitions`, JSON 이 아니면 `not-json` — YAML 은 받지 않는다) · `rowPathChoices` (스키마의 `array` 속성 = 행 배열 후보, 같은 단계의 `total` · `totalCount` · `totalElements` · `count` = 전체 수 경로, 스키마 자체도 한 행 후보) · `schemaColumns` (§2.4 표 — `allOf` 합침 · 문서 안 `$ref` · `type: [T, "null"]` · `nullable` · `format` date / date-time / time → date · email · uri/url · 두 값 글자 `enum` 의 참 · 거짓 후보 · `int64` = number (key 후보인 `int64` 만 `bigInt` 후보 — 사용자 결정 5) · 객체 · 배열 `children` · `title` → 없으면 짧은 `description` → label · `default` · 필수 = 부모 `required` 이고 null 불가) · `endpointDraftOf` (메서드 · 경로 · 쿼리 파라미터 · `dataPath` · `totalPath` · `servers[0].url`).
  - 보고: 받지 않는 구성 (`oneOf` · `anyOf` · `not` · `discriminator` · `patternProperties` · 스키마 값 `additionalProperties` · 외부 `$ref` · 순환 · 깊이 8) 과 저장하지 않는 제약 (`enum` (두 값 후보 밖) · 범위 · `multipleOf` · `pattern` · 길이 · 개수 · `uniqueItems` · `const`) 을 속성 경로와 함께 전부. 모양이 `oneOf` · `anyOf` · `not` 뿐인 속성은 열로 만들지 않는다. 정수형 이름은 경고.
  - UI `editors/SchemaImportSection.tsx` — 방법 「Schema」 (방법 목록 7): 파일 (RAC `DropZone` · `FileTrigger`, `.json`) · 붙여넣기 → 「Schema」 고르기 → 「Rows at」 (후보가 둘 이상일 때) → 「Also create the API definition」 (응답 스키마일 때, 기본 켬) → 열 표 (`ColumnIntakeTable` — key 필드 기본 = 첫 key 후보) → 「Not imported (N)」. 만들기 = 한 DataChange (`create_collection` source api + `keyField` · `set_source` · `define_endpoint` — 정의만, 실행 없음) 또는 endpoint 없이 `createDataTable`.
  - 검사: `schemaImport.test.ts` 8 (3.0 — 고를 수 있는 스키마 6 · 행 경로 content + totalElements · UserDto 10 열의 타입 · 필수 · key 후보 · 후보 · 보고 4 · endpoint 초안 / 3.1 — 10 열 · `additionalProperties` / JSON Schema — `$defs` · 외부 `$ref` · 순환 · 중첩 · 정수 이름 / YAML · 스키마 아님 거절 / 네트워크 0 정적) · `DataTableCreator.test.tsx` +1 (Schema → 열 10 · key 필드 = USER_ID 의 새 id · 표 + endpoint 한 변경 · `fetch` 0). 원복 RED 4/4 — (a) `allOf` 무시 2 · (b) 제약 보고 끔 1 · (c) 전체 수 경로 잃음 3 · (d) 외부 `$ref` 보고 끔 1.
  - live (Chrome MCP · dev 5173): 「Schema」 → Spring OpenAPI 3.0 표본 붙여넣기 → `GET /api/users` · Rows at `content` · API 정의 켬 · 열 10 · key USER_ID · 가져오지 않은 것 4 (USER_NM maxLength · SALARY_AMT pattern · DEPT_ID minimum · contact oneOf) → 만들기 → 표 10 열 · APIs 에 `GET /api/users` (page · size · Total count path `totalElements`) · 그동안 네트워크 요청 0 (`performance` resource 항목). 발견 1 수리: 「Not imported」 목록 글자가 패널보다 컸다 (`.creator-schema-report`). 처음 다시 읽기는 HMR 중 CanvasKit wasm 예외로 멈췄고 새로 열면 정상 — 이 변경과 무관 (새로 연 문서에 `encoding` · `keyField` 표 3 개가 그대로 열린다).
- 2026-11-17 **Phase 3 종결 (G3)** — 사용자 결정 2 · 3 · 4 · 5 · 6 권고안 (Phase 3 착수 전, 4 · 2 · 3 은 Phase 4 몫을 함께 물었다).
  - 감지 후보 (§2.5, `columnDetector.ts` `encodingCandidates`): 큰 정수 (정수 원문이 안전 범위 밖 — **기본 선택**, 열 = `string` + `bigInt`) · 참 · 거짓 (값이 두 종류이고 알려진 짝 `Y`/`N` · `1`/`0` (JSON 숫자 — 글자 원본에는 없음) · `"1"`/`"0"` · `T`/`F` · `"true"`/`"false"`) · 숫자 글자 (JSON 원본만, 0 으로 시작하지 않고 정확히 옮겨짐) · 붙여 쓴 날짜 · 일시 (8 · 14 자리 + 달력, `wire` = 표본의 JSON 타입) · epoch (정수 · 2000 ~ 2100 · 이름이 시각을 암시) · 날짜 배열. key 후보 = 이름 `id` · `*_ID` · `*_id` · `*Id` + 값이 모두 있고 서로 다름. `DetectedColumn` 에 `candidates` · `encoding` · `keyCandidate`, 선택 적용은 `applyColumnChoice`.
  - 선택지 표 `utils/encodingChoices.ts` (`ENCODING_PRESETS` 16 · `choiceId` · `choiceLabel` — 타입 이름 · 표기 예, 글자 표기는 따옴표로 보인다). 미리보기 열 표 `editors/ColumnIntakeTable.tsx` — key 필드 칸 (후보에 「Suggested key」) + 열마다 「타입 · 값 표현」 칸 (감지한 타입 · 후보 「Suggested from the sample」 · 지금 선택 · String) + 지금 선택으로 읽은 셈 (타입과 다른 셀 · 읽지 못한 셀 · 정밀도를 잃는 셀, `slot="description"`). 생성 창 (붙여넣기 · 파일) 과 API 저장 (`ApiEndpointEditor` 의 Schema) 이 같이 쓰고, 만들 때 필드 id 를 발급해 `keyField` 를 싣는다 (`createDataTable` · Quick Connect · `buildSaveApiAsTableOps` 의 `create_collection.keyField`). 기존 표로 가져오기 미리보기는 열마다 셈을 보인다 (`importPlanReport`).
  - 열 편집 팝오버: Type 절에 「Value notation」 (없음 + 프리셋 16 + 저장된 표현) — 다른 타입의 표현을 고르면 타입도 바뀐다. 사용자 결정 6: 작성 행은 새 표현으로 읽히는 값을 바꾸고 (`encodingChange.ts` `previewEncodingChange` · `encodingChangeToOps` — 한 DataChange), 못 읽는 값이 있으면 타입 변경과 같은 확인 (비움 / 유지). Rules 절에 「Key field」 스위치 (`update_collection.keyField`).
  - 사용자 결정 5 (`int64` 기본 `number`) 는 Phase 4 의 스키마 가져오기가 쓴다 — 감지기는 표본의 큰 정수로만 `bigInt` 를 기본 선택.
  - 검사: `adr313Detect.test.ts` 6 (정답표의 값 표현이 후보 · 기본 선택은 큰 정수뿐 · 후보를 고르면 정답표의 저장 값 · key 후보 · R6 반례 3 (`01234` · 한 종류 `Y` · 이름 없는 epoch) · 처음 5 행 null 열과 첫 행에 없는 키 · 글자 원본) · `encodingChange.test.ts` 3 · `DataTableCreator.test.tsx` +1 (열 표 · 큰 정수 기본 선택 · id 발급). 원복 RED 4/4 — (a) 후보 끔 4 실패 · (b) 스키마가 표현을 버림 2 · (c) 표현 변경이 행을 그대로 3 · (d) 0 으로 시작하는 숫자 글자 허용 1. 정적 게이트 `collectionResolve.static.test.ts` 가 schema 를 key 로 찾는 새 코드 2 곳을 잡아 고쳤다 (열 key → 새 id 는 Map 으로).
  - live (Chrome MCP · dev 5173 · 2026-11-17): JSON 붙여넣기 `USER_ID` (큰 정수 · `1001`) · `USE_YN` · `JOIN_DT` · `AMT` → 열 표 — USER_ID 「String · big integer」 기본 · USE_YN 후보 「Boolean · Y / N」 · JOIN_DT 후보 「Number · number written as text」 · 「Date · YYYYMMDD (text)」 · key 칸 USER_ID 「Suggested key」 → USE_YN · JOIN_DT 후보와 key USER_ID 를 고르고 만들기 → 격자 `true` / `false` · `2026-11-06` → AMT 열 편집 「Value notation」 → 「Number · number written as text」 → 타입 Number · `"4500000.00"` → `4500000` · Format 칸 사라짐 → ⌘Z 한 번에 되돌아감 → USER_ID 팝오버 Key field ON. 발견 1 수리: 목록에 「Boolean · 1 / 0」 이 두 번 (숫자 짝 · 글자 짝) — 글자 표기를 따옴표로 보인다.
- 2026-11-17 **Phase 2 종결 (G2)** — 네 진입 · 출구 · key 순서.
  - 진입: (a) 붙여넣기 — `parsePastedRows` 의 JSON 은 `parseJsonLossless`, 표 셀은 글자 그대로 (`coerceCell` 삭제), 결과 `format` → 원본 종류 (`pastedRowsSource`). CSV 파일 — Papa `dynamicTyping` 끔. 생성 창은 `detectColumns(rows, source)` → `intakeRows` 로 저장 행을 만든다. (b) 기존 표로 가져오기 — `planImport(rows, schema, source)` (격자의 파일 가져오기가 JSON · CSV 를 알려 준다) · `importPlanToOps` 가 `intakeRows` 를 지나고 미리보기용 `importPlanReport` (열마다 「타입과 다른 셀」 · 읽지 못한 셀). (c) Builder API 실행 — `parseJsonLossless` → `intakeQueryItems` (대상 collection 의 schema · `keyField`). (d) Preview · Publish — `loadCollectionEndpoint` · `executeCollectionEndpoint` 가 `parseJsonLossless`, 세션이 받은 항목을 `intakeQueryItems` (두 load 자리), provider 실행기 (`createCollectionEndpointExecutor`) 는 collection 목록 (세션은 읽는 함수) 을 받아 `targetCollectionId` 의 schema 로. 격자 입력 · 붙여넣기 · 행 양식 (`coerceCellValue`) 은 shared `readTextCell` + 필드의 `encoding` 표기. 목록 편집 값 (Form 의 글자, 세션 `itemFields`) 은 `normalizeRows(…, "text")` — 체크박스의 `on` · `off` 를 boolean 으로 받는다. AI 붙여넣기 (`buildPasteProposal`) 도 `intakeRows` (대상 표의 schema).
  - 출구: 보기 조건 직렬화 — 쿼리는 `fieldText` (되돌린 글자), body 는 `fieldJson` (되돌린 JSON 타입 · 큰 정수 `rawJsonNumber`) · 조회 body · 제출 body 는 `stringifyJsonLossless`. Form 제출은 endpoint 의 `targetCollectionId` 가 있을 때만 그 schema 로 되돌린다 (`outgoingRecord(body, schema, "text")` — §3.2 인벤토리대로). `ViewRunField` · `viewRunSchema` · 세션의 보기 schema · 패널의 요청 미리보기가 `encoding` 을 싣는다.
  - key 순서: `resolveFieldRoles(dataBinding, schema, keyField)` — `fieldMap.value` 가 없으면 `keyField` 의 key (fieldMap 이 없는 바인딩도). Canvas (`catalogBoundRows`) · 공용 hook (`useCollectionData` → `useResolvedCollectionItems`) · 세션 (`treeFieldKeyOf` 의 value 역할 대체) · Publish snapshot (`toRuntimeCollection`) · 런타임 데이터 (`collectionOf`) 가 `keyField` 를 옮긴다.
  - 감지기 (§2.5 의 기본 — 타입만): 열 = 처음 200 행의 키 합집합, 타입 = `null` 아닌 값 전부의 일치 (갈리면 `string`), 글자 원본은 글자 모양으로 (`true`/`false` · 정확히 옮겨지는 숫자 — 0 으로 시작하면 아님 · ISO 날짜). 값 표현 후보 · key 후보는 Phase 3.
  - 전후 표 9 행의 뜻 정정: 「42 만 있는 열 · true 만 있는 열」 (각 열이 그대로 number · boolean). 한 열에 42 와 true 가 섞이면 8 행과 같이 string 열이다.
  - 큰 정수 보존 파싱의 기본 경로를 원문 훑기로 바꿨다 (§2.3 의 「원문 접근 우선」 정정): 1 만 행 × 20 열 · 행마다 큰 정수 (Node 24 · Apple Silicon) — `JSON.parse` 8.2 ms · 훑기 16.0 ms · reviver (`context.source`) 41.7 ms. reviver 경로는 차등 테스트용 (`parseJsonLosslessWithSource`) 으로 남겼다 — 두 경로의 결과가 같다 (G1).
  - HC6 (Node 24 · 3 회 중앙값 · 같은 하니스): 변환이 필요 없는 응답 (선언 없음) — 새 행 객체 **0** · 바뀐 셀 0 · 진입 비용 = 큰 정수 보존 파싱 8.0 ms (Phase 0 `JSON.parse` 6.5 ms) + 타입과 다른 셀 세기 4.8 ms. 불리한 경우 (20 열 전부 값 표현 · 행마다 큰 정수) — 새 행 객체 10,000 · 바뀐 셀 190,000 · 파싱 + 변환 약 64 ms (훑기 16 + 변환 48, Phase 0 `JSON.parse` 8.7 ms). 시간은 방향만 (Q3).
  - G0 파일 (`adr313Current.test.ts`) 의 기대 값을 「표준」 열로 바꿨다 — 11 행 + Spring 표본 감지 (11 건). 이 ADR 이 바꾸는 동작을 적고 있던 기존 테스트 6 건을 고쳤다 (`pasteRows.test.ts` — 표 셀은 글자 · `importPlan.test.ts` — 글자 원본은 `source: "text"`, JSON 원본 케이스 추가).
  - 검사: `adr313Exits.test.ts` 4 (쿼리 글자 · body JSON 타입과 큰 정수 literal — 실제 요청 글자 · Form 제출 body · key 순서) · `adr313Wiring.static.test.ts` 13 (진입 9 파일의 직접 파싱 0 · 출구 2 파일의 되돌리기 · barrel 밖 · 네트워크 0). 원복 RED 8/8 — (a) 표 셀 형변환 3 실패 · (b) 조회 응답 `JSON.parse` 1 · (c) 쿼리 되돌리기 제거 1 · (d) 제출 되돌리기 제거 1 · (e) `keyField` 무시 1 · (f) 가져오기가 원본 종류 무시 2 · (g) 글자 감지 끔 2 · (h) Builder 실행 `JSON.parse` 1 (정적).
  - 회귀: shared 실패 10 (기존 8 파일 그대로) · builder unit 실패 11 (기존 7 파일 그대로) · type-check 6/6 (builder `tsconfig.app.json` 직접 실행 포함).
  - 번들 (HC3 · R8, production build + closure — Phase 0 기준선 대비): 첫 측정 Builder **+4,541 B** (Δ 상한 +4,096 초과 — 첫 화면의 `collectionSnapshot` → 실행기와 `validation` → `encoding.ts` 가 변환기 전체를 끌어왔다) → 수리: 종류 표 · 검증 판정을 `intake/encodingKinds.ts` 로 나누고, 실행기 (`executeCollectionEndpoint`) 와 Builder API 실행 (`dataActions`) 은 변환기 (`parseJsonLossless` · `queryItems` · `outgoing`) 를 실행할 때 lazy import → Builder **+1,500 B** · Preview **−1 B** (1,573,151 · 170,274). 사용자 결정 7 (상한 재승인) 은 필요 없다.
  - live (Chrome MCP · dev 5173 · CPU throttle 없음 · 2026-11-17): 새 프로젝트 → Data → 새 표 → Paste — CSV `USER_ID,ZIP_CD,AMT,NAME` (`9007199254740993` · `01234` · `4500000.50`) 미리보기 USER_ID · ZIP_CD string · AMT number → 만들기 → 격자 `9007199254740993` · `01234` · `4500000.5` · JSON `[{"ID": 9007199254740995, "USE_YN": "Y", …}, {"ID": 12, …}]` → `9007199254740995` 보존 · `"Y"` 그대로 · ID 열 string (숫자 12 는 값 그대로 — 타입과 다른 셀) · 새로고침 뒤 같은 값 · 콘솔 오류 0. 대시보드는 그전 프로젝트 3 개를 열지 않는다 (contract 70 — 예정된 Breaking). (c)(d) 는 네트워크 응답이 필요해 live 대신 실제 `loadCollectionEndpoint` 를 응답 원문으로 돈 테스트.
- 2026-11-17 **Phase 1 종결 (G1)** — contract 69 → **70** (Breaking).
  - `packages/shared/src/collections/intake/` — `encoding.ts` (종류 8 · `encodingProblem` · `readEncoded` · `readEncodedText` · `writeEncoded` · `writeEncodedText` · `readNumberText`) · `normalizeRows.ts` (`normalizeRows` · `readTextCell` · `jsonFitsType`) · `parseJsonLossless.ts` (`parseJsonLossless` · `stringifyJsonLossless` · `rawJsonNumber`). 의존 0, `collections` barrel 밖.
  - 결정한 세부: 읽기는 이미 정규 값이면 그대로 (flag 의 boolean · numberText 의 숫자 · 날짜의 ISO 글자 · bigInt 의 숫자 글자) · epoch 저장 값은 `…Z` (밀리초 0 이면 뺀다) · 0 ~ 9999 년 밖은 읽지 않는다 · 날짜 배열은 `date` = 3 칸, `dateTime` = 5 ~ 7 칸 (7 번째 = 나노초 → 초 아래 글자) · 날짜 표현의 되돌리기는 저장 글자의 적힌 성분을 쓴다 (offset 이 있는 값의 날짜 표현은 그 offset 의 날짜) · 정수인데 안전 범위 밖인 epoch · bigInt 숫자 = `precision` · 큰 정수 보존 파싱은 16 자리 이상의 숫자 열이 원문에 있을 때만 원문 접근 경로를 탄다 (없으면 `JSON.parse` 그대로) · `object` · `array` 필드의 `children` 안은 변환하지 않는다 (값 표현은 최상위 필드에만).
  - entry 형: `CatalogDataField.encoding` · `CollectionEntry.keyField` (필드 id). 문서 검증: `INVALID_FIELD_ENCODING` (모르는 종류 · 인자 · 값) · `FIELD_ENCODING_TYPE_MISMATCH` · `KEY_FIELD_MISSING` (그 collection 의 작성 필드 id 가 아님 — 계산 필드 포함). DataChange zod: `FieldEncodingSchema` · `encoding` (필드 · patch — `null` = 지움) · `create_collection.keyField` · `update_collection.patch.keyField` (`null` = 지움). 적용기: 타입을 바꾸면 맞지 않는 값 표현을 같은 op 에서 지우고 inverse 가 되살린다 · key 필드를 지우면 `keyField` 도 빠지고 inverse 가 필드 → key 순으로 되살린다 · delete 의 inverse 가 `keyField` 를 싣는다. 문서 ↔ store 투영 (`toCollectionEntry` · `fromCollectionEntry`) 이 `keyField` 를 옮긴다.
  - Code 보기: `encoding` · `keyField` 는 코드에 쓰지 않는다 (`fieldCoverage.ts` `notInCode` — 코드는 저장 값과 행 key 를 읽는다). §3.2 의 「Phase 2 가 Code 보기에 `encoding` 을 싣는다」 를 정정.
  - `responseMapping.fieldMappings` 형 선언 둘 삭제 (읽는 코드 0 — F7).
  - 검사: `adr313Intake.test.ts` 30 (정답표 · 대조쌍 3 · 종류 9 × 읽기 · 실패 · 되돌리기 · 원본 종류 × 선언 유무 · HC6 identity · 큰 정수 차등 · 경계 · 두 파싱 경로 · 두 쓰기 경로 · 검증 판정) · `adr313DataContract.test.ts` 4 (69 거부 · 받음 · 거절 3 종 · key 필드) · `dataChange.test.ts` +4 (왕복 · 타입 변경 · key 필드 삭제 · 생성 / 삭제). 원복 RED 7/7 — (a) 큰 정수 보존 파싱 → `JSON.parse` 3 실패 · (b) 숫자 글자의 정밀도 검사 제거 3 · (c) 선언 없는 JSON 값을 열 타입으로 강제 1 · (d) 늘 새 행 객체 4 · (e) `keyField` 검사 제거 1 · (f) `encoding` 검사 제거 1 · (g) key 필드 삭제 때 `keyField` 유지 1 (bash + trap 복원 + cmp).
  - 회귀: shared 2,582 중 실패 10 (8 파일 — HEAD `62d56d224` worktree 에서 같은 8 파일 · 10 건, 새 실패 0) · builder unit 실패 7 파일 (HEAD 에서도 같은 7 파일 실패 — catalog 표 · 아이콘 등 이 ADR 밖) · type-check 6/6 · `docs:stale-symbols` 0. contract 고정값 `69` 를 쓰던 테스트 3 곳은 `LIBRARY_CONTRACT_VERSION` 으로 (ADR-312 · 306 · 284 · code library), fixture 32 파일의 `libraryContractVersion: 69` → 70.
  - live: 이 Phase 는 화면에 닿는 것이 없다 (진입 연결 · UI 는 Phase 2 · 3) — live 는 Phase 2 와 함께.
- 2026-11-17 **Phase 0 종결 (G0)** — 착수 HEAD `62d56d224` (contract 69 — ADR-312 가 먼저 올렸다, 이 ADR 은 70). 사용자 결정 1 「손으로 쓴 표본」.
  - 표본 fixture 와 정답표: `packages/shared/src/collections/intake/__tests__/fixtures/springSamples.ts` — Spring `Page<UserDto>` 응답 원문 14 열 (큰 정수 PK · `Y`/`N` · `1`/`0` · 숫자 글자 · `YYYYMMDD` · `YYYYMMDDHHmmss` · epoch 밀리초 · offset 없는 ISO · 날짜 배열 5 · 6 칸 · `01234` · 이메일 · null), 포장 응답 (`{code, message, data.list}`), Oracle CSV 내보내기, OpenAPI 3.0 (`allOf` 상속 · `nullable` · `oneOf` · 제약) · 3.1 (`type: [T, "null"]` · `format: uri` · 배열 · `additionalProperties`). 정답표는 사람이 썼고 epoch 은 Python 으로 따로 계산했다.
  - 「지금」 열 실행 확인: `apps/builder/src/builder/panels/datatable/utils/adr313Current.test.ts` 10/10 — 전후 표 11 행이 breakdown 과 같다 (차이 0). F4 (같은 JSON 의 `"Y"` 가 (b) 에서만 `true`) · F5 (JSON (a)(b)(c)(d) 와 붙여넣기 탭 · 쉼표 CSV 에서 2^53 + 1 → 2^53, Papa CSV 파일은 글자) 재현. Spring 표본의 지금 감지: `USER_ID` number · `USE_YN` string · `ACTIVE_FLAG` number · `SALARY_AMT` · `JOIN_DT` · `REG_DTM` string · `UPD_TS` number · 날짜 배열 array. Papa CSV 는 `USER_ID` 한 열에 글자 (큰 정수) 와 숫자 (`1001`) 를 섞는다. Phase 2 가 이 파일의 기대 값을 표준 열로 바꾼다.
  - §2.5 정정: epoch 후보의 이름 조건에 `_TS` · `_DTM` 을 더한다 (Oracle 관례 — `UPD_TS`).
  - 진입 시간 기준선 (`adr313Perf.test.ts`, Node 24 · Apple Silicon · throttle 없음 · 3 회 중앙값): 1 만 행 × 20 열 `JSON.parse` — 변환 없는 응답 6.5 ms · 값 표현 응답 8.7 ms, 기존 표로 가져오기 `importPlanToOps` 8.9 ms. 원 수치 `.agent/runs/2026-11-17-adr313-phase0/perf-base-{1,2,3}.json` (로컬).
  - 번들 기준선: `vite build` + `adr209-bundle-closure.mjs` — Builder initial JS gzip **1,571,651 B** · Preview **170,275 B** (closure 측정 — ADR-312 와 같은 방식, 판정은 이 기준선과의 Δ). 원 수치 `.agent/runs/2026-11-17-adr313-phase0/bundle-{builder,preview}.json` (로컬).
  - §3.2 인벤토리 4 항목 확정 (위). 추정 규모와의 차이 없음.
- 2026-11-16 리뷰 round 2 — HIGH 0 · pending 0, 설계 리뷰 종결. l4 정정: 전후 표 8 행 (지금 감지 타입 number) · 10 행 (붙여넣기는 쉼표 CSV 도 큰 정수를 잃는다 — 파서가 Papa 가 아니라 `parseTable`).
- 2026-11-16 리뷰 round 1 반영 — §2.1 (인자 `wire` · `precision` · 왕복의 보장 범위 · 값을 잃는 읽기 금지 · epoch 예시 정정) · §2.3 (원본 종류 · 셀 규칙 · 전후 표) · §2.5 (타입의 기본 선택과 후보의 구분). 실행 확인: Papa `dynamicTyping` 은 `9007199254740993` 을 글자로 두고 `01234` 를 `1234` 로 바꾼다, `Number("9007199254740993")` = `9007199254740992`.
- 2026-11-16 작성. 외부 사실 확인: JSON Schema `format` 기본 동작 · Spring Boot 날짜 기본값 · `JSON.parse` 원문 접근 지원 (검색), zod `fromJSONSchema` (설치본 소스). Safari 의 원문 접근 지원은 확인하지 못했다 — 기능 감지와 대체 경로가 전제다.

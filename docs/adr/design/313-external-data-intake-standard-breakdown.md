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
  - 모든 값이 정수이고 2000 ~ 2100 년의 epoch 밀리초 (13 자리) · 초 (10 자리) 범위 + 열 이름이 날짜를 암시 (`_DT` · `_DATE` · `At` · `Time` …) → `date` + `epochMs` · `epochSec`. 이름 조건이 없으면 후보를 내지 않는다.
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

### 3.2 Phase 0 에서 다시 재는 것

- `DataField` 를 읽는 59 파일 가운데 새 속성을 통과시켜야 하는 곳 (복제 · 내보내기 · Code 보기 · 투영).
- API 결과가 Builder 에서 Preview 로 넘어가는 길 (`CATALOG_DATA`) 의 행이 (c) 의 결과인지 — 맞으면 Preview 는 그 행을 다시 변환하지 않는다 (멱등이라 안전하지만 비용).
- 작성 행 (`mockData`) 이 변환기를 지나는 시점 — 저장 때 한 번인지.
- Form 제출이 대상 collection 을 아는 경우의 수.

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

- 2026-11-16 리뷰 round 2 — HIGH 0 · pending 0, 설계 리뷰 종결. l4 정정: 전후 표 8 행 (지금 감지 타입 number) · 10 행 (붙여넣기는 쉼표 CSV 도 큰 정수를 잃는다 — 파서가 Papa 가 아니라 `parseTable`).
- 2026-11-16 리뷰 round 1 반영 — §2.1 (인자 `wire` · `precision` · 왕복의 보장 범위 · 값을 잃는 읽기 금지 · epoch 예시 정정) · §2.3 (원본 종류 · 셀 규칙 · 전후 표) · §2.5 (타입의 기본 선택과 후보의 구분). 실행 확인: Papa `dynamicTyping` 은 `9007199254740993` 을 글자로 두고 `01234` 를 `1234` 로 바꾼다, `Number("9007199254740993")` = `9007199254740992`.
- 2026-11-16 작성. 외부 사실 확인: JSON Schema `format` 기본 동작 · Spring Boot 날짜 기본값 · `JSON.parse` 원문 접근 지원 (검색), zod `fromJSONSchema` (설치본 소스). Safari 의 원문 접근 지원은 확인하지 못했다 — 기능 감지와 대체 경로가 전제다.

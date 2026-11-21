# ADR-313: 외부 데이터 가져오기 표준 — 스키마 가져오기 (OpenAPI · JSON Schema, 네트워크 없이) · 필드의 값 표현 선언 · 행 진입 정규화 한 곳 · key 필드

## Status

Implemented — 2026-11-21 (G5 — 네트워크를 끊은 브라우저에서 스키마 가져오기 → 붙여넣기 → 타입 · 표현 · key → 목록 · 표 연결 → 정렬 · 필터 → 새로고침 뒤 Canvas · Preview · Publish, 아래 「Live Exercise」 · 사용자 승격 지시 「1-4 먼저 시작해」). Accepted 2026-11-17 (사용자 `/execute-adr 313` + [reviews/313.md](../reviews/313.md) round 2 pending 0 · HIGH 0). Proposed 2026-11-16.

> **G5 종결 (2026-11-21)**: Phase 5 에서 남긴 두 가지 — 보기 정렬 · 네트워크 차단 — 를 이번 live 가 다뤘다. 정렬은 그 사이 ADR-315 Phase 2 가 바꾼 정렬 구현 (`collections/view/sortOrder.ts`) 위에서 확인했다 — 큰 정수 key 글자가 숫자 순, 날짜가 시간 순, 참 · 거짓이 묶임. 차단은 브라우저 단위 (localhost 밖 요청을 모두 끊고 셈) 이고 OS 의 회선 차단은 아니다. 결함 0. 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 5 (2026-11-17 — G5, 사용자 확인 대기)**: 격자 Export 메뉴의 「Copy · Download JSON Schema」 — 저장 값 (정규 값) 을 기술하는 2020-12 스키마 (key 필드 필수 · `date` 는 `format` 없이 주석 · 값 표현 · key 는 `x-composition-*` 주석). 독립 구현 (zod `fromJSONSchema`) 이 정답표 행을 받고 어긋난 행을 떨어뜨린다 (4 · RED 4/4). 규칙 문서 `data-interaction.md` §4. 회귀 새 실패 0 · 번들 Builder +1,481 · Preview +3 B. live: 스키마 복사 · ListBox 연결 → Publish 항목 key = `keyField` 의 큰 정수 그대로 · 외부 요청 0 · 격자 필터. 보기 정렬 · 실제 네트워크 차단은 exercise 하지 못했다. 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 4 종결 (2026-11-17 — G4)**: 생성 방법 「Schema」 — api-docs (OpenAPI 3.0 · 3.1) · JSON Schema 를 붙여넣거나 놓으면 (네트워크 0) 스키마 · 행 위치 (포장 · 페이지 — `content` · `totalElements`) 를 고르고 열 표로 정한 뒤 표와 API 정의 초안을 한 번에 만든다. 받지 않는 구성 · 저장하지 않는 제약은 「Not imported」 에 전부. `int64` = number (key 후보만 큰 정수 후보). G4 9 · RED 4/4 · live (네트워크 요청 0). 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 3 종결 (2026-11-17 — G3)**: 감지가 값 표현 후보 (참 · 거짓 짝 · 숫자 글자 · 붙여 쓴 날짜 · epoch · 날짜 배열) 와 key 후보를 내고, 큰 정수만 기본 선택한다. 생성 미리보기 · API 저장의 열 표에서 열마다 타입 · 값 표현을 고르고 key 필드를 정하며, 지금 선택으로 읽은 어긋난 셀 수를 본다. 열 편집 팝오버에 「Value notation」 · 「Key field」 — 표현을 바꾸면 작성 행은 타입 변경과 같은 규칙 (사용자 결정 6). 원복 RED 4/4 · live (후보 선택 → 생성 → 표현 변경 → Undo → key 필드). 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 2 종결 (2026-11-17 — G2)**: 네 진입 (붙여넣기 · 파일 · 기존 표로 가져오기 · Builder API 실행 · Preview/Publish 조회) 과 격자 입력 · 목록 편집 값 · AI 붙여넣기가 같은 변환기를 지난다 — 표 · CSV 셀은 글자 그대로 들어와 열 감지 (§2.5 의 타입 기본) 뒤 열 타입으로 읽히고, JSON 은 큰 정수를 보존해 선언 없는 값을 바꾸지 않는다. 출구 (보기 조건 쿼리 · body · `targetCollectionId` 가 있는 Form 제출) 가 값 표현으로 되돌리고 큰 정수는 literal. 항목 key = `fieldMap.value` → `keyField` → `id` · `key` · `value` → `row-N` (Canvas · DOM · 세션 · Publish). 전후 표 11 행이 「표준」 열과 일치 (9 행의 뜻 정정 — 각 열), 원복 RED 8/8, 새 실패 0, HC6 변환 불필요 응답의 새 행 객체 0, 번들 Builder +1,500 · Preview −1 B (첫 측정 +4,541 → 변환기 lazy 로 수리). 큰 정수 보존 파싱의 기본 경로는 원문 훑기 (reviver 보다 2.5 배 빠름). live: CSV · JSON 붙여넣기 → 큰 정수 · `01234` · `"Y"` 보존 → 새로고침 뒤 같음. 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 1 종결 (2026-11-17 — G1, contract 70)**: shared `collections/intake` (값 표현 8 종의 읽기 · 되돌리기 · 진입 변환기 `normalizeRows` · 큰 정수 보존 파싱 · 쓰기, 의존 0 · barrel 밖) · entry 형 `CatalogDataField.encoding` · `CollectionEntry.keyField` · 문서 검증 (`INVALID_FIELD_ENCODING` · `FIELD_ENCODING_TYPE_MISMATCH` · `KEY_FIELD_MISSING`) · DataChange 스키마 · 적용기 (타입 변경이 맞지 않는 값 표현을 지움 · key 필드 삭제가 `keyField` 를 지움, 둘 다 inverse 복원) · `fieldMappings` 삭제. 검사 G1 34 + 적용기 4 · 원복 RED 7/7 · 새 실패 0. Code 보기는 `encoding` · `keyField` 를 쓰지 않는다 (진입 설정). 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

> **Phase 0 종결 (2026-11-17 — G0)**: 손으로 쓴 Spring 표본 (응답 14 열 · 포장 응답 · Oracle CSV · OpenAPI 3.0 · 3.1) 과 정답표를 fixture 로 고정 · 전후 표 11 행의 「지금」 열과 F4 · F5 를 실제 코드로 실행 (`adr313Current.test.ts` 10/10, breakdown 과 차이 0) · 인벤토리 4 항목 (필드를 키별로 옮기는 곳 = Code 보기 · 보기 결과 schema / Preview 의 API 행 = (c) 의 결과 / 작성 행은 진입 때 한 번 / Form 제출은 `targetCollectionId` 가 있을 때만 collection 을 안다) · 기준선 (1 만 행 × 20 열 파싱 6.5 · 8.7 ms, 번들 Builder 1,571,651 · Preview 170,275 B gzip closure). contract 는 69 (ADR-312) → 이 ADR 이 70. 상세 [breakdown §8](../design/313-external-data-intake-standard-breakdown.md).

- 사용자 결정 2 · 3 · 4 · 5 · 6 확정 (2026-11-17, Phase 3 착수 전 — 모두 권고안): 2 = 표 + endpoint 초안 · 3 = JSON 만 · 4 = 제약은 보고만 · 5 = `int64` 기본 `number` (key · 안전 범위 밖 표본만 `bigInt` 제안) · 6 = 값 표현 변경은 타입 변경과 같은 규칙 (바뀌는 값은 바꾸고 못 바꾸는 값은 비운다).
- 사용자 결정 1 확정 (2026-11-17 「손으로 쓴 표본」): Phase 0 fixture 는 Spring Boot 기본 설정을 가정해 손으로 쓴 표본이다 — 형식 판정에만 쓰고 빈도 · 분포의 근거로 쓰지 않는다.

- 사용자 요청: `/create-adr` (2026-11-16).
- 방향을 정한 사용자 원문 (2026-11-16 대화 순서대로):
  - 「빌더의 모든 저장데이터는 단일소스로 이워져있다 catalog … item 에대한 표준은 정해지지않은 상태에서 자체적인 규칙보다는 현재구현을 json schema표준 으로 변경시 RAC 쪽 문제가 없을지 검토해」
  - 「이부분검토를 하는것이 외부api로 데이터를 받아올때 대부분 오라클db,java로 만들어진 환경의 데이터를 받아올것인데」
  - 「JSON Schema 표준을 도입할 필요성은 없다는건가」
  - 「빌더내 data패널 - table생성 단계에서는 수정이 필요없나?」
  - 「필요한 수정 — 생성 단계 안에서 <-- 인데 인터넷 연결 없이(네트워크통신없이) 가능해야한다」
- 사용자가 이미 답한 확인 항목: 네트워크 없이 동작 (위 마지막 원문). 그 밖의 판정은 아래 「사용자 결정」 에 모았다.
- 아래의 새 이름 (`encoding` · `keyField` · `intake` 모듈 · 생성 방법 「Schema」) 은 제안이고 아직 구현되지 않았다. 코드 인용은 main `3b9d7fb45` 기준이다.
- 리뷰 round 1 (2026-11-16, [reviews/313.md](../reviews/313.md)) 반영: h1 — 변환을 「선언된 값 표현」 과 「글자 셀 읽기」 둘로 나누고 원본 종류 (JSON · 글자) 마다 규칙을 정함, 달라지는 동작을 전후 표로 고정 (HC5 · Decision 4 · G2 · breakdown §2.3) / h2 — 왕복의 보장 범위를 「서버가 같은 값으로 읽는 JSON 표현」 으로 정의, 값 표현에 JSON 타입 · 날짜 정밀도 인자 추가, 정밀도를 잃는 숫자 글자는 읽기 실패 (HC7 · Decision 5 · breakdown §2.1) / l3 — Papa 의 큰 정수 서술과 epoch 예시 정정 (F5 · breakdown §2.1). 수리 검증 round 2 (2026-11-16) — HIGH 0 · pending 0 (h1 · h2 · l3 fixed, l4 LOW deferred). **설계 리뷰 종결 (실행자 선언)**. l4 (현재 동작 인벤토리의 사실 둘 — CSV 붙여넣기도 큰 정수를 잃음 · 섞인 열의 지금 감지 타입은 number) 는 F4 · F5 · G0 · breakdown 전후 표 8 · 10 행에 같은 날 정정했다.
- 사용자 결정 8 확정 (2026-11-17 「권고안 대로」): 선언 없는 필드에 온 타입이 다른 JSON 값은 그대로 두고 세어 값 표현을 제안한다 — Decision 4 · HC5 · breakdown §2.3 전후 표가 그대로 정답이다.
- 같은 날 대화에서 변환 규칙의 자리를 endpoint (`responseMapping.normalize`) 로 보였는데, 조사에서 붙여넣기 · 파일 경로에는 endpoint 가 없고 서버로 나가는 값이 collection schema 를 읽는다는 것을 확인해 필드 단위 선언으로 바꿨다 (대안 C 기각 사유).

## Context

### 도메인

- D1 · D2 · D3 어느 것도 바꾸지 않는다. 대상은 **데이터 정의 계약** (ADR-286 의 문서 entry `collection` · `endpoint`) 과 **빌더 패널** (Data 패널 — builder-system UI, [panel-structure.md](../../../.claude/rules/panel-structure.md)) 이다.
- D1 과 닿는 곳은 하나다 — RAC collection 이 받는 항목 key. RAC 는 행 (`items`) 과 key 만 받고 스키마를 읽지 않는다. 이 ADR 은 key 를 정하는 필드를 선언할 수 있게 할 뿐, RAC 의 DOM · ARIA · 동작은 그대로다.
- 생성기 선언: catalog rule · `generate-css.ts` 는 대상이 아니다.

### 문제

고객 데이터는 대부분 Oracle DB · Java (Spring) 로 만든 API 에서 온다 (사용자 2026-11-16). 그 응답은 JSON 타입과 뜻이 어긋나는 값이 흔하다 — 참 · 거짓을 `"Y"` · `"N"` 으로, 금액을 숫자 글자로, 날짜를 epoch 밀리초나 `"20261106"` 으로, PK 를 2^53 을 넘는 정수로 준다. 지금 Data 패널은 값의 모양만 보고 타입을 추측하고, 같은 값이 들어오는 길에 따라 다른 값이 된다. API 가 제공하는 스키마 선언 (OpenAPI = JSON Schema) 을 읽는 길은 없다.

### 코드 사실 (2026-11-16 실측 — 전수 표는 [breakdown §3](../design/313-external-data-intake-standard-breakdown.md))

- **F1 — 스키마는 자체 형식이고 RAC 로 가지 않는다.** `CatalogDataField` (`packages/shared/src/catalog/document/types.ts:1561`) 는 `key` · `type` · `format` · `required` · `children` · `reference` · `formula` 를 갖는 배열이다. 문서 검증이 허용 키를 고정한다 (`validation.ts:516-531` 필드 · `:2386-2398` collection). 스키마를 읽는 곳은 resolver · 보기 평가 · Preview 세션 · 계산 필드 · Code 보기이고 (`DataField` 참조 59 파일), RAC 컴포넌트에 전달되는 경로는 없다.
- **F2 — 생성 방법 여섯에 스키마 선언을 읽는 것이 없다.** `"empty" | "preset" | "paste" | "file" | "api" | "ai"` (`apps/builder/src/builder/panels/datatable/editors/DataTableCreator.tsx:141`). Empty · Preset 밖의 모든 길이 `detectColumns` 로 스키마를 만든다 — 호출부 5 (`DataTableCreator.tsx:302` · `ApiEndpointEditor.tsx:972` · `utils/importPlan.ts:35` · `services/ai/tools/bindCollection.ts:75` · `services/ai/data/pasteProposal.ts:102`).
- **F3 — 감지기는 값의 모양만 본다** (`utils/columnDetector.ts`). 열은 첫 행의 키 (`:84`), 타입은 처음 5 행 (`:92`), `required` 는 늘 `false` (`:131`), 날짜는 `YYYY-MM-DD` 로 시작하는 글자뿐 (`:45`). `"Y"` · `"N"` · 숫자 글자 · epoch · `"20261106"` 은 각각 `string` · `string` · `number` · `string` 으로 남는다.
- **F4 — 행이 들어오는 길 넷이 값을 다르게 다룬다.**
  - (a) 생성의 붙여넣기 · 파일: 파싱한 값 그대로 저장 (`DataTableCreator.tsx:399` `mockData: imported.rows`).
  - (b) 기존 표로 가져오기: 원본이 JSON 이어도 모든 셀을 글자로 바꾼 뒤 대상 열 타입으로 강제 (`importPlan.ts:83-88` → `grid/cellValue.ts:17` `coerceCellValue` — boolean 은 `y` · `n` · `1` · `0` 을 받고 date 는 `coerceDateText`, 못 읽으면 `null`).
  - (c) Builder 의 API 실행: 응답 그대로 (`stores/utils/dataActions.ts:714` → `:768` `setRuntimeRows`).
  - (d) Preview · Publish 의 조회: 응답 그대로 (`packages/shared/src/collections/executeCollectionEndpoint.ts:119` · `:152`).
  - 그래서 같은 JSON 의 `"Y"` 가 (b) 에서는 `true`, (a)(c)(d) 에서는 글자다.
  - 글자 원본은 파싱 단계가 셀마다 타입을 정하고 파서가 둘이다 — CSV 파일은 Papa `dynamicTyping` (`DataTableCreator.tsx:208`), 붙여넣기 (탭 표 · 쉼표 CSV 모두) 는 `parseTable` 의 `coerceCell` (`utils/pasteRows.ts:75-82` · `:83-101`). 실행 결과 (2026-11-16): `01234` → `1234`, 한 열의 `42` · `abc` → 값은 숫자와 글자가 섞이고 감지 타입은 number (`columnDetector.ts:92-104` — 글자가 아닌 첫 타입에서 멈춘다).
- **F5 — 큰 정수가 JSON 파싱과 붙여넣기 읽기에서 바뀐다.** `JSON.parse` (`utils/pasteRows.ts:41` · `dataActions.ts:714`) · `response.json()` (`executeCollectionEndpoint.ts:119`) · 붙여넣기 (탭 표 · 쉼표 CSV) 의 `Number(value)` (`pasteRows.ts:80`) 가 2^53 을 넘는 정수를 근삿값으로 만든다. Java `Long` PK 가 바뀌면 항목 key 가 틀어진다. CSV 파일 경로만 해당하지 않는다 — Papa 는 안전 범위 밖의 수를 글자로 둔다 (설치본 `papaparse.js:967-968` · `:1129-1132`, 실행 확인).
- **F6 — collection 에 key 필드 선언이 없다.** 항목 key 는 바인딩의 `fieldMap.value` → 행의 `id` · `key` · `value` → `row-N` 순이다 (`packages/shared/src/collections/resolveCollectionItems.ts:328-341`). `USER_ID` 같은 PK 는 바인딩마다 지정하지 않으면 모든 행이 `row-N` 이다.
- **F7 — `responseMapping.fieldMappings` 는 읽는 코드가 없다.** 형 선언 둘 (`apps/builder/src/types/builder/data.types.ts:180` · `packages/shared/src/types/collection.types.ts:119`) 뿐이고 소비처는 0 이다.
- **F8 — 서버로 나가는 값은 저장 값의 글자다.** 보기 조건 직렬화가 `String(value)` 로 쓴다 (`packages/shared/src/collections/view/serialize.ts:149-153`). 목록 편집 · Form 값은 schema 의 `type` 으로만 바꾼다 (`catalog/runtime/catalogPreviewSession.ts:950` `itemFields`). `"Y"` 를 `true` 로 읽으면 서버에는 `true` 가 나간다.
- **F9 — 날짜 값은 ISO 글자이고 모양이 정밀도다.** `parseDateValue` 가 날짜 · 일시 (offset 없음) · 시각 · 절대 시각으로 나눈다 (`packages/shared/src/state/dateValue.ts:31-46`, ADR-309). offset 없는 일시는 정상 값이다.
- **F10 — 설치본.** zod 4.6.7 (builder · shared 직접 의존성) 에 `fromJSONSchema` 가 있다 — `draft-2020-12` · `draft-7` · `draft-4` · `openapi-3.0`, 외부 `$ref` 는 가져오지 않고 예외 (`zod/v4/classic/from-json-schema.js:106-108`), 타입 주석이 「semi-experimental」 이라 적는다. `ajv@6` · `js-yaml@3` 은 다른 패키지를 통해 들어온 것이다. OpenAPI 를 읽는 코드는 없다.
- **F11 — 행 상한.** 작성 행 1,000 (`types.ts:1596` `CATALOG_COLLECTION_ROW_LIMIT`), 로컬 실행 1 만 (`serialize.ts:48` `VIEW_LOCAL_LOAD_CAP`).
- **F12 — contract 68** (`types.ts:169` — 2026-11-17 ADR-312 로 69, 이 ADR 은 70). entry 의 허용 키가 고정이라 (F1) 필드 추가는 contract 를 올린다.

### 선행 결정

유지하는 것:

- [ADR-286](286-catalog-single-source-data-site-settings.md) — 데이터 정의는 문서 entry, 편집은 `applyDataChange` → sink → 문서 명령 한 step.
- [ADR-152](152-data-panel-collection-binding-integration.md) — 필드의 안정 참조 `id`. 이름 (`key`) 변경이 참조를 깨지 않는다.
- 사용자 결정 2026-10-29 「공통 타입으로 맞춰」 — 필드 타입은 변수와 같은 집합, 날짜는 `date` 하나, 이메일 · URL · 이미지는 `string` 의 `format`.
- [ADR-309](309-date-value-authoring.md) — 날짜 값은 ISO 글자, 읽는 함수는 하나.
- [ADR-284](284-data-view-filter-sort-group-query.md) — 보기 조건의 서버 직렬화, 평가기 하나.
- [ADR-218](218-collection-runtime-data-persistence-execution-policy.md) — API 결과 캐시와 지문 (`sourceRev` 에 schema 포함).
- [ADR-212](212-data-panel-editor-redesign.md) · [288](288-data-panel-single-surface-column-popover-variable-table.md) — 생성 방법 목록 · 가져오기 계획 · 열 편집 팝오버.
- 메모리 `project-builder-data-rows-are-design-samples` — Builder 의 데이터 행은 디자인 표본이다.

바꾸는 것:

- ADR-212 의 「붙여넣기 · 파일의 값은 파싱한 그대로」 → 모든 진입이 같은 변환기를 지난다.
- ADR-212 의 「기존 표로 가져오기는 모든 셀을 글자로 바꿔 대상 타입으로 강제」 → 원본 종류를 따른다 (JSON 원본은 JSON 규칙 — Decision 4). 달라지는 값은 [breakdown §2.3](../design/313-external-data-intake-standard-breakdown.md) 의 전후 표가 전부다.
- `responseMapping.fieldMappings` (F7) → 삭제 (읽는 코드 0).

### 레퍼런스 (2026-11-16)

| 원천                                      | 사실                                                                                                                                                                                             | 확인 방법                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| JSON Schema Draft 2020-12                 | 스키마는 객체 · boolean, 행은 `type: "object"` + `properties`, 필수는 객체의 `required` 배열. `format` 은 기본이 주석이고 검사는 별도 vocabulary. `date-time` 을 검사하면 RFC 3339 (offset 필수) | 검색 — 여러 구현 문서가 같은 서술                  |
| OpenAPI 3.1 · 3.0                         | 3.1 의 스키마 객체는 JSON Schema 2020-12, 3.0 은 `nullable` 을 쓰는 부분집합. Spring 은 springdoc 이 `/v3/api-docs` 로 낸다                                                                      | 표준 서술 — Phase 0 에서 실제 문서 표본으로 재확인 |
| Spring Boot · Jackson                     | Boot 는 날짜를 timestamp 로 쓰는 기능을 기본으로 끈다 → `LocalDateTime` 은 offset 없는 ISO 글자. 설정에 따라 epoch 밀리초 · 배열도 나온다                                                        | 검색 — 버전별 기본값은 Phase 0 표본으로 재확인     |
| `JSON.parse` 원문 접근 (`context.source`) | Chrome 114 · Firefox 135 지원. Safari 는 이 세션에서 확인하지 못했다                                                                                                                             | 검색 — 기능 감지 + 대체 경로 전제                  |
| zod `fromJSONSchema`                      | F10                                                                                                                                                                                              | 설치본 소스                                        |

- 로우코드 도구의 공통 방식은 「표본 응답에서 열 타입을 추정하고 사용자가 열마다 고친다」 이다. 열 타입을 바꾸는 단계가 원본 표현 (날짜 형식 · 참 값) 을 받는 예는 Power Query 의 타입 변환 · Grafana 의 「Convert field type」 이다. 이 문장은 일반 지식 서술이고 제품 문서를 이 세션에서 다시 읽지 않았다 — 결정의 근거는 위 표와 코드 사실이다.

### Hard constraints

- **HC1 네트워크 0.** 스키마 가져오기 · 감지 · 변환 · 검증 · 내보내기는 네트워크 통신 없이 동작한다 (사용자 2026-11-16). 그 모듈은 `fetch` · XHR · WebSocket · 원격 `import` 를 부르지 않고 외부 `$ref` 를 받아 오지 않는다. API 실행 자체 (「From API」 · 조회) 는 이 제약의 대상이 아니다.
- **HC2 문서 변환 코드 없음.** entry 형이 바뀌는 Phase 에서 `LIBRARY_CONTRACT_VERSION` 을 다음 번호로 한 번 올리고 이전 번호의 문서는 열리지 않는다 (메모리 `feedback-no-document-migration-code-dev-stage`).
- **HC3 번들 상한.** Builder 1,435,351 B · Preview 327,000 B (gzip, ADR-201, 만료 2026-12-25). 스키마 가져오기 · 감지 UI 는 생성 창을 열 때 읽는 lazy chunk 다. 변환기는 Preview · Publish 의 조회 경로에 있으므로 세션 chunk 에 든다.
- **HC4 변환기 하나.** 행이 들어오는 길 넷 (F4) 과 서버로 나가는 길이 같은 모듈을 지난다. 같은 원본 종류 (JSON · 글자) 와 같은 스키마는 어느 길에서나 같은 행이 된다.
- **HC5 JSON 값은 선언 없이 바꾸지 않는다.** JSON 원본에서 값 표현을 선언하지 않은 필드의 값은 이 ADR 전후가 같다 — (a) 의 JSON · (c) · (d). 예외는 안전 범위 밖 정수 literal 의 보존 (F5) 하나다. 이 ADR 로 값이 달라지는 경우는 breakdown §2.3 의 전후 표에 적은 것이 전부다 — (b) 의 JSON 원본, 글자 원본의 0 으로 시작하는 숫자 글자 · 타입이 섞인 열 · 탭 표의 큰 정수.
- **HC6 진입 비용.** 변환이 필요 없는 행은 새 객체를 만들지 않는다 (행 배열 · 행 객체의 identity 유지 — 계산 필드 · 보기 캐시가 원본 행 배열을 키로 쓴다, [data-interaction.md](../../../.claude/rules/data-interaction.md) §4). 1 만 행 × 20 열의 진입 시간은 Phase 0 기준선과 전후 비교한다.
- **HC7 왕복 = 서버가 같은 값으로 읽는 표현.** 선언으로 읽은 값을 되돌리면 같은 JSON 타입 · 같은 값의 표현이 나간다. 글자 단위로 같은 원문은 보장하지 않는다 — 숫자 글자의 소수 자릿수와 앞의 0, 날짜 배열의 길이, 표현의 정밀도 아래 자리 (epoch 초의 밀리초). 값을 잃는 읽기는 하지 않는다 — 수로 정확히 옮길 수 없는 숫자 글자는 읽기 실패다.

### Soft constraints

- 사용자는 비개발자다 — 「이 열은 Y/N 으로 온다」 를 고르는 수준이어야 하고 형식 문자열을 쓰게 하지 않는다.
- 고객은 대량 데이터를 정렬 · 필터 · 차트로 조회한다. 타입이 틀리면 정렬이 글자 순이 되고 필터가 맞지 않는다.
- 개발 단계다.

## Alternatives Considered

### 대안 A: 저장 형식을 JSON Schema 로

- 설명: `CollectionEntry.schema` 를 JSON Schema 객체로 바꾸고 Composition 고유 정보는 `x-` 확장으로 싣는다.
- 근거: 외부 도구와 스키마를 그대로 주고받는다.
- 위험:
  - 기술: **HIGH** — 저장할 정보의 절반이 표준 밖이다: 열 순서 (`properties` 는 순서에 뜻이 없고 JS 는 정수형 이름을 재배열한다) · 안정 id · key 필드 · `reference` · `formula`. offset 없는 일시 (F9) 는 `date-time` 검사에서 탈락한다. 읽는 코드 59 파일 (F1).
  - 성능: LOW.
  - 유지보수: MEDIUM — 확장이 많은 방언이 된다.
  - 마이그레이션: **HIGH** — 모든 스키마 소비자와 저장 형식을 함께 바꾼다.

### 대안 B: 감지기만 보강

- 설명: 저장과 진입 경로는 그대로 두고 `detectColumns` 가 Y/N · 숫자 글자 · epoch 를 알아보게 한다.
- 근거: 변경이 가장 작고 contract 를 올리지 않는다.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: **HIGH** — 길마다 다른 값 (F4) · 서버로 나가는 값 (F8) · 큰 정수 (F5) · 스키마 선언을 못 읽음 (F2) 이 남는다. 타입을 `boolean` 으로 잡아도 API 응답은 여전히 `"Y"` 로 저장된다 (c · d 는 변환하지 않는다).
  - 마이그레이션: LOW.

### 대안 C: endpoint 단위 변환 규칙

- 설명: `responseMapping.normalize` 에 열마다 변환을 적는다 (같은 날 대화의 첫 안).
- 근거: 「이 API 는 이렇게 준다」 가 API 설정에 모인다.
- 위험:
  - 기술: MEDIUM.
  - 성능: LOW.
  - 유지보수: **HIGH** — 붙여넣기 · 파일에는 endpoint 가 없어 규칙의 자리가 둘이 된다. 한 collection 을 채우는 endpoint 가 여럿이면 규칙이 중복된다. 서버로 나가는 값 (F8) 은 collection schema 를 읽으므로 되돌릴 표현을 endpoint 에서 거꾸로 찾아야 한다.
  - 마이그레이션: MEDIUM.

### 대안 D: 필드의 값 표현 선언 + 진입 변환 한 곳 + 스키마 가져오기

- 설명: 저장 형식은 `DataField[]` 를 유지한다. 필드에 「원본이 이 값을 어떻게 표현하는가」 를 선언하고, 모든 진입이 같은 변환기로 저장 값을 만들고, 나가는 값은 같은 선언으로 되돌린다. JSON Schema 는 입구 (가져오기) 와 출구 (내보내기) 에 둔다.
- 근거: 저장 값은 한 벌 (정렬 · 필터 · 차트가 같은 타입을 읽는다) 이고 표준은 교환 지점에만 있다.
- 위험:
  - 기술: MEDIUM — 큰 정수 보존 파싱과 나가는 길의 전수 연결.
  - 성능: MEDIUM — 조회 경로에 변환이 든다 (HC6).
  - 유지보수: LOW.
  - 마이그레이션: MEDIUM — contract 를 한 번 올린다.

### Risk Threshold Check

| 대안 | 기술     | 성능   | 유지보수 | 마이그레이션 | HIGH 이상 |
| ---- | -------- | ------ | -------- | ------------ | :-------: |
| A    | **HIGH** | LOW    | MEDIUM   | **HIGH**     |     2     |
| B    | LOW      | LOW    | **HIGH** | LOW          |     1     |
| C    | MEDIUM   | LOW    | **HIGH** | MEDIUM       |     1     |
| D    | MEDIUM   | MEDIUM | LOW      | MEDIUM       |     0     |

HIGH 가 없는 대안 (D) 이 있어 루프를 더 돌지 않는다. CRITICAL 없음.

## Decision

**대안 D** 를 채택한다. 표준은 아래 여덟 항이다.

1. **저장 형식은 그대로.** catalog 의 스키마는 `DataField[]` 다. JSON Schema 는 저장 형식이 아니라 가져오기 · 내보내기의 교환 형식이다.
2. **필드가 값 표현을 선언한다.** 필드에 `encoding` (선택) 을 둔다 — 「원본이 이 필드를 JSON 에 어떻게 싣는가」. 종류는 닫힌 목록이다: 참 · 거짓의 표기 (`"Y"`/`"N"` · `1`/`0` …) · 숫자 글자 · 날짜의 epoch 밀리초 · epoch 초 · 붙여 쓴 날짜 (`YYYYMMDD`) · 붙여 쓴 일시 (`YYYYMMDDHHmmss`) · 날짜 배열 · 큰 정수 글자. 표현이 JSON 타입으로 갈리는 종류 (epoch · 붙여 쓴 날짜) 는 그 타입을, 날짜 배열은 정밀도를 함께 적는다. 선언이 없으면 JSON 값 그대로다 (HC5). 형식 문자열은 받지 않는다.
3. **저장 값은 타입의 정규 값 한 벌.** `boolean` 은 `true` · `false`, `number` 는 숫자, `date` 는 ISO 글자 (F9 그대로 — offset 없는 일시 포함), 큰 정수 key 는 글자다. 보기 · 정렬 · 차트 · RAC 가 읽는 값은 이 한 벌이다.
4. **진입 변환은 한 곳이고 변환은 두 가지뿐이다.** 붙여넣기 · 파일 · 기존 표로 가져오기 · Builder API 실행 · Preview/Publish 조회가 같은 변환기를 지난다. 진입이 원본 종류를 알려 준다 (값을 보고 추측하지 않는다).
   - **선언된 값 표현** — JSON 원본과 글자 원본 모두에 적용한다. 되돌릴 수 있다 (5 항).
   - **글자 셀 읽기** — 글자 원본 (CSV · 탭 표 · 격자 입력 · Form 값) 에만 적용한다. 글자에는 타입이 없으므로 열 타입으로 읽는다 (지금의 `coerceCellValue`).
   - JSON 값은 타입을 갖고 온다. 선언이 없으면 바꾸지 않고, 열 타입과 다르면 그대로 두고 「타입과 다른 셀」 로 세어 값 표현 후보를 제안한다. 기존 표로 가져오기도 JSON 원본이면 이 규칙이다 (지금과 달라지는 값은 breakdown §2.3 전후 표).
   - 읽지 못한 셀 (선언과 다른 값 · 읽을 수 없는 글자) 은 `null` 로 두고 열마다 센다. JSON 원문은 큰 정수를 보존하는 파싱 하나로 읽는다.
5. **나가는 값은 같은 선언으로 되돌린다.** 보기 조건의 서버 직렬화 · Form 제출 · 목록 편집 값이 필드의 `encoding` 으로 서버가 같은 값으로 읽는 표현을 쓴다 (HC7) — 쿼리에는 그 글자, JSON body 에는 그 JSON 타입, 큰 정수는 따옴표 없는 literal. 선언 없는 필드는 저장 값 그대로 나간다 (지금과 같다).
6. **collection 이 key 필드를 선언한다.** collection 에 `keyField` (필드 id, 선택) 를 둔다. 항목 key 는 바인딩의 `fieldMap.value` → collection 의 `keyField` → 지금의 `id` · `key` · `value` → `row-N` 순이다. key 필드는 비울 수 없는 필드다.
7. **스키마 가져오기는 생성 방법 하나다.** 생성 창에 「Schema」 방법을 더한다 — OpenAPI 3.0 · 3.1 문서나 JSON Schema 를 파일 · 붙여넣기로 받아 스키마를 고르고 `DataField[]` 를 만든다. 네트워크를 쓰지 않는다 (HC1). 받지 않는 구성 (`oneOf` · `anyOf` · 외부 `$ref` …) 과 저장하지 않는 제약 (`enum` · 범위 · `pattern` …) 은 가져오기 보고에 전부 적는다 — 조용히 버리지 않는다. 표본 값이 있으면 (붙여넣기 · 파일 · API) 감지기가 타입과 값 표현의 **후보** 를 내고 미리보기에서 사용자가 정한다. 자동으로 확정하지 않는다.
8. **JSON Schema 내보내기.** collection 의 스키마를 JSON Schema 2020-12 로 낸다 (표 메뉴 — 복사 · 파일). 내보낸 스키마는 저장 값 (3 항) 을 기술한다. Composition 고유 정보는 `x-composition-*` 주석으로 싣고, 읽는 쪽이 무시해도 스키마가 성립한다.

contract 는 entry 형이 바뀌는 Phase 에서 한 번 올린다 (HC2).

위험 수용 근거: 남는 위험은 나가는 길의 누락 (R2) 과 조회 경로의 비용 (R7) 이다. 앞의 것은 출구 목록을 정적 검사로 고정하고 (G2), 뒤의 것은 「변환이 필요 없는 행은 그대로 통과」 (HC6) 를 결정적 카운트로 잰다. JSON 값은 선언 없이 바뀌지 않으므로 (HC5) API 로 채운 기존 화면의 회귀 범위는 큰 정수 보존으로 한정되고, 그 밖에 달라지는 값은 전후 표에 적어 gate 의 정답으로 쓴다. 변환이 일어난 값에는 늘 선언이 있으므로 한쪽으로만 바뀌는 값 (읽기만 되고 되돌리지 못하는 값) 이 생기지 않는다.

기각 사유:

- **A** — 표준 밖 정보가 절반이라 확장이 많은 방언이 되고, 흔한 Java 일시 값이 표준 검사에서 탈락하며, 59 파일을 고쳐도 사용자가 얻는 것 (스키마를 읽고 내보내기) 은 D 의 입구 · 출구로 같다. 외부 시스템이 Composition 의 스키마를 직접 편집해 되돌려 보내는 흐름이 생기면 다시 따진다.
- **B** — 타입을 맞게 잡아도 API 응답은 원본 글자로 저장되고 (F4 c · d) 서버로 나가는 값이 틀린다 (F8). 문제의 절반만 다룬다.
- **C** — 규칙의 자리가 둘이 되고 (endpoint 없는 진입) 되돌릴 표현을 schema 를 읽는 쪽이 찾을 수 없다.

> 구현 상세: [313-external-data-intake-standard-breakdown.md](../design/313-external-data-intake-standard-breakdown.md)

### 사용자 결정 (8건 — 8 은 확정, 나머지는 그 Phase 에 닿을 때 묻는다)

1. **실제 응답 표본.** Phase 0 의 fixture 로 쓸 고객 환경 (Oracle · Java) 의 응답과 `api-docs` 표본을 제공할 수 있는가. 없으면 Spring Boot 기본 설정을 가정해 손으로 쓴 표본을 쓰고, 그 표본은 「형식이 맞는가」 의 근거로만 쓴다 (빈도 · 분포의 근거로 쓰지 않는다).
2. **OpenAPI 에서 endpoint 정의까지 만들기.** 권고: 포함 — 경로 · 메서드 · 파라미터 · `dataPath` · 전체 수 경로를 채운 endpoint 초안을 표와 함께 만든다 (정의만 만들고 실행하지 않으므로 네트워크 0). 대안: 표만 만들고 endpoint 는 지금처럼 손으로.
3. **YAML 입력.** 권고: JSON 만 받는다 (새 의존성 0 — springdoc 의 기본 출력은 JSON). 대안: YAML 파서를 직접 의존성으로 더한다 (lazy chunk).
4. **저장하지 않는 제약.** 권고: `enum` · 범위 · `pattern` · 길이는 저장하지 않고 가져오기 보고에만 보인다 (필드에 검증 제약 축이 없고 Builder 의 행은 디자인 표본이다). 대안: 필드에 제약을 저장하고 행 입력 · 검증에 쓴다 — 범위가 커서 새 ADR 이 맞다.
5. **`int64` 의 기본 타입.** 권고: `number`. key 필드로 고른 `int64` 와 표본 값이 안전 범위를 넘는 열만 글자 (큰 정수 글자) 를 제안한다. 대안: 모든 `int64` 를 글자로.
6. **값 표현을 나중에 바꿀 때의 작성 행.** 권고: 열 타입을 바꿀 때와 같은 규칙 — 바뀌는 값은 바꾸고 못 바꾸는 값은 비운다. 대안: 작성 행은 건드리지 않는다.
7. **번들 상한.** 변환기로 Preview 가, 가져오기 UI 로 Builder 첫 화면이 상한을 넘으면 재승인 (ADR-201) 을 묻는다.
8. **선언 없는 필드에 온 타입이 다른 JSON 값 — 확정 2026-11-17: 권고안.** 권고 (Decision 4): 그대로 두고 세어 값 표현을 제안한다 — 바뀐 값에는 늘 되돌릴 선언이 있다. 대안: 지금의 가져오기처럼 열 타입으로 읽는 것을 모든 길에 적용한다 (`"Y"` 가 선언 없이도 `true`) — 손이 덜 가지만 서버로는 `true` 가 나가고, 못 읽는 값은 API 응답에서도 `null` 이 된다. (대안은 택하지 않았다.)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 진입 변환이 기존 값을 바꾼다 — `DataTableCreator.tsx:399` · `dataActions.ts:768` · `executeCollectionEndpoint.ts:119` 가 지금은 원본을 그대로 쓰고 `importPlan.ts:83-88` 은 JSON 원본도 글자로 강제한다                                                                                         |  HIGH  | G2 — JSON 원본의 선언 없는 필드가 전후 같음 (HC5) · breakdown §2.3 전후 표의 행마다 기대값 일치. 표 밖에서 달라지는 값이 나오면 실패                                             |
| R2  | 나가는 길의 누락 또는 값 손실 — `serialize.ts:149` `text` · `catalogPreviewSession.ts:950` `itemFields` · `executeCollectionEndpoint.ts:166` 의 `JSON.stringify(body)` · 조회 load 인자 가운데 하나가 정규 값을 그대로 보내거나, 읽기가 값을 근삿값으로 만든다 (숫자 글자 `"9007199254740993"`) |  HIGH  | G1 — 대조쌍 (원문이 다른 같은 값 · JSON 타입이 다른 같은 날짜 · 정밀도를 잃는 숫자 글자는 실패) · G2 — 출구 목록 정적 검사 + 표현마다 「읽고 → 보내면 같은 JSON 타입 · 같은 값」 |
| R3  | 큰 정수 보존 파싱이 글자 안의 숫자를 건드리거나 표준 파싱과 다른 값을 낸다                                                                                                                                                                                                                      |  MED   | G1 — 큰 정수가 없는 JSON 표본에서 `JSON.parse` 와 결과 동일 (차등), 글자 안 숫자 · 지수 · 음수 · 소수 경계 표본                                                                  |
| R4  | contract 올림 — 이전 문서가 열리지 않는다. ADR-312 도 한 번 올린다 (번호 경합)                                                                                                                                                                                                                  |  MED   | 올림은 한 번 · 한 Phase. 번호는 착수 시점의 다음 번호, push 전 `git fetch` 로 확인. CHANGELOG 에 Breaking                                                                        |
| R5  | OpenAPI 방언 — springdoc 3.0 · 3.1 의 차이 · `allOf` 상속 · 제네릭 래퍼 (`PageUserDto`) · 응답 포장 (`{code, message, data}`)                                                                                                                                                                   |  MED   | 받는 구성의 표를 breakdown 에 고정. 받지 않는 구성은 보고에 표시 (G4)                                                                                                            |
| R6  | 후보를 잘못 확정 — 우편번호 `"01234"` 가 숫자로, 한 글자 코드 `"Y"` 가 참 · 거짓으로                                                                                                                                                                                                            |  MED   | 후보는 제안이고 확정은 사용자. 0 으로 시작하는 숫자 글자는 숫자 후보에서 뺀다. 값이 두 종류뿐일 때만 참 · 거짓 후보                                                              |
| R7  | 조회 경로 비용 — Preview · Publish 의 매 조회에 변환이 든다                                                                                                                                                                                                                                     |  MED   | G2 — HC6 의 카운트 (새 행 객체 0) 와 1 만 행 전후 시간                                                                                                                           |
| R8  | 번들 (HC3)                                                                                                                                                                                                                                                                                      |  MED   | G4 · G5 — `adr201-bundle-gate.mjs`. 가져오기는 lazy                                                                                                                              |
| R9  | zod `fromJSONSchema` 가 「semi-experimental」 이다                                                                                                                                                                                                                                              |  LOW   | 제품 코드에 쓰지 않는다. 내보낸 스키마를 검사하는 테스트의 독립 구현으로만 쓴다                                                                                                  |

## Gates

측정 조건 (기기 · production build · revision · CPU throttle) 을 기록에 적는다. 실행하지 않은 gate 를 PASS 로 적지 않는다. 측정 설계는 [breakdown §6](../design/313-external-data-intake-standard-breakdown.md).

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                        |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| G0   | Phase 0 | 표본 fixture (응답 · OpenAPI 3.0 · 3.1) 와 열마다의 정답표 (기대 타입 · 값 표현 · 저장 값) 를 손으로 써 고정 · F4 재현 (같은 JSON 의 `"Y"` 가 길마다 다른 값 · 글자 원본의 `01234`) · F5 재현 (큰 정수 손실 — JSON 셋과 붙여넣기의 탭 표 · 쉼표 CSV. Papa 의 CSV 파일 경로는 손실 경로가 아니다) · breakdown §2.3 전후 표의 「지금」 열을 실행으로 확인 · 진입 시간과 번들 기준선. 착수 여부를 가르지 않는다                                                                                | 사실이 breakdown §3 과 다르면 breakdown 을 고친다   |
| G1   | Phase 1 | 변환기: 표현 종류마다 읽기 · 되돌리기가 정답표와 일치 (대조쌍 — `"4500000.00"` 과 `"4500000"` 은 같은 수이고 되돌리면 같은 글자 · 숫자 `20261106` 과 글자 `"20261106"` 은 선언한 JSON 타입으로 · 숫자 글자 `"9007199254740993"` 은 읽기 실패) · 원본 종류 × 선언 유무의 셀 규칙 · 큰 정수를 보존하는 body 쓰기 · 변환 불필요 입력에서 새 행 객체 0 · 큰 정수 원문 보존과 `JSON.parse` 차등 (R3) · 이전 contract 문서 거부 · entry 검증이 `encoding` · `keyField` 를 받고 모르는 종류를 거절 | 표현 종류를 줄이고 사용자 보고                      |
| G2   | Phase 2 | 같은 원본 종류 · 같은 스키마의 fixture 가 네 진입에서 같은 행 · JSON 원본의 선언 없는 필드가 전후 같음 · breakdown §2.3 전후 표의 행마다 기대값 일치 (R1) · 정적 검사: 진입 경로의 `JSON.parse` · `response.json()` 직접 호출 0 (허용 목록) 과 출구 목록 전부가 되돌리기를 지남 · 되돌린 값의 JSON 타입 (쿼리 글자 · body) (R2) · 항목 key 가 `keyField` 를 따름 · HC6 (1 만 행 × 20 열 전후, 카운트 우선)                                                                                  | 빠진 길 수리. 시간 초과는 변환을 필드 단위로 건너뜀 |
| G3   | Phase 3 | 감지: fixture 열마다 후보가 정답표와 일치 · 처음 5 행이 `null` 인 열 · 첫 행에 없는 키 · key 후보 · R6 의 반례가 후보에서 빠짐. 미리보기가 어긋난 셀 수를 보인다. 패널 정적 게이트 통과                                                                                                                                                                                                                                                                                                     | 후보 규칙 수리                                      |
| G4   | Phase 4 | 스키마 가져오기: OpenAPI 3.0 · 3.1 · JSON Schema fixture → 기대 `DataField[]` (손 정답) · 받지 않는 구성과 저장하지 않는 제약이 보고에 전부 · 정적 검사: 가져오기 모듈의 네트워크 호출 0 (HC1) · live 에서 네트워크 요청 0 (요청 기록) · 번들 Δ                                                                                                                                                                                                                                             | 구성 수리. 번들 초과는 사용자 결정 7                |
| G5   | Phase 5 | 내보낸 JSON Schema 를 독립 구현 (zod `fromJSONSchema`) 으로 읽어 정규 fixture 행이 통과하고 어긋난 행이 탈락 · live (네트워크를 끊은 상태): 스키마 가져오기 → 표본 붙여넣기 → 타입 · 표현 · key 확정 → 목록 · 표 연결 → 정렬 · 필터 → 저장 재열기 (Canvas · Preview · Publish) + 사용자 확인                                                                                                                                                                                                | 내보내기 수리                                       |

집행: `pnpm codex:preflight` 사슬의 단위 · 정적 검사 · `adr201-bundle-gate.mjs` (push 전) · 배포 workflow `deploy.yml` 의 절대 상한 (`push: main`). 새 게이트 기구를 만들지 않는다.

### Live Exercise

2026-11-21 · 실행: Claude — Playwright (headless Chromium, CDP 로 붙은 한 브라우저) · `pnpm dev` 5173 · 착수 HEAD `dd05b99` · CPU throttle 없음. **네트워크 차단**: 브라우저 context 의 모든 요청을 가로채 localhost 밖 (http · https · ws) 은 끊고 기록했다 — 기록된 외부 요청은 Publish 화면의 Google Fonts CSS 1 건뿐 (이 ADR 밖 · 끊긴 채 화면 정상). 표본은 `springSamples.ts` 의 OpenAPI 3.0 · Spring `Page` 응답 · Oracle CSV 와 정렬용 CSV 4 행 (`USER_ID` = `9007199254740993` · `9007199254740995` · `1001` · `12`, `USE_YN` `Y`/`N`, `JOIN_DT` `YYYYMMDD`, `ZIP_CD` `01234` 등).

| #   | 흐름                                                                                                                        | 결과                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 새 프로젝트 → Data → 새 표 → 「Schema」 → OpenAPI 3.0 붙여넣기 → `GET /api/users` · 행 위치 `content` · 열 표 → 만들기      | 열 10 · key 후보 `USER_ID` · 「Not imported」 4 · 표 `SchemaUsers` 와 API 정의 초안이 함께 생김 · 그동안 외부 요청 0                                                                              |
| 2   | 새 표 → Paste → 정렬용 CSV → 열 표에서 타입 · 값 표현 · key 확정 → 만들기 → 열 편집 팝오버에서 `JOIN_DT` 표현 변경 → Ctrl+Z | 감지 후보 (참 · 거짓 짝 · 붙여 쓴 날짜 · 큰 정수 key) 가 정답과 같음 · 격자 `9007199254740993` · `01234` · `Y` → `true` · `20261106` → `2026-11-06` · 표현 변경이 Undo 로 원래대로                |
| 3   | Canvas 에 Table · ListBox → 표 `SortUsers` 연결 → Builder Preview (비교 iframe) 와 Publish 에서 머리글 정렬 · 격자 필터     | `USER_ID` 오름차순 = `12` · `1001` · `…993` · `…995` (글자 순 아님) · 내림차순 반대 · `JOIN_DT` 시간 순 · `USE_YN` 묶임 · ListBox 항목 key = `keyField` 의 큰 정수 글자 그대로 · 격자 필터 → 1 행 |
| 4   | 새로고침 → 격자 · Canvas · Publish 다시 보기 · 격자 Export 「Copy JSON Schema」                                             | 값 그대로 (큰 정수 · `01234` · 날짜) · 스키마에 key 필수 · `x-composition-encoding` · `x-composition-key` · 콘솔 오류 0                                                                           |

하지 않은 것: OS 수준의 회선 차단 (브라우저 단위 차단으로 대신) · 사용자 자신의 화면 확인 (승격은 사용자 지시 「1-4 먼저 시작해」 로). Code 보기는 `keyField` 를 쓰지 않는다 (`Row id={item.id}` — Phase 1 결정대로).

## Consequences

### Positive

- Oracle · Java 응답의 `"Y"` · 숫자 글자 · epoch · 붙여 쓴 날짜가 어느 길로 들어와도 같은 값이 되고, 정렬 · 필터 · 차트가 맞는 타입을 읽는다.
- 필터 · 제출이 서버가 아는 표현으로 나간다.
- 백엔드가 준 `api-docs` 파일로 열 이름 · 타입 · 필수 여부를 손으로 치지 않고 만든다 — 네트워크 없이.
- PK 가 한 번 선언되면 그 표를 쓰는 모든 목록의 선택 · 편집이 같은 key 를 쓴다.
- 큰 정수 PK 가 바뀌지 않는다.
- Composition 의 스키마를 표준 형식으로 꺼낼 수 있다.

### Negative

- contract 를 올려 그전 프로젝트가 열리지 않는다.
- Preview · Publish 의 조회에 변환 단계가 든다.
- 필드에 개념이 하나 는다 (값 표현) — 열 편집 팝오버에 칸이 생긴다.
- 서버로 값을 보내는 새 길을 만들 때마다 되돌리기를 지나야 한다 (정적 검사가 막는다).
- 가져오기는 JSON Schema 의 일부만 받는다 — 받지 않는 구성은 보고로 남는다.
- 기존 표로 JSON 을 가져올 때 열 타입과 다른 값 (`"Y"` · `"42"`) 이 더는 자동으로 바뀌지 않는다 — 값 표현을 한 번 골라야 한다 (가져오기 미리보기가 후보를 낸다).
- 글자 원본에서 `01234` 가 숫자 `1234` 가 아니라 글자로 남고, 타입이 섞인 열은 열 타입 하나로 읽힌다.
- 되돌린 값은 원문과 글자 단위로 같지 않을 수 있다 (`"4500000.00"` → `"4500000"`).
- ADR-212 의 「파싱한 그대로 저장」 · 「가져오기는 글자로 강제」 가 이 ADR 로 바뀐다 — 그 문서를 읽는 사람은 이 문서를 같이 봐야 한다.

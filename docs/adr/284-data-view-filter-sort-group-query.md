# ADR-284: 데이터 보기 — 조회 · 필터 · 정렬 · 묶기 · 참조를 변수와 보기로, RAC 코드로 환원되는 저장 형식

## Status

Accepted — 2026-10-26 (사용자 `/execute-adr 284` + [reviews/284.md](reviews/284.md) Round 4 이슈 0 · pending 0 · Round 3 HIGH 1 fixed) · 사용자 결정 1 · 2 · 3 · 5 · 6 · 7 권고안 확정 (같은 날 질문 — 4 · 8 은 원래대로 ADR 밖) · Phase 0 완료

> **Phase 0 (2026-10-26)**: RED 4 (`it.fails`, `apps/builder/src/preview/catalog/__tests__/adr284DataView.test.tsx`) 가 의도한 이유로 RED — ① mock GridList 가 규칙 뒤에도 3 행 · ② Table 은 Kim · Lee · Park 으로 정렬되나 같은 데이터 GridList 는 Kim · Park · Lee · ③ 변수 쓰기 뒤 요청 `/users?gender=male` 하나 · ④ `CatalogValidationError entry.actions`. probe 6 · inventory §1b 22 파일 · 수용 집합 원본 fixture 10 (react-spectrum `338cf2e19`) · Preview initial 308,574 B gz (여유 H 11,426). 정정 2: data id (`data:collection:` · `data:field:` · `data:variable:`) 는 `referencedIds` 밖 — 바인딩은 `collection` edge 로만 색인 · `ResponseMapping.pagination.totalPath` 는 타입만 있고 소비자 0 (Phase 2 가 소비 경로를 만든다). 상세: breakdown §10.

> [보충 검토 및 반영 기록](reviews/284.md): 신입 개발자 관점의 연결 재편집 · 결과 계산 범위 · 실행 설명 · 인계 검증을 보강했다 (2026-10-26 사용자 「수정반영해」). 설계 보충이며 구현 완료나 Status 승격을 뜻하지 않는다.
>
> **리뷰 round 3 반영 (2026-10-26 사용자 「수정반영해」)**: H1 code view 수용 기준을 예제 7 종 전체가 아니라 **수용 집합** (예제 5 종의 데이터 흐름 · 제외 목록 명시 · 고정 revision 원본 fixture) 으로 좁혔다 (Decision 9 · G6 · R9 · breakdown §7a). M1 Table 정렬 소유 기준을 「보기에 정렬 변수가 있는 Table」 하나로 통일했다 (Decision 5 · 사용자 결정 2 · breakdown §0 · §1a). M2 파생 보기는 원본 목록의 기본 보기를 공유 보기로 **승격**한 뒤 가리킨다 — 조건 사본 금지 (Decision 1 · G4 · breakdown §5). M3 Preview 번들 여유를 phase 별로 배분하고 Preview 쪽 lazy 대안 · 상한 만료를 R10 으로 관리한다 (G4 · G7 · breakdown §8b). L1 사용자 결정 2 의 분류 표기를 고쳤다.

- 사용자 요청: `/create-adr 데이터 조회 · 필터 · 정렬 · 보기` (2026-10-26). 출발은 같은 날 「GridList 에 Users 데이터가 묶여 있고 RadioGroup (all · male · female) 으로 거르려면 어떻게 하나 · RAC 는 무엇을 주나」 → 연구 [DATA_LAYER_RAC_EXAMPLES_2026-10](../explanation/research/DATA_LAYER_RAC_EXAMPLES_2026-10.md) (예제 7 종 · 어휘 · gap · walkthrough).
- 방향을 정한 사용자 원문 (2026-10-26):
  - 「radiogroup 만 테스트한 것이고 checkbox · input · select 등 다양한 조건 조합으로 나올 수 있지 않나」 · 「adobe 제공 sample 만 봐도 filter · sort 조합이다」 — 한 컨트롤이 아니라 **조건의 조합과 정렬**이 범위.
  - 「OR 묶음 · 조인 · 집계는 범위 밖으로 해야 하는 이유가 뭐지」 → 셋을 **설계에 넣고 phase 로 나눈다** (연구 §8.3.1 — 범위 밖 근거 셋 모두 불성립).
  - 「현재 composition 빌더를 개발하는 이유도 인건비를 줄이고 프로젝트 결과물의 완성도와 유지보수를 누가 하든 일관되게 하기 위함이다」 · 「프리랜서 개발자들의 실력 문제로 휴먼 에러 급증과 유지보수 리스크를 반복했다」 — 판정 기준은 한 사람의 쉬움이 아니라 **누가 해도 같은 결과** (연구 §9.6).
  - 「나도 개발자가 아니다 … 목록형에 연동하면 보여주기 · 검색 기능 추가 · input · select 추가 — 하나의 예시일 뿐」 — **기능 이름 하나 = 빌더 동작 하나**, 진입점은 양쪽, 첫 화면 어휘는 비개발자의 것 (연구 §9.4.1).
  - 「code view 로 했을 때 그 형태가 그대로 나와야겠지」 — code view 는 **레퍼런스 예제 모양의 RAC 코드**, 전용 DSL 아님 (연구 §8.5).
- 이미 답한 확인: 「새 어휘 금지」 원칙 (2026-10-22) 은 RAC 표면이 있는 Interactions 에 닿고, 데이터 조회에는 RAC 표면이 없으므로 참조는 데이터 도구 (Airtable · Notion · SQL) 다 (연구 §8.3.1 · 사용자 승인된 §8 커밋 `8eebf6b77`).
- 선행: [ADR-152](completed/152-data-panel-collection-binding-integration.md) (`DataBindingRef` · id 기반 `fieldMap`) · [ADR-132](completed/132-usecollectiondata-useasynclist-alignment.md) (`useAsyncList` 모양의 collection 로드) · [ADR-158](completed/158-interactions-rules-capability-registry.md) (한 규칙 = 한 줄) · [ADR-214](completed/214-variables-owner-model-runtime-state.md) (변수) · [ADR-257](completed/257-table-column-tracks.md) (Table 정렬 = Preview 런타임 상태) · [ADR-280](280-interactions-rac-surface-registry-controlled-runtime.md) · [ADR-281](281-interactions-panel-vocabulary-inheritance-form-destination.md) (`!event` 값 참조 · `callEndpoint`) · [ADR-283](283-interaction-capability-target-ref-picker.md) (값 참조 `!item` · `!var` · 「값 고르기」, contract 49). 의존 방향 152 · 214 → 280 → 281 → 283 → **284**. 분리 아님 — 데이터 층의 **조회 단위 (보기)** 를 새로 두는 base 결정이고, 뒤의 code view · dnd 는 그 응용 phase 다.

## Context

### 도메인

- **문서 모델 (D1 · D2 · D3 무관)** — 조회 조건 · 정렬 · 묶기 · 참조를 어디에 어떤 모양으로 저장하고, Preview · Publish 가 어떻게 계산하는가. 시각 값 0 · 생성기 질문 해당 없음.
- **D1 접점 (읽기만)** — RAC 는 거르기 · 정렬 · 묶기를 하지 않는다 (설치 d.ts: `Sortable` 은 `useTableState.d.ts` 만, GridList · ListBox · Tree 에 정렬 prop 0). 쓰는 RAC 표면은 `Autocomplete filter` (표시 층 글자 검색 — 감쌀 수 있는 자식 Menu · ListBox · TagGroup · GridList · Table) · `useDragAndDrop` (ListBox · GridList · Tree · Table) · `useFilter` · `useCollator` · `useListData` / `useAsyncList` 의 명령과 `load({filterText, sortDescriptor, cursor})` 다. 어느 것도 바꾸지 않는다.
- **D2 접점 하나** — S2 `renderActionBar` (TableView · ListView · CardView — 선택이 있을 때 일괄 동작 막대) 는 데이터 층이 아니라 선택 UI 다. 사용자 결정 8.

### 현재 (실측 2026-10-26, main `237df0e84`)

1. **바인딩에 조건이 없다.** `DataBindingRef = { collectionId, fieldMap, key? }` (`packages/shared/src/catalog/document/types.ts:533-542`) — `key` 는 `getItem(key)` 한 항목. 거르기 · 정렬 · 묶기 필드 0. 바인딩된 컴포넌트는 RAC 동적 `items` 가 아니라 **행마다 템플릿을 반복**한다 (`runtime/domRegistry.runtime.ts:127`) · 표시 투영 상한 100 (`packages/shared/src/collections/resolveCollectionItems.ts:36`, `getFlatProjectionRows` 의 slice). 이는 원본 데이터나 조회 계산의 상한이 아니다. `catalogBoundRows` 의 `records` 경로는 전체 행을 읽는다 (`runtime/dataBinding.ts:160`).
2. **로컬 (mock) 데이터는 거를 길이 없다.** 유일한 필터 명령 `setFilterText` (`types.ts` 목록 명령 · `dispatcher.ts:570-592`) 는 `catalogPreviewSession.setFilterText` (`:1186`) 가 `loadArguments` 에 글자를 두고 `reload` 할 뿐이고, `queryEndpoint` 는 mock collection 을 거부한다 — 값만 저장되고 목록은 그대로 (사용자가 겪은 「무반응」). 서버 필터는 endpoint 가 `{{ filterText }}` 를 읽을 때만 (`:1216 serverFilterOf` · `endpointTemplateFor :1292` · `ENDPOINT_LOAD_ARGUMENTS = ["cursor", "filterText", "sortDescriptor"]` `collections/executeCollectionEndpoint.ts:18`).
3. **정렬은 Table 이 소유한다.** `sortDescriptor` 는 Preview 런타임 상태 (ADR-257 · `runtime/tableSort.ts` · `domBinding.runtime.ts:2392-2406`) — 클라이언트 `Intl.Collator`, 서버는 `{{ sortDescriptor }}` (`catalogPreviewSession.ts:1361 serverSort` · `:1408 sortTable`). 같은 데이터를 보는 GridList 는 따라가지 않는다. 변수가 바뀌어도 템플릿 endpoint 를 다시 부르지 않는다 (`loadRouted :1332` 는 데이터 수신 · 라우트 param 변경 때만, `writeState :652` 는 호출 0).
4. **표시 층 검색은 ComboBox · Select 안에만.** `CatalogAutocomplete` (`runtime/domBinding.components.tsx:188-201`) 가 `RAC.useFilter({sensitivity:"base"}).contains` 고정. GridList · ListBox · Table 을 감싸는 저작 경로 0.
5. **묶기 · 집계 · 참조 · 파생값이 없다.** 섹션은 저작 노드 한 단계 (`bindings/ListBoxSection.binding.ts`) · 필드로 묶기 0 · `{{ }}` 는 경로 접근만 (`state/template.ts:2-22`) · `DataField` 타입에 참조 없음 (`apps/builder/src/types/builder/data.types.ts:26-36 DataFieldType` · `:41 DataField`) · 집계 어휘는 Chart 표시 예산 `budgetAggregate` (sum · mean · max · min — `catalog/bindings/Chart.binding.ts:189`) 만.
6. **collection drag & drop 이 없다.** `useDragAndDrop` · `dragAndDropHooks` 는 빌더 자체 Layers 트리 (`panels/navigator/tree/TreeBase`) 에만, 문서 컴포넌트는 DropZone `onDrop*` (인자 0 — `interactions/componentInteractionSpecs.ts:150`) 만. 목록 명령 (append · update · remove · insert* · move* · removeSelectedItems) 은 있다 (`types.ts:948-1031` · `dispatcher.ts:206-360`).
7. **한 규칙 = 한 Do.** `interactionRule.types.ts:9-11` — 「조건부 실행 / 다중 actions[] 원천 제거 (ADR-158, 필요 실증 시 후속 ADR)」. kanban 의 drop 하나는 `update` + `moveBefore/After` 둘을 요구한다 (연구 §2.4) — 실증.
8. **API 조건은 두 번 적는다.** endpoint 의 `path` · `ApiParam.value` (`data.types.ts:143`) · `bodyTemplate` 에 `{{ 변수 }}` 를 손으로 (연구 §8.2-2).
9. **값 참조와 「값 고르기」 는 있다** (ADR-283, 2026-10-26) — `!event.<arg>` · `!item.<keyArg>[.field]` · `!var.<id>` (`interactions/valueRef.ts`) · 패널 `ValueField` · 변수 type object · array. 조건의 값 자리가 그대로 쓸 수 있다.
10. **바인딩 UI**: `components/property/CollectionBinding.tsx` — collection 선택 · `fieldMap` 역할 `value | children | parentId` (`:91`) · 「항목 key 는 Form 에만」 (`:203`). 필터 · 정렬 UI 0 (Column `allowsSorting` 만).
11. **walkthrough (연구 §9)** — 과제 12 × 방식 3 × 독립 walker 3: 지금 빌더는 12 과제 중 **10 불가** · 스크립트와 리서치 설계는 kanban 을 빼면 동작 수 비슷 · 리서치 설계의 조용한 실패 31 ~ 35 (설계 층 — 비교 기본값 · 묶음 위치 · 보기 공유 부작용) → 요구 9 (§9.4). 공식 예제 7 종 중 데이터가 있는 5 종 (plants · photos · kanban · ios-list · emoji) 의 데이터 흐름은 전부 「원본 state → 변수들로 filter (AND · 빈 값 통과) → `SortDescriptor` 로 sort → 같은 `items` 를 여러 컴포넌트」 (§2).

### 사용자와 인계 상황

- 기본 사용자는 비개발자를 포함한다. 목록과 컨트롤의 진입점은 동등하며, 첫 화면은 기능 이름으로 설명한다. React · RAC 지식은 사용 전제가 아니다.
- **보조 페르소나: 신입 개발자** — 배열 · 객체 · state · 이벤트의 기본은 알지만 RAC, 여러 컴포넌트의 상태 공유, API 조회 범위에 익숙하지 않은 유지보수 담당자. 다른 사람이 만든 화면을 설명 없이 열어 조건 하나를 바꾸고, 결과와 다른 목록에 미치는 영향을 확인하는 상황을 검증한다. 경력 개월 수나 특정 프레임워크 학습 여부로 전체 사용자를 제한하지 않는다.
- 성공 기준은 최초 생성뿐 아니라 **재발견 · 수정 · 해제 · 되돌리기 · 인계**다. 모델 walkthrough는 설계 가설이며 실제 신입 사용성의 실측이 아니다. 기능 live와 인간 사용성 관찰을 별도로 기록한다 (연구 §9.5 · §9.6).

### 제약

- **Hard — 스키마**: 새 entry `view` (조회 단위) + `DataBindingRef.viewId?` + `DataField` 참조 타입 + `InteractionEntry.action` 의 다중 Do (`actions[]`) 자리. `LIBRARY_CONTRACT_VERSION` 49 → 50 (`types.ts:136`). **마이그레이션 코드 0** (사용자 지시 2026-10-14) — 옛 개발용 프로젝트 거부 · 샘플 · fixture 직접 수정. **저장 형식은 phase 1 에서 조건 트리 · 묶기 · 집계 · 참조 경로 · 다중 Do 의 자리를 모두 연다** — 뒤 phase 가 형식을 바꾸지 않는 것이 phase 분할의 조건 (연구 §8.4).
- **Hard — RAC 코드로 환원**: 문서의 단위 ↔ RAC 코드의 단위 1:1 (변수 = `useState` · 규칙 = `onChange={setX}` · 조건 = `filter` 의 한 항 · 정렬 = `toSorted(collator…)` · 집계 = `reduce` · 참조 = `find` · dnd = `useDragAndDrop` 핸들러 → list 명령 · API = `useAsyncList load({filterText, sortDescriptor})`). **수용 기준: 수용 집합 (공식 예제 중 데이터 흐름이 있는 5 종의 데이터 층 — breakdown §7a) 을 빌더로 재현했을 때 code view 가 예제 원본의 해당 부분과 구조 동치** (hook · filter 항 · 배선; 스타일 · 마크업 세부 제외). tabs · ripple 은 데이터 흐름이 없어, 표시 층 Autocomplete 와 plants 의 열 보이기는 이 ADR 밖이라 비교에서 뺀다. 코드로 환원되지 않는 저장 모양 금지 (연구 §8.5).
- **Hard — 실행 동등성**: Preview 와 Publish 는 같은 공유 runtime (`catalogPreviewSession` · `catalogPreviewInteractions`) — 분기 0. 로컬 (mock) 과 API 는 **같은 조건 정의**를 쓴다 — 로컬은 Preview 가 계산, API 는 직렬화해 서버가 계산.
- **Hard — 비개발자 어휘 · 기능 하나 = 동작 하나**: 첫 화면은 「데이터 연동 · 검색 · 정렬 · 개수 · 묶기」. 변수 · 규칙 · 보기 · 조건 트리 · 직렬화는 펼치면 보이는 층. 어느 쪽 (목록 · 컨트롤) 에서 시작해도 같은 문서.
- **Hard — 조용한 실패 금지**: 틀린 저작은 그 자리에서 알린다 (walkthrough §9.3 의 10 지점이 반례 목록) — B 의 「무반응」 을 되살리지 않는다.
- **Hard — 결과 범위 명시**: 필터 · 집계 계산 범위와 표시 투영 범위를 분리한다. 전체 일치 수 · 현재 로드 수 · 표시 수를 구분하고, API 전체 수를 확인하지 못했으면 미확인으로 남긴다. 부분 결과를 전체 결과로 표시하지 않는다.
- **Hard — 자유 코드 · 수식 언어 배제**: 닫힌 어휘 (비교 방식 · 집계 함수 5 · 참조 경로). 숙련자 경로는 code view 의 1:1 자리 편집.
- **Hard — 번들**: Builder initial ≤ 1,390,000 B gz · Preview ≤ 320,000 B gz (ADR-201 재승인, 만료 2026-11-25; HEAD Builder 는 이미 초과 — ADR-283 기록). 조건 · 집계 계산기는 Preview 에 들어가므로 Preview 증분을 G 에서 잰다.
- **Soft**: 데이터 UI 는 Properties 의 바인딩 절과 Data 패널 (`panels/datatable/*`) 에, Interactions 패널 파일 상한 (ADR-158 G4) 은 다중 Do · dnd When 만 건드린다.

## Alternatives Considered

### 대안 A: 조건 · 정렬을 `DataBindingRef` 의 필드로 (`binding.filter` · `binding.sort`)

- 설명: 바인딩마다 조건 트리 · 정렬을 둔다. 새 entry 0. 로컬은 Preview 가 거르고 API 는 직렬화.
- 근거: 사례의 다수는 보기 1 : 컴포넌트 1 (photos · 과제 ① ~ ⑥).
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (plants 의 Table + GridList · kanban 의 열 3 + 머리 count · ⑦ 「결과 수」 가 같은 조건을 두 바인딩에 복제 — 조건 하나 바꾸면 둘을 고쳐야 하고 어긋나면 조용히 다른 결과. 집계 결과 (행 모양이 다름) 를 바인딩 필드로 표현할 자리가 없다) / 마이그레이션 MEDIUM (contract).
- 기각: 공유가 필요한 사례가 공식 예제 2 (plants · kanban) 와 과제 4 (⑦ ⑧ ⑩ ⑫) — 예외가 아니다. walkthrough 의 조용한 실패 중 「보기 공유」 가 한 묶음 (§9.3-4).

### 대안 B: 보기 (view) entry = 원본 + 조건 트리 + 묶기 · 집계 + 정렬, 바인딩은 보기를 가리킨다 · 기본 보기 자동 · 생성 단축 양쪽 · 직렬화 · RAC 코드 환원 (채택)

- 설명:
  1. **보기**: `ViewEntry = { source: collectionId | viewId, where: ConditionGroup, groupBy?: fieldPath[], aggregates?: {fn, field?, as}[], sort?: SortRef, name? }`. 바인딩은 `viewId` 를 가리키거나 (공유) 이름 없는 기본 보기를 자동으로 갖는다 (보기 1 : 컴포넌트 1 의 기본 사례에 UI 부담 0). 보기는 다른 보기를 원본으로 둘 수 있다 (거른 결과의 count — ⑦).
  2. **조건** = 필드 경로(들) + 비교 방식 + 값 (리터럴 · `!var` · `!event`) + 건너뛰는 값 + **적용 여부** (boolean 변수 — Checkbox 「closed 제외」). 비교 방식 목록은 필드 타입 × 값 모양으로 좁힌다: 같음 · 아님 · 포함 (`useFilter`, `sensitivity`) · 시작 · 끝 · 그 중 하나 · 하나라도 포함 · 전부 포함 · 이상 · 초과 · 이하 · 미만 · 사이 (끝 포함) · 이전 · 이후 · 상대 날짜 · 있음 · 없음. `ConditionGroup = { op: "and" | "or", items: (Condition | ConditionGroup)[] }`, 루트 기본 `and`, 자식이 전부 건너뛰면 묶음도 건너뜀.
  3. **묶기 · 집계**: `groupBy` + `aggregates` (`count` · `sum` · `mean` · `min` · `max` — Chart `budgetAggregate` 와 이름 통일) → 결과 행 `{묶음 키…, 집계 값…}` 과 결과 schema. 묶기 0 + count = 결과 수. 집계는 **파생 보기**로만 (GridList 의 보기에 넣어 목록이 깨지는 길 차단 — §9.3-4).
  4. **참조**: `DataField.type = "reference"` + `{ collectionId, keyField, as }` — 조건 · `fieldMap` · 정렬 · 묶기가 `team.name` 경로를 쓴다 (저장은 필드 id 경로, 표시는 `as` 이름).
  5. **정렬 = 변수**: `sort: { var: variableId } | { literal: SortDescriptor }`. Table `onSortChange → Set state` 가 변수를 쓰고 보기가 정렬한다 — 같은 보기를 보는 GridList 도 따라간다. 조건과 정렬은 **나눠 공유**할 수 있다 (⑩ 은 정렬만).
  6. **실행**: 로컬 데이터는 표시 투영 전 원본 전체에 조건 → 묶기 · 집계 → 정렬을 적용하고 마지막에 표시 투영한다 (`useListData.filter` 자리). 참조 경로는 해당 필드를 읽는 단계에서 해소한다. API 는 endpoint 에 **직렬화 형식** 하나 (query param 접미 가족 · body JSON) 를 두고 보기의 조건 · 정렬이 요청에 실린다 (`useAsyncList load({filterText, sortDescriptor})` 와 같은 모양). 변수 변경 → 그 보기를 읽는 endpoint 다시 부르기 (글자 입력 debounce · `signal` 취소). 형식이 못 담는 조건 (평면 param 에 `or`) 과 비교 ↔ param 대응은 **조건 저작 · 원본 변경 · 형식 변경 세 시점**에 그 자리에서 알린다. API 결과의 완전성과 개수는 Decision 3 · 6을 따른다.
  7. **저작 — 기능 하나 = 동작 하나**: 「검색 추가」 (목록 Properties 에서 필드 → 컨트롤 종류 → 캔버스 컨트롤 + 변수 + `onChange → Set state` + 조건) · 「이 컨트롤로 목록 거르기」 (컨트롤에서 → 대상 · 필드) · 「정렬 따라가기」 (Table → 변수 + 규칙 + 보기 정렬) · 「결과 수 표시」 (파생 보기 + Text) · 「묶기로 열 만들기」 (kanban — 열 보기 N + 머리 count + drop 규칙). 기본값은 컨트롤 모양 × 필드 타입 (값 고르기 컨트롤 = 같음 / 그 중 하나 · 글자 입력 = 포함 · 대소문자 무시), select · radio 항목은 필드 값에서 채우고 「전체」 가 기본, 생성 직후 비교 · 건너뜀 · 변수 이름이 한 화면에.
  8. **drag & drop**: ListBox · GridList · Tree · Table 에 `useDragAndDrop` 배선 (`getItems` 직렬화 · `acceptedDragTypes` · `shouldAcceptItemDrop` · `renderDropIndicator` 자동) · When `onReorder` · `onInsert` · `onRootDrop` · `onItemDrop` · `onDragEnd` 와 인자 (`keys` · `items` · `target.key` · `target.dropPosition` · `dropOperation` · `isInternal`) · 「놓음 (빈 자리 · 사이)」 묶은 When · **한 When 에 Do 여러 개** (`actions[]`, 순서 실행, 조건부 0) · `update` 키 기본 = 끌어온 항목 · 대상 = 원본 collection 고정.
  9. **code view**: 문서 → RAC 코드 생성기 (연구 §3 어휘표 = 생성 어휘). 1:1 자리만 양방향 (projection 편집 → 기존 명령), 자리 밖 코드는 「문서로 환원되지 않음」 표시. 수용 기준 = 수용 집합 재현 (breakdown §7a).
- 근거: 공식 예제 5 종의 공통 모양 (연구 §2 · §6) · Airtable · Notion 의 view (filter group · group by · lookup) 가 같은 단위 · walkthrough 요구 9 (§9.4) 가 전부 이 모양 안에서 닫힘.
- 위험: 기술 **MEDIUM** (로컬 계산기 — 조건 트리 · 집계 · 참조 해소 · 날짜 비교 — 를 Preview 에 새로 두고 Publish 와 동일해야 함 · 직렬화 형식의 표현 범위 판정) / 성능 **MEDIUM** (표시 상한 100과 무관하게 원본 전체를 변수 변경마다 계산 — 보기 결과 memo · 변수 의존 추적 · 원본 규모별 측정 필요 · Preview 번들 증분) / 유지보수 **MEDIUM** (보기를 지나는 명령 — 복사 · 삭제 · 필드 rename · collection 삭제 · 참조 대상 삭제 — 와 `referencedIds` 색인 · ADR-283 과 같은 전수 표) / 마이그레이션 **MEDIUM** (contract 50 · 변환 0).

### 대안 C: `setFilterText` · `sortDescriptor` 서버 경로 확장만 (로컬은 API 로 올려서)

- 설명: 조건 UI 를 endpoint param 생성기로만 두고, mock 데이터는 거를 수 없는 채로 (API 로 바꾸라고 안내).
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (저작 단계의 데이터가 mock 이라 결과를 보지 못한 채 만들고 API 로 바꿔 확인 — 조용한 실패의 온상 · 공식 예제 5 종이 전부 로컬 배열) / 마이그레이션 LOW.
- 기각: 사용자 결정 「로컬도 전부」 권고 (연구 §7-7) 와 반대 · 지금 B 의 결함 (현재 2) 을 그대로 둠.

### 대안 D: 자유 수식 · JS 식 (`filter: "u.gender === $gender"`)

- 설명: 조건 · 집계 · 참조를 식 문자열로 저장, 런타임이 평가.
- 위험: 기술 **HIGH** (평가기 · 보안 · Publish 번들에 사용자 코드) / 성능 MEDIUM / 유지보수 **HIGH** (사람마다 다른 식 — 일관성 목표 역행 · code view 로 환원 불가 · 검증 불가) / 마이그레이션 LOW.
- 기각: 사용자 원칙 (연구 §9.6 · §8.5 배제) — walkthrough 의 A 경로 (사람마다의 운영 비용) 를 되살린다.

### Risk Threshold Check

| 대안  | HIGH+ 항목                               | 판정                                   |
| ----- | ---------------------------------------- | -------------------------------------- |
| A     | 유지보수 H                               | 기각 — 조건 복제 · 집계 자리 없음      |
| **B** | 없음 (기술 M · 성능 M · 유지 M · 이관 M) | 통과                                   |
| C     | 유지보수 H                               | 기각 — 로컬 저작 불가 · 현재 결함 유지 |
| D     | 기술 H · 유지보수 H                      | 기각 — 사용자 원칙 반대 · 환원 불가    |

B 가 HIGH 0 — 추가 루프 불요. MEDIUM 넷은 Risks 와 Gates 가 관리한다.

## Decision

**대안 B 채택.**

> 구현 상세: [284-data-view-filter-sort-group-query-breakdown.md](design/284-data-view-filter-sort-group-query-breakdown.md)

1. **조회 단위는 보기 (view) entry 다.** 원본 (collection 또는 다른 보기) + 조건 트리 + 묶기 · 집계 + 정렬. 바인딩은 `viewId` 로 가리키고, 가리키지 않으면 이름 없는 기본 보기가 바인딩에 내장된다 (문서에는 같은 `ViewEntry` 모양, `name` 없음). 공유가 필요할 때만 이름을 붙여 다른 바인딩이 가리킨다. 조건과 정렬은 나눠 공유할 수 있다. 보기의 `source.viewId` 는 공유 보기만 가리킨다. 그래서 파생 보기 (결과 수 · 묶기 · 집계) 를 만들 때 원본 목록이 내장 기본 보기를 쓰면, 그 보기를 **공유 보기로 승격** (이름 자동 · 목록 바인딩은 `viewId` 로) 한 뒤 source 로 둔다. 조건을 복사한 파생 보기는 만들지 않는다 (대안 A 의 기각 사유와 같은 조용한 불일치). 승격과 파생 보기 생성은 Undo 한 번으로 함께 복원된다.
2. **조건 = 필드 경로(들) + 비교 방식 + 값 참조 + 건너뜀 + 적용 여부.** 비교 방식 어휘는 닫혀 있고 (Decision B-2) 이름에 뜻을 붙인다 (하나라도 / 전부 포함 · 사이 (끝 포함) · 미만 · 초과). 필드 타입 × 값 모양으로 목록을 좁힌다. 조건은 보기 안에서 안정 id를 가져 재편집과 실행 설명이 같은 조건을 가리킨다. 글자 비교는 `useFilter` 와 같은 `Intl.Collator` 규칙 (`sensitivity: "base"` 기본).
3. **묶기 · 집계는 파생 보기에서만**, 집계 이름은 Chart `budgetAggregate` 와 통일 (`count` · `sum` · `mean` · `min` · `max`). 결과 schema 를 보기가 내고 `fieldMap` · 템플릿 피커가 그것을 보여 준다. 「이 목록의 결과 수」는 대상 보기의 표시 투영 전 결과 행 수이며, 현재 로드 수 · 화면 표시 수와 구분한다. API 전체 수는 **같은 조회 조건에 대한 서버 total 또는 집계 결과**가 확인된 경우에만 확정한다. 그 외에는 「현재 불러온 N개 · 전체 수 미확인」으로 표시하고 미확인을 0으로 바꾸지 않는다. 선택의 `'all'`도 어떤 보기 · 조회 범위를 가리키는지 표시하며, 전체 선택 수를 로드된 키 수로 대신하지 않는다.
4. **참조 필드** (`DataField.type: "reference"`) 와 필드 id 경로. 로컬은 Preview 가 대상 collection 에서 키로 찾고 (없으면 빈 값), API 는 직렬화가 경로를 endpoint 형식 (`expand=` 류) 으로 넘기거나 대상 endpoint 를 키 목록으로 따로 부른다 — 형식은 endpoint 단위.
5. **정렬은 변수다** (`SortDescriptor` 모양의 object 변수). Table 의 `sortDescriptor` 표시와 보기 정렬이 같은 변수에 묶인다. 기준은 **보기에 정렬 변수가 있는가** 하나다. 모든 바인딩에 기본 보기가 붙으므로 「보기가 있는가」 로 가르지 않는다. 정렬 변수가 없는 Table (바인딩 없는 Table · 기본 보기에 정렬이 없는 바인딩 Table) 은 ADR-257 의 「Table 런타임 상태」 를 그대로 쓴다 — 지금 동작하는 헤더 클릭 정렬을 없애지 않는다 (사용자 결정 2).
6. **실행은 로컬 · API 가 같은 조건 정의를 쓴다.** 로컬 계산기 (원본 전체 → 조건 → 묶기 · 집계 → 정렬 → 표시 투영)는 shared runtime 에 하나, Preview · Publish 공유. 참조 경로는 해당 필드를 읽는 단계에서 해소한다. API 는 endpoint 의 직렬화 형식으로 요청을 만들고, 변수 변경이 그 보기를 읽는 endpoint 를 다시 부른다 (debounce · `signal`). 조건 · 정렬 · 원본이 바뀌면 이전 cursor · 누적 페이지 · total을 새 조회에 재사용하지 않고, 늦게 도착한 이전 조회 응답도 합치지 않는다. 서버 결과에 클라이언트 조건을 암묵적으로 다시 적용하지 않는다. API의 부분 로드 결과에 대한 로컬 집계는 부분 결과임을 유지하며 전체 집계로 대체할 수 없다. 경고는 세 시점 (조건 저작 · 원본 변경 · 형식 변경).
7. **저작은 기능 이름 하나 = 동작 하나, 진입점 양쪽.** 「검색 추가」 · 「이 컨트롤로 거르기」 · 「정렬 따라가기」 · 「결과 수 표시」 · 「묶기로 열 만들기」 가 변수 · 규칙 · 조건 · (파생) 보기를 한꺼번에 만들고, 만든 뒤 각자 보이고 고칠 수 있다. 재진입하면 기존 연결을 찾아 편집하며 **새 연결 추가와 기존 연결 변경을 구분**한다. 변수 재사용은 타입 · 소유 범위와 명시된 연결을 기준으로 하고, 이름만 같다고 재사용하거나 기존 규칙을 덮어쓰지 않는다. 공유 보기는 영향받는 사용처를 보여 주고, 「이 목록에서만 변경 · 해제」는 보기를 분리해 다른 사용처를 보존한다. 연결 해제는 선택한 연결을 제거하며 공유 변수 · 규칙 · 컨트롤을 함께 삭제하지 않는다. 생성 · 변경 · 분리 · 해제의 각 사용자 동작은 실제 바꾼 문서와 외부 데이터 상태를 포함해 **Undo 한 번으로 복원**된다. 기본값 규칙과 생성 직후 확인 화면은 Decision B-7.
8. **drag & drop 은 이벤트 → list 명령**이고, 그것을 위해 **한 When 에 Do 여러 개** (`actions[]` 순서 실행) 를 연다 — ADR-158 의 「다중 actions[] 원천 제거 (필요 실증 시 후속 ADR)」 의 후속. 조건부 실행 · debounce · DAG 는 여전히 0 (실증 없음).
9. **code view 는 레퍼런스 모양의 RAC 코드**이고 수용 기준은 **수용 집합** 재현이다 — plants (열 보이기 제외) · photos (album 조건 · drop, Autocomplete 층 제외) · kanban · ios-list · emoji (정적 조건, Autocomplete 층 제외) 의 데이터 흐름. tabs · ripple 은 데이터 흐름이 없어 제외한다. 제외 부분은 판정 스크립트의 입력 목록으로 두고, 결정 4 의 별도 ADR 이 Autocomplete 층을 열면 그 ADR 이 목록에서 뺀다. 판정 원본은 react-spectrum 고정 revision 의 파일을 저장소 fixture 로 둔다 (출처 · 라이선스 표기). 생성기는 마지막 phase 이지만 **수용 기준은 phase 1 저장 형식 설계 때부터 고정**한다.
10. **배제 유지**: 자유 코드 · 수식 언어 · 전용 DSL · 조건부 규칙 · `Virtualizer` (ADR-257 「쓰지 않는다」 — 기존 표시 투영 상한 유지) · 표시 층 Autocomplete 를 collection 에 감싸는 저작 구조 (사용자 결정 4 — 이 ADR 밖 가능).
11. **현재 값과 결과 설명은 실행 결과에서 읽는다.** 연결 상세에서 컨트롤 값 → 변수 현재 값 → 조건의 적용 · 건너뜀 → 대상 목록을 확인하고 기존 편집기로 이동한다. 로컬 행의 일치 · 불일치 · 건너뜀 설명은 실제 계산기의 판정을 사용한다. API가 반환하지 않은 행의 제외 이유는 확정하지 않고, 요청 조건 · 응답 · 로드 범위 · 오류까지만 설명한다. 진단을 위한 별도 조건 평가기나 저장 모델을 만들지 않는다.

**위험 수용 근거**: 기술 M — 계산기는 순수 함수 (문서 + 변수 + 행 → 행) 라 RAC tester 없이 단위 검증이 되고, Publish 동등성은 같은 모듈 하나를 둘이 import 하는 것으로 구조적으로 보장 (grep 게이트). 성능 M — 보기 결과는 (보기 정의 · 변수 값 · 원본과 참조 collection 버전) 키로 memo하되 **표시 상한을 계산량 상한으로 간주하지 않는다**. G4의 100행 기준과 별도로 원본 규모 · 참조 데이터 크기 · 캐시 무효화에 따른 비용을 측정하며, 실측 전 대규모 조회 성능은 UNVERIFIED다. 유지 M — 보기를 지나는 명령 전수 표 (breakdown §1a) 와 명령별 원복 RED, ADR-283 과 같은 절차. 이관 M — contract bump 는 표준 절차 (277 ~ 283).

**기각 사유**: A — 조건 복제 · 집계 자리 없음. C — 로컬 저작 불가 · 현재 결함 유지. D — 사용자 원칙 반대 · 환원 불가.

### 사용자 결정 8 건 (execute-adr 가 그 항목에 닿을 때 묻는다 — 4 결정 지점 밖)

| #   | 항목                                                                                                         | 권고                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 로컬 (mock · runtimeData) 에서 Preview 가 OR 묶음 · 집계 · 참조를 **다** 계산하는가, API 전용인가            | **전부** — mock 은 저작 단계의 데이터라 로컬이 못 하면 결과를 못 보고, API 로 바꿨을 때 같은지 확인할 길이 없다 (연구 §7-7)                                                   |
| 2   | ADR-257 Table 정렬 소유를 변수로 옮기는 범위 — 보기에 정렬 변수가 있는 Table 만인가, 바인딩된 Table 전부인가 | **정렬 변수가 있는 Table 만** — 바인딩 없는 Table 과 정렬 변수 없는 바인딩 Table 은 257 런타임 상태 그대로. 문서 모델 안의 상태 소유 이동이며 D1 · D2 · D3 소속 변경이 아니다 |
| 3   | 파생값 범위 — count · sum · mean · min · max + 결과 수 · 선택 수 · 적용 조건 수인가, 일반 식인가             | **앞쪽** — 선택 수 (`selectedKeys.size` · `'all'`) 와 적용 조건 수는 보기 · 선택의 속성으로 값 소스에 노출, 일반 식 배제 (연구 §7-3 · §8.5)                                   |
| 4   | 표시 층 Autocomplete 를 ListBox · GridList · Table · Menu · TagGroup 에 감싸는 저작 구조                     | **이 ADR 밖 (별도 ADR)** — D1 그대로지만 어느 노드가 Autocomplete 를 소유하는지가 ADR-256 부품 구조에 닿는다. 데이터 층 조건 (포함) 이 같은 결과를 주므로 급하지 않다         |
| 5   | 다중 Do 의 범위 — dnd When 에만인가, 모든 When 인가                                                          | **모든 When** — 저장 모양 하나 (`actions[]`), 패널은 「Do 추가」 한 줄. dnd 만 열면 같은 모양이 두 벌. 조건부 · 순서 외 제어는 0                                              |
| 6   | 직렬화 형식 종류 — query param 접미 가족 (json-server · PostgREST 류) 와 body JSON 둘인가                    | **둘 + 「없음 (로컬 전용)」** — 접미 규칙은 endpoint 가 표로 고르고 (`=` · `_like` · `_gte` …), 못 담는 조건은 세 시점 경고. GraphQL · OData 는 실증 뒤                       |
| 7   | code view 의 위치 — 생성기 phase 를 마지막에 두되 수용 기준은 phase 1 부터인가, 생성기도 phase 1 인가        | **수용 기준만 phase 1** — 생성기는 환원할 실행이 다 생긴 뒤 (phase 6). 다만 phase 1 의 저장 형식 리뷰는 「수용 집합이 이 형식으로 적히는가」 를 표로 확인                     |
| 8   | S2 `renderActionBar` (선택 → 일괄 동작 막대) 노출                                                            | **이 ADR 밖** — 선택 UI (D2). 선택 수 파생값 (결정 3) + capability `show` 로 같은 효과가 나므로 별도 결정                                                                     |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 로컬 계산기와 API 직렬화가 같은 조건에 다른 결과 (포함 vs `_like` 의 뜻 · 날짜 경계 · 대소문자) — mock 에서 맞고 API 에서 틀림 (`catalogPreviewSession.ts:1292 endpointTemplateFor` · `collections/executeCollectionEndpoint.ts`)                      |  HIGH  | Decision 6 — 비교 ↔ param 대응 표를 endpoint 에 보이고 (G2) · 형식이 못 담는 비교는 세 시점 경고 · G2 가 같은 fixture 를 로컬 · mock 서버 (json-server 류) 로 돌려 결과 동치 단언 · 원복 RED (경고 제거 → 불일치 fixture GREEN 으로 통과하면 RED) |
| R2  | 보기를 지나는 명령 (복사 · 삭제 · collection 삭제 · 필드 rename · 참조 대상 삭제 · detach · createComponent) 중 하나가 빠져 dangling `viewId` · 필드 id (`document/clone.ts` · `commands/structure.ts removeWithReferrers` · `graph.ts referencedIds`) |  HIGH  | breakdown §1a 전수 표 · 색인이 `viewId` · 조건의 필드 id · 참조 대상 collection id 를 모두 들음 · 명령별 테스트 + 원복 RED · ADR-283 과 같은 절차                                                                                                 |
| R3  | 보기 공유가 조건까지 따라가 뜻밖의 결과 (⑩ Table 이 걸러짐) · 집계를 목록 보기에 넣어 목록이 한 행이 됨 (walkthrough §9.3-4)                                                                                                                           |  MED   | Decision 1 (조건 · 정렬 나눠 공유) · Decision 3 (집계 = 파생 보기만, 목록 보기의 「집계 추가」 는 파생 보기 생성으로 바뀜) · 패널 「이 보기를 N 개가 봅니다」 표시 · G3 반례                                                                      |
| R4  | 변수 변경마다 조건 · 집계 재계산 + endpoint 재호출 — 글자 입력 때 요청 폭주 · Preview 프레임                                                                                                                                                           |  MED   | memo 키 (변수 값 · 원본 버전) · 글자 변수는 debounce 300 ms · 앞선 요청 `signal` 취소 · G4 측정 100 행 × 조건 5 × 변경 100 회 ≤ 16 ms/회 (로컬) · 요청 수 ≤ 변경 수                                                                               |
| R5  | contract 50 으로 사용자의 기존 개발용 프로젝트가 열리지 않음 (283 의 contract 49 와 겹침)                                                                                                                                                              |  MED   | bump 는 Phase 1 커밋에서만 · 283 G5 확인 뒤 (breakdown §2 순서) · 샘플 3 파일 · fixture 직접 수정                                                                                                                                                 |
| R6  | 다중 Do (`actions[]`) 가 ADR-158 의 「한 줄」 을 깨 패널 · dispatcher · code library vocabulary · AI 도구 전부에 닿음 (`interactionRule.types.ts` · `dispatcher.ts` · `executionVocabulary.ts` · `aiHost.ts`)                                          |  MED   | 저장은 `action` → `actions[]` 하나 (단일은 길이 1) · dispatcher 는 순서 실행 · 실패 시 중단 + report · 패널 「Do 추가」 · 전수 표 §1b · 원복 RED (dnd `onInsert` 가 `update` 만 → 카드가 열은 바뀌나 위치 안 바뀜)                                |
| R7  | 기본값 규칙 (컨트롤 모양 × 필드 타입) 이 틀린 조합을 자동으로 고름 (string 필드 + 값 고르기 컨트롤에 「포함」 → `male ⊂ female`)                                                                                                                       |  MED   | Decision 7 표 (값 고르기 = 같음 / 그 중 하나 · 글자 입력 = 포함) · 생성 직후 확인 화면에 비교 · 건너뜀 · 변수 이름 · select 항목은 필드 값에서 + 「전체」 기본 · G3 가 walkthrough §9.3 의 10 지점을 반례로                                       |
| R8  | 참조 해소 (로컬) 가 대상 collection 의 로드 순서 · 삭제된 대상 · null 키에서 빈 값 — 조건이 그 행을 조용히 뺌                                                                                                                                          |  LOW   | 「없음」 비교로 걸러낼 수 있게 · 패널에 참조 끊김 수 표시 · G3 반례 (Teams 에 없는 teamId)                                                                                                                                                        |
| R9  | code view 생성기가 저장 형식의 어떤 조합을 코드로 환원 못 함 (뒤늦게 발견)                                                                                                                                                                             |  LOW   | Decision 9 — phase 1 리뷰에 「수용 집합이 이 형식으로 적히는가」 표 · phase 6 수용 기준 · 수용 집합 안의 환원 불가 조합만 저장 형식 결함으로 phase 1 에 되돌림 (제외 목록의 부분은 되돌림 사유 아님)                                              |
| R10 | Preview 번들 여유 약 12,349 B (실측 307,651 · 상한 320,000) 를 계산기 · 직렬화 · dnd 배선이 나눠 써야 하고, 상한은 2026-11-25 에 만료 (`apps/builder/scripts/adr201-bundle-gate.mjs:30-31` · `budgetCurrent`)                                          |  MED   | breakdown §8b phase 별 배분 (착수 실측 여유 기준) · 묶기 · 집계 · 참조 계산과 dnd 배선은 그 기능을 쓰는 문서에서만 불러오는 Preview lazy chunk · 만료 뒤 상한은 ADR-201 재승인 절차 (사용자 재승인 — 실행자가 `APPROVED` 를 바꾸지 않음)          |

R1 · R2 는 G2 · G1 이 1:1 로 관리한다. 그 밖의 잔존 HIGH 위험 없음.

보충된 계약은 기존 위험의 대응에 포함한다. R1에는 부분 로드 · 전체 집계의 혼동 (G1 · G2 · G4), R3에는 재편집 · 해제가 공유 연결을 바꾸는 위험 (G3), R4에는 표시 상한을 넘는 원본 계산 비용 (G4), R10에는 Preview 번들 배분 (G1 · G2 · G4 · G5 · G7), R7에는 현재 값과 실제 결과를 이해하지 못하는 위험 (G3 · G7)을 포함한다. 아래 보충 수용 기준은 각 Gate의 일부다.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                                                                                             |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | inventory freeze (breakdown §1a 보기 · 바인딩 · 필드 참조를 읽고 쓰는 자리 전수 · §1b 규칙 `action` 소비자 전수 · 공식 예제 7 종 → 저장 형식 적기 표) · RED 4 (`it.fails`): ① mock GridList + RadioGroup 규칙 → 목록 무변경 ② Table 정렬이 같은 데이터 GridList 에 안 따라감 ③ 변수 변경 뒤 템플릿 endpoint 재호출 0 ④ kanban drop 이 `update` + `move` 둘을 못 함 · 비교 방식 × 필드 타입 × 값 모양 표 (walkthrough §4.1 + §9.4-1) · 수용 집합 원본 fixture (react-spectrum 고정 revision) · Preview initial 착수 실측 (여유 H)                                                                                       | RED 가 안 나는 항목은 결함 아님 — 표에서 내리고 사유 기록                                                |
| G1   | Phase 1 | contract 50 · `ViewEntry` (조건 트리 · 묶기 · 집계 · 정렬 · 원본 = collection \| view) · `DataBindingRef.viewId` · `DataField reference` · `actions[]` 자리 전부 · 검증 (dangling · 필드 타입 × 비교 방식 · 묶음 빈 OR) · 색인 (`viewId` · 필드 id · 참조 collection) · 명령 전수 (복사 · 삭제 · rename · detach · createComponent · swap) 테스트 + 원복 RED · 로컬 계산기 하나 (조건 트리 AND/OR · 건너뜀 · 적용 여부 · 비교 17 · 날짜 단위) Preview · Publish 가 같은 모듈 (grep 게이트) · G0 RED ① GREEN · 수용 집합 저장 형식 표 리뷰 통과 · Preview 증분 ≤ breakdown §8b 의 Phase 1 배분                          | 환원 안 되는 조합이 있으면 저장 형식을 고친다 (뒤 phase 로 미루지 않음)                                  |
| G2   | Phase 2 | 직렬화: endpoint 「형식」 (접미 가족 · body JSON · 없음) · 비교 ↔ param 대응 표 UI · 세 시점 경고 (조건 저작 · 원본 변경 · 형식 변경) · 변수 변경 → 재호출 (debounce 300 · `signal`) · 같은 fixture 를 로컬 계산기와 mock 서버 (json-server 류 하니스) 로 돌려 결과 동치 (과제 ① ② ④ ⑤ ⑥) · 못 담는 조건 (`or` 평면 param) 경고 · G0 RED ③ GREEN · 원복 RED (경고 제거 · 재호출 제거) · Preview 증분 ≤ §8b Phase 2 배분                                                                                                                                                                                                | 접미 가족이 서버마다 다르면 형식을 endpoint 의 표 (비교 → param 이름) 로 사용자가 적게                   |
| G3   | Phase 3 | 저작 UI: 「검색 추가」 (목록에서 필드 → 컨트롤 종류 → 컨트롤 + 변수 + 규칙 + 조건) · 「이 컨트롤로 거르기」 (컨트롤에서) — 둘이 같은 문서 (단언) · 기본값 표 (값 고르기 = 같음 / 그 중 하나 · 글자 = 포함) · select 항목 = 필드 값 + 「전체」 · 생성 직후 확인 화면 (비교 · 건너뜀 · 변수 이름) · 「또는 조건 추가」 · 「결과 수 표시」 = 파생 보기 · 「정렬 따라가기」 · 「이 보기를 N 개가 봅니다」 · walkthrough §9.3 의 10 지점 반례 전부 (조용한 실패 → 그 자리 안내 또는 불가능) · 정렬 변수 없는 바인딩 Table 의 헤더 클릭 → 257 런타임 정렬 유지 (반례) · ADR-163 패널 표준 정적 테스트 GREEN · G0 RED ② GREEN | 한 번 동작이 패널 표준과 충돌하면 Properties 절 안 버튼으로 (별도 패널 신설 금지)                        |
| G4   | Phase 4 | 묶기 · 집계 · 참조: `groupBy` + 5 집계 → 결과 schema · 파생 보기 바인딩 (Text count · ListBox 3 줄) · 기본 보기 승격 반례 (목록 조건 변경 → 개수가 따라감 · Undo 한 번에 승격까지 복원 · 조건 사본 0) · 0 건 묶음 처리 (사용자 결정 — 기본은 없는 줄, 「모든 값」 옵션) · 참조 필드 → `team.name` 경로 (조건 · `fieldMap` · 정렬 · 묶기) · 역방향 집계 (사용자 → 주문 수) · 「묶기로 열 만들기」 (kanban 열 N + 머리 count) · 성능 100 행 × 조건 5 × 변수 변경 100 회 ≤ 16 ms/회 · Preview initial 증분 0 (묶기 · 집계 · 참조 계산은 lazy chunk — §8b)                                                                 | 성능 초과면 보기 memo 키 세분 (조건별) · 번들 초과면 Phase 1 계산기 core 도 lazy 모듈                    |
| G5   | Phase 5 | drag & drop + 다중 Do: `useDragAndDrop` 배선 4 컴포넌트 · When 5 + 「놓음」 묶음 + 인자 6 (값 고르기) · `actions[]` 순서 실행 · 실패 중단 report · 패널 「Do 추가」 · dispatcher · vocabulary · AI 도구 · code library 전수 (§1b) · kanban 과제 ⑫ 를 「묶기로 열 만들기」 1 동작 + drop 규칙 자동 → 카드 이동 · 머리 개수 변경 (RAC tester) · G0 RED ④ GREEN · 원복 RED (`actions[1]` 무시 → 위치 안 바뀜) · Preview initial 증분 ≤ §8b Phase 5 배분 (dnd 배선 본체는 lazy chunk)                                                                                                                                      | 배선이 RAC tester 로 안정되지 않으면 Phase 5 deferred — Phase 1 ~ 4 로 ADR 종결 가능 (dnd 는 후속 phase) |
| G6   | Phase 6 | code view: 문서 → RAC 코드 생성기 (어휘 = 연구 §3 · 부록 A) · 1:1 자리 역매핑 (조건 비교 · 값 · 필드 · 변수 이름 · 정렬 열 · 핸들러 종류) → 기존 명령 · 자리 밖 코드 표시 · **수용 집합 (breakdown §7a) 을 빌더로 재현 → 생성 코드가 고정 revision 원본 fixture 의 해당 부분과 구조 동치** (hook 종류 · filter 항 수 · prop 배선 · 정렬 · dnd 핸들러; 스타일 · 마크업 · 제외 목록 제외 — 동치 판정 스크립트) · 원복 RED (역매핑 제거 → 편집이 문서에 안 닿음)                                                                                                                                                          | 수용 집합 안에서 환원 안 되는 것만 저장 형식 결함 → Phase 1 로 (R9)                                      |
| G7   | Phase 7 | Chrome MCP live (별도 dev 서버 — 사용자 5173 무관): plants 구성 (SearchField + Checkbox + TagGroup 3 + Table 정렬 + GridList 공유 + 결과 수 배지) 을 「검색 추가」 로 만들고 Preview · Publish 각 1 회 · kanban 이동 1 회 · API 전환 (mock 서버) 1 회 · code view 열어 plants 원본 fixture (§7a 비교 부분) 대조 · 번들 Builder ≤ 1,390,000 (HEAD 초과분 제외 Δ) · Preview ≤ 320,000 B gz (§8b 배분 합계 · 만료 2026-11-25 뒤면 ADR-201 재승인 값) · `pnpm docs:stale-symbols` exit 0 · 문서 (state-management §6 · data 규칙 · 158 · 257 · README · CHANGELOG · 연구 §8.4 phase 표 갱신)                               | Builder 초과 시 생성기 · 저작 UI 를 lazy 모듈로 · Preview 초과 시 §8b 의 Preview lazy chunk 범위를 넓힘  |
| G8   | 종결    | 사용자 Builder 확인 (walkthrough 과제 ① · ⑥ · ⑫ 를 사용자가 직접) → Implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 지적 수리 뒤 재확인                                                                                      |

### 보충 수용 기준 — 기존 Gate에 포함

- **G0 · G1**: 생성 연결을 다시 찾는 안정 식별과 조회 결과의 범위 · 완전성 전달을 inventory에 포함한다. 표시 상한 밖에서만 일치하는 로컬 데이터도 조회에 포함돼야 하며, 표시 투영 전 결과 행과 그 수를 검증한다. 파생 count의 검증은 G4에서 수행한다.
- **G2 · G4**: API total 유무 · cursor 페이지 · 조건 변경 · 늦은 응답에서 전체 수/로드 수를 구분한다. 부분 데이터의 집계가 전체 집계로 표시되면 실패다. G4는 원본 규모별 비용과 캐시가 무효화되는 경우를 함께 기록한다. 측정 조건과 독립 기대값은 breakdown §5를 따른다.
- **G3**: 생성 → 재진입 → 수정 → 해제 → Undo → 저장 · 재열기를 통과하고 중복 연결 · 다른 사용처 변경이 없어야 한다. 연결 상세의 현재 값 · 조건 판정은 실제 실행 결과와 일치해야 한다. API 미반환 행의 제외 이유를 추정해 표시하면 실패다.
- **G7**: 제작자의 구두 설명 없이 다른 사람이 만든 문서에서 조건 수정 · 제외 원인 확인 · 공유 영향 파악을 수행하는 인계 시나리오를 추가한다. 기능 검증과 실제 신입 관찰의 결과를 분리하며, 관찰하지 못한 사용자 사용성은 UNVERIFIED로 남긴다. 새 사용자 승인 Gate는 추가하지 않는다.

### Live Exercise

(Implemented 승격 시 기재 — G7 · G8 의 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- 로컬 · API 데이터를 같은 조건 정의로 거르고 · 정렬하고 · 묶고 · 세고 · 참조한다 — walkthrough 의 불가 10 과제가 전부 가능해진다 (연구 §9.2).
- 「검색 추가」 한 동작이 변수 · 규칙 · 조건을 만들고, 만든 것은 누가 열어도 같은 세 단위로 보인다 — 인건비 · 일관성 · 유지보수 목표 (연구 §9.6).
- 조용한 실패 10 지점이 설계로 닫힌다 (기본값 규칙 · 적용 여부 · 비교 이름 · 파생 보기 · 나눠 공유 · 세 시점 경고).
- code view 가 레퍼런스 모양의 RAC 코드라 개발자 인계 · 검토 · AI 입출력이 한 형식이고, 수용 집합 (예제 5 종의 데이터 흐름) 재현이 수용 기준이 된다.
- kanban · 일괄 삭제 같은 drop 흐름이 다중 Do 로 표현된다.

### Negative

- contract 50 — 기존 개발용 프로젝트는 열리지 않는다 (변환 0).
- 새 entry (`view`) 와 참조 필드가 명령 전수 (복사 · 삭제 · rename · detach · createComponent · swap) 를 지난다 — 보기를 보지 않는 새 명령은 dangling 을 만든다 (`referencedIds` 가 그 자리).
- ADR-158 「한 규칙 = 한 Do」 가 「한 When = Do 순서 목록」 으로 바뀐다 (조건부 · DAG 는 여전히 없음) — 패널 · dispatcher · vocabulary · AI 도구가 같이 바뀐다.
- ADR-257 의 Table 정렬 소유가 보기에 정렬 변수가 있는 Table 에서 변수로 옮겨 간다 (사용자 결정 2). 그 밖의 Table 은 257 그대로.
- Preview 번들에 조건 계산기 core 와 직렬화가 들어가고, 묶기 · 집계 · 참조 · dnd 는 그 기능을 쓰는 문서에서만 불러온다 (R10 · §8b).

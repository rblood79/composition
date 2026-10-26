# ADR-284 design breakdown — 데이터 보기 · 조건 트리 · 묶기 · 집계 · 참조 · 정렬 변수 · 직렬화 · dnd 다중 Do · code view

> 본문: [../284-data-view-filter-sort-group-query.md](../284-data-view-filter-sort-group-query.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 는 로컬 전용이라 실측 결론은 여기에 둔다. 연구: [DATA_LAYER_RAC_EXAMPLES_2026-10](../../explanation/research/DATA_LAYER_RAC_EXAMPLES_2026-10.md) (§2 예제 · §3 어휘 · §4 원형 20 · §5 gap · §8 보완 · §9 walkthrough) — §4 · §5 · §8.3 이 Phase 0 inventory 의 출발점, §7 · 본문 사용자 결정 8 이 질문 목록, §8.4 + §9.4 가 이 phase 표의 원형.

## 0. 전제 lock-in (분리 아님 — 데이터 층의 조회 단위를 새로 두는 base)

1. **base / 응용**: [ADR-152](../completed/152-data-panel-collection-binding-integration.md) (`DataBindingRef` · id 기반 `fieldMap`) · [ADR-214](../completed/214-variables-owner-model-runtime-state.md) (변수) → [ADR-280](../280-interactions-rac-surface-registry-controlled-runtime.md) → [ADR-281](../281-interactions-panel-vocabulary-inheritance-form-destination.md) (`!event` · `callEndpoint`) → [ADR-283](../283-interaction-capability-target-ref-picker.md) (`!item` · `!var` · 「값 고르기」 · contract 49) 가 base. 이 ADR 은 그 위에 **보기 (view)** 를 두는 base 결정이고, Phase 5 (dnd · 다중 Do) 와 Phase 6 (code view) 는 보기의 응용이다. 의존 방향 152 · 214 → 280 → 281 → 283 → 284.
2. **schema**: 새 entry `view` (`ViewEntry`) · `DataBindingRef.viewId?` · `DataField.type: "reference"` · `InteractionEntry.action` → `actions[]` (단일은 길이 1). `LIBRARY_CONTRACT_VERSION` 49 → 50, 변환 0. **Phase 1 에서 조건 트리 · 묶기 · 집계 · 참조 경로 · 다중 Do 의 자리를 모두 연다** — 뒤 phase 가 저장 형식을 바꾸지 않는다 (마이그레이션 코드 금지).
3. **선행 전제 reverse 검증**: 283 의 값 참조 (`!var` · `!event` · `!item`) 는 「규칙의 Value 칸」 용이었다. 조건의 값 자리가 같은 참조를 쓰면 resolver (`resolveRuleValue`) 하나를 공유한다 — 조건 평가 시점의 `env` (변수 읽기) 만 더하면 되고 283 코드는 바뀌지 않는다 (grep: `valueRef.ts` 의 `RuleValueEnv`). 257 의 Table 정렬은 **보기에 정렬 변수가 있는 Table** 에서만 변수로 옮기고 (사용자 결정 2), 정렬 변수가 없는 Table (바인딩 없음 · 기본 보기에 정렬 없음) 은 257 그대로 — 두 경로가 `sortDescriptor` 하나의 출처만 다르다. 모든 바인딩에 기본 보기가 붙으므로 「보기가 있는가」 로 가르지 않는다 (리뷰 round 3 M1).
4. **ADR-158 「한 줄」 후속**: 「다중 actions[] 원천 제거 (필요 실증 시 후속 ADR)」 의 실증 = kanban drop (`update` + `moveBefore/After`) · ios-list 일괄 삭제 뒤 선택 비우기 + 모드 복귀 (연구 §2.4 · §2.5). 이 ADR 이 그 후속이다 — 조건부 · debounce · DAG 는 여전히 열지 않는다.
5. **판독**: 사용자가 요청할 때 `/review-adr 284`.

## 1. Phase 0 — inventory · probe · RED (G0)

### 1a. 보기 · 바인딩 · 필드 참조를 읽고 쓰는 자리 (전수는 Phase 0 grep 으로 freeze — 아래는 출발점)

| 자리                            | 파일:행 (2026-10-26)                                                                                                                                                                                                                                       | 지금                                                               | Phase 1                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 스키마 — 바인딩                 | `packages/shared/src/catalog/document/types.ts:533-542` `DataBindingRef`                                                                                                                                                                                   | `collectionId` · `fieldMap` · `key?`                               | + `viewId?` (공유 보기) · 기본 보기는 바인딩 내장 `view?: ViewEntry` (이름 없음)                                                                                                                                                                                                                           |
| 스키마 — 보기                   | 없음                                                                                                                                                                                                                                                       | —                                                                  | `ViewEntry { id, name?, source: { collectionId } \| { viewId }, where: ConditionGroup, groupBy?, aggregates?, sort?: SortRef }` · `ProjectEntry.viewIds` · `source.viewId` 는 공유 보기만 — 내장 기본 보기는 승격 명령 (`promoteBindingView`: 내장 보기 → 공유 entry · 바인딩 `viewId` 로) 뒤에만 가리킨다 |
| 스키마 — 필드                   | `apps/builder/src/types/builder/data.types.ts:26-36 DataFieldType` · `:41 DataField`                                                                                                                                                                       | string · number · … · array · object                               | + `reference` + `{ collectionId, keyField, as }`                                                                                                                                                                                                                                                           |
| 스키마 — 규칙                   | `types.ts:928-1039 InteractionEntry.action` · `interactions/interactionRule.types.ts`                                                                                                                                                                      | `action` 하나                                                      | `actions: Action[]` (단일 = 길이 1) · dnd When 5 + 인자                                                                                                                                                                                                                                                    |
| 검증                            | `document/validation.ts` (`binding` 절 · `exact([...])`)                                                                                                                                                                                                   | `collectionId` · `fieldMap` · `key`                                | 보기 모양 · 필드 타입 × 비교 방식 · 묶음 빈 `or` · 참조 대상 존재 · 집계 `as` 유일 · `actions` 길이 ≥ 1                                                                                                                                                                                                    |
| 참조 색인                       | `document/graph.ts` `referencedIds` (ADR-283 이 `address()` helper 로 모든 project id 를 들게 함)                                                                                                                                                          | binding `collectionId` (data id 는 project entry 아님 — 확인 항목) | `viewId` · 보기의 `source.viewId` · 조건 · 묶기 · 정렬의 필드 id · 참조 대상 collection id — data id 가 색인 밖이면 **보기 ↔ data 삭제 검사**를 따로 둔다                                                                                                                                                  |
| 복사                            | `document/clone.ts` (바인딩 · 283 의 세 모양 재매핑)                                                                                                                                                                                                       | `collectionId` 그대로                                              | 내장 보기 통째 · 공유 `viewId` 그대로 · 변수 참조 (`!var`) 는 복사 범위에 따라 재매핑 (page 복사 시 page 변수)                                                                                                                                                                                             |
| 삭제                            | `commands/structure.ts removeWithReferrers`                                                                                                                                                                                                                | 노드 삭제 → 규칙 삭제                                              | 공유 보기 삭제 → 바인딩은 기본 보기로 (조건 유지 복사) 또는 거부 — 사용자 결정 아님, 설계: **거부 + 「N 개가 봅니다」**                                                                                                                                                                                    |
| collection 삭제                 | Data 패널 (`panels/datatable/*` · `stores/*`)                                                                                                                                                                                                              | 바인딩 dangling 처리 (확인 항목)                                   | 보기 · 참조 필드 dangling 검사 + 패널 표시                                                                                                                                                                                                                                                                 |
| 필드 rename · 삭제              | Data 패널 필드 편집 (`DataTableFieldPanel.tsx`)                                                                                                                                                                                                            | `fieldMap` 은 id 라 안전                                           | 조건 · 묶기 · 정렬 · 참조 경로도 id — 삭제 시 조건을 「끊김」 표시 (조용히 통과 금지)                                                                                                                                                                                                                      |
| detach · createComponent · swap | `commands/materialize.ts reanchorInteractions` · `components.ts rewriteAddressesThroughExtracted` · `swap.ts`                                                                                                                                              | 283 이 interaction 대상 추가                                       | 내장 보기는 노드와 함께 이동 (무변경) · 보기의 `!var` 참조는 283 과 같은 재주소                                                                                                                                                                                                                            |
| Preview 행 산출                 | `catalog/runtime/dataBinding.ts:160 catalogBoundRows` · `collections/resolveCollectionItems.ts` (상한 100)                                                                                                                                                 | 바인딩 → collection 행 → 템플릿 반복                               | **보기 계산기** (`collections/view/evaluate.ts` 신설) 가 원본 전체를 계산한 뒤 표시 투영 · 참조는 해당 필드를 읽을 때 해소                                                                                                                                                                                 |
| 서버 로드                       | `catalog/runtime/catalogPreviewSession.ts:1186 setFilterText` · `:1216 serverFilterOf` · `:1292 endpointTemplateFor` · `:1332 loadRouted` · `:1361 serverSort` · `:1408 sortTable` · `collections/executeCollectionEndpoint.ts:18 ENDPOINT_LOAD_ARGUMENTS` | `filterText` · `sortDescriptor` · `cursor` 세 인자                 | 보기 조건 · 정렬 → **직렬화** (`collections/view/serialize.ts`) → 요청 · 변수 변경 → 재호출 (`writeState :652` 뒤 보기 의존 추적) · `setFilterText` 는 유지 (ComboBox)                                                                                                                                     |
| Table 정렬                      | `runtime/tableSort.ts` · `domBinding.runtime.ts:2392-2406` · `catalogPreviewInteractions.ts:839 sortTable`                                                                                                                                                 | Preview 런타임 상태                                                | 보기에 정렬 변수가 있는 Table: `sortDescriptor` = 그 변수 (controlled) · `onSortChange` → 변수 쓰기 · 정렬 변수 없는 Table (바인딩 없음 · 기본 보기에 정렬 없음): 257 런타임 상태 그대로                                                                                                                   |
| 값 참조                         | `interactions/valueRef.ts` `resolveRuleValue` · `RuleValueEnv`                                                                                                                                                                                             | 규칙 Value 칸                                                      | 조건 값 자리가 같은 resolver — `env.readVariable` 만                                                                                                                                                                                                                                                       |
| 패널 — 바인딩                   | `apps/builder/src/builder/components/property/CollectionBinding.tsx` (`:91` 역할 · `:203` key)                                                                                                                                                             | collection · `fieldMap` · key                                      | + 「검색 · 필터」 · 「정렬」 · 「묶기 · 개수」 절 · 「이 보기를 N 개가 봅니다」 · 공유 보기 선택                                                                                                                                                                                                           |
| 패널 — 규칙                     | `panels/interactions/catalog/CatalogRuleRow.tsx` · `StateActionFields.tsx` · `ValueField.tsx`                                                                                                                                                              | Do 하나                                                            | 「Do 추가」 · dnd When 인자 (값 고르기 그룹 「놓음」)                                                                                                                                                                                                                                                      |
| 패널 — Data                     | `panels/datatable/DataTableFieldPanel.tsx` · endpoint 편집기                                                                                                                                                                                               | 필드 타입 목록 · param `{{ }}` 손 입력                             | 참조 타입 · endpoint 「형식」 + 비교 ↔ param 표 · 경고 세 시점                                                                                                                                                                                                                                             |
| 실행 어휘                       | `document/executionVocabulary.ts CATALOG_ACTION_OPCODES` · code library                                                                                                                                                                                    | 단일 opcode                                                        | `actions[]` · dnd trigger 이름                                                                                                                                                                                                                                                                             |
| AI host · 도구                  | `catalogRuntime/aiHost.ts` · `services/ai/tools/createInteractionRule.ts`                                                                                                                                                                                  | 규칙 1 Do                                                          | `actions[]` · 「검색 추가」 동작을 도구로                                                                                                                                                                                                                                                                  |
| Chart 집계                      | `catalog/bindings/Chart.binding.ts:189 budgetAggregate`                                                                                                                                                                                                    | 표시 예산 (sum · mean · max · min)                                 | 이름 공유 (`count` 추가) · 보기 집계 뒤 표시 예산 순서                                                                                                                                                                                                                                                     |
| 샘플 · fixture                  | `docs/how-to/samples/*.composition.json` 3 · `LIBRARY_CONTRACT_VERSION` 리터럴 (283 기준 ~33 파일)                                                                                                                                                         | 49                                                                 | 50 · 보기 0 개 문서도 유효                                                                                                                                                                                                                                                                                 |

### 1b. 규칙 `action` 소비자 전수 (다중 Do — Phase 0 grep)

`action.opcode` · `action.kind` 를 읽는 자리: `dispatcher.ts` (실행) · `catalogPreviewInteractions.ts` (변환) · `interactionRule.types.ts` · `executionVocabulary.ts` · `validation.ts` · `graph.ts` (참조 색인 — `action.target` · `variableId` · `collectionId` · `pageId` · `endpointId`) · `clone.ts` · `structure.ts` · `materialize.ts` · `components.ts` · `swap.ts` · `aiHost.ts` · 패널 `CatalogRuleRow.tsx` · `CatalogInheritedRuleRow.tsx` · `interactions.ts` (기본값) · 테스트 fixture. Phase 0 에서 파일 · 행을 freeze 한다.

### 1c. 공식 예제 7 종 → 저장 형식 적기 표 (G1 리뷰 입력 · R9)

| 예제          | 보기 · 조건 · 정렬 · 집계                                                                                                                  | 규칙 (변수 · Do)                                                                                  | 환원 확인 지점                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| plants        | 보기 `plants` where [name 포함 $search OR scientific 포함 $search] AND [favorite = true 적용=$favorite] AND [cycle ∈ $cycles] … sort $sort | SearchField · Checkbox · TagGroup ×3 → Set state · Table `onSortChange` → $sort · Menu → $columns | 한 조건 안 필드 OR · 적용 여부 · `Selection` ∈ · 정렬 변수 · 열 보이기 (범위 밖 — Table `columns` capability) |
| photos        | 보기 where album = $album (건너뜀 `library`) · Autocomplete (결정 4 — 밖)                                                                  | Tree 선택 → $album · drop → `update album`                                                        | 지정 키 건너뜀 · `update` 가 보기 재계산                                                                      |
| kanban        | 보기 ×3 where status = 리터럴 · 파생 보기 count ×3 (「묶기로 열 만들기」 가 생성)                                                          | `onRootDrop` · `onInsert` → [`update status`, `moveBefore/After`]                                 | 다중 Do · 묶기 → 열 N                                                                                         |
| ios-list      | 보기 원본 그대로 · 파생 선택 수                                                                                                            | Edit → [$mode toggle, `clearSelection`] · Delete → [`removeSelectedItems`, Set state ×2]          | 선택 수 파생값 · 다중 Do · `selectionMode` capability                                                         |
| emoji         | 보기 where label ≠ 시작 `regional indicator` (정적) · Autocomplete (밖)                                                                    | —                                                                                                 | 정적 조건 (값 리터럴)                                                                                         |
| tabs · ripple | 데이터 없음 — 수용 집합 밖 (§7a)                                                                                                           | —                                                                                                 | —                                                                                                             |

- 수용 집합 원본 fixture 복사 (§7a — react-spectrum 고정 revision) · Preview initial 착수 실측으로 §8b 의 여유 H 갱신.

### 1d. RED 4 (`it.fails` → Phase 뒤 `it`)

1. mock Users GridList + RadioGroup `onChange → setFilterText` (지금 가능한 유일한 경로) → 목록 무변경 (현재 2).
2. Table `allowsSorting` 정렬 뒤 같은 collection 의 GridList 순서 무변경 (현재 3).
3. endpoint 가 `{{ GENDER }}` 를 읽을 때 `GENDER` 변수 변경 → 재호출 0 (현재 3 · `writeState` 는 `loadRouted` 를 부르지 않음).
4. 규칙 하나에 `update` + `moveBefore` 를 둘 수 없음 (스키마 거부 · 현재 7).

### 1e. probe

- `useListData.filter` 가 빈 `filterText` 에도 실행 (설치본 `dist/private/data/useListData.mjs:22`) — 「전체」 처리는 조건 쪽 (건너뜀) 이 맞다.
- `Intl.Collator({sensitivity: "base"})` 의 `compare` 와 `useFilter.contains` 의 대소문자 · 악센트 동작 — 조건 「포함」 의 기준.
- data id (`DataTable.id` · `DataField.id`) 가 `referencedIds` 색인 대상인지 — 아니면 보기 ↔ data 삭제 검사를 어디에 두나.
- walkthrough §4.1 컨트롤 → 값 모양 표를 등록표 (`concepts/*.ts` 의 `args` 타입) 에서 유도할 수 있는지 — 손 표 금지.
- 생성 연결 탐색: source 컨트롤의 주소 · 상태 prop, 변수 · 규칙 · 대상 보기와 조건의 안정 id를 따라 기존 연결을 다시 찾는 경로를 freeze한다. 이름이나 패널 진입 순서로 연결을 추정하지 않는다. 수동 편집으로 경로가 끊기거나 후보가 여러 개일 때의 표시도 포함한다.
- 조회 결과 범위: 원본 행 읽기 → 보기 계산 → 표시 투영의 순서와 API의 현재 조회 · cursor · total 전달 경로를 freeze한다. `catalogBoundRows`의 `items`/`records`와 파생 보기 모두 같은 계산 결과를 소비해야 한다. `ResponseMapping.pagination.totalPath`를 읽어 같은 조회의 전체 수로 전달하는 소비 경로까지 확인한다 (설정 필드 존재만으로 지원 판정 금지).

## 2. Phase 1 — 저장 형식 · 검증 · 색인 · 명령 · 로컬 계산기 (G1)

- `types.ts`: `ViewEntry` · `ConditionGroup` · `Condition { id: string; fields: fieldPath[]; op: ComparisonOp; value?: Scalar \| RuleValueRef; skip?: Scalar \| "empty"; enabled?: RuleValueRef }` · `ComparisonOp` 17 · `Aggregate { fn, field?, as }` · `SortRef` · `DataBindingRef.viewId?` · `view?` · `DataField reference` · `actions[]` · contract 50. 조건 id는 보기 안에서 유일하고, 값 수정 · 조건 순서 변경 · AND/OR 재묶기에도 유지한다. 연결 요약은 이 id와 기존 노드 · 변수 · 규칙 · 보기 참조에서 유도하며 별도 연결 DSL을 저장하지 않는다.
- `validation.ts` · `graph.ts`: 모양 · dangling · 필드 타입 × 비교 방식 표 (`collections/view/comparison.ts` — 하나, 패널 · 검증 · 계산기 · 직렬화가 같이 읽음) · 색인.
- 명령: `clone` · `structure` · `materialize` · `components` · `swap` · Data 패널 삭제 · rename 경로 — §1a 표 · 명령별 테스트 + 원복 RED.
- 로컬 계산기 `collections/view/evaluate.ts` (순수 함수: 문서 보기 + 변수 읽기 + 행 → 행 · 결과 schema) — 조건 트리 (`and` · `or` · 건너뜀 · 적용 여부) · 비교 17 (글자 = `Intl.Collator` base · 날짜 = 날짜 단위 · 배열 = any / all) · 참조는 Phase 4 자리만 · memo 키 (보기 정의 · 변수 값 · 원본과 참조 collection 버전). `catalogBoundRows` 가 **표시용 slice 전 원본 전체**로 호출하고 계산 결과를 투영한다. Preview · Publish 같은 모듈 (grep 게이트).
- 결과 메타데이터: 보기 · 현재 조회와 함께 계산/로드 범위의 완전성, 확인된 전체 결과 수 (미확인은 값 없음), 현재 로드 수를 전달한다. 표시 수는 consumer가 투영 뒤 산출한다. 이 값들은 실행 결과이며 저작 문서에 실측값을 저장하지 않는다. 파생 보기도 원본의 완전성을 전달받아 부분 원본을 전체로 승격하지 않는다.
- 회귀 fixture: 로컬 200행 중 101~200번째만 조건에 일치 → 계산 결과 100행, 표시 상한 밖의 원본도 포함. 200행 전부 일치 → 계산 결과 200행, 표시 100행. Phase 4의 count는 각각 100 · 200이어야 한다. 기대값은 fixture의 명시한 행 id 집합으로 두고 계산기 출력에서 재생성하지 않는다.
- 다중 Do: `actions[]` 저장 · dispatcher 순서 실행 (실패 시 중단 + report) · 변환 · vocabulary · AI · 패널 「Do 추가」 — §1b 전수. 저장 모양만 Phase 1, dnd When 은 Phase 5.
- 순서: contract 50 커밋은 **283 G5 뒤** (R5).
- 번들: 조건 계산기 core (조건 트리 · 비교 · 정렬 · 표시 투영) 만 Preview initial 에 둔다 — §8b Phase 1 배분.
- 종결: G1 · RED 1 GREEN · §1c 표 리뷰 (「수용 집합 (§7a) 이 이 형식으로 적히는가」).

## 3. Phase 2 — 직렬화 · 재호출 · 경고 (G2)

- `ApiEndpoint.querySerialization?: { kind: "suffix" \| "body" \| "none"; suffixes?: Record<ComparisonOp, string> }` (기본 표 json-server 류 `=` · `_like` · `_gte` · `_lte` · `_ne` …) — `collections/view/serialize.ts` 가 보기 조건 · 정렬 → `URLSearchParams` 또는 body JSON. 건너뛰는 조건은 param 생략. 못 담는 조건 (`or` 묶음 in suffix · 비교 미대응) → `SerializationWarning[]`.
- `catalogPreviewSession`: 보기 → endpoint 의존 추적 · `writeState` 뒤 변경 변수를 읽는 보기의 endpoint 재호출 (글자 변수 debounce 300 ms · `AbortSignal` 취소 · `loadingState: "filtering"`) · `endpointTemplateFor` 가 직렬화 결과를 `{{ }}` 와 합성.
- 경고 세 시점: 조건 저작 (패널) · 바인딩 원본 변경 (collection → endpoint) · endpoint 형식 변경 — 같은 `SerializationWarning` 을 세 UI 가 표시.
- 번들: `serialize.ts` 는 Preview initial — §8b Phase 2 배분.
- 하니스: json-server 류 mock 서버로 과제 ① ② ④ ⑤ ⑥ fixture 를 로컬 계산기 결과와 대조 (G2 동치).

### 3a. 페이지 · 전체 수 · 요청 변경의 계약 (G2)

- total은 현재 보기의 조건 · 묶기 · 원본에 대응하는 서버 값일 때만 전체 수로 노출한다. 필터 전 원본 total이나 이전 요청의 total을 재사용하지 않는다. 집계 endpoint가 반환한 값도 그 집계에 대응할 때만 전체 집계로 사용한다.
- API가 전체 일치 1,000건 중 20건과 total을 반환하면 「전체 1,000개 · 불러온 20개」, total이 없으면 「불러온 20개 · 전체 수 미확인」을 표시한다. 요청 전 · 로딩 · 실패 · 정상 0건을 구분한다. 미확인을 0으로 바꾸지 않는다.
- 조건 · 정렬 · 원본 변경 시 cursor · 누적 페이지 · total을 새 조회 기준으로 초기화한다. 이전 요청을 취소하고 응답의 조회 식별도 확인하여, 취소를 무시한 늦은 응답과 이전 `loadMore`가 새 결과에 합쳐지지 않게 한다. 기존 결과를 로딩 중 유지하면 이전 조회 결과라는 상태를 함께 유지한다.
- 부분 API 응답을 로컬에서 다시 거르거나 집계해 서버 전체 결과로 표시하지 않는다. 전체 집계가 필요한 파생 보기는 서버가 수행할 수 있는 조회로 직렬화하며, 못 하면 미지원 이유를 알린다. 부분 범위의 계산을 명시적으로 제공하는 경우에는 값과 범위를 함께 전달한다.
- 하니스에는 total 있음/없음, 다음 cursor 있음, 정상 0건, 필터 변경 직전 `loadMore`, 이전 조회의 늦은 응답을 포함한다. UI 문구뿐 아니라 값 소스가 제공하는 전체/부분/미확인 상태도 검증한다.

## 4. Phase 3 — 저작 UI · 기능 하나 = 동작 하나 (G3)

- `CollectionBinding.tsx` 절 추가: 「검색 · 필터」 (조건 목록 · 「또는 조건 추가」 · 「검색 추가」 → 필드 → 컨트롤 종류 (입력 · 선택 · 다중 선택 · 체크 · 날짜 · 범위) → 캔버스 컨트롤 생성 + 변수 + `onChange → Set state` + 조건, 기본값 표 · select 항목 = 필드 값 + 「전체」) · 「정렬」 (「정렬 따라가기」 — Table 고르기 → 변수 + 규칙 + 보기 정렬) · 「묶기 · 개수」 (Phase 4) · 「이 보기를 N 개가 봅니다 — 이름 붙이기 · 나누기」.
- 컨트롤 쪽 진입 「이 컨트롤로 목록 거르기」 (Properties 의 컨트롤 절) — 같은 생성 함수 (`catalogRuntime/viewAuthoring.ts` 하나, 두 진입점이 호출 · 결과 문서 동일 단언).
- 생성 직후 확인 화면 (role `status` 안): 비교 · 건너뜀 · 변수 이름 · 「고치기」.
- walkthrough §9.3 10 지점 반례 → 각각 「그 자리 안내」 또는 「만들 수 없음」 테스트.
- 반례 (리뷰 round 3 M1): 정렬 변수 없는 바인딩 Table 에서 Column `allowsSorting` 헤더 클릭 → 257 런타임 정렬이 지금처럼 동작. 「정렬 따라가기」 뒤에는 변수가 소유하고 같은 보기를 보는 GridList 가 따라감.
- ADR-163 패널 표준 정적 테스트 · i18n 함수형 메시지 (파라미터) · 어휘: 첫 화면 「데이터 연동 · 검색 · 정렬 · 개수 · 묶기」, 펼침 「변수 · 규칙 · 보기 · 조건」.

### 4a. 생성한 연결의 재진입 · 수정 · 해제 (G3)

- 목록과 컨트롤의 두 진입점은 같은 생성/편집 함수와 연결 탐색을 사용한다. 기존 연결이 있으면 편집 대상으로 보여 주고 「새 연결 추가」를 별도로 제공한다. 패널 재진입이나 기존 연결의 수정은 새 변수 · 규칙 · 조건을 만들지 않는다. 후보가 여러 개면 대상 목록/조건을 보여 주고 선택하게 한다.
- 변수 재사용은 타입 · 소유 범위와 기존 참조를 확인한 연결만 대상으로 한다. 이름이 같다는 이유로 재사용하지 않는다. 기존 규칙과 충돌하거나 수동 편집으로 연결이 끊겼으면 해당 상태와 편집 위치를 보여 주며 임의 덮어쓰기/복구를 하지 않는다.
- 공유 보기에는 사용처를 표시하고 「공유 보기 수정」과 「이 목록에서만 수정 · 해제」를 구분한다. 후자는 기본 보기 사본으로 분리한 뒤 선택한 조건을 변경/제거한다. 다른 사용처의 변수 · 규칙 · 보기 · 컨트롤은 유지한다. 연결 해제 자체가 컨트롤 삭제나 공유 상태 삭제를 뜻하지 않으며, 남은 요소의 개별 삭제는 기존 사용처 검사 경로를 따른다.
- 생성 · 수정 · 분리 후 해제는 각각 사용자 동작 하나와 history 항목 하나로 실행한다. 기존 catalog 명령 → `workspace.execute` 경로를 사용하고, 문서 밖 저작 데이터도 바뀌면 기존 `recordExternal` 경로로 같은 Undo 단위에 포함한다. 중간 실패는 부분 연결을 남기지 않는다.
- 검증: 두 진입점에서 생성 → 저장 · 재열기 → 재진입 → 비교 변경 → 공유 보기의 이 목록만 해제 → Undo를 수행한다. 각 생성/수정도 Undo 한 번으로 이전 문서 · 외부 저작 데이터 상태가 복원되는지 별도로 확인한다. 재진입 전후 엔트리 수 · 안정 id, 다른 목록의 결과, 원래 규칙을 비교한다. 기존 변수를 재사용한 경우, 같은 이름의 다른 범위 변수, 수동 변경된 연결, 복사한 페이지에서도 확인한다.

### 4b. 연결 상세와 실행 결과 설명 (G3)

- 생성 직후뿐 아니라 재진입 시에도 「컨트롤 값 → 변수 현재 값 → 조건의 적용/건너뜀 → 대상 목록」을 확인한다. 각 항목은 기존 State · Interactions · 조건 편집으로 이동한다. 첫 화면 기능명은 유지하고 상세에서 RAC prop/이벤트 이름을 그대로 보여 준다.
- 실행 중인 세션의 현재 값과 저작 기본값을 구분한다. Preview가 실행되지 않았으면 「실행 전」을 표시하며 기본값을 실측 현재 값으로 제시하지 않는다. Preview와의 값 전달은 기존 origin 검증 메시지 경로를 사용한다.
- 로컬 행 상세는 계산기가 사용한 조건 id · 비교 입력 · 일치/불일치/건너뜀 판정과 최종 포함 여부를 읽는다. AND/OR 묶음과 비활성 조건을 포함하며 실제 판정과 다른 별도 UI 평가기를 두지 않는다. 상세를 요청한 행에 한해 판정 정보를 수집하고 평상시 전체 행 trace를 저장하지 않는다.
- API는 요청 조건 · 응답 · 로드 범위 · 오류를 보여 준다. 서버가 반환하지 않은 행의 제외 이유를 로컬 추정으로 확정하지 않는다. 확보한 행을 별도 점검하더라도 서버 제외 사유와 구분한다.
- 검증: 조건 적용 · 건너뜀 · OR 묶음 · 실행 전 · 로드 실패의 설명을 같은 실행 결과와 대조한다. API 미반환 행에는 제외 이유를 확정한 표시가 없어야 한다. 결과 수는 전체/로드/표시 수를 구분한다. 상세 판정 UI보다 연결 편집과 범위 표기를 먼저 구현하되 G3 종결 때 함께 확인한다.

## 5. Phase 4 — 묶기 · 집계 · 참조 · 성능 (G4)

- 계산기: `groupBy` + 5 집계 → 결과 행 · 결과 schema (묶음 키 필드 + `as` 필드) · 0 건 묶음 (기본 없는 줄 · 「모든 값」 옵션 = 필드 값 enum 이 있을 때) · 정렬이 집계 값으로도.
- 파생 보기: 「결과 수 표시」 (Text) · 「묶기로 목록 만들기」 (ListBox 3 줄) · 「묶기로 열 만들기」 (kanban — 열 보기 N + 머리 count + Phase 5 drop 규칙 자리).
- 기본 보기 승격 (리뷰 round 3 M2): 원본 목록이 내장 기본 보기를 쓰면 파생 보기 생성 명령이 먼저 `promoteBindingView` (내장 → 공유 entry, 이름 자동 「<목록 이름> 보기」, 바인딩 `viewId` 로) 를 실행하고 파생 보기의 `source.viewId` 로 둔다. 조건을 복사한 파생 보기는 만들지 않는다. 승격 + 생성은 한 `workspace.execute` 트랜잭션 · history 항목 하나. 이미 공유 보기면 승격 없이 가리킨다. 반례: 목록에 조건 추가 → 개수 배지가 같이 바뀜 · Undo 한 번 → 파생 보기와 승격이 함께 사라지고 목록은 내장 보기로 · 문서의 조건 개수는 생성 전후 같음 (사본 0).
- 참조: `DataField reference` 편집 UI · 경로 `as.field` · 로컬 해소 (대상 collection 키 색인 memo) · 끊김 (null · 삭제) = 빈 값 + 「없음」 비교 · 역방향 집계 (대상 쪽 「나를 가리키는 행」 count) · 직렬화 `expand=` 또는 대상 endpoint 키 목록 호출 (형식 표).
- 성능: 100 행 × 조건 5 × 변수 변경 100 회 ≤ 16 ms/회 · memo 키 세분 (조건별) 예비.
- 번들: 묶기 · 집계 · 참조 계산은 Preview lazy chunk (§8b) — Preview initial 증분 0.

### 5a. 집계 범위와 측정 조건 (G4)

- Phase 1의 200행 fixture에서 count 100/200을 표시 투영 전에 계산한다. 묶기 · sum · mean · min · max도 동일한 원본 범위를 사용한다. 참조 필드는 조건 · 묶기 · 정렬이 읽기 전에 해소하며 대상 collection 크기도 계산 비용에 포함한다.
- 「결과 수」는 대상 보기 결과의 행 수다. 예를 들어 부서별로 묶인 목록의 결과 수는 부서 행 수이고, 그 행 안의 인원 count와 구분한다. API 부분 원본에서 계산한 값은 부분 상태를 유지한다. `'all'` 선택은 대상 보기/조회 범위를 표시하며 서버 전체 수가 없으면 숫자를 추정하지 않는다.
- 기존 100행 ≤ 16 ms 기준은 작은 입력의 기준이다. 1,000행 · 10,000행과 실제 저작 샘플을 추가하고 원본/참조 행 수, 조건 수, 첫 계산, memo hit, 변수 변경, 원본/참조 변경으로 memo가 무효화된 계산의 p50/p95 · 최댓값을 기록한다. 큰 입력의 결과를 앞 100행으로 잘라 성능 통과시키지 않는다. 이 추가 규모의 측정은 적용 범위 보고이며 새로운 임의의 시간 상한을 뜻하지 않는다.
- 측정 무결성 Q1~Q5: 샘플 출처와 합성 여부를 적고 합성물은 규모 부하 검증에만 쓴다. 같은 조건에서 memo 비활성/활성 대조군과 cache miss를 포함한다. 실제 runtime 소비 경로와 계산+투영 총비용을 확인하며, 독립 기대값은 손으로 명시한 행 id/집계값을 사용한다. commit · 기기 · 브라우저 · DPR · foreground/visibilityState · warm-up/힙 상태 · 반복 수를 기록한다. UI 상세 진단 열림/닫힘 비용도 분리한다.

## 6. Phase 5 — drag & drop · 다중 Do 배선 (G5)

- `delegatedDom.runtime.ts` · `domBinding.runtime.ts`: 바인딩된 ListBox · GridList · Tree · Table 에 `useDragAndDrop` (`getItems` = `{ "composition/item": JSON(key) , "text/plain": textValue }` · `acceptedDragTypes` 같은 collection · `shouldAcceptItemDrop` 보기 조건 · `renderDropIndicator` · `onDragEnd` move 는 명령으로).
- 등록표 (`concepts/dragDrop.ts` 확장): When `onReorder` · `onInsert` · `onRootDrop` · `onItemDrop` · `onDragEnd` + 묶음 「놓음 (빈 자리 · 사이)」 · 인자 `keys` · `items` · `target.key` · `target.dropPosition` · `dropOperation` · `isInternal` → `EVENT_ARG_TYPES` · 「값 고르기」 그룹.
- 「묶기로 열 만들기」 가 drop 규칙 자동 생성 (`[update <groupField> = 열 값, moveBefore/After(target.key, keys)]`) · `update` 대상 = 원본 collection 고정 · 키 기본 = `keys`.
- RAC tester 로 kanban 과제 ⑫ · ios-list 일괄 삭제 흐름.
- 번들: `useDragAndDrop` 배선 · drop indicator 는 Preview lazy chunk (§8b) — initial 에는 「이 문서가 dnd 규칙을 갖는가」 판정만.
- 실패 시 대안: Phase 5 deferred — Phase 1 ~ 4 로 ADR 종결 가능 (다중 Do 저장 모양은 Phase 1 에 이미 있음).

## 7. Phase 6 — code view 생성기 · 수용 집합 재현 (G6)

- `packages/shared/src/codeView/` (신설): 문서 → RAC 코드 (어휘 = 연구 §3 · 부록 A) — 변수 → `useState` · 규칙 → 핸들러 · 보기 → `filter` 항 (조건 트리 → `&&` / `||` · 건너뜀 → `|| !x`) · `toSorted(collator…)` · 집계 → `reduce` / `Map` · 참조 → `find` · dnd → `useDragAndDrop({…})` · API → `useAsyncList({ load })`.
- 1:1 자리 역매핑 표 (조건 비교 · 값 · 필드 · 변수 이름 · 초기값 · 정렬 열 · 핸들러 종류 → 문서 필드 + 명령) — projection 편집 · 자리 밖 코드는 표시 · 적용 0.
- 동치 판정 스크립트 (`scripts/code-view-equivalence.mjs`): 생성 코드와 원본 fixture 의 hook 종류 · filter 항 수 · 배선 prop · 정렬 · dnd 핸들러 집합 비교 (스타일 · 마크업 제외). 입력에 §7a 제외 목록을 받아 해당 부분을 양쪽에서 뺀 뒤 비교한다.
- 수용: 수용 집합 재현 문서 (fixture) → 동치 PASS. 수용 집합 안에서 환원 안 되는 조합만 Phase 1 저장 형식 결함 (R9). 제외 목록의 부분은 되돌림 사유가 아니다.

### 7a. 수용 집합 · 제외 목록 · 원본 fixture (리뷰 round 3 H1)

| 예제     | 비교하는 부분                                                                                    | 제외 (사유)                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| plants   | SearchField · Checkbox · TagGroup ×3 → 변수 → filter 항 · Table `sortDescriptor` · GridList 공유 | 열 보이기 Menu (`columns` — 데이터 층 아님) · PlantDialog 파일 drop (DropZone — 기존 경로)         |
| photos   | Tree 선택 → album 조건 (`library` 건너뜀) · drop → `update`                                      | `Autocomplete filter` 층 (사용자 결정 4 — 별도 ADR)                                                |
| kanban   | 열 보기 ×3 · 머리 count · `onInsert` / `onRootDrop` → [`update`, `moveBefore/After`]             | —                                                                                                  |
| ios-list | `selectionMode` 변수 · 선택 수 → Delete 비활성 · 일괄 삭제 다중 Do                               | 스와이프 · 애니메이션 (표시 층)                                                                    |
| emoji    | 정적 조건 (label ≠ 시작 `regional indicator`)                                                    | `Autocomplete filter` 층 (사용자 결정 4) · `Select defaultValue` (uncontrolled — 데이터 흐름 아님) |
| tabs     | —                                                                                                | 전체 — 앱 state 없음 (`TabListStateContext`)                                                       |
| ripple   | —                                                                                                | 전체 — press 좌표의 일시 state (데이터 층 아님)                                                    |

- 제외 목록은 `scripts/code-view-equivalence.mjs` 의 입력 파일 하나에 둔다. 결정 4 의 별도 ADR 이 Autocomplete 층을 열면 그 ADR 이 이 목록에서 해당 줄을 지운다 (이 ADR 의 수용 집합은 넓히지 않는다).
- 원본 fixture: Phase 0 에서 react-spectrum 고정 revision (commit sha 기록) 의 `packages/dev/s2-docs/pages/react-aria/examples/{plants,photos}/` 와 `kanban.mdx` · `ios-list.mdx` · `emoji-picker.mdx` 의 코드 블록을 `packages/shared/src/codeView/__fixtures__/reference/` 로 복사한다. 머리에 출처 · revision · Apache-2.0 표기. 판정은 이 fixture 만 읽는다 (scratchpad clone · 네트워크 0).

## 8. Phase 7 — live · 번들 · 문서 (G7) → G8

- Chrome MCP (별도 dev 서버 · 사용자 5173 무관): plants 구성 「검색 추가」 로 · Preview · Publish 각 1 · kanban 1 · API 전환 1 · code view 대조 1.
- 문서: `.claude/rules/state-management.md` §6 (보기 · 다중 Do) · 데이터 규칙 (있으면) · ADR-158 (「한 줄」 후속 표기) · ADR-257 (정렬 소유 범위) · README · CHANGELOG · 연구 §8.4 phase 표 갱신 · `pnpm docs:stale-symbols`.
- G8: 사용자 Builder 확인 (walkthrough ① · ⑥ · ⑫) → Implemented.

### 8b. Preview 번들 배분 (리뷰 round 3 M3 · R10)

기준 실측 2026-10-26 Preview initial 307,651 B gz (283 미커밋 · README) · 상한 320,000 · 여유 H ≈ 12,349. Phase 0 에서 착수 시점 H 를 다시 재고 아래 비율을 그 H 에 적용한다.

| Phase | Preview initial 에 들어가는 것                       | 배분 (H 대비) | 그 밖 (lazy chunk — 그 기능을 쓰는 문서에서만)           |
| ----- | ---------------------------------------------------- | ------------- | -------------------------------------------------------- |
| 1     | 조건 계산기 core · `comparison.ts` · 결과 메타데이터 | ≤ 40 %        | —                                                        |
| 2     | `serialize.ts` · 재호출 의존 추적                    | ≤ 15 %        | —                                                        |
| 4     | 없음 (판정 스텁만)                                   | ≤ 5 %         | 묶기 · 집계 · 참조 해소                                  |
| 5     | dnd 규칙 유무 판정                                   | ≤ 5 %         | `useDragAndDrop` 배선 · drop indicator · 등록표 dnd 인자 |
| 예비  | —                                                    | ≥ 35 %        | —                                                        |

- lazy chunk 는 Preview · Publish 가 snapshot 을 받을 때 문서를 훑어 해당 기능이 있으면 첫 그리기 전에 불러온다. 같은 모듈을 둘이 import 하는 구조 (grep 게이트) 는 그대로다.
- 각 phase 커밋에서 `adr201-bundle-gate.mjs` 로 누적 증분을 잰다. 배분을 넘으면 그 phase 의 모듈을 lazy 로 옮기고, 그래도 넘으면 Phase 1 core 도 lazy 로 옮긴다.
- 상한 320,000 은 2026-11-25 에 만료되고 판정기의 `budgetCurrent` 가 날짜만으로 실패한다. 그 뒤 phase 는 ADR-201 재승인 절차 (사용자 재승인) 의 새 값을 쓴다. 실행자가 `APPROVED` 나 상한 상수를 바꾸지 않는다.

### 8a. 제작자 부재 상태의 인계 검증 (G7에 포함)

- 다른 사람이 만든 Users 화면을 처음 연 상황으로 과제를 구성한다. 제작자의 구두 설명 없이 성별 조건을 수정하고, 특정 행이 표시/제외된 이유를 확인하고, Table과 GridList의 공유 여부를 파악해 한 목록만 변경한 뒤 해제 · Undo한다. 검색 조건이 있는 API 전환 사례에서는 전체 수를 아는지 여부도 설명하게 한다. 목록/컨트롤 양쪽 진입점을 사용한다.
- 기대 결과는 시작 문서, 변경할 조건, 포함될 행 id와 그대로여야 할 다른 목록을 과제마다 미리 적는다. 성공 여부 · 도움 요청 횟수 · 틀린 결과를 성공으로 오인한 횟수 · 의도치 않은 다른 목록 변경 · 수정 시간 · 재시도 횟수를 기록한다. 기능 검증은 기대 결과 일치, 다른 사용처 보존, Undo 복원을 확인한다.
- **기능 live와 인간 사용성 관찰은 별도 증거**다. 자동화/모델이 과제를 수행해도 실제 신입 사용성 PASS로 기록하지 않는다. 신입 2~3명 관찰은 연구 계획이며 참여자를 확보해 관찰했을 때만 실측을 적는다. 관찰하지 못했으면 UNVERIFIED와 이유를 남긴다. 사전 근거 없는 시간 기준이나 모델 추정 성공률을 통과 조건으로 만들지 않는다.
- 신입 개발자는 보조 페르소나다. 비개발자 기본 흐름과 두 진입점의 동등성을 유지하며, 새 사용자 승인 Gate를 추가하지 않는다. 기존 G8 사용자 확인을 인간 신입 관찰과 같은 증거로 취급하지 않는다.

## 9. 사용자 결정 8 (본문 표) — 묻는 시점

| #   | 항목                                | 닿는 phase                    |
| --- | ----------------------------------- | ----------------------------- |
| 1   | 로컬 계산 범위 (전부)               | Phase 1                       |
| 2   | 257 정렬 소유 범위 (정렬 변수 기준) | Phase 1                       |
| 3   | 파생값 범위                         | Phase 4                       |
| 4   | Autocomplete 저작 구조 (밖)         | —                             |
| 5   | 다중 Do 범위 (모든 When)            | Phase 1                       |
| 6   | 직렬화 형식 종류                    | Phase 2                       |
| 7   | code view 위치                      | Phase 1 (수용 기준) · Phase 6 |
| 8   | `renderActionBar` (밖)              | —                             |

## 10. 기록

(Phase 종결 때 적는다 — 날짜 · 실측 · RED/GREEN · 원복 RED · 사후 보고 (scope inflation · sub-group).)

### Phase 0 — 2026-10-26 (main `c8a50109e`)

**RED 4** (`apps/builder/src/preview/catalog/__tests__/adr284DataView.test.tsx`, `it.fails` — `it` 으로 바꿔 돌려 실패 이유를 확인):

| #   | 실패 이유 (실측)                                                                             | GREEN 이 되는 phase |
| --- | -------------------------------------------------------------------------------------------- | ------------------- |
| ①   | mock GridList + 버튼 규칙 (`setFilterText` "female") 뒤에도 `Kim · Park · Lee` — 기대 `Park` | 1 (보기 조건)       |
| ②   | Table 은 `Kim · Lee · Park` 로 정렬되나 같은 데이터 GridList 는 `Kim · Park · Lee`           | 3 (정렬 따라가기)   |
| ③   | 변수 `gender` 를 `female` 로 쓴 뒤 요청 `/users?gender=male` 하나뿐                          | 2 (재호출)          |
| ④   | 규칙 하나에 `actions: [update, moveBefore]` → `CatalogValidationError entry.actions`         | 1 (저장) · 5 (배선) |

**probe 6**:

1. `useListData` 의 `filter` 는 `filterText` 가 빈 값이어도 모든 항목에 실행된다 (`react-stately@3.51.0 dist/private/data/useListData.mjs:22` — `filter ? state.items.filter(...) : state.items`). 「전체」 는 조건의 건너뜀이 처리한다 — 확인.
2. `useFilter` (`react-aria@3.53.1 dist/private/i18n/useFilter.mjs:15-61`) = `useCollator({ usage: "search", ...options })` · 빈 부분 문자열 = 참 · 양쪽 NFC 정규화 · `contains` 는 길이 같은 조각마다 `collator.compare === 0` (startsWith · endsWith 도 같은 비교). 조건 「포함 · 시작 · 끝」 은 같은 알고리즘을 `Intl.Collator(locale, { usage: "search", sensitivity: "base" })` 로 재현한다 — 계산기가 RAC hook 을 부르지 않는 순수 함수라서.
3. data id 는 `referencedIds` 밖이다 (`graph.ts:112-161` — `project:` 접두만). 바인딩은 `collection` edge (`graph.ts:256-260`, key = `collectionId`) 로 색인된다. 필드 id (`fieldMap` 값) 는 어디에도 색인되지 않는다. → 보기의 원본 collection 은 같은 `collection` edge 로 넣고, 필드 · 참조 대상 삭제 검사는 Data 패널 쪽 (보기를 읽어 「끊김」 표시) 에 둔다. 프로젝트 변수 (`data:variable:`) 도 색인 밖이라 page 변수 (`project:stateVariable:`) 만 `referencedIds` 로 든다 — 지금 `setState` 와 같다 (`graph.ts:150-154`).
4. 컨트롤 → 값 모양은 등록표에서 유도된다 — 개념의 `state.valueType` (`interactions/concepts/types.ts:15-26` `ValueTypeId` 10 — boolean · string · number · key · keys · strings · date · dateRange · color · sort). 손 표 없이 기본값 표 (값 고르기 = 같음 / 그 중 하나 · 글자 = 포함) 를 `valueType` 으로 고른다.
5. 생성 연결 탐색 경로 (freeze): 컨트롤 노드 → `InteractionEntry` (`ownerId` = 컨트롤 · `action.opcode: "setState"` · `variableId`) → 변수 → 보기 조건 (값 `!var.<variableId>` · 조건 id) → 그 보기를 가진 바인딩 노드. 반대 방향은 바인딩 → 보기 조건의 `!var` → 그 변수를 쓰는 `setState` 규칙의 `ownerId`. 이름 · 패널 순서로 추정하지 않는다. 후보가 여러 개 (같은 변수를 쓰는 규칙 둘) 면 목록으로 고르게 한다.
6. 조회 결과 범위: `catalogBoundRows` (`runtime/dataBinding.ts:160-260`) 의 `items` 경로는 `getFlatProjectionRows(…, limit)` 에서 표시 상한을 건다 (`:207-210`), `records` 경로는 전체 행 (`:168`). → 보기 계산은 `getFlatProjectionRows` 앞에서 바운드 collection 의 행을 계산 결과로 바꿔 넘긴다 (items · records 가 같은 계산 결과를 소비). `ResponseMapping.pagination.totalPath` (`apps/builder/src/types/builder/data.types.ts:155`) 는 **타입만 있고 읽는 곳 0** — 「API 전체 수」 는 Phase 2 가 `loadCollectionEndpoint` 에서 읽고 세션이 같은 조회의 total 로 들고 있어야 한다 (설정 칸 존재 ≠ 지원).

**inventory freeze**:

- §1b 규칙 `action` 소비자 22 파일 — shared: `document/{validation,graph,clone}.ts` · `transactions/transaction.ts:767` · `commands/{components,materialize,swap,project,instanceOverrides}.ts` · `runtime/catalogPreviewInteractions.ts` · `interactions/interactionRule.types.ts`; builder: `catalogRuntime/{interactions,aiHost,dataVariables,targetPick,targetRef}.ts` · `panels/interactions/{StateActionFields.tsx,catalog/CatalogRuleRow.tsx,catalog/CatalogInheritedRuleRow.tsx}` · `services/ai/tools/{createInteractionRule,definitions}.ts` · `i18n/translations.ts` (라벨). dispatcher · `executionVocabulary.ts` 는 변환된 규칙만 받는다 (문서 `action` 직접 읽기 0).
- §1a 바인딩 읽기 · 쓰기 31 파일 (binding 정의 파일 제외) — shared: `document/{types,validation,graph,itemLinks}.ts` · `commands/{fields,collections}.ts` · `transactions/transaction.ts` · `resolution/resolver.ts` · `runtime/{dataBinding,catalogPreviewSession,catalogPreviewInteractions,compositionRoot,delegatedDom.runtime,domBinding.runtime,domRegistry.runtime,domRegistry.components}.ts(x)` · `collections/resolveBoundCollection.ts` · `components/GridList.tsx`; builder: `catalogRuntime/{canvasScene,dataBindingCommand,dataHistory,editContract,rowTemplate}.ts` · `main/CatalogBuilderCore.tsx` · `panels/datatable/{usage/catalogQuickConnectHost,utils/quickConnectPlan}.ts` · `panels/interactions/catalog/CatalogInteractionsPanel.tsx` · `panels/properties/catalog/CatalogRowTemplateSections.tsx` · `components/property/CollectionBinding.tsx` · `stores/utils/dataChange.ts` · `services/ai/{catalog/componentCatalog,tools/bindCollection}.ts`.
- 수용 집합 원본 fixture 10 파일 — `packages/shared/src/codeView/__fixtures__/reference/` (react-spectrum `338cf2e1940e395c899e79b7ac09eb0de6b1cea7`, 2026-10-23 · 머리에 출처 · Apache-2.0 · `.txt` 라 컴파일 · 포맷 대상 아님): plants (App · PlantTable · PlantList · plants) · photos (App · Sidebar · PhotoGrid) · kanban · ios-list · emoji-picker (mdx 첫 `tsx` 블록). 공식 저장소의 `crud.mdx` 는 plants 를 보여 주는 페이지다 (예제 수 7 그대로).
- 번들 (production build `vite build` → `adr209-bundle-closure.mjs`, dirty = 문서 · 테스트 · fixture 만): **Preview initial 308,574 B gz → 여유 H = 11,426** (§8b 배분의 기준). Builder initial 1,421,341 — 상한 1,390,000 초과는 HEAD 기존 (283 기록 1,418,803 이후 product 커밋 포함), 284 는 Δ 로 잰다.

**사후 보고**: scope 변화 없음. Phase 0 은 테스트 · fixture · 문서뿐이라 CHANGELOG 면제 (테스트만).

### Phase 1 — 2026-10-26 (main `de54eefba` 위 작업 트리)

**저장 형식 (contract 50)** — `packages/shared/src/catalog/document/types.ts`: `InteractionEntry.actions: readonly InteractionAction[]` (옛 `action` 은 49 문서 거부 · 변환 0) · `DataBindingRef.viewId?` · `view?: ViewQuery` · `ViewEntry` (`kind: "view"`, 이름 필수, `source` = collection 또는 공유 보기) · `ProjectEntry.viewIds?` (없으면 보기 0) · `ViewCondition` (`id` · `fields` (필드 id 경로 — 여러 개면 하나라도) · `op` 18 · `value` (리터럴 · 목록 · `!var` 참조) · `skip` (`"empty"` 기본 · 리터럴) · `enabled` · `sensitivity` · `unit`) · `ViewConditionGroup` (`and` · `or`) · `ViewAggregate` (count · sum · mean · min · max) · `ViewSort` (변수 · 리터럴). 샘플 3 · fixture · contract 리터럴 32 파일.

**검증 · 색인 · 명령**:

- `validation.ts` — `viewQuery` (조건 id 유일 · `or` 빈 묶음 거부 · 비교 × 값 모양: 목록 3 · `between` 두 끝 · `exists` 값 없음 · `withinLast` 단위 · `enabled` boolean 또는 참조) · 내장 보기의 묶기 · 집계 거부 (`VIEW_AGGREGATE_DERIVED_ONLY` — 결정 3) · `view` 와 `viewId` 동시 거부 · `actions` 길이 ≥ 1 (`ACTIONS_REQUIRED`).
- `graph.ts` — `catalogViewRootCollection` (공유 보기의 원본 사슬 — 없음 · 순환 = `DANGLING_VIEW`) · 바인딩의 `viewId` 원본 = `collectionId` (`VIEW_COLLECTION_MISMATCH`) · `referencedIds` 에 `binding.viewId` · `source.viewId` · 모든 Do 의 page · 변수 · 대상. 필드 id 와 프로젝트 변수 (`data:`) 는 Phase 0 probe 3 대로 색인 밖 — 계산기가 「끊김」 (`broken`) 으로 낸다.
- 명령 — `commands/views.ts` 신설: `addView` · `updateView` · `removeView` (읽는 바인딩 · 보기가 있으면 `VIEW_IN_USE`) · `promoteBindingView` (내장 → 공유 · 바인딩은 `viewId` · 한 step) · `catalogViewUsers`. `document/viewRefs.ts` — 보기의 `!var` 참조 재매핑: `cloneNodeSubgraph` (subtree 의 요소 변수 사본) · `duplicatePage` (page 변수 사본). detach · createComponent · swap 은 바인딩이 노드 필드라 무변경 (내장 보기는 노드와 함께 이동).
- 다중 Do 소비자 (§1b 22 파일) — dispatcher `executeInteractionRule` 이 Do 를 순서대로, 실패한 Do 에서 멈추고 「Do N: 사유」 로 보고 · Preview 변환 `ruleOf` → `actionOf` (한 Do 라도 이 record 에서 풀리지 않으면 규칙 전체를 내지 않음 — 뒤 Do 가 앞 Do 를 전제) · components · materialize · swap · project · instanceOverrides · transaction 재검증 · clone · dataVariables · targetPick (Do 번호 · 기본 = 첫 capability Do) · targetRef · AI host (AI 도구는 Do 하나로 만든다 — 다중 Do 도구는 Phase 5 §1b) · 패널.

**로컬 계산기** — `packages/shared/src/collections/view/comparison.ts` (비교 표 하나 — 필드 종류 × 비교 · `useFilter` 와 같은 `Intl.Collator({usage:"search"})` + NFC 조각 비교 · 날짜는 일 단위 · 범위 끝 포함 · `Selection` `Set` · `"all"`) · `evaluate.ts` (`runViewQueries` — 조건 값은 실행 1 회 해석 · `and` / `or` · 전부 건너뛴 묶음 = 건너뜀 · 필드 · 참조 없음 = 건너뜀 + `broken` · 정렬 (변수 `{column, direction}` — field id 또는 key) · 파생 보기 사슬 · `explainViewRow` = 같은 판정의 행별 설명 — Decision 11 의 재료). `catalog/runtime/viewQuery.ts` — 바인딩의 보기 사슬과 참조 값 (`catalogVariableValue` — 노드 page 변수 · 프로젝트 변수, Canvas 기본값 · Preview/Publish 실행 값) 을 compositionRoot 의 행 감싸개가 한 번 풀어 행 소스에 넘긴다. `catalogBoundRows` 가 **표시 투영 전** 원본 전체에 실행하고 결과 메타 `view` (`matched` · `loaded` · `complete` (mock = true, API 는 Phase 2) · `broken` · `applied`) 를 싣는다 · memo = (보기 정의 · 읽은 값 · 원본 행 배열). `refreshState(names)` 가 그 변수를 읽는 보기의 collection 을 다시 읽는다.

**패널** — `CatalogRuleRow`: When 아래 「Do 순서」 (Do 가 둘 이상일 때 · `1. Set state` 형식 · 이 Do 삭제) → Do 편집기 (고른 Do) → 「Do 추가」 (`.control-button` `data-variant="add"`, 새 Do = 마지막 Do 와 같은 종류의 기본값) · 요약 「… 외 Do N개」 · 상속 행은 Do 이름을 이어 적는다. History 라벨 4 (보기 추가 · 편집 · 삭제 · 공유).

**검증**:

| 항목                                  | 결과                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 RED                                | ① (mock GridList + 변수 조건) GREEN · ④ (`update` + `moveBefore` 한 규칙) GREEN · ② · ③ 은 `it.fails` 유지 (Phase 3 · 2)                                             |
| 계산기 (`evaluate.test.ts` 14)        | 비교 18 · 묶음 · 건너뜀 · 적용 여부 · 끊김 · 설명 · 정렬 · 사슬 · 200 행 (r101..r200 만 일치 → 100 행 · 전부 일치 → 표시 100 / total 200 / matched 200)              |
| 스키마 · 명령 (`adr284ViewSchema` 9)  | 모양 거부 7 · 공유 보기 3 · Do 목록 · 49 거부 · `VIEW_IN_USE` · 승격 + undo · page 복제 변수 재매핑 · Do 색인                                                        |
| grep 게이트 (`oneEvaluator.static` 2) | `runViewQueries` · `viewCompare` 정의 1 곳 · 호출자 `dataBinding.ts` 하나 · Publish = shared 세션                                                                    |
| 패널 (`phase4eInteractions` +2)       | Do 추가 · 순서 목록 · 삭제 각 한 step · 모든 Do 선택의 기본값이 문서 검증 통과                                                                                       |
| 원복 RED 8/8                          | 행 소스 보기 실행 · 감싸개 query · refreshState 보기 · dispatcher 모든 Do · page 복제 재매핑 · `VIEW_IN_USE` · 내장 보기 집계 거부 · 전부 건너뛴 묶음 (반례 추가 뒤) |
| 스위트                                | shared 1766 · builder unit 6661 (실패 `chromeIsland.static` 1 = HEAD 기존 · 5k G5 테스트는 전체 실행 부하 중 5 s timeout, 단독 9/9) · publish 13 · type-check 0      |
| 번들 (production build)               | Preview initial 308,640 (Δ +66) · lazy `dataBinding` · `graph` chunk +5,372 · Builder initial 1,425,895 (Δ +4,554 — HEAD 상한 초과는 기존)                           |

**live (Chrome MCP · dev 5175 · 2026-10-26)** — 새 프로젝트 「ADR284 live」: Users (mock 3 행) · 프로젝트 변수 `gender` (`all`) 시드 → 팔레트로 GridList · Button → Design 패널 Data source 로 Users 연결 → 내장 보기 (gender = 변수, `all` 건너뜀) 를 문서 명령으로 (저작 UI 는 Phase 3) → Canvas 3 행 · 변수 기본값 `female` → Canvas 1 행 · `all` 로 복귀 → Interactions 패널에서 Button 규칙 · Do = Set state `male` · 「Do 추가」 → Do 순서 2 → Show a toast (이때 HEAD 기존 결함 — 기본 message `""` 를 문서가 거부 — 발견 · 수리) → Compare Mode Preview 에서 버튼 → 목록 Kim · Lee + 토스트 「Message」 → 새로고침 → contract 50 · Do 목록 · 보기 조건 유지.

**정정 · 사후 보고**:

- 비교 어휘는 18 (본문 Decision B-2 의 나열 그대로 — 「17」 은 셈 착오).
- §8b 의 「조건 계산기 core 는 Preview initial」 은 틀린 전제다 — Preview 의 catalog runtime (graph · dataBinding · session) 은 이미 initial 밖 lazy chunk 다. Phase 1 의 Preview initial Δ 는 +66 B. 배분 표는 lazy chunk 의 증분으로 읽는다 (R10 의 「lazy chunk 로 옮김」 대안은 이미 성립).
- `update` 의 값은 record 여야 한다 (리터럴은 scalar) — kanban drop 의 열 값은 Phase 5 가 이벤트 인자 · 변수로 넘긴다. ④ 테스트는 object 변수 참조를 쓴다.
- scope: §1b 22 파일 + 테스트 · fixture 약 60 파일 (contract 리터럴 · `action` → `actions`) — breakdown 추정 범위 안. sub-group 없음.
- contract 50 커밋 순서 (R5): ADR-283 G5 (사용자 Builder 확인) 뒤.

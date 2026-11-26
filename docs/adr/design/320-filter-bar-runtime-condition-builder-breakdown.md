# ADR-320 breakdown — 필터 바 (실행 중 조건 빌더)

> 결정: [ADR-320](../320-filter-bar-runtime-condition-builder.md). 이 문서는 대조 표 · 조립 표 · 설계 · Phase · 시제품 · 파일 추정을 둔다. 경로 약칭 `S/` = `packages/shared/src/`, `B/` = `apps/builder/src/builder/`.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 범위 네 묶음 · 묶음마다 ADR 하나.
- 이 ADR 의 범위: 실행 중 필터 상태 모델 (필터 범위의 조건 트리) · `FilterBar` 컴포넌트 (칩 줄 · 조건 빌더) · 값 편집기와 후보 값 · 기억 · 주소 · 이름 붙인 묶음 · 상대 날짜 · 서버 후보 값 계약 · 상태 연동.
- 선행: [ADR-325](../325-collection-runtime-store-three-layers.md) (사용자 답 2026-11-27, round 4 h8) — 대상마다 다른 합성 조회의 요청 · 결과 분리는 325 의 조회 결과와 그 Decision 6 이 맡는다.
- 범위 밖: 작성 때의 필터 저작 (ADR-284 「검색 · 필터」 구획 — 그대로) · 정렬 · 묶기의 실행 중 표면 (ADR-315 — 그대로) · 접근 통제.
- 조사 근거: 코드 실측 (HEAD `0ea8c33d8`) · ReUI 문서와 registry 소스 (Filters 14 파일) · 2026-10-30 자유 필터 18 제품 조사.

## 2. ReUI Filters 대조 표

| ReUI                                                                 | composition 대응                                                                   | 판정                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `fields: FilterField[]` (필수 하나)                                  | 대상 collection 의 schema 에서 유도                                                | 작성자가 스키마를 손으로 적지 않는다            |
| `FilterQuery` = 묶음 (`combinator` 묶음마다 하나) · `rules` 중첩     | `ViewConditionGroup` (`op` · `items`) — 같은 모델                                  | 그대로 재사용                                   |
| `FilterRule { path, operator, value, negated }`                      | `ViewCondition { fields, op, value, enabled, skip }`                               | `negated` 없음 — `not*` 비교가 있다             |
| 필드 타입 6 (text · number · range · select · multiselect · boolean) | 필드 종류 5 (text · number · boolean · date · list) × 비교 21                      | 날짜가 타입으로 있다. `range` 는 `between`      |
| 연산자 `arity` (none · one · many · range) 가 값 모양을 정함         | 비교가 값 모양을 정함 (`exists` = 값 없음 · `oneOf` = 목록 · `between` = 둘)       | 같은 생각 — 편집기 선택에 그대로 쓴다           |
| `variant: basic` (칩 줄) / `advanced` (빌더), 같은 query             | 칩 줄 · 조건 빌더가 같은 트리                                                      | 채택                                            |
| `advancedMode: popover \| inline`                                    | `FilterBar` 의 빌더 배치 (popover · 제자리)                                        | 채택                                            |
| 칩 4 조각 (필드 글자 · 연산자 · 값 · kebab) — X 버튼 없음            | 같은 4 조각 + 삭제 Button                                                          | 삭제 키가 없으므로 (HC2) 보이는 버튼을 둔다     |
| 필드를 고르면 미완성 rule 이 바로 commit                             | 조건이 바로 생기고 값이 비면 `skip` 으로 적용되지 않음                             | 채택 — 미완성 상태를 따로 만들지 않는다         |
| 조건 끄기 없음                                                       | `enabled`                                                                          | 우리 쪽이 넓다                                  |
| `reorderable` (끌기 · Alt + 화살표 · 메뉴)                           | RAC Tree `useDragAndDrop` (포인터 · 키보드 끌기) + 행 메뉴                         | Alt + 화살표는 없다 (RAC 가 주는 키보드 끌기로) |
| 깊이 제한 prop 없음                                                  | 사용자 결정 3                                                                      | 화면에서만 막는다                               |
| `loadOptions(query, { signal, cursor })` — debounce 250 ms           | 로컬 = `facet` 보기 + 검색, 서버 = 사용자 결정 9                                   | 계약을 따로 설계                                |
| `resolveValues` (저장된 id 의 라벨 복원)                             | 없음                                                                               | 우리는 필드 값으로 거른다 (참조는 경로)         |
| `validate` · `onBeforeQueryChange`                                   | 필드 종류 × 비교 검증 (기존) · 서버 판정 (HC4)                                     | 임의 함수는 받지 않는다                         |
| `disabled` · `readOnly`                                              | `isDisabled` · `isReadOnly` (RAC 이름)                                             | 채택                                            |
| `labels` (약 70 키) · `operatorLabels`                               | i18n 메시지 표 (기존 열 필터 문구 4 언어를 옮김)                                   | prop 이 아니라 사이트 언어                      |
| 직렬화 helper 없음 · saved views 없음                                | body · suffix 직렬화 (기존) · 기억 · 주소 · 이름 붙인 묶음 (사용자 결정 4 · 5 · 6) | 우리 쪽이 넓다                                  |
| live region 문구 7 종                                                | react-aria `announce` — 「조건 N 개 적용」 과 묶음 추가 · 삭제                     | 문구 수는 Phase 3 에서 정한다                   |
| Data Grid 연동 = 예제가 직접 쓴 `matches`                            | 범위 트리가 보기에 합쳐진다 (§5.2)                                                 | 연결이 문서의 필드 하나다                       |

## 3. 지금 있는 기구

**그대로 쓰는 것**

- 조건 트리 타입 · 검증 — `S/catalog/document/types.ts:839-862`, `S/catalog/document/validation.ts:1499-1569`.
- 비교표 · 평가기 · body 직렬화 — `S/collections/view/comparison.ts:38-78`, `evaluate.ts:361-395`, `serialize.ts:361-390`.
- 후보 값 보기 (`facet: true`) 와 `tableFacet` 의 계산 방식 — `S/catalog/runtime/catalogTableController.ts:1556-1619`, `tableStateQuery.ts:150-164`.
- draft → 조건 변환 · 문구 4 언어 — `S/catalog/runtime/tableColumnFilterDraft.ts`, `tableColumnFilter.components.tsx:58-227`.
- 연결 형식 선례 `pagesOf` · `columnsOf` — `types.ts:1376-1386`.
- lazy chunk 와 import 정적 게이트 — `S/catalog/runtime/__tests__/tableStateQueryImports.static.test.ts`.

**모양을 넓히는 것**

- 표 상태 `columnFilters` (열마다 하나 · 평평) — `tableState.ts:32-38`, `:207-237`.
- 조각 → 보기 번역과 합성 — `tableStateQuery.ts:52-94`, `:118-139`.
- 로컬 빠른 경로 `viewRowsPassing` 과 `CatalogRowSlices.filters` — `rowFilter.ts:99-106`, `S/catalog/runtime/tableRowSlices.ts:122-127`.
- 서버 판정 `catalogTableSliceServable` (판정 단위 = 비교 하나 → 비교 × 필드 경로) — `tableStateQuery.ts:244-305`, `catalogTableController.ts:381-383`.
- 후보 값 보기의 제외 규칙 (그 필드의 「그리고」 조건 전부 → 편집 중인 조건 id 하나) — `S/collections/view/evaluate.ts:521-549`.
- 실행 상태의 자리 (Table 전용) — `catalogPreviewSession.ts:1786-1800`.
- 기억 대상 조각 (`REMEMBERED_SLICES`) — `tableState.ts:94-97`.
- Do `setColumnFilter` · `clearColumnFilter` — `S/interactions/concepts/tableColumns.ts:60-80`.

**없는 것**

- 조건을 추가 · 삭제 · 묶는 실행 중 UI 와 그 상태.
- Table 이 아닌 목록의 실행 중 필터 상태.
- 서버 후보 값 계약 · 주소에 상태 싣기 · 이름 붙인 묶음 · 상대 날짜 토큰.
- `FilterBar` 의 binding · rule · template · Canvas 표현.

## 4. D1 — RAC 조립 표 (예외 0)

| 자리                    | RAC 부품                                                                                          | RAC 가 주는 것                                             | 우리가 정하는 것 (ARIA 직접 작성 없음)      |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| 필터 바 줄              | `Toolbar` (`aria-label` prop)                                                                     | `role="toolbar"` · 화살표로 focus 이동 · Tab 한 번에 나감  | 이름 문구                                   |
| 칩                      | `Group` (`aria-label` prop = 「필드 · 비교 · 값」)                                                | `role="group"`                                             | 이름 문구, 꺼진 조건의 표시 글자            |
| 비교 고르기             | `MenuTrigger` > `Button` + `Popover` > `Menu` (단일 선택)                                         | `aria-haspopup` · `aria-expanded` · 메뉴 키 · typeahead    | 항목 = 필드 종류의 비교 목록                |
| 값 편집                 | `DialogTrigger` > `Button` + `Popover` > `Dialog` > field 류                                      | dialog role · focus 가두기 · Esc                           | 편집기 선택 (비교의 값 모양)                |
| 조건 메뉴 · 삭제        | `MenuTrigger` > `Menu`, `Button`                                                                  | 메뉴 계약 · press                                          | 항목 (복제 · 끄기 · 삭제)                   |
| 필드 고르기 (조건 추가) | `MenuTrigger` > `Popover` > `Autocomplete` > `SearchField` + `Menu`, 참조 필드는 `SubmenuTrigger` | 검색 중 virtual focus · 하위 메뉴 키 (오른쪽 · 왼쪽)       | 필드 목록과 순서                            |
| 후보 값 목록            | `ListBox` (다중 선택) + `ListBoxLoadMoreItem`                                                     | option 계약 · 선택 · 이어 불러오기 지점                    | 항목 · 개수 표시                            |
| 조건 빌더               | `Tree` (`TreeItem` 재귀) + `useDragAndDrop`                                                       | `treegrid` 계약 · 단계 낭독 · 펼침 · 키보드 끌기와 그 안내 | 행 내용 (묶음 전환 · 필드 · 비교 · 값 버튼) |
| 알림                    | react-aria `announce`                                                                             | 숨은 live region                                           | 문구                                        |

- 예외 0 의 조건: 구현 파일에 `role=` · `aria-` 리터럴과 `onKeyDown` 이 없다 (RAC prop 으로 넘기는 `aria-label` · `aria-labelledby` 는 허용) — G3 의 정적 검사가 본다.
- 조립으로 낼 수 없어 넣지 않는 것: 칩 위의 Backspace · Delete 삭제, 빌더의 칸 단위 위 · 아래 이동, Alt + 화살표 재정렬.
- no-go 대안 (R4): Tree 행 안의 버튼 여럿이 낭독 · 키에서 서지 않으면 중첩 `Group` (묶음) + 행마다 `Toolbar` 로 바꾼다. 그것도 서지 않으면 사용자에게 D1 예외를 묻는다.

## 5. 설계

### 5.1 필터 범위의 상태

- **범위** = 필터 바 하나의 `filtersOf` 가 가리키는 대상들의 모임. 어느 필터 바도 가리키지 않는 Table 은 자기 하나가 범위다 (지금의 열 필터와 같은 동작).
- **한 대상은 범위 하나** — 한 노드는 필터 바 하나의 `filtersOf` 에만 든다. 문서 검증이 두 번째 연결을 거절하고 (`pagesOf` 의 id 검증 옆 — `S/catalog/document/validation.ts:1977`), 패널의 대상 후보에서도 빠진다. 그래서 대상 → 범위가 하나로 정해지고, 열 메뉴가 쓸 트리도 하나다.
- **값** = `ViewConditionGroup` (루트 `and`). 세션이 범위 id (필터 바의 record id, 없으면 Table 의 record id) 로 든다.
- 복제: 필터 바와 대상을 같이 복제하면 사본끼리 연결된다 (복제의 참조 id 바꾸기 — `mapNodeRefIds`). 필터 바만 복제하면 사본의 `filtersOf` 는 빈 채 (연결 안 됨) 로 놓이고, 대상만 복제하면 사본은 어느 필터 바에도 들지 않는다.
- 연결 해제: 뺀 대상은 자기 범위 (Table) 로 돌아가고 실행 상태는 빈 트리에서 시작한다. 문서 명령 한 step 이라 되돌리면 연결이 함께 돌아온다.
- **열 필터의 자리** — 열 메뉴 「필터…」 는 루트 직계의 그 열 조건 하나를 읽고 쓴다. id 는 지금의 `table-filter:<열 key>` 를 그대로 쓴다 (`tableStateQuery.ts:41-42`). 같은 필드의 다른 조건 (필터 바에서 넣은 둘째 조건 · 묶음 안의 조건) 은 열 메뉴가 「조건 N 개」 로만 알리고 필터 바에서 고친다.
- 대상이 Table 이면 열 머리글의 필터 표시 (적용 중) 는 그 열의 필드를 읽는 조건이 트리 어디에든 있으면 켠다.
- 필터 바가 여러 대상을 가리킬 때 (사용자 결정 1) 대상은 같은 collection 이어야 한다 — 조건의 `fields` 가 그 collection 의 필드 id 다. 검증이 다른 collection 의 대상을 거절한다.
- 실행 상태는 문서에 저장되지 않는다. 시작 값은 필터 바의 작성 값 (`defaultQuery`), 필터 바가 없으면 빈 트리다. 시작 값도 §5.3 의 대입 판정을 지난다 — 문서에 저장된 트리를 그대로 믿지 않는다.

### 5.2 합성 · 로컬 실행

- 대상의 행 조회는 지금처럼 `catalogTableStateQueries` 자리에서 마지막 보기의 `where` 에 범위 트리를 「그리고」 로 붙인다. Table 이 아닌 대상도 같은 함수를 지난다 (F6 — `catalogBoundRows` 가 조각을 종류와 무관하게 받는다).
- 로컬 경로 둘:
  - 트리가 평평한 「그리고」 뿐이면 지금의 `viewRowsPassing` (행 번호 위의 test 목록 — 이어 친 검색어의 증분 포함).
  - 「또는」 · 중첩이 있으면 묶음 test — 조건마다 통과 행 집합을 만들고 묶음의 `op` 로 합친다. 검색 · 정렬된 순서 유지는 지금과 같다.
- 두 경로와 평가기 (`runViewQueries`) 의 결과가 같아야 한다 — 무작위 트리 대조 테스트 (G1).
- 꺼진 조건 (`enabled: false`) 과 값이 빈 조건은 「통과」 가 아니라 「건너뜀」 이다 (평가기의 `skip` — `evaluate.ts:384-394`). 묶음 test 는 조건마다 「통과 행 집합」 또는 「건너뜀」 을 내고, 묶음은 건너뛰지 않은 피연산자만 `op` 로 합친다 (「그리고」 = 교집합 · 「또는」 = 합집합). 항목이 모두 건너뛰는 묶음도 건너뛰고, 루트가 건너뛰면 모든 행이다. 예: `점수 = 20 또는 (꺼짐)` = 20 인 행만 — 꺼진 조건을 통과 집합으로 합치면 모든 행이 된다.

### 5.3 서버 판정

| 범위의 행                                    |         그리고          | 또는 · 중첩 | 비교                  | 참조 경로 · 계산 필드 | 필터 바의 표시                                                                                         |
| -------------------------------------------- | :---------------------: | :---------: | --------------------- | :-------------------: | ------------------------------------------------------------------------------------------------------ |
| 전량 (로컬 · 전량 로드하는 원격)             |            ○            |      ○      | 21 전부 (로컬)        |           ○           | 전부                                                                                                   |
| 쪽 단위 원격 · `body` (본문을 보내는 method) |            ○            |      ○      | 21 전부               |           ×           | 묶음 · 비교 전부, 필드 목록에 그 필드 없음                                                             |
| 쪽 단위 원격 · `body` + GET · HEAD           |            ×            |      ×      | 없음                  |           ×           | 필터 추가가 꺼지고 사유를 알린다 (본문이 가지 않는다 — F14)                                            |
| 쪽 단위 원격 · `suffix`                      | ○ (키가 겹치지 않을 때) |      ×      | 접미사 표에 있는 것만 |           ×           | 묶음 · 「또는」 없음, 비교 · 필드 목록은 받는 것만, 요청에 이미 있는 키를 내는 조건은 사유와 함께 꺼짐 |
| 쪽 단위 원격 · 형식 선언 없음                |            ×            |      ×      | 없음                  |           ×           | 필터 추가가 꺼지고 사유를 알린다 (받지 않는다)                                                         |

- 판정의 단위는 조건 하나 (비교 × 필드 경로) 다. 참조 경로 (`teamId.name`) 는 어느 형식도 담지 못하고 (`REFERENCE_PATH` — `serialize.ts:369` · `:722`), 계산 필드는 서버로 가지 않는다 (ADR-291). 그래서 쪽 단위 원격 범위의 필드 목록에는 두 종류가 없다 — 조건을 넣은 뒤 전량 로드로 넘어가 상한 (`VIEW_LOCAL_LOAD_CAP` 10,000) 에서 빈 화면이 되는 길을 만들지 않는다.
- **판정의 자리는 하나** — 세션에서 범위 트리를 바꾸는 함수 (`filterScope.ts` 의 대입) 다. 트리를 바꾸는 모든 길이 그 함수를 지나고, 함수는 넣는 때의 공급 방식 (위 표의 행) 과 지금 스키마로 트리 전체를 판정한다. 길마다 따로 판정하지 않고, 넣는 쪽이 트리를 미리 다듬지도 않는다 — 원본을 그대로 넘긴다.
  - 받지 못하는 사유 (한 곳에서 판정): 요청이 싣지 못하는 조건 (위 표) · 스키마에 없는 필드의 조건 (지워진 필드 — `viewQueryLimits` 의 `BROKEN` 과 같은 판정).
  - 판정의 입력 (round 4 · 5): 범위의 **각 대상** 의 합성 요청 — 실제로 나갈 URL (endpoint 경로 · 기본 query · 풀린 템플릿 · load 인자 + 작성자 조건 + 범위 트리의 키) 과 본문 — 과 endpoint 의 실제 method. 요청을 조립하는 함수 (`buildEndpointRequest` 의 URL 단계) 를 판정이 같이 부른다 — 키 목록을 따로 계산하지 않는다. 한 대상이라도 못 실으면 받지 않는다.
    - 같은 키 (h6): `suffix` 의 한 요청에서 두 조건이 같은 키 (필드 key + 접미사 — `equals` · `oneOf` = `""`, `gt` · `after` = `_gt`, `lt` · `before` = `_lt`) 를 내거나 그 키가 endpoint 의 경로 · 기본 query · load 인자에 이미 있으면 (h9 — 기본 `status=open` 에 `status = closed`), 반복 키는 서버가 「또는」 으로 읽으므로 뒤에 넣는 쪽을 받지 않는다 (작성자 조건이 늘 앞 — 넣는 쪽은 범위의 조건). 한 조건의 `oneOf` 목록은 한 키의 반복이라 받는다. 통째로 넣는 트리는 겹치는 조건이 든 직계 항목을 뺀다.
    - GET · HEAD 본문 (h7): `body` 형식 + GET · HEAD 는 표의 「`body` + GET · HEAD」 행이다 — 조건을 하나도 받지 않는다.
    - 두 사유는 `viewQueryLimits` · `serializeViewQueries` 의 「보낼 수 없음」 (새 경고 코드 `DUPLICATE_KEY` · 지금의 `GET_BODY` 를 `load: "all"` 로 승격) 으로 둔다 — 작성자 보기도 같은 판정을 받아 서버에 맡기지 않고 평가기로 돈다. 판정 함수는 하나다 (대입 자리가 그것을 부른다).
  - 여기서 도는 보기의 완전성 (h10): 평가는 끝까지 모은 것이 확인된 목록에서만 한다 — ADR-325 조회 결과의 「끝까지 모았다」 (전체 수 = 모은 수, 또는 쪽이 진전된 끝에 다음 cursor 없음). 확인할 수 없는 두 경우는 행 없이 「조회 실패」 사유 (상한 초과 거절 `refuseView` 와 같은 모양 — 사유만 다르다):
    - cursor 를 보낼 길이 없음 — GET · HEAD 인데 cursor 가 본문에만 실리는 형식 (`pageBody` — `serialize.ts:515-522`) 이고 endpoint 가 `{{ cursor }}` 템플릿도 URL 모양 cursor 도 주지 않는다. 첫 요청 전에 판정한다.
    - 진전 없음 — 다음 요청이 같은 cursor 를 돌려주거나 앞 쪽과 같은 행 key 만 준다. 지금의 `loadAll` · 전량 수집 (`catalogPreviewSession.ts:2096-2112` · `:2669`) 은 그때 말없이 멈춘다 — 그 멈춤을 실패로 바꾼다.
  - 조건 하나를 넣는 길: 칩 (UI 가 그 필드 · 비교를 내지 않는다) · 열 메뉴 (그 열의 「필터…」 가 꺼지고 사유) · Do (실패를 보고).
  - 트리를 통째로 넣는 길: 시작 조건 (`defaultQuery` — 첫 열기와 「지우기」) · 이름 붙인 묶음 · 주소와 기억의 복원. 루트 직계 항목 단위로 가른다 — 받지 못하는 것이 든 항목 (조건, 또는 묶음 통째) 은 넣지 않고 나머지를 넣는다. 필터 바가 「적용하지 못한 조건 N」 을 보이고 `announce` 로 알린다. 루트가 「그리고」 라 직계 항목을 빼면 결과가 넓어질 뿐 남은 조건의 뜻은 그대로다 (묶음 안의 조건 하나만 빼면 「또는」 묶음의 뜻이 바뀐다 — 그래서 묶음은 통째로 뺀다).
  - 공급 방식이 바뀔 때 (작성자가 collection 의 endpoint · 형식을 바꿈 — Builder Preview 는 문서 변경으로, Publish 는 다음 열기에) 지금 트리를 같은 함수로 다시 판정한다.
- 반례 (리뷰 round 2): 로컬 데이터에서 `teamId.name = Red` 를 시작 조건으로 저장 → 같은 collection 을 쪽 단위 `body` 원격으로 바꿈 → 첫 열기. 대입 판정이 그 항목을 빼므로 요청에 그 조건이 없고 칩에도 없으며 「적용하지 못한 조건 1」 이 보인다 (판정이 없으면 칩은 적용으로 보이는데 요청의 `where` 가 빈다). 지금의 열 필터는 비교만 보고 받으므로 (`catalogTableController.ts:381-383`) 참조 열의 열 필터도 이 판정으로 닫힌다.
- 판정은 범위 단위로 내지만 입력은 대상마다다 — 공급 방식 (위 표의 행) 은 한 collection 이라 하나이고, 키 겹침은 대상의 작성자 조건에 따라 다르므로 모든 대상의 요청을 본다.
- 대상마다의 요청 (h8): 쪽 단위 원격 범위의 대상은 각자 합성 조회를 보낸다. 같은 collection 이라도 작성자 조건이 다르면 요청 · 결과가 둘이다 — ADR-325 의 조회 결과 (요청마다 키 목록 · cursor · 전체 수) 가 그것을 든다. 지금의 `uniqueView` (collection 마다 하나 — `catalogPreviewSession.ts:1927`) 위에는 짓지 않는다.
- 반례 (리뷰 round 5): (h9) suffix endpoint 의 기본 query `status=open` 에 범위 `status = closed` 를 넣으려 하면 막히고 요청의 `status` 키는 하나 — 그대로 두면 `?status=open&status=closed` 로 두 행. 같은 조건의 작성자 보기는 끝까지 모아 0 행. (h10) 2 행을 1 행씩 주는 GET + `body` endpoint (open 이 둘째 쪽) 의 작성자 보기 `status = open` — 행 없이 「조회 실패」 (첫 쪽의 closed 를 보이면 실패). 같은 endpoint 가 `?cursor={{ cursor }}` 를 읽으면 끝까지 모아 open 한 행.
- 반례 (리뷰 round 4): (h6) 쪽 단위 `suffix` 에 `status = open` 이 든 범위에 `status = closed` 를 넣으려 하면 그 비교 · 값이 사유와 함께 막히고 요청은 `status=open` (결과 open 행) — 그대로 두면 `status=open&status=closed` 로 두 행. (h7) 같은 범위를 `body` + GET 으로 두면 필터 추가가 꺼지고, 작성자 보기의 `status = open` 은 상한까지 불러와 open 한 행 — 그대로 두면 본문 없는 GET 이 두 행. (h8) 8 행을 3 행씩 주는 endpoint 에 ListBox · GridList (GridList 만 작성자 `status = open`) 와 같은 범위 조건 `name = Kang` — 두 요청이 각자의 조건을 싣고 둘째 쪽에만 있는 Kang 이 두 목록에 보인다.
- 판정 결과는 필터 바의 실행 props 로 내려가 UI 가 그 기능을 그리지 않는다 — 넣은 뒤 빠지는 일이 없다 (HC4).

### 5.4 노드 · prop

- type `FilterBar` (팔레트 data 범주 · composition 확장). 원본 template 의 부품:
  - 칩 template 하나 — 조건마다 반복된다 (선례: `columnsOf` 메뉴의 첫 항목이 열마다 반복).
  - 「필터 추가」 Button · 「조건 편집」 Button · 「지우기」 Button.
- 노드 필드 `filtersOf: NodeId[]`.
- prop (이름은 RAC · S2 관습 — 상세 표는 Phase 2 에서 확정):

| prop              | 값                    | 뜻                                  |
| ----------------- | --------------------- | ----------------------------------- |
| `defaultQuery`    | 조건 트리             | 시작 조건 (Canvas 가 그린다)        |
| `variant`         | `chips` · `builder`   | 칩 줄 / 제자리 빌더                 |
| `size`            | S · M · L             | 칩 · 버튼 크기 (control 높이 축)    |
| `isDisabled`      | boolean               | 전부 비활성                         |
| `isReadOnly`      | boolean               | 보기만 (조건은 보이고 바꿀 수 없다) |
| `showClear`       | boolean               | 「지우기」 Button                   |
| `hiddenFields`    | 필드 id 목록          | 내놓지 않을 필드 (사용자 결정 8)    |
| `fieldOrder`      | 필드 id 목록          | 필드 순서                           |
| `rememberFilters` | boolean               | 브라우저 기억 (사용자 결정 4)       |
| `presets`         | 이름 + 조건 트리 목록 | 이름 붙인 묶음 (사용자 결정 6)      |

- contract +1 (Phase 2 — 그때의 다음 번호). 상대 날짜 토큰을 넣으면 Phase 5 에서 +1.

### 5.5 칩 줄 (Phase 3, lazy)

- 조건 추가: 「필터 추가」 → 필드 메뉴 (검색 · 참조 필드는 하위 메뉴) → 조건이 생기고 비교 메뉴가 열린다 → 비교를 고르면 값 편집기가 열린다. 시작 비교는 지금 규칙 그대로 (text = contains · list = containsAny · 그 밖 = equals).
- 값이 없는 비교 (`exists` · `notExists`) 는 값 조각이 없다.
- 조건 메뉴: 복제 · 끄기 / 켜기 · 삭제. 꺼진 조건의 칩은 흐리게 그리고 이름에 「꺼짐」 을 붙인다.
- 「지우기」 는 범위 트리를 시작 조건으로 되돌린다 (§5.3 의 대입 판정을 지난다).
- 묶음이 있는 트리에서 칩 줄은 루트 직계의 조건만 칩으로 그리고, 묶음은 「묶음 (조건 N)」 칩 하나로 그려 누르면 빌더가 열린다.

### 5.6 조건 빌더 (Phase 4, lazy)

- Tree 의 행 = 조건 (필드 · 비교 · 값 Button + 행 메뉴), 자식을 가진 행 = 묶음 (「그리고 · 또는」 전환 + 묶음 메뉴).
- 묶음 메뉴: 조건 추가 · 묶음 추가 · 묶음 풀기 · 삭제. 행 메뉴: 복제 · 끄기 · 묶음으로 감싸기 · 삭제.
- 순서 · 소속 바꾸기는 Tree 끌기 (포인터와 키보드) 와 행 메뉴 (위로 · 아래로) 둘 다.
- 깊이 상한 (사용자 결정 3) 에 닿은 묶음에는 「묶음 추가」 가 나오지 않는다.
- 빈 묶음은 저장 형식이 거절하므로 (`or` 의 빈 항목 금지 — `validation.ts:1506-1507`) 마지막 조건을 지우면 묶음도 같이 지운다.

### 5.7 값 편집기 · 후보 값

- 편집기 모듈 하나 (lazy) 를 열 필터 대화상자와 필터 바가 같이 쓴다 — 지금 `tableColumnFilter.components.tsx` 의 편집기 부분을 꺼낸다.
- 비교의 값 모양 → 편집기: 하나 = 글자 · 숫자 · 날짜 칸, 둘 (`between`) = 칸 둘, 목록 (`oneOf` · `containsAny` · `containsAll`) 과 `equals` · `notEquals` = 후보 값 목록, boolean = 두 항목, `withinLast` = 숫자 + 단위.
- 후보 값: 열 때 `facet` 보기로 계산한다. 보기에 편집 중인 조건의 id 를 싣고, 평가기는 범위 트리에서 **그 id 의 조건 하나만** 건너뛴다 (트리 어디에 있든 — 「또는」 아래 · 중첩 묶음 안 포함). 같은 필드의 다른 조건과 작성자 조건은 그대로 적용한다. 예: 점수 5 · 10 · 20 에 `점수 ≥ 10 그리고 점수 = 20` 의 둘째 조건 후보 = 10 · 20 (지금 규칙은 5 · 10 · 20). 열 메뉴의 후보 값도 같은 id 규칙이다 (`table-filter:<열 key>`).
- 표시 200 · 20 을 넘으면 검색 칸. 부분 로드면 「불러온 N 행 기준」.
- 서버 후보 값 (사용자 결정 9, Phase 6): `body` 형식 endpoint 가 선언하면 `{ facet: { field, search, cursor } }` 요청 → `{ items: [{ value, count }], nextCursor }`. 이어 불러오기는 `ListBoxLoadMoreItem`, 검색은 debounce 250 ms 와 앞 요청 취소. 형식의 확정은 ADR-313 의 외부 API 계약과 대조한 뒤 한다.

### 5.8 기억 · 주소 · 이름 붙인 묶음 · 상대 날짜 (Phase 5)

- 기억: 범위 트리를 Table 「Remember state」 와 같은 저장소에 (키는 프로젝트 · 필터 바 id). Builder Preview 에는 저장하지 않는다.
- 주소: hash 경로 뒤 query 에 범위마다 한 값 (트리의 압축 표기). 읽는 순서 = 주소 → 기억 → 시작 조건. 복원한 트리는 **원본 그대로** §5.3 의 대입 함수에 넘긴다 — 스키마에 없는 필드의 조건을 여기서 먼저 빼지 않는다 (그 판정도 대입 함수의 것이다). 기억의 복원도 같다. 반례 (리뷰 round 3): `(지워진 지역 = 서울 또는 상태 = open)` — 지역 조건만 먼저 빼면 `상태 = open` 이 남아 open 한 행이고 알릴 정보도 없다. 대입 함수는 묶음 통째를 빼므로 open · closed 두 행이고 「적용하지 못한 조건 1」 을 알린다. 같은 트리는 주소 · 기억 · 이름 붙인 묶음 · 시작 조건 어느 길로 와도 같은 행과 같은 알림이다.
- 이름 붙인 묶음: 필터 바의 메뉴에서 고르면 범위 트리를 그 묶음으로 바꾼다 (§5.3 의 대입 판정을 지난다 — 받지 못하는 직계 항목은 빼고 수를 알린다).
- 상대 날짜 (사용자 결정 7): 날짜 조건의 값에 닫힌 토큰 — 오늘 · 어제 · 이번 주 · 지난 주 · 이번 달 · 지난 달 · 올해. 읽는 순간 날짜 값 (하루 또는 범위) 으로 풀고, 주의 시작은 사이트 locale 을 따른다. 요청에는 푼 값을 싣는다.

### 5.9 상태 연동

- Do: 「조건 넣기」 (필드 · 비교 · 값) · 「조건 지우기」 (필드) · 「전부 지우기」. 대상은 필터 바 또는 Table. §5.3 의 판정이 받지 않는 조건을 넣는 Do 는 실패로 보고한다 (조용히 버리지 않는다).
- When: 「필터 변경」 (조건이 적용 상태로 바뀔 때 — 편집 중의 미완성 조건에는 실행되지 않는다).
- 이름 붙인 상태: 적용된 조건 수 (number). 결과 행 수는 기존 count 보기로 읽는다.

### 5.10 Canvas

- 작성 값만 그린다 — 필터 바의 배치, 시작 조건의 칩 (필드 · 비교 · 값 글자), 버튼 셋.
- 열린 메뉴 · 값 편집기 · 빌더는 그리지 않는다 (Canvas 는 overlay 를 열지 않는다).
- 칩의 글자는 Preview 첫 화면과 같은 문구 함수 (필드 라벨 · 비교 문구 · 값 표기) 를 읽는다.

### 5.11 저작

- 연결된 목록의 「검색 · 필터」 구획에 「필터 바 추가」 — 한 transaction 으로 `FilterBar` 를 목록 앞에 넣고 `filtersOf` 에 그 목록을 적는다.
- 필터 바의 패널: 연결된 목록 (추가 · 빼기 — 같은 collection 의 목록만 후보) · 내놓을 필드 · 시작 조건 편집 · 묶음 · 스위치.
- 팔레트에서 직접 놓은 필터 바는 연결 안 됨 상태로 그려지고 패널이 연결할 목록을 고르게 한다.
- 패널의 시작 조건 · 이름 붙인 묶음 편집기는 지금 공급 방식이 받지 못하는 항목에 경고를 붙인다 (같은 판정 함수) — 공급 방식을 바꾼 뒤 남은 조건을 작성자가 본다. 저장은 막지 않는다 (실행 때의 대입 판정이 막는다).

## 6. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                   | Gate |
| :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | ADR-325 Implemented 확인 · 조회 결과 API 재대조 · 코드 사실 재대조 · v3 확인 · 대상 종류 inventory · 시제품 4 · Publish 주소 형식 · 번들 · 속도 기준선                                                                                                                                                                                                                                                                 |  G0  |
|   1   | 필터 범위 상태 — 표 상태 조각을 트리로 · 열 메뉴의 읽기 쓰기 · 합성 · 「또는」 로컬 경로 (건너뜀 규칙) · 서버 판정 (비교 × 필드 경로 · 네 길 · 대상마다 합성 요청의 같은 키 · method) · `viewQueryLimits` 의 `DUPLICATE_KEY` (endpoint 기본 query 포함) · `GET_BODY` 를 보낼 수 없음으로 · 여기서 도는 보기의 완전성 (cursor 전송 길 · 진전 없음 = 조회 실패) · 한 대상 = 범위 하나 검증 · Do 의 대상 (화면 변화 없음) |  G1  |
|   2   | `FilterBar` 등록 (binding · rule · template · traits · nesting · d2Provenance) · Canvas 정적 · 「필터 바 추가」 · 패널 · contract                                                                                                                                                                                                                                                                                      |  G2  |
|   3   | 칩 줄 (lazy) — 조건 추가 · 비교 · 값 · 끄기 · 삭제 · 지우기 · 편집기 모듈 공유 · 후보 값 (편집 중인 조건 id 만 제외) · 알림                                                                                                                                                                                                                                                                                            |  G3  |
|   4   | 조건 빌더 (lazy) — 묶음 · 전환 · 중첩 · 순서 바꾸기 · 제자리 배치                                                                                                                                                                                                                                                                                                                                                      |  G4  |
|   5   | 기억 · 주소 · 이름 붙인 묶음 · 상대 날짜 · When · Do · 이름 붙인 상태                                                                                                                                                                                                                                                                                                                                                  |  G5  |
|   6   | 서버 후보 값 · 여러 대상 (325 조회 결과 위 — 대상마다 요청) · 번들 · 속도 재측정 · 종결 live · 문서 (규칙 · CHANGELOG)                                                                                                                                                                                                                                                                                                 |  G6  |

## 7. Phase 0 시제품

| ID  | 확인할 것                                                                                                                     | go 기준                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1  | 칩 줄 조립 — `Toolbar` > `Group` > 버튼 넷. 화살표 이동 · 메뉴와 값 대화상자가 닫힌 뒤 focus 복귀 · Chrome 접근성 트리의 이름 | 키보드 전 경로 · 트리에 toolbar > group > button 과 이름. VoiceOver 는 사용자    |
| P2  | 빌더 조립 — `Tree` 행 안의 버튼 셋 + 메뉴, 묶음 행, `useDragAndDrop` 으로 순서 · 소속 바꾸기 (포인터 · 키보드)                | 행 안 버튼에 화살표로 닿음 · 끌기가 묶음 안팎으로 놓임 · 단계가 낭독 트리에 있음 |
| P3  | 「또는」 묶음의 행 필터 — 10,000 · 100,000 행에서 묶음 test 의 계산 시간과 지금 경로의 시간                                   | 10,000 행에서 조건 변경 한 번의 계산이 지금 경로의 2 배 안                       |
| P4  | `announce` — private 경로 import 가 Preview · Publish 번들에서 동작하고 문구가 접근성 트리의 live region 에 실림              | 두 앱에서 문구 확인                                                              |

## 8. 파일 추정 (Phase 0 에서 확정)

| 자리                           | 파일                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 상태 · 합성 (shared)           | `catalog/runtime/tableState.ts` · `tableStateQuery.ts` · `tableRowSlices.ts` · `catalogPreviewSession.ts` · `catalogTableController.ts` · 새 `filterScope.ts`                                                                                                                                                                                      |
| 로컬 경로 (shared)             | `collections/view/rowFilter.ts` · `catalog/runtime/dataBinding.ts`                                                                                                                                                                                                                                                                                 |
| 등록 (shared)                  | 새 `bindings/FilterBar.binding.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/types.ts` · `document/validation.ts` · `d2Provenance.ts` · `domain/componentTraits.ts`                                                                                                 |
| 실행 (shared, lazy)            | 새 `runtime/filterBar.components.tsx` · `filterBuilder.components.tsx` · `filterValueEditor.components.tsx` (열 필터에서 꺼냄)                                                                                                                                                                                                                     |
| 상태 연동 (shared)             | `interactions/concepts/` 새 concept · `componentInteractionSpecs.ts` · `tableColumns.ts`                                                                                                                                                                                                                                                           |
| Canvas · 패널 · 저작 (builder) | `catalogRuntime/canvasBinding.ts` · `viewAuthoring.ts` · `panels/properties/catalog/CatalogFilterSection.tsx` · 새 필터 바 패널 · `paletteItems.ts` · i18n                                                                                                                                                                                         |
| 요청                           | Phase 1: `collections/view/serialize.ts` (`viewQueryLimits` · `serializeViewQueries` — 같은 키 · GET 본문) · `querySuffixes.ts` 읽기만 · `collections/executeCollectionEndpoint.ts` (URL 조립을 판정이 같이 부름) · `catalogPreviewSession.ts` 의 전량 로드 (완전성 · 조회 실패). Phase 6: endpoint 형식 · 대상마다 요청 (ADR-325 의 조회 결과 위) |

추정 shared 18 ~ 24 · builder 8 ~ 12 파일 + 테스트.

## 9. Phase 결과

(Phase 가 닫힐 때마다 기록)

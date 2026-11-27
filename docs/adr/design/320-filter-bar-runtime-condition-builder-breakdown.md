# ADR-320 breakdown — 필터 바 (실행 중 조건 빌더)

> 결정: [ADR-320](../320-filter-bar-runtime-condition-builder.md). 이 문서는 대조 표 · 조립 표 · 설계 · Phase · 시제품 · 파일 추정을 둔다. 경로 약칭 `S/` = `packages/shared/src/`, `B/` = `apps/builder/src/builder/`.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 범위 네 묶음 · 묶음마다 ADR 하나.
- 이 ADR 의 범위: 실행 중 필터 상태 모델 (필터 범위의 조건 트리) · `FilterBar` 컴포넌트 (칩 줄 · 조건 빌더) · 값 편집기와 후보 값 · 기억 · 주소 · 이름 붙인 묶음 · 상대 날짜 · 서버 후보 값 계약 · 상태 연동.
- 선행: [ADR-325](../completed/325-collection-runtime-store-three-layers.md) (사용자 답 2026-11-27, round 4 h8) — 대상마다 다른 합성 조회의 요청 · 결과 분리는 325 의 조회 결과와 그 Decision 6 이 맡는다.
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

### Phase 0 (2026-11-27 — G0 통과)

HEAD `f4a9c4b51` (ADR-324 · 325 구현 위). 시제품 = `apps/builder/scripts/adr320Prototypes.mjs` (설치된 RAC 1.22.1 부품만으로 조립한 작은 필터 바 · production lib build) + 실행 `adr320-phase0-prototypes.mjs` (headed Chrome 158.0.8127.37 · Playwright WebKit 27.2, 보이는 탭). 판정값은 브라우저의 focus · DOM 속성 · 접근성 트리 (CDP) · `performance.now()` 이고 기대값은 실행 스크립트에 따로 적었다. 결과 원본은 로컬 scratchpad (커밋하지 않음).

**선행 · 조회 결과 API (ADR-325)**: Implemented (2026-11-27). 이 ADR 이 딛는 자리 —

- 저장소 `S/catalog/runtime/collectionStore.ts`: 요청 하나 = 키 목록 · cursor · total (`accept` · `startList` · `appendPage` · `dropList`), 보이는 행은 세션 `shownRows` 한 곳.
- 세션 `catalogPreviewSession.ts`: `bindingViews` (`:2082` — 그려진 record 마다 작성자 보기 + 표 상태 조각으로 조회를 만들고 조회 key 로 모은다) → 조회가 하나면 `uniqueView` (`:2209`), 여럿이면 `splitViews` (`:2234`) → `syncViewLists` (`:2332` — 보기마다 자기 요청 · 목록, 동시 6). 완전성 = `answerComplete` (`:2282`) · `wholeComplete` (`:2307`).
- 그래서 대상마다의 합성 요청 (h8 · R10) 은 새 기구가 아니다 — 범위 트리를 record 의 조회 (`recordRowSlices` `:1952` → `stateRowQuery`) 에 넣으면 `bindingViews` 가 대상마다 다른 조회로 나누고 325 가 요청 · 결과를 나눈다. Phase 6 의 「여러 대상」 은 그 경로의 Gate (G6) 다.

**코드 사실 재대조** (본문 F1 ~ F17 — 본문의 줄 번호는 `0ea8c33d8` 기준이고 아래가 지금 자리다):

| 사실      | 지금 자리 (`S/`)                                                                                                                                                   | 판정                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1        | `catalog/document/types.ts:842-865` · `validation.ts:1579-1583`                                                                                                    | 그대로                                                                                                                                                                     |
| F2        | `collections/view/comparison.ts:38-78` · `:647`                                                                                                                    | 그대로                                                                                                                                                                     |
| F3        | `catalog/runtime/tableState.ts:32-38` · `:207-237` · `tableStateQuery.ts:118-139`                                                                                  | 그대로                                                                                                                                                                     |
| F4        | `collections/view/rowFilter.ts:102` · `evaluate.ts:361-395`                                                                                                        | 그대로                                                                                                                                                                     |
| F5        | `serialize.ts:361-390` · `:455-466` · `:369` · `:411` · `:722` · `tableStateQuery.ts:244-305` · `catalogTableController.ts:382-383`                                | 그대로                                                                                                                                                                     |
| F6        | `catalogPreviewSession.ts:1952-1975` (`recordRowSlices` — `tables.tableStates`) · `pageOf` `:4507`                                                                 | 그대로 (줄 이동)                                                                                                                                                           |
| F7        | `tableState.ts:94-97` · `apps/publish/src/App.tsx:90-121`                                                                                                          | 그대로                                                                                                                                                                     |
| F8        | `tableOperationsDom.components.tsx` · `tableColumnFilterDraft.ts` · `tableColumnFilter.components.tsx`                                                             | 그대로                                                                                                                                                                     |
| F9        | `catalogTableController.ts:1556-1619` · `evaluate.ts:521-549`                                                                                                      | 그대로                                                                                                                                                                     |
| F10       | `types.ts:1383` · `:1389` · `validation.ts:2053-2056`                                                                                                              | 그대로 (줄 이동)                                                                                                                                                           |
| F11       | RAC 1.22.1 · `actionBarHost.components.tsx:16` · `:217`                                                                                                            | 그대로                                                                                                                                                                     |
| F12       | `types.ts:207` · `adr201-bundle-gate.mjs:28-30`                                                                                                                    | **달라짐** — contract 79 → **80** (ADR-324). Builder initial 1,643,618 B — 여유 **6,382** (본문 약 10,600). 324 (+4,126) 와 판독 수리 몫                                   |
| F13 · F14 | `querySuffixes.ts:14` · `:17` · `serialize.ts:503-504` · `:753-757`                                                                                                | 그대로                                                                                                                                                                     |
| F15       | `catalogPreviewSession.ts:2209-2228` (`uniqueView`) · `:2234` (`splitViews`) · `:2332` (`syncViewLists`)                                                           | **달라짐 (선행이 해소)** — 조회가 여럿이면 조건 없는 첫 쪽이 아니라 보기마다 자기 요청이다 (ADR-325 Decision 6). R10 의 기구는 이미 있다                                   |
| F16       | `collections/executeCollectionEndpoint.ts:140` (URL 조립) · `:94` · `:113` (주소 key)                                                                              | 그대로 (줄 이동) — 판정이 같이 부를 URL 단계는 `resolvedEndpointUrl` (`:90`) · `buildEndpointRequest` (`:136`)                                                             |
| F17       | `serialize.ts:515-522` · `executeCollectionEndpoint.ts:168` · `catalogPreviewSession.ts:2485-2502` (`loadAll` — cursor 가 그대로면 `return`) · `:3304` (전량 수집) | 그대로 (줄 이동). 「끝까지 모았다」 판정 `answerComplete` 가 325 로 생겼다 — Phase 1 의 「진전 없음 = 조회 실패」 는 `loadAll` 의 말없는 `return` 을 그 판정에 잇는 일이다 |

설계에 닿는 차이 0. 달라진 셋 (contract · 번들 여유 · F15) 은 선행 구현의 결과다.

**D2 확인**: 설치된 S2 1.8.2 의 export 에 filter 계열 컴포넌트 없음 (로컬 reference 는 `SearchField` 뿐). v3 `@adobe/react-spectrum` (npm 최신 3.47.7) 은 이 저장소에 설치돼 있지 않고, 공개 컴포넌트 목록에 필터 빌더가 없다 (npm 메타의 의존 이름에 filter · query 없음). design-data 는 본문 그대로 (전용 컴포넌트 없음). → 정본 순서 4 번, `d2Provenance.ts` 의 `composition`.

**대상이 될 목록 종류 (등록표에서 유도)**: binding 이 `dataBinding` 을 받고 행을 반복하는 type 17 —

- `COLLECTION_TYPE_TABLE` 의 `repeat` owner 10: Tabs · TagGroup · SelectBoxGroup · ListBox · GridList · Menu · Breadcrumbs · Tree · CardView · Table (`S/catalog/document/collectionItems.ts:33`).
- 그 표의 picker 2: Select · ComboBox.
- `GROUP_REPEAT_ITEMS` 의 그룹 4: RadioGroup · CheckboxGroup · ToggleButtonGroup · SegmentedControl (`ActionButtonGroup` 은 Pagination 의 쪽 번호라 대상이 아니다).
- Chart (`records` 바인딩).
- 지금 「검색 · 필터」 구획 (`CatalogListFilterSection`) 은 연결된 노드 전부에 뜬다 (`CatalogPropertiesPanel.components.tsx` `withFilterSections` — `isBound`). 「필터 바 추가」 가 서는 자리와 `filtersOf` 검증의 대상 집합은 Phase 2 에서 이 17 에서 고른다 (key 바인딩 — 한 항목 — 은 목록이 아니라 제외).

**시제품**:

| 시제품                | 결과 (Chrome · WebKit 같음, 다르면 적음)                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 판정 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| P1 칩 줄              | Tab 으로 첫 버튼 · ArrowRight 가 칩을 건너 버튼 10 개를 차례로 · Tab 한 번에 나가고 Shift+Tab 은 마지막 버튼으로 · 비교 메뉴 (Enter → ↓ → Enter) 뒤 focus 가 그 버튼으로 · 값 대화상자는 입력 칸에 focus, Esc 뒤 값 버튼으로 · 조건 메뉴 「끄기」 뒤 Group 이름에 「꺼짐」. 접근성 트리: toolbar 「필터」 > group 「부서 포함 부산 꺼짐」 > button 넷 (이름 있음) — Chrome CDP · WebKit aria snapshot                                                                                           |  go  |
| P2 조건 빌더          | ↓ 가 행 7 을 차례로 (단계 1 1 2 2 2 3 1 — DOM `aria-level` · Chrome 접근성 트리) · 조건 행은 → 로 버튼 다섯 (끌기 · 필드 · 비교 · 값 · 메뉴), 묶음 행은 → 로 끌기 · 전환 · 메뉴 · 전환 버튼 Enter 로 「또는 → 그리고」. 포인터 끌기 3 (묶음 안으로 · 묶음 밖 맨 앞으로 · 2 단 묶음에서 루트로) 과 키보드 끌기 (행 안 끌기 버튼 Enter → ↑ 로 「묶음 또는에 드롭」 → Enter) 가 따로 적은 정답 모양과 같다. 「안에 놓기」 는 묶음 행만 (`shouldAcceptItemDrop`) — 키보드 이동이 조건 행을 건너뛴다 |  go  |
| P3 「또는」 계산 시간 | 조건 6 · 2 단 중첩 (`c3 그리고 (c1 또는 c2 또는 (c4 그리고 c5)) 그리고 c6`), 교대 15 회 중앙값. 10,000 행 1x 평평 2.3 ms · 묶음 4.4 ms (1.91 배) · 4x 8.9 · 17.1 ms (1.92 배). 100,000 행 1x 23.3 · 44.6 ms · 4x 89.3 · 171.1 ms. 두 경로의 결과 = 따로 적은 술어 (틀린 행 0)                                                                                                                                                                                                                   |  go  |
| P4 `announce`         | private 경로 import 의 production 빌드에서 live region (`role="log"`) 에 문구 · Chrome 접근성 트리에 그 문구. 제품에서는 ActionBar 가 같은 import 를 Preview · Publish 에서 이미 쓴다 (`actionBarHost.components.tsx:217`)                                                                                                                                                                                                                                                                      |  go  |

**시제품이 설계에 더한 것**:

1. **삭제 뒤 focus** — 삭제 버튼으로 칩을 지우면 focus 가 `body` 로 떨어진다 (RAC `Toolbar` 는 사라진 자식의 focus 를 옮기지 않는다). 제품은 지운 뒤 다음 칩의 첫 버튼 (없으면 「필터 추가」) 으로 focus 를 옮긴다 — 요소의 `focus()` 호출이고 role · `aria-*` · 키 handler 가 아니다 (HC2 안). 조건 메뉴의 「삭제」 · 빌더의 행 삭제도 같다. G3 의 키보드 전 경로에 「삭제 뒤 focus 자리」 를 넣는다.
2. **알림은 `polite`** — `announce(message)` 의 기본은 `assertive` 다 (시제품 live region 관찰). 「조건 N 개 적용」 은 `announce(message, "polite")` 로 보낸다.
3. **키보드 끌기의 시작 자리** — 끌기 버튼 (`slot="drag"`) 은 행 안의 focus 자리라 행까지 ↓, 행 안으로 → 로 간 뒤 Enter 다 (요소에 직접 `focus()` 하면 RAC 가 focus 를 행으로 돌린다). 놓을 자리 문구 (「… 이전에 삽입 · … 사이에 삽입 · …에 드롭」) 와 시작 안내는 RAC 가 브라우저 언어로 낸다 — 사이트 언어와 맞추려면 `I18nProvider` 아래에 둔다 (Phase 4).
4. **묶음 경로의 비용 구조** — 묶음 경로는 조건마다 모든 행을 비교하고 평평한 경로는 앞 조건에서 떨어진 행을 건너뛴다. 그래서 비는 조건 수에 따라 2 배에 가깝다 (go 기준 「2 배 안」 을 1.9 배로 통과 — 여유가 작다). 절대값은 10,000 행 4x 에서 17 ms 로 HC6 기준선 (조건 변경 → 표시 수백 ms) 의 작은 몫이다. G1 에서 HC6 가 넘으면 「그리고」 묶음 안에서 이미 떨어진 행을 건너뛰게 한다 (Gate 의 실패 시 대안보다 먼저 쓸 수 있는 수).
5. **포인터 끌기 하니스** — 놓을 자리는 마지막 `dragover` 가 정한다. 합성 포인터가 마지막 지점에서 멈춘 채 이벤트가 하나 더 오지 않으면 직전 지점의 자리 (묶음 「안」) 에 놓인다 — WebKit 에서 재현, 그 자리에서 1 px 움직였다 돌아오면 두 브라우저가 같다. Phase 4 live 하니스도 같은 방법을 쓴다. RAC `TreeDropTargetDelegate` 는 포인터의 세로 이동 방향 · 가로 위치로 단계를 고른다 (묶음의 마지막 자식 뒤 = 묶음 안 / 밖).

**Publish 주소 형식** (사용자 결정 5 의 확인): Publish 는 `location.hash` 의 `#/경로` 를 `session.navigateTo` 에 넘기고 세션의 `path` 를 hash 에 되쓴다 (`apps/publish/src/App.tsx:92-119`). 경로 해석은 정확히 맞는 route 에서 `?` · `#` 뒤를 뗀다 (`S/catalog/runtime/catalogPreviewRoute.ts:54`). 그래서 `#/orders?<범위>=<트리>` 는 지금도 `/orders` 로 풀린다 — `:param` route 의 맞추기 (`matchCatalogRoute`) 가 query 를 떼는지는 Phase 5 에서 본다. Builder Preview 는 hash 를 쓰지 않는다 (주소 없음 — 기억 · 주소 모두 Publish 만).

**기준선**:

- 번들 (일반 `vite build` → `adr209-bundle-closure.mjs`, `f4a9c4b51`): Builder initial JS gzip **1,643,618** / 1,650,000 B (여유 6,382) · Preview **172,277** / 327,000. 사용자 결정 10 의 권고 (Builder +4,000) 는 여유 안이지만, 같이 진행하는 ADR-321 의 결정 8 (+3,000) 과 합치면 7,000 으로 여유를 넘는다 — 상한 재승인 (만료 2026-12-25) 또는 lazy 분리를 Phase 2 전에 정한다.
- 속도 (계산만 — `adr315-phase0-mainthread.mjs`, 10,000 행): 글자 열 정렬 1x p95 19.4 ms · 4x 71.9 ms, 검색 「Person 12」 4x 16.9 ms. 조건 변경 → 화면 표시 (HC6) 의 기준선은 G1 에서 대조군 (같은 문서의 열 필터 하나) 과 교대 3 쌍으로 같이 잰다 — 낡은 기준값과 비교하지 않는다.

**파일 확정 (Phase 1)**: §8 의 「상태 · 합성」 · 「로컬 경로」 · 「요청」 행 그대로이고, 325 뒤의 자리로 읽는다 — `catalog/runtime/tableState.ts` · `tableStateQuery.ts` · `tableRowSlices.ts` · `catalogTableController.ts` · `catalogPreviewSession.ts` (`recordRowSlices` · `stateRowQuery` · `bindingViews` · `loadAll`) · 새 `filterScope.ts` · `collections/view/rowFilter.ts` · `evaluate.ts` (후보 값의 제외 규칙) · `serialize.ts` (`DUPLICATE_KEY` · `GET_BODY` 를 보낼 수 없음으로) · `executeCollectionEndpoint.ts` (URL 단계 재사용) · `catalog/runtime/dataBinding.ts` · `interactions/concepts/tableColumns.ts` · `catalog/document/validation.ts` (한 대상 = 범위 하나 — 필드는 Phase 2 의 `filtersOf` 와 같이).

### Phase 1 (2026-11-27 — G1 통과, `cedac12da`)

HEAD `f4a9c4b51` 위 작업 트리. 표 상태의 필터는 조건 트리 하나다 — 열 메뉴는 그 트리의 루트 조건 (`table-filter:<열 key>`) 만 읽고 쓴다.

**바뀐 것**:

- 상태: `tableState.ts` 의 `columnFilters` 조각 → `filters?: ViewConditionGroup` (루트 = 「그리고」). 읽기 `catalogFilterTreeRead` (새 `filterScope.ts` — 모양 검증 · 루트를 「그리고」 로 · 같은 루트 id 는 뒤 값이 첫 자리 · 빈 묶음 제거 · 변수 참조 `enabled` 거절) → 대입 판정 `judgeFilters` → 비면 조각 없음.
- 로컬 경로: 평평한 트리는 지금 빠른 경로 (`viewRowsPassing`), 「또는」 · 중첩은 새 `viewRowsPassingGroup` (`rowFilter.ts`) — test 묶음은 `viewRowTestGroupOf` (새 `rowTests.ts`). 건너뛴 조건 · 전부 건너뛴 묶음은 피연산자가 아니다 (`점수 = 20 또는 (꺼짐)` = 20 인 행만). `dataBinding.ts` `keptRowOrder` 가 둘을 고르고 검색과 AND.
- 대입 판정 (`catalogTableController.ts` `judgeTableFilters`): 루트 항목마다 앞에서 받은 것과 함께 — 행에 없는 필드 (지운 필드) · 요청이 못 싣는 조건 (`viewRequestLimits` — `GET_BODY` 또는 그 항목의 id) 은 받지 않는다. 묶음은 안의 조건 하나라도 못 받으면 통째로 뺀다. 거절 수는 `tableFiltersRefused`. 데이터 정의 · 문서 변경 뒤 `rejudgeFilters` 가 다시 판정한다 (앞 거절 수 유지).
- serializer: `DUPLICATE_KEY` — suffix 형식에서 같은 key 를 두 번째로 내는 조건, endpoint URL 에 이미 있는 key (`endpointUrlKeys` — `queryParams` · baseUrl · path 의 `?`) 는 보내지 않고 `load: "all"`. GET · HEAD 의 `body` 형식은 아무것도 보내지 않고 `load: "all"`.
- 끝까지 모으는 보기의 완전성 (`catalogPreviewSession.ts`): cursor 를 보낼 수 없는 요청 (GET + `body`, cursor 템플릿 없음, cursor 가 URL 아님 — `cursorUnsendable`) · 진전 없는 쪽 (같은 cursor · 새 행 0) → `failView` — 행 없음 + 읽는 중 상태 `error`, 사유 `viewFailures`. `reload` 가 지운다.

**G1 항목**:

| 항목                                                 | 근거                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 열 필터 회귀 0                                       | ADR-315 Phase 3 · 4 테스트 (`adr315Columns` · `adr315FacetItems` · `adr315ServerRows` · `tableColumnMenu`) 를 트리 모양으로 옮겨 통과 · live 아래                                                                                                                                                                                                    |
| 두 로컬 경로 = 평가기 = 정답표                       | `rowFilterGroup.test.ts` 11 — 손으로 쓴 정답 (전부 건너뛰는 묶음 · 일부만 건너뛰는 「또는」 · 2 단 · 지운 필드) + 무작위 트리 300 (중첩 > 100) · 평평한 트리 300 에서 세 경로 같음                                                                                                                                                                   |
| 서버 판정 · 같은 키 · 기본 query 충돌 · GET + `body` | `serialize.test.ts` 7 · `adr315Search.test.tsx` (거절 key · endpoint key · 작성자 보기 key · 다시 판정 · 지운 필드) · `adr320ViewCompleteness.test.tsx` 5 (GET + `body` 의 cursor 없음 = 행 없이 실패 · URL cursor 의 GET = open 한 행 · POST 는 본문에 조건 · 기본 `status=open` 에 `status = closed` = 요청 key 하나 · 0 행 · 같은 쪽 반복 = 실패) |
| HC6                                                  | 아래                                                                                                                                                                                                                                                                                                                                                 |
| 원복 RED                                             | 변이 9 전부 실패 · 바이트 복원 확인 — rowFilter 건너뜀 · 대입 판정 (limits · 지운 필드 · 같은 key · GET body) · 완전성 (진전 없음 · cursor 못 보냄 · 같은 key · GET body)                                                                                                                                                                            |
| **한 대상에 두 번째 범위 거절**                      | **Phase 2 로 넘김** — 범위를 세는 단위가 필터 바 노드 (`filtersOf`) 라 그 검증 · 필드와 같이 둔다 (§9 Phase 0 「파일 확정」 의 `validation.ts` 줄)                                                                                                                                                                                                   |

**HC6** (`adr320FilterTree.bench.test.ts` — 제품 행 경로 `catalogBoundRows`, 실행마다 조건 값을 바꿔 memo 적중 없음, 글자 열 정렬 위, 팔 교대 21 회, 결과는 따로 적은 술어와 대조):

| 행      | 열 필터 하나 (대조군) | 평평한 6 조건 | 「또는」 · 2 단 6 조건 |
| ------- | --------------------- | ------------- | ---------------------- |
| 10,000  | 0.34 ms (p95 0.42)    | 2.62 (2.76)   | 4.68 (5.02)            |
| 100,000 | 2.50 (2.66)           | 25.17 (25.74) | 44.45 (45.13)          |

Node 1x 계산만이다. 대조군과의 차 4.3 ms (4x 환산 약 17 ms — Phase 0 P3 의 브라우저 4x 17.1 ms 와 같은 크기) 는 HC6 기준선 (정렬 클릭 → 표시 1x 154 ~ 169 · 4x 556 ~ 589 ms) 의 3 % 안. 「또는」 트리를 화면에서 바꾸는 길 (칩 · 빌더) 이 Phase 3 · 4 에 생기므로 조건 변경 → 표시의 live 교대 측정은 그때 G3 · G4 에서 하고 G6 에서 다시 잰다.

**live** (production build · Publish · Chrome headless · 1,000 행 — `datagrid-table-vs-tanstack-live.mjs --check-filter --column-origin`): 열 메뉴 「Filter…」 → Dept 「Contains」 `dept 1` → 둘째 조건 → … 네 단계 행 수 256 · 116 · 39 · 481 = 하니스가 행에서 따로 센 기대값, 메뉴에 「Clear filter」 가 다시 열 때 생김, 후보 값 12 같음 — `pass: true`. 하니스 주의: `--column-origin` 없이 만든 열은 내용 감싸개가 없어 (S2 `ColumnWithMenu` 의 메뉴 버튼 자리 — `2e449e6a7`) 메뉴가 없다. HEAD 빌드에서도 같아 이 Phase 의 회귀가 아니다.

**번들** (일반 `vite build` → `adr209-bundle-closure.mjs`): Builder initial JS gzip 1,643,618 → **1,644,931 (+1,313)** — 결정 10 의 +4,000 안. Preview 는 이 Phase 의 변경이 shared 실행 모듈뿐이라 같은 방법으로 Phase 2 와 같이 잰다.

**Phase 2 로 가져가는 것**: 한 대상 = 범위 하나 검증 (`filtersOf` 와 같이) · Preview 번들 측정.

### Phase 2 (2026-11-27 — G2 통과)

HEAD `cedac12da` 위 작업 트리. contract 80 → **82** (81 은 ADR-321 의 worktree 가 쓴다 — 321 은 Phase 2 까지 81 그대로).

**바뀐 것**:

- 등록: `FilterBar` (binding `filterbar` — RAC `Toolbar`, 이름 = 사이트 언어 「Filters」) · `FilterChip` (binding `filterchip` — RAC `Group`, 이름 = 「필드 비교 값」 + 꺼짐). 원본 (`document/filterBarOrigins.ts`): 칩 = 필드 Text + 비교 · 값 · 조건 메뉴 · 삭제 ActionButton (비교 · 값은 그 글자가 비면 자리 없음 — `presentWith`), 막대 = 칩 frame (slot 「Conditions」) + 필터 추가 · 조건 편집 · 지우기 (지우기는 `showClear` — `bindingMaps`). rule (`rule/filterBar.ts`): 막대 = 줄바꿈 flex · gap S 4 · M/L 8, 칩 = S2 Tag 의 칠 · 테두리 · 모서리, 높이 = 막대의 control 높이 (안쪽 버튼 한 단계 작음 · 칩 글자도 그 크기). prop: `defaultQuery` · `presets` (새 값 종류 `filterQuery` · `filterPresets` — 실행 트리 읽기 `catalogFilterTreeRead` 와 같은 모양) · `variant` · `size` · `showClear` · `rememberFilters` · `hiddenFields` · `fieldOrder` · `isDisabled` · `isReadOnly` (D2 = composition — `CATALOG_D2_COMPOSITION_TYPES`).
- `filtersOf` (graph `validateFilterScopes`): `FILTER_TARGETS_HOST` (막대만) · `FILTER_TARGET_SELF` · `FILTER_TARGET_TAKEN` (한 목록 = 범위 하나) · `FILTER_TARGET_COLLECTION` (연결된 목록이 같은 collection). 복제: 같이 복제된 목록에만 다시 잇는다 — 중복 · 붙여넣기 · 페이지 복제가 루트를 따로 복제하므로 교차 연결 단계 (`connectCopiedFilterBars`) 하나를 셋이 지난다. 막대만 복제하면 연결 안 됨.
- 칩 행: 목록 연결 = 칩을 반복 항목으로 (`setFilterBarTargets` — 열 선택 메뉴 `setColumnChooser` 와 같은 방식, `COLLECTION_TYPE_TABLE` 행 `FilterBar → FilterChip`). resolver `filterChipRows` — 시작 조건의 루트 항목마다 한 행 (묶음 = 「묶음 (조건 N)」 한 칩), 문구는 `runtime/filterWording.ts` (열 필터 대화상자와 같은 표로 옮김 — en · ko · ja · zh). 필드 이름 = collection 필드 label (없으면 key, 참조 경로는 이어서).
- 증분: 연결된 막대의 `defaultQuery` 쓰기 = 구조 (칩이 생기고 사라짐 — `writesFilterChips`), collection 의 필드 이름 변경 = 그 collection 의 막대를 다시 해석 (`dataReaderSources`). `presentWith` 가 `bindingMaps` 키를 따라간다 (compositionRoot · positions — 중첩 원본 자리는 그 자리의 정의로).
- 저작: 목록의 「검색 · 필터」 첫 줄 = 「필터 바 추가」 (한 step — 목록 바로 앞 · 연결, `filterBarAuthoring.ts`) 또는 그 목록을 거르는 막대 이름. 막대의 Collection = 필터할 목록 (같은 페이지 · 17 종류 · 같은 collection · 다른 막대의 목록 아님) · 내놓을 필드 (보이기 · 순서). Value = 시작 조건 · 이름 붙인 묶음 편집기 (lazy — `CatalogFilterBarFields.tsx`). 공급 방식이 못 받는 항목은 「Preview 는 빼고 적용」 표시 — 판정은 실행의 대입 판정과 같은 함수 (`catalogJudgeFilterItems` 로 꺼냄 — `catalogTableController` 도 이 함수).

**G2 항목**:

| 항목                                                  | 근거                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 게이트                                           | `codex:registration` · guard · css-boundary · chart-contract · agent-catalog · skills gate 통과, `d2S2Alignment.static.test.ts` 포함 builder 단위 통과. format check 는 다른 세션의 미커밋 파일 셋 (ApiEndpointEditor · dataActions) 에서만 막힘, rule-size 는 HEAD 에서도 실패                                                                                               |
| contract                                              | 82 — 리터럴 32 파일                                                                                                                                                                                                                                                                                                                                                           |
| 칩 · 버튼 rect Canvas = Chrome ±1                     | `adr320FilterBarParity.browser.test.ts` — 시작 조건 둘 (조건 · 조건 · 묶음 / 값 없는 비교 · 목록 값 · 꺼진 사이) × S · M · L, 노드 36 ~ 38 개 최대 **0.08 px**, 칩 높이 24 · 32 · 40 = 따로 적은 값. 팔레트 막대 (견본 칩) S · M · L 은 `adr295PaletteSymmetry` 최대 0.05 px                                                                                                  |
| 「필터 바 추가」 한 번에 연결 · 되돌리기 한 번에 복원 | `adr320FilterBar.test.ts` (단위 11) · live 1 · 5                                                                                                                                                                                                                                                                                                                              |
| 이미 연결된 대상의 두 번째 연결 거절                  | 단위 — `FILTER_TARGET_TAKEN` · `COLLECTION` · `SELF`                                                                                                                                                                                                                                                                                                                          |
| 복제 (대상과 같이 · 따로)                             | 단위 — 막대만 = 연결 안 됨 · 막대 + 표 = 사본끼리 · 페이지 복제 = 사본 페이지의 표                                                                                                                                                                                                                                                                                            |
| 연결 해제와 되돌리기                                  | 단위                                                                                                                                                                                                                                                                                                                                                                          |
| live                                                  | `apps/builder/scripts/adr320-g2-live.mjs` (dev 5173 · Chrome headless) **ALL PASS 7**: Design 패널의 「Add filter bar」 버튼 → 막대가 표 앞 · `filtersOf` · 버튼 셋 / 막대 패널 「Add condition」 → 칩 하나 / 시작 조건 셋 → 칩 문구 / Publish: `role=toolbar` 「Filters」 > `role=group` 이름 셋 · 칩 3 · 버튼 13 상자 = Canvas record ±1 px / undo ×2 / page error 0        |
| 원복 RED                                              | 변이 10 중 9 실패 · 바이트 복원 확인 — 두 번째 연결 거절 · 교차 연결 · 시작 조건 쓰기 = 구조 · 필드 이름 다시 해석 · 중첩 자리 `presentWith` · 칩 행 · 칩 글자 · 연결의 반복 표시 · `bindingMaps` 의 `presentWith`. 통과한 하나 = clone 단계의 「바깥 목록 빼기」 — 세 복제 경로 모두 교차 연결 단계가 다시 쓰므로 가려진다 (단일 루트 경로 `components.ts` 의 안전장치, LOW) |

**회귀**: shared 274 파일 · 2913 통과. builder 단위 — 전체 실행에서 6 파일 실패, 그중 어휘 게이트 하나 (「Remove」 = 「제거」) 를 고쳤고 나머지 다섯 (`adr282LibraryOriginUnlock` · `phase4eOriginView` · `phase4ePalette` · `adr310ShowMore` · `adr315GroupWindow`) 은 단독 실행에서 전부 통과 — 부하 때 시간 초과 (321 worktree 도 같은 파일에서 관찰). type-check PASS.

**번들** (일반 `vite build` → `adr209-bundle-closure.mjs`): Builder initial JS gzip 1,644,931 (Phase 1) → **1,651,091 (+6,160)** — 320 합계 **+7,473**. 결정 10 의 +4,000 을 넘어 사용자에게 물었고, 한도를 **+8,000** 으로 올렸다 (2026-11-27 — Phase 3 이후 몫 527 B 남음, 절대 상한 1,660,000 그대로). Preview 172,277 → 172,278 (+1). 줄인 것: 공급 방식 경고 (serializer · intake 변환기 ≈ 7 KB) 와 막대 패널 · 편집기를 lazy 로. 남은 몫: 칩 문구 표 `filterWording` 1,660 (네 언어 — Canvas 가 칩을 그리려면 첫 화면에 있어야 한다) · 등록 (binding · rule · 원본 template · resolver 행 출처) · 목록의 「필터 바 추가」 줄.

**설계와 달라진 것**: 칩의 견본 — 팔레트에서 놓은 (연결 안 된) 막대는 견본 칩 하나 (Field · Contains · Value) 를 그린다 (§5.11 「연결 안 됨 상태로 그려지고」). 시작 조건이 실행 행에 닿는 것은 Phase 3 (칩 줄 — 범위의 실행 트리) 이다 — Phase 2 의 Preview 는 칩을 시작 조건대로 그리지만 행은 아직 거르지 않는다. 대상 종류 (17) 는 패널 후보 · 「필터 바 추가」 가 거르고 graph 는 막지 않는다.

### Phase 3 (2026-11-27 — G3 통과)

HEAD `4e8c066ec` 위 작업 트리 (같은 checkout 에서 다른 세션이 ADR-321 Phase 3 을 진행 중 — contract 84 는 그쪽 것, 이 Phase 는 contract 를 바꾸지 않는다).

**바뀐 것**:

- 범위의 실행 트리 (`runtime/filterScopeSession.ts`): 연결된 막대마다 트리 하나 (막대의 노드 id). 첫 읽기에 시작 조건 (`defaultQuery`) 을 대입 판정에 넣어 시작하고, 작성자가 시작 조건을 바꾸면 (Builder Preview) 새 시작에서 다시 시작한다. 대입 판정 = 범위의 **모든 목록** 이 루트 항목마다 그 필드를 갖고 요청이 실을 때만 받는다 (`catalogJudgeFilterItems` — 패널 경고와 같은 함수). 못 받은 수는 막대의 알림 (`refusedOf`).
- 트리는 하나다 (HC3): Table 대상은 표 상태의 `filters` 를 범위 트리에서 읽고 (`CatalogTableController.tableState` — 사본을 두지 않는다, 표 상태에 쓰는 `filters` 는 범위의 대입으로 간다 → 열 메뉴의 조건이 칩이 된다), 다른 목록은 행 조회의 조건으로 읽는다 (`boundRows` · `recordRowSlices`). 칩 행은 세션 트리 (resolver 행 출처 `filterTree` — Builder 에는 없어 시작 조건).
- 후보 값 (Decision 9): 실행 전용 `ViewQuery.facetSkip` (문서의 보기는 그 키를 거절 — 저장되지 않는다) — 후보 값 보기 앞의 보기에서 **그 id 의 조건 하나만** 뺀다 (「또는」 아래 · 중첩 묶음 안, 비게 된 묶음도 같이). 열 메뉴도 같은 규칙 (`table-filter:<열>` — 같은 필드의 작성자 조건이 이제 남는다). 작성자가 만든 후보 값 보기 (`facet` 만) 는 지금 규칙 그대로.
- 칩 줄 (`runtime/filterBar.components.tsx`, lazy): 막대 · 칩의 RAC `Toolbar` · `Group` 렌더 자체가 이 chunk 다 (Builder 첫 화면 몫을 줄이려고 — 렌더러는 props 와 자식만 넘긴다). 실행 중 Preview 에서: 「필터 추가」 = 필드 메뉴 (RAC `Autocomplete` 검색 · 참조 필드는 `SubmenuTrigger`) → 조건이 생기고 비교 메뉴가 열린다 → 값을 받는 비교면 값 편집기가 열린다. 값 편집기 = 열 필터 대화상자 그대로 (편집기 모듈 하나 — 사이트 언어 `I18nProvider` 로 감싼다), 후보 값은 그 조건만 뺀 범위 트리. 조건 메뉴 = 복제 · 끄기 / 켜기 · 삭제 (묶음 칩은 복제 · 삭제), 삭제 버튼, 「지우기」 = 시작 조건 (대입 판정). 못 받은 항목은 막대 끝 글줄 「적용하지 못한 조건 N」, 적용 수는 `announce`. 내놓는 필드 · 비교 = 범위가 받는 것만 (탐침 조건을 지금 트리에 더해 판정 — 넣은 뒤 빠지는 일 없음, HC4).
- 값이 아직 없는 조건의 칩: 값 자리에 「값 입력…」 (값 버튼이 편집기를 연다 — 그 조건은 건너뜀).
- 비활성 막대 = 버튼이 RAC 비활성 (`ButtonContext`), 읽기 전용 = 칩은 보이고 실행 없음.

**G3 항목**:

| 항목                                                           | 근거                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 조건 추가 · 비교 · 값 · 끄기 · 삭제 · 지우기 = 정답표          | `adr320FilterScope.test.tsx` (Preview 세션 · jsdom) 10 — 시작 조건이 Table · ListBox 를 같이 거름 · 비교 변경 (값 모양이 다르면 값을 버리고 편집기 열림) · 끄기 · 켜기 · 복제 · 삭제 · 「Add filter」 → 비교 메뉴 · 「Clear」 = 시작 · 빈 트리 · 꺼진 조건. 행 key 정답은 손으로 적음                                                                |
| 지우기 = 대입 판정을 지난 시작 조건 · 「적용하지 못한 조건 N」 | 같은 파일 — 지운 필드 조건 → 빼고 1 셈 · 막대 끝 글줄 「1 condition could not be applied」                                                                                                                                                                                                                                                           |
| 열 메뉴의 조건이 칩으로 · 그 반대도                            | 같은 파일 — Table 의 `table-filter:status` 쓰기 → 범위 트리 · 칩 2 · ListBox 도 따라옴 · Table 은 자기 `filters` 를 갖지 않음 / 범위에서 고친 `table-filter:status` 를 열 메뉴가 읽는 조건 (`catalogFilterColumnCondition`) 이 그대로 · 행 u2 · u4                                                                                                   |
| 후보 값 정답표                                                 | `facetSkip.test.ts` 4 — 점수 5 · 10 · 20 에 `점수 ≥ 10 그리고 점수 = 20` 의 둘째 후보 = 10 · 20 (옛 규칙은 5 · 10 · 20), 같은 필드의 작성자 조건 유지, 「또는」 아래, 중첩 묶음 · 비게 된 묶음. 칩 값 편집기의 후보 = 그 조건만 빼고 A · B · C (jsdom)                                                                                               |
| 키보드 전 경로                                                 | live 3 · 4 — Tab 으로 「Add filter」 → Enter → 「Sta」 검색 → Enter → 비교 메뉴 → Enter → 값 편집기 → 1 · Enter, 조건 메뉴 → 「Turn off」                                                                                                                                                                                                            |
| role · `aria-*` 는 RAC 것뿐                                    | `adr320D1ChipLine.static.test.ts` — `role` 0, `aria-label` 은 RAC `Toolbar` · `Group` · `Menu` · `SearchField` 의 이름 prop 만                                                                                                                                                                                                                       |
| Chrome · WebKit live                                           | `apps/builder/scripts/adr320-g3-live.mjs` (dev 5173 · headless) **Chrome ALL PASS 7 · WebKit ALL PASS 7** — Publish 탭에서 시작 조건 = 칩 1 · 행 4 / 포인터: 비교 「Equals」 → 값 편집기 자동 → 「C」 · Apply → 행 2 / 키보드 경로 (위) / 삭제 · 「Clear」 → 칩 1 · 행 4 / live region 「N condition(s) applied」 / page error 0. G2 하니스 다시 7/7 |
| 원복 RED                                                       | 변이 10 전부 실패 · 바이트 복원 확인 — facetSkip 무시 · Table 이 범위 트리를 읽지 않음 · 열 메뉴 쓰기가 범위로 가지 않음 · 다른 목록의 행 조회에 트리 없음 · 행 출처 `filterTree` 전달 누락 · 지운 필드 판정 · 칩 `conditionId` 묶음 · 대입 뒤 Table 다시 읽기 · 대입 뒤 목록 다시 읽기 · 복제                                                       |
| 대칭                                                           | `adr320FilterBarParity.browser.test.ts` 6/6 (렌더가 lazy 가 되어 chunk 로드를 기다리게 고침) · 팔레트 대칭 FilterBar S · M · L                                                                                                                                                                                                                       |

**회귀**: shared 281 파일 · 2,986 통과 · builder 단위 10,035 통과 (staged-load 순회 기록 게이트에 새 순회 둘을 적음). type-check — 이 Phase 의 코드는 통과, 같은 checkout 의 다른 세션 (ADR-321 Phase 3, contract 84) 의 테스트 리터럴이 진행 중이라 지금 전체 type-check 는 그쪽에서 막힌다.

**번들** (일반 `vite build` → `adr209-bundle-closure.mjs`, 다른 세션의 진행 중 변경을 빼려고 이 Phase 의 tracked 파일만 HEAD 로 돌린 빌드와 나란히 잼): Builder initial **+511 B** → 320 합계 **+7,984** (결정 10 의 +8,000 안, 16 B 남음). Preview −1 B. 줄인 것: 막대 · 칩 DOM 렌더를 lazy chunk 로 (lazy 모듈이 `delegatedDom` 을 import 하면 rollup 이 공용 chunk 를 다시 나눠 +528 B — props 로 넘겨 피함), 필드 목록 함수를 첫 화면 밖 모듈로 (`filterBarFields.ts`), 칩 부품 판별을 lazy 쪽으로.

**설계와 달라진 것 · 넘긴 것**:

- 「조건 편집」 버튼과 묶음 칩 누르기 (빌더 열기) 는 Phase 4 (빌더) 와 같이.
- 참조 경로 조건의 후보 값은 없다 (값 칸만) — 서버 후보 값과 같이 Phase 6 에서 본다.
- **HC6 의 live 교대 측정 (Phase 1 이 G3 · G4 로 넘긴 것) 은 이번에 하지 못했다** — Phase 4 (G4) 에서 칩 · 빌더 경로를 같이 잰다. 계산 자체는 Phase 1 의 10,000 행 4.68 ms (「또는」 2 단) 그대로다 (이 Phase 는 평가 경로를 바꾸지 않았다 — 후보 값 보기만).
- 여러 원격 대상의 요청 나누기는 Phase 6 그대로 — 지금 범위 판정은 대상마다 요청 한계를 보지만, 요청은 지금 세션 경로를 지난다.

(다음 Phase 가 닫힐 때마다 이어서 기록)

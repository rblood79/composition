# 쉬움 평가 — 과제 × 방식 cognitive walkthrough (brief)

당신은 「신입 개발자가 이 과제를 이 방식으로 하면 어떻게 되나」 를 **셀 수 있는 양**으로 걷는 평가자다. 의견 (「쉽다 · 어렵다」) 은 쓰지 않는다. 세 방식 (A · B · C) 을 설계한 사람의 근거는 주지 않는다 — 아래 설명만 보고 걷는다. 어떤 방식도 편들지 않는다.

## 데이터 (모든 과제 공통)

- 테이블 `Users` — 필드: `id` (number) · `name` (string) · `gender` (string: `male` · `female`) · `age` (number) · `email` (string, 비어 있을 수 있음) · `createdAt` (date) · `tags` (string[]: `vip` · `new` · `inactive` …) · `teamId` (number — `Teams.id` 를 가리킴) · `status` (string: `active` · `pending` · `closed`)
- 테이블 `Teams` — `id` (number) · `name` (string)
- 처음에는 로컬 (mock) 데이터 50 행. 과제 11 에서만 API (`GET /users`) 로 바뀐다.
- 화면: `Users` 를 보여 주는 GridList (행 = name · gender · age). 조건 컨트롤은 과제마다 추가.

## 과제 12 개

| #   | 과제                                                                                                                        | 성공 기준                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | RadioGroup (all · male · female) 로 GridList 거르기                                                                         | male 을 누르면 male 만 보임, all 이면 전부                   |
| 2   | SearchField 에 친 글자가 `name` 에 포함된 행만                                                                              | 「ja」 → James · Jane; 빈 글자면 전부; 대소문자 무시         |
| 3   | TagGroup (multiple: vip · new · inactive) 에서 고른 tag 가 `tags` 에 하나라도 들어 있는 행                                  | 아무것도 안 고르면 전부                                      |
| 4   | DateRangePicker 로 `createdAt` 이 범위 안인 행                                                                              | 범위 비우면 전부                                             |
| 5   | Checkbox 「closed 제외」 — `status ≠ closed`                                                                                | 체크하면 closed 가 사라짐                                    |
| 6   | 과제 1 + 2 를 동시에 (AND), 그리고 「`gender = female` 이거나 `age < 25`」 묶음 하나 추가 → `search AND (female OR age<25)` | 세 조건이 함께 동작                                          |
| 7   | 거른 결과 개수를 Text 에 「N 명」 으로 표시                                                                                 | 조건이 바뀌면 숫자가 따라 바뀜                               |
| 8   | `status` 별 개수 (active N · pending N · closed N) 를 작은 목록 3 줄로                                                      | 데이터가 바뀌면 숫자가 따라감                                |
| 9   | GridList 행에 `teamId` 대신 팀 이름 (`Teams.name`) 표시, 그리고 Select (팀 이름) 로 거르기                                  | 행에 「Design」 처럼 이름이 보이고 Select 로 걸러짐          |
| 10  | Table (allowsSorting 열 name · age) 의 정렬을 같은 데이터를 보는 GridList 도 따라가게                                       | Table 머리를 누르면 GridList 순서도 바뀜                     |
| 11  | 과제 1 · 2 를 그대로 둔 채 데이터를 API `GET /users?gender=…&name_like=…` 로 전환 — 서버가 거름                             | Radio · Search 가 그대로 동작, 네트워크 요청에 param 이 실림 |
| 12  | kanban: `status` 3 개를 열 3 개 (GridList 3 개) 로 보여 주고, 카드를 다른 열로 끌어 놓으면 `status` 가 바뀜                 | 끌어 놓은 카드가 그 열로 옮겨지고 머리 개수가 바뀜           |

## 프로필 8 개 (사전 지식 축 3 개)

| 축                                      | Y 면 이미 아는 개념                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| R (React 상태)                          | `useState` · controlled/uncontrolled · 불변 갱신 · `useMemo` · 이벤트 핸들러 · props 전달       |
| Q (SQL · 필터 개념)                     | `WHERE` · `AND`/`OR` 괄호 · `IN` · `LIKE` · `GROUP BY` · `COUNT` · `JOIN` · 외래키 · 정렬       |
| S (스프레드시트 · Notion/Airtable 필터) | 「필드 · 조건 · 값」 한 줄 필터 · 필터 그룹 · 묶기 (group by) · lookup/관계 열 · 수식 `COUNTIF` |

프로필 = R · Q · S 각각 Y/N 의 8 조합 (RQS · RQ · RS · QS · R · Q · S · 없음). 모두 「신입 개발자」 — HTML · JS 기본과 「빌더 UI 를 처음 본다」 는 공통.

## 방식 3 개 (설명만 — 근거 없음)

### A. 스크립트 — React Aria Components 로 직접 코드

- 데이터는 `useState` 배열 (또는 react-stately `useListData`). 거르기 · 정렬은 `items.filter(…)` · `toSorted(…)` 를 렌더에서 계산. 글자 비교는 `useFilter({sensitivity:'base'}).contains`, 정렬은 `useCollator()`.
- 컨트롤은 controlled (`value`/`onChange` · `selectedKeys`/`onSelectionChange`). GridList 는 `items={filtered}` + render 함수. Table 정렬은 `sortDescriptor`/`onSortChange`.
- 개수 · 묶음 · 조인은 `reduce` · `Map` · `find` 로 직접. drag & drop 은 `useDragAndDrop({getItems, acceptedDragTypes, onInsert, onRootDrop, onReorder})` 로 `update` + `moveBefore/After`.
- API 는 `useAsyncList({load({signal, filterText})})` 또는 직접 `fetch` + `useEffect`.
- 「결과 보기」 = 저장하면 dev 서버 HMR 로 즉시. 타입 오류는 편집기 · 콘솔에 바로 보임.

### B. 지금 빌더 (2026-10-26)

- **Data 패널**: 테이블 (필드 · mock 행) 과 API endpoint (method · path · query param · body 템플릿 — 값에 `{{ 변수 }}` 를 손으로 적음 · 응답 매핑) 를 만든다.
- **바인딩**: 컴포넌트 (GridList · Table …) 의 Properties 에서 collection 을 고르고 필드 역할 (`value` · `children` · `parentId`) 을 매핑. 행 글자는 `{name}` 템플릿. 「항목 key」 칸은 Form 에서만 쓰인다.
- **변수**: Properties → State 절에서 page 또는 요소 변수 (string · number · boolean · object · array) 를 만든다.
- **규칙 (Interactions 패널)**: 한 규칙 = When (그 컴포넌트의 RAC callback 하나: `onChange` · `onSelectionChange` · `onSortChange` …) → Do 하나. Do 선택지: Set state (변수에 값 — Value 칸에서 리터럴 입력 또는 「값 고르기」 로 This event 인자 · 선택한 항목 필드 · 변수) · navigate · callEndpoint · toast · 목록 명령 (append · update · remove · insert · move · removeSelectedItems · reload · loadMore · **setFilterText**) · 대상 capability (selectItem · sort · open · show/hide …). **조건부 실행 · 한 규칙에 Do 둘은 없다.**
- **거르기 · 정렬에 지금 있는 것**: `setFilterText` 는 API 데이터의 endpoint 가 `{{ filterText }}` 를 읽을 때만 서버에 다시 요청한다 (mock 데이터에는 값만 저장되고 목록은 그대로). Table 열의 `allowsSorting` 은 그 Table 만 정렬한다 (다른 컴포넌트는 안 따라감). ComboBox 안에만 글자 검색 (Autocomplete) 이 있다. 「필드 = 변수」 같은 조건 UI · OR · 집계 · 조인 · 공유 보기 · collection drag & drop · 파생값 (개수) · 변수 바뀌면 endpoint 다시 부르기는 **없다**. Text 는 `{{ 변수 }}` · `{{ 변수.경로 }}` 만 보여 준다 (식 · `.length` 없음).
- **결과 보기**: 상단 Preview 탭 (또는 Publish 탭) 에서 동작 확인. 규칙이 잘못돼도 오류 표시는 거의 없다 — 아무 일도 안 일어난다.
- 과제가 B 로 **불가능**하면 「불가」 로 적고 가장 가까운 우회 (예: 데이터를 미리 손으로 나눈 테이블 3 개) 와 그 비용을 적는다.

### C. 리서치 설계 (제안 — 아래 UI 가 있다고 가정)

- B 의 모든 것 그대로 + 아래가 추가된다.
- **「이 컨트롤로 목록 거르기」 동작**: 조건 컨트롤 (RadioGroup · SearchField …) 을 고르고 → 대상 목록과 필드를 고르면, 변수 · `onChange → Set state` 규칙 · 보기 조건이 한 번에 생긴다. 생긴 셋은 각자 보이고 고칠 수 있다.
- **보기 (view)**: 바인딩마다 이름 없는 기본 보기가 자동으로 있다 (원본 collection + 조건 트리 + 묶기 · 집계 + 정렬). 공유가 필요하면 이름을 붙여 다른 바인딩이 같은 보기를 가리킨다.
- **조건**: 필드(들) + 비교 방식 + 값 (리터럴 또는 변수 참조 「값 고르기」) + 건너뛰는 값 (빈 글자 · false · 빈 선택 · 지정 키 `all`). 비교 방식 목록은 「필드 타입 × 값 모양」 으로 좁혀진다: 포함 · 시작 · 끝 · 같음 · 아님 · 그 중 하나 · 배열 포함 · 이상 · 이하 · 사이 · 이전 · 이후 · 상대 날짜 (오늘 기준 N 일) · 있음 · 없음.
- **조건 트리**: 루트 묶음 (기본 AND) 아래 조건 또는 묶음 (AND/OR) 을 넣는다. 자식이 전부 건너뛰면 묶음도 건너뛴다.
- **묶기 · 집계**: 보기에 묶기 필드 (0 개 이상) + 집계 (`count` · `sum` · `mean` · `min` · `max`) 를 두면 결과 행이 `{묶음 키, 집계 값}` 이 된다. 묶기 0 + count = 결과 수. 집계 결과도 보기이므로 Text · 목록이 바인딩한다.
- **참조 필드**: 필드 타입 「참조 → Teams.id」. 조건 · 바인딩 `{team.name}` · 정렬 · 묶기가 `team.name` 경로를 쓴다.
- **정렬 = 변수**: Table `onSortChange` 가 변수 (`SortDescriptor`) 를 쓰고, 보기가 그 변수로 정렬한다 → 같은 보기를 보는 GridList 도 따라간다.
- **API**: endpoint 에 「조건 직렬화 형식」 을 하나 고르면 (query param `field=value` · `field_like=` · `field_gte=` …, 또는 body JSON) 보기의 조건이 자동으로 요청에 실린다. 변수가 바뀌면 그 보기를 읽는 endpoint 를 다시 부른다 (글자 입력은 debounce). 형식이 못 담는 조건 (평면 param 에 OR) 은 저작 때 그 자리에서 알려 준다.
- **drag & drop**: ListBox · GridList · Tree · Table 에 `useDragAndDrop` 배선. When 에 `onInsert` · `onRootDrop` · `onReorder` · `onItemDrop` 이 있고 인자 (`keys` · `items` · `target.key` · `target.dropPosition`) 를 「값 고르기」 로 쓴다. **한 When 에 Do 를 여러 개** 둘 수 있다 (예: `update` 그 뒤 `moveBefore`).
- **결과 보기**: B 와 같이 Preview 탭. 로컬 (mock) 데이터도 조건 · 집계 · 참조를 Preview 가 계산한다.

## 세는 것 (과제 × 방식마다)

1. **동작 수**: UI 클릭 · 선택 · 글자 입력 각각 1, 코드는 「의미 있는 줄」 1 줄 = 1. 과제 완료까지 최소 경로.
2. **필요한 개념**: 그 과제를 그 방식으로 하려면 이해해야 하는 개념 목록 (이름으로). 예: `useState` · 불변 갱신 · controlled prop · 「변수」 · 「규칙 When/Do」 · 「값 참조」 · 「보기」 · 「조건 트리」 · 「직렬화 형식」 · `SortDescriptor` · `GROUP BY` …. 프로필별 **새 개념 수** = 목록에서 그 프로필이 이미 아는 것 (위 표) 을 뺀 수.
3. **조용한 실패 지점**: 신입이 그럴듯하게 할 수 있는 틀린 선택인데 **오류 없이 아무 일도 안 일어나거나 틀린 결과가 나오는** 곳. 각각 「무엇을 하면 → 무엇이 보이나 → 알아챌 수 있나」 한 줄. (바로 오류가 뜨는 실수는 세지 않는다.)
4. **결과 왕복**: 결과를 눈으로 보려면 거쳐야 하는 전환 수 (저장 · 탭 이동 · 새로고침 · 빌드).
5. **확장 비용**: 같은 종류 조건 하나를 더 추가할 때의 동작 수.
6. **불가 / 우회**: 그 방식으로 안 되면 「불가」 + 우회와 그 동작 수.

## 출력 형식

마크다운 하나. 순서:

1. 과제 × 방식 표 (12 × 3): 동작 수 · 결과 왕복 · 확장 비용 · 불가 여부.
2. 과제 × 방식 개념 목록 (이름).
3. 프로필 8 × 방식 3 의 「새 개념 수 합계」 표 (12 과제 합).
4. 조용한 실패 지점 목록 — 방식별, 과제 번호 붙여서. 이게 가장 중요하다.
5. 방식 C 에서 **가장 많은 동작 · 가장 많은 새 개념 · 조용한 실패**가 나온 과제 3 개와 이유 (C 를 고치려면 어디를 봐야 하나 — 제안은 하지 말고 지점만).
6. 당신이 가정한 것 (설명에 없어서 추정한 것) 목록.

숫자는 추정이다 — 어느 쪽으로도 둥글리지 말고, 두 방식이 비슷하면 비슷하다고 쓴다. 전체 400 줄 안.

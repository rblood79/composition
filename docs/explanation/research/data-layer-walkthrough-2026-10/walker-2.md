# 쉬움 평가 — cognitive walkthrough (walker-2)

brief 만 보고 걸었다. 숫자는 「최소 경로」 추정이며 둥글리지 않았다. 공통 전제: 세 방식 모두 `Users` 50 행 테이블과 name · gender · age 를 보여 주는 GridList 가 **이미 있다** (A 는 `useState(mockUsers)` + `<GridList items>` 코드, B · C 는 Data 패널 테이블 + 바인딩). 동작 수는 그 위에 더하는 것만 센다. A 는 CSS · 스타일 줄을 세지 않는다 (§6 가정 1).

표기: 동작 수 `n` / 결과 왕복 `w` / 확장 비용 `+n` / 불가는 「불가 (우회 n)」. 과제 11 은 「param 이 실림」 확인에 devtools Network 전환 +1 이 모든 방식에 붙는다.

---

## 1. 과제 × 방식 표

| #   | A 스크립트                               | B 지금 빌더                                                                            | C 리서치 설계                                                    |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | 8 / w1 / +6                              | **불가** (우회 ≈500: 손 분할 테이블 2 + Tabs 3 — RadioGroup 아님)                      | 13 / w2 / +12                                                    |
| 2   | 8 / w1 / +5                              | **불가** (우회 5: ComboBox Autocomplete 로 대체 — GridList 행 표시 미달)               | 6 / w2 / +6                                                      |
| 3   | 8 / w1 / +7                              | **불가** (우회 없음)                                                                   | 12 / w2 / +12 (tag 1 개 추가는 +2)                               |
| 4   | 22 / w1 / +20 (조립 재사용 시 +5)        | **불가** (우회 없음)                                                                   | 6 / w2 / +6                                                      |
| 5   | 4 / w1 / +3                              | **불가** (우회 없음)                                                                   | 9 / w2 / +9                                                      |
| 6   | 2 / w1 / +1                              | **불가** (조건부 실행 · OR 없음)                                                       | 9 / w2 / +3                                                      |
| 7   | 1 / w1 / +1                              | **불가** (파생값 없음)                                                                 | 9 / w2 / +8                                                      |
| 8   | 5 / w1 / +4                              | **불가** (우회 16: 손으로 친 `StatusCounts` 테이블 3 행 — 데이터 안 따라감)            | 8 / w2 / +5                                                      |
| 9   | 14 / w1 / +2 (표시) · +8 (Select 거르기) | **불가** (우회 52: `teamName` 필드 손 입력 50 — 표시만, 거르기 없음)                   | 12 / w2 / +3 (참조) · +8 (Select 거르기)                         |
| 10  | 16 / w1 / +2 (열 1)                      | 13 / w2 / +2 — **가정 §6-7** (`sort` capability 가 descriptor 인자를 받을 때만)        | 19 / w2 / +2                                                     |
| 11  | 9 / w1(+1) / +2                          | 28 / w2(+1) / +8 — **가정 §6-8** (같은 When 에 규칙 둘 허용)                           | 6 / w2(+1) / +6                                                  |
| 12  | 18 / w1 / +2 (열을 배열로 돌릴 때)       | **불가** (우회 ≈580: 손 분할 테이블 3 + 열마다 이동 버튼 — status 안 바뀜 · 개수 없음) | 69 / w2 / +24 (열 1 = 목록 4 + 조건 4 + dnd 1 + 규칙 7 + 머리 7) |
| 합  | **115** · 불가 0                         | **41** (가능 2 과제만) · **불가 10**                                                   | **178** · 불가 0                                                 |

C 의 과제 12 는 69 중 머리 개수 21 (열마다 보기 이름 + Text + count) 과 규칙 21 (열마다 같은 규칙 반복) 이 절반 이상이다. 묶기 `status` + count 한 보기로 개수 3 줄을 한 목록에 두면 56 이 되지만 「열 머리」 가 아니다.

A 의 동작 수 분포: 과제 4 (22) · 12 (18) · 10 (16) · 9 (14) 가 RAC 조립 (DateRangePicker 15 줄 · Table 8 줄 · Select 9 줄) 때문이고, 과제 6 · 7 · 5 는 1 ~ 4 줄이다. C 는 과제 2 · 4 · 11 이 6 으로 가장 적고 조건 1 개 = 「이 컨트롤로 거르기」 1 회다.

### 1-1. 동작 수 산정 근거 (요약)

- **A1**: state 1 · filter 1 (all 분기 포함) · RadioGroup 1 · Radio 3 · items 교체 1 · import 1 = 8. **A2**: import 1 · state 1 · `useFilter` 1 · filter 1 · SearchField 1 · Label · Input 2 = 7 → 8 (import 2). **A3**: Set state 1 · filter(`some`·`has`·빈 선택) 1 · TagGroup 1 · TagList 1 · Tag 3 · import 1 = 8. **A4**: import 2 · state 1 · 날짜 변환 · 비교 2 · DateRangePicker 1 · Label/Group/DateInput×2/DateSegment×2/Button/Popover/Dialog/RangeCalendar/헤더 3/CalendarGrid/CalendarCell 15 · 비우기 Button 1 = 22. **A5**: state 1 · filter 1 · Checkbox 1 · import 1. **A6**: filter 식 재작성 1 ~ 2. **A7**: `<Text>{filtered.length} 명</Text>` 1. **A8**: reduce/groupBy 1 ~ 2 · 배열 변환 1 · ListBox + render 2 = 5. **A9**: `find` 1 · 행 템플릿 1 · state 1 · filter 1 · Select/Label/Button/SelectValue/Popover/ListBox/ListBoxItem/all 항목 9 · import 1 = 14. **A10**: state 1 · collator 1 · 비교 함수 (열 · 방향 · 타입) 3 · Table/TableHeader/Column×2/TableBody/Row/Cell 8 · GridList items 1 · import 1 · 숫자/글자 분기 1 = 16. **A11**: `useAsyncList` load 4 · `URLSearchParams` · all 생략 1 · `useEffect` reload 1 · items 교체 1 · 로컬 filter 제거 1 · import 1 = 9. **A12**: `useListData` 1 · 열 배열 1 · map 2 · 열 컴포넌트 props 1 · `useDragAndDrop` getItems/acceptedDragTypes/onRootDrop(getText · update) 6 · 머리 개수 1 · GridList + render 2 · `slot="drag"` Button 1 · import 1 · 열 필터 1 = 18.
- **B10**: Table 추가 1 · 바인딩 3 · 열 allowsSorting 2 · 규칙 (추가 · When `onSortChange` · Do capability `sort` · 대상 GridList · 값 고르기 This event 인자 2) 7 = 13. **B11**: endpoint (추가 · method · path · query param 2 × 2 · 응답 매핑) 8 · 바인딩 전환 1 · SearchField 규칙 (setFilterText + This event 인자) 6 · 변수 `gender` 2 · RadioGroup 규칙 Set state 6 · 같은 When 에 `reload` 규칙 5 = 28.
- **C1**: RadioGroup 추가 1 · 항목 3 × (추가 + 값) 6 · 선택 1 · 「이 컨트롤로 거르기」 1 · 대상 1 · 필드 1 · 건너뛸 키 `all` 1 · 확인 1 = 13 (비교 「같음」 은 기본값 가정). **C2**: 추가 · 선택 · 동작 · 대상 · 필드 · 비교 「포함」 = 6 (빈 글자 건너뛰기 기본값 가정). **C3**: TagGroup 1 · tag 3 × 2 · 선택 · 동작 · 대상 · 필드 · 비교 「배열 포함」 = 12. **C4**: 6 (비교 「사이」 기본값 가정). **C5**: Checkbox 1 · 라벨 1 · 선택 · 동작 · 대상 · 필드 · 비교 「아님」 · 리터럴 `closed` 1 = 9. **C6**: 보기 열기 1 · 묶음 추가 1 · OR 1 · 조건 (gender 같음 female) 3 · 조건 (age 이하 24) 3 = 9. **C7**: GridList 보기 이름 붙이기 4 · Text 추가 1 · 원본 = 그 보기 1 · 집계 count 1 · 역할 1 · 템플릿 1 = 9. **C8**: ListBox 1 · 바인딩 1 · 보기 1 · 묶기 status 1 · 집계 count 1 · 역할 · 템플릿 2 = 8 (+ 0 인 status 처리 없음). **C9**: 필드 타입 → 참조 3 · 템플릿 `{team.name}` 1 · Select 추가 + 옵션 바인딩 4 · 거르기 동작 4 = 12. **C10**: Table 추가 · 바인딩 · allowsSorting 6 · 변수 `sort`(object) 2 · 규칙 (When `onSortChange` → Set state, This event 인자) 6 · GridList 보기 이름 2 · Table 바인딩을 그 보기로 1 · 보기 정렬 = 변수 2 = 19. **C11**: endpoint 추가 · method · path · 직렬화 형식 · 응답 매핑 5 · 바인딩 전환 1 = 6. **C12**: GridList 3 · 바인딩 9 · 열 조건 (보기 · 조건 · 필드 · 리터럴) 12 · dnd 켜기 3 · 규칙 (When `onRootDrop` · Do `update` · keys 인자 2 · 필드 · 값) 7 × 3 = 21 · 머리 (보기 이름 2 · Text · 원본 · count · 역할 · 템플릿) 7 × 3 = 21 → 69.

---

## 2. 과제 × 방식 개념 목록

대괄호는 「이미 아는」 프로필 축 — `[R]` `[Q]` `[S]` · `[JS]` = 공통 기본 (모두 기지) · 표기 없음 = 모두에게 새 개념. 매핑 근거는 §6-2 ~ 6-5. 팔레트에서 컴포넌트 추가 · Preview 탭 전환 · 저장/HMR 은 첫 과제에서 1 회 배우는 공통 절차로 보고 과제마다 세지 않았다.

| #   | A                                                                                                                                                                                                                                                     | B                                                                                                                                                                                                   | C                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `useState`[R] · controlled prop[R] · 이벤트 핸들러[R] · 렌더에서 파생 계산[R] · `filter`[JS] · 「all」 분기 · RadioGroup/Radio 조립 · GridList `items` + render                                                                                       | Data 패널 테이블·필드[Q,S] · 바인딩 (collection·역할·템플릿) · Tabs · 「setFilterText 는 API 만」 제약                                                                                              | 「이 컨트롤로 거르기」 동작 · 변수[R] · 규칙 When/Do[R] · 보기 · 조건 (필드·비교·값)[Q,S] · 건너뛰는 값 (`all`)[S] · RadioGroup 항목 값                                                                                                     |
| 2   | `useState`[R] · controlled[R] · 이벤트[R] · `filter`[JS] · `useFilter` 대소문자 무시 · 빈 글자 = 전부 · SearchField 조립 (Label/Input)                                                                                                                | 바인딩 · ComboBox Autocomplete · 제약                                                                                                                                                               | 거르기 동작 · 변수[R] · 규칙[R] · 보기 · 조건[Q,S] · 비교 「포함」[Q,S] · 건너뛰는 값 (빈 글자)[S]                                                                                                                                          |
| 3   | `useState`[R] · controlled[R] · 이벤트[R] · `filter`/`some`[JS] · `Set` · Selection 타입 (`selectedKeys`) · 빈 선택 = 전부 · TagGroup/TagList/Tag 조립 · 다중 선택 ∈ 개념[Q,S]                                                                        | 변수[R] · 규칙[R] · 제약                                                                                                                                                                            | TagGroup 다중 선택 항목 · 거르기 동작 · 변수[R] · 규칙[R] · 보기 · 조건[Q,S] · 비교 「배열 포함」 (any/all 뜻) · 건너뛰는 값 (빈 선택)[S]                                                                                                   |
| 4   | `useState`[R] · controlled[R] · 이벤트[R] · `filter`[JS] · null = 전부 · `@internationalized/date` ↔ `Date` · 타임존 · 끝 경계 포함 · `RangeValue` 모양 · DateRangePicker 조립 (Popover/Dialog/RangeCalendar/segments)                                | 변수[R] · 규칙[R] · 제약                                                                                                                                                                            | 거르기 동작 · 변수[R] · 규칙[R] · 보기 · 조건[Q,S] · 비교 「사이」[Q,S] · 건너뛰는 값 (빈 선택)[S]                                                                                                                                          |
| 5   | `useState`[R] · controlled `isSelected`[R] · 이벤트[R] · `filter` 부정[JS] · Checkbox prop 이름 (`isSelected` ≠ `checked`)                                                                                                                            | 변수[R] · 규칙[R] · 제약                                                                                                                                                                            | 거르기 동작 · 변수[R] · 규칙[R] · 보기 · 조건[Q,S] · 비교 「아님」[Q,S] · 리터럴 값 vs 변수 참조 (체크가 게이트) · 건너뛰는 값 (false)[S]                                                                                                   |
| 6   | `&&`/`\|\|` 괄호[JS] · 렌더 계산[R]                                                                                                                                                                                                                   | 변수[R] · 규칙[R] · 「조건부 실행 없음」 제약                                                                                                                                                       | 보기 열기 · 조건 트리/묶음 AND·OR[Q,S] · 리터럴 조건 (컨트롤 없음) · 「이하」 vs 미만 경계[Q,S] · 자식 전부 건너뜀 → 묶음 건너뜀                                                                                                            |
| 7   | 렌더 파생값[R] · `.length`[JS] · JSX 식[R]                                                                                                                                                                                                            | Text `{{변수}}` 템플릿 · 「파생값 없음」 제약                                                                                                                                                       | 보기 이름 붙이기 (공유) · 보기 체인 (보기를 원본으로) · 집계 count[Q,S] · 묶기 0[Q,S] · Text 바인딩 역할 · 템플릿 `{count}`                                                                                                                 |
| 8   | 묶기·집계 개념[Q,S] · `reduce`/`Object.groupBy` 구현 · Map → 배열 (id) · ListBox `items` · 0 인 묶음 처리 · 렌더 파생[R]                                                                                                                              | Data 패널 테이블[Q,S] · 바인딩 · 「집계 없음」 제약                                                                                                                                                 | 바인딩 · 보기 · 묶기[Q,S] · 집계 count[Q,S] · 결과 행 모양 `{묶음 키, 집계 값}` · 역할·템플릿 · 0 인 묶음 처리                                                                                                                              |
| 9   | 조인/외래키 개념[Q,S] · `find`[JS] · `filter`[JS] · `useState`[R] · controlled[R] · 이벤트[R] · Select 조립 (Button/SelectValue/Popover/ListBox) · `selectedKey`/Key 타입 · `items` 옵션 · 「all」 항목/null 선택                                     | Data 패널 필드 추가[Q,S] · 템플릿 `{field}` · 바인딩 · 제약                                                                                                                                         | 참조 필드 타입[Q,S] · 경로 `{team.name}` · Select 옵션 바인딩 · 거르기 동작 · 변수[R] · 규칙[R] · 보기 · 조건[Q,S] · 건너뛰는 값[S] · Select 해제 불가 → `all` 항목                                                                         |
| 10  | 정렬 개념[Q] · `SortDescriptor` · controlled 정렬 (`sortDescriptor`/`onSortChange`) · `useCollator` · 타입별 비교 (number/string) · `toSorted` 불변[R] · state lifting[R] · Table 조립 (TableHeader/Column/TableBody/Row/Cell) · `useState`[R]        | Table 바인딩 · `allowsSorting` 열 · 규칙[R] · 대상 capability `sort` · 값 고르기 (이벤트 인자)[R]                                                                                                   | Table 바인딩 · `allowsSorting` · 변수 (object)[R] · 규칙[R] · 값 고르기[R] · `SortDescriptor` 모양 · 보기 정렬 = 변수 · 보기 공유 (이름) · 정렬 개념[Q]                                                                                     |
| 11  | `fetch`/async[JS] · `useEffect` 의존성 · `useAsyncList` load/reload · AbortSignal/경쟁 · `URLSearchParams` · 서버 거르기 ↔ 로컬 filter 제거 · 로딩 상태 · 「all」 param 생략                                                                          | endpoint (method·path·query param `{{ }}`) · 응답 매핑 · 바인딩 전환 · 변수[R] · 규칙[R] · `setFilterText` + 예약 이름 `{{ filterText }}` · `reload` 명령 · 같은 When 규칙 둘 + 순서 · 값 고르기[R] | endpoint · 응답 매핑 · 직렬화 형식 · 조건 → 요청 자동 · 변수 바뀌면 재요청 (debounce) · 바인딩 전환 (보기 유지)                                                                                                                             |
| 12  | `useListData` (update/getItem) · `useDragAndDrop` (getItems/acceptedDragTypes/onRootDrop/onInsert) · 드래그 데이터 직렬화 · `getText` async · Key string 화 · 열 컴포넌트 추출[R] · `slot="drag"` Button · 파생 개수[R] · 불변 갱신[R] · `filter`[JS] | Data 패널 테이블[Q,S] · 바인딩 · 「dnd 없음 · Do 하나」 제약 · 목록 명령 remove/append · 규칙[R]                                                                                                    | 보기 리터럴 조건[Q,S] · 한 collection 여러 바인딩 · dnd 배선 켜기 · When `onRootDrop`/`onInsert` · 이벤트 인자 `keys`/`items` + 값 고르기[R] · 목록 명령 `update` (필드·값) · 다중 Do · 집계 count[Q,S] · 보기 이름/체인 · 템플릿 · 규칙[R] |

B 열의 개념은 「불가 판정에 이르기까지 / 우회를 만들기까지」 필요한 것이라 A · C 와 같은 축으로 비교할 수 없다 (성공 기준을 못 채우는 과제 10 개).

---

## 3. 프로필 8 × 방식 3 — 새 개념 수

### 3-1. 12 과제 합 (과제마다 새 개념을 세어 더함 — 반복 등장이 그대로 쌓인다)

| 프로필 | A   | B (가능 2 + 불가 10 의 우회 개념) | C   |
| ------ | --- | --------------------------------- | --- |
| RQS    | 42  | 30                                | 48  |
| RQ     | 42  | 30                                | 54  |
| RS     | 43  | 30                                | 49  |
| QS     | 71  | 44                                | 65  |
| R      | 46  | 34                                | 73  |
| Q      | 71  | 44                                | 71  |
| S      | 72  | 44                                | 66  |
| 없음   | 75  | 48                                | 90  |

과제별 (RQS / 없음): A = 3/7 · 3/6 · 4/8 · 6/9 · 1/4 · 0/1 · 0/2 · 4/6 · 4/8 · 5/9 · 7/7 · 5/8. C = 3/7 · 2/7 · 4/8 · 2/7 · 3/8 · 3/5 · 4/6 · 5/7 · 4/9 · 5/9 · 6/6 · 7/11. B = 4/5 · 3/3 · 1/3 · 1/3 · 1/3 · 1/3 · 2/2 · 2/3 · 3/4 · 3/5 · 6/9 · 3/5.

읽는 법: R 축이 있으면 A 가 C 보다 적다 (R 42 vs 48 · R 단독 46 vs 73). Q · S 만 있으면 C 가 A 보다 적거나 비슷하다 (QS 71 vs 65 · Q 71 vs 71 · S 72 vs 66). 아무 축도 없으면 A 75 vs C 90 — C 가 많다. 차이의 출처: A 는 `useState` · controlled · 이벤트 세 개가 과제 1 ~ 5 · 9 · 10 에 되풀이되고 R 이 전부 깎아 가는 반면, C 는 「보기 · 거르기 동작 · 바인딩」 이 되풀이되고 어느 축도 깎지 못한다.

### 3-2. 고유 개념 수 (12 과제에서 한 번이라도 나온 개념을 중복 없이 셈)

| 프로필 | A (전체 48) | B (전체 21) | C (전체 41) |
| ------ | ----------- | ----------- | ----------- |
| RQS    | 35          | 17          | 29          |
| RQ     | 35          | 17          | 30          |
| RS     | 36          | 17          | 30          |
| QS     | 41          | 20          | 32          |
| R      | 39          | 18          | 38          |
| Q      | 41          | 20          | 33          |
| S      | 42          | 20          | 33          |
| 없음   | 45          | 21          | 41          |

중복을 빼면 C 가 모든 프로필에서 A 보다 적다 (R 단독만 38 vs 39 로 거의 같다). 두 표의 방향이 다른 이유: A 의 새 개념은 컴포넌트마다 다른 「조립 · prop 이름 · hook」 (48 중 35 가 한 번씩만 나오는 RAC/JS API) 이고, C 의 새 개념은 적은 수가 과제마다 되풀이된다. 어느 표가 「배우는 부담」 에 가까운지는 brief 가 정하지 않았다 — 둘 다 적는다.

---

## 4. 조용한 실패 지점 (오류 없이 아무 일도 없거나 틀린 결과)

형식: 「무엇을 하면 → 무엇이 보이나 → 알아챌 수 있나」. 「알아챔 (원인 불명)」 = 안 되는 건 보이지만 어디가 틀렸는지는 화면이 말해 주지 않음.

### A 스크립트 — 26

- **A1-a** 거른 결과를 `setUsers(users.filter(…))` 로 덮어씀 → male 뒤 all 로 돌아가도 male 만 → 되돌릴 때만 알아챔.
- **A1-b** 비교값 `'Male'` (대소문자) → male 누르면 빈 목록 → 알아챔 (원인 불명).
- **A2-a** `u.name.includes(query)` → 「ja」 로 James/Jane 안 나오고 「Ja」 로는 나옴 → 소문자로 안 쳐 보면 모름.
- **A2-b** `useFilter()` 옵션 없이 (`sensitivity` 기본 = 대소문자 구분) → A2-a 와 같은 결과 → 모름.
- **A3-a** 빈 선택 분기 빠뜨림 → 아무것도 안 고르면 빈 목록 → 알아챔.
- **A3-b** `<Tag id="VIP">` 와 데이터 `vip` 불일치 → 골라도 빈 목록 → 알아챔 (원인 불명).
- **A4-a** `createdAt <= range.end.toDate(tz)` → 끝 날짜 00:00 이라 그 날 행이 빠짐 → 경계 행을 세어 보지 않으면 모름.
- **A4-b** `CalendarDate` 와 `Date` 를 `>` 로 직접 비교 → 항상 false → 범위 고르면 빈 목록 → 알아챔 (원인 불명).
- **A4-c** `toDate('UTC')` vs 로컬 시간대 → 하루 어긋남 → 모름.
- **A5-a** `u.status !== 'Closed'` → 체크해도 closed 그대로 → closed 행을 알아야 알아챔.
- **A6-a** 괄호 빠짐 `a && b && female || age<25` → 25 미만 행이 검색 · 성별을 무시하고 나옴 → 결과가 그럴듯해 모름.
- **A6-b** filter 체인을 둘로 두고 한쪽만 `items` 에 넘김 → 한 조건만 동작 → 둘 다 시험하면 알아챔.
- **A7-a** `users.length` 를 넣음 → 항상 50 → 조건을 바꾸면 숫자가 안 변해 알아챔.
- **A8-a** `reduce` 로 묶으면 0 인 status 가 줄에서 사라짐 (closed 0 이면 2 줄) → 데이터에 따라 모름.
- **A9-a** `selectedKey` 가 string 으로 오고 `teamId` 는 number → `===` 매치 0 → 팀 고르면 빈 목록 → 알아챔 (원인 불명).
- **A9-b** `teams[u.teamId].name` (index = id 가정) → 한 칸 밀린 팀 이름 → 그럴듯해 모름.
- **A10-a** `items.sort()` 를 state 배열에 직접 → 참조 같아 재렌더 생략될 때 있음 → 가끔 안 바뀜, 재현 어려움.
- **A10-b** `a.name > b.name` (collator 없음) 또는 age 를 글자로 비교 → 로케일/자릿수 어긋남 → 두 자리 나이뿐이면 안 드러남.
- **A10-c** `direction` 처리 빠뜨림 → 화살표는 뒤집히는데 순서 그대로 → 두 번 눌러 보면 알아챔.
- **A11-a** `useEffect` 의존성에 `query` 빠짐 → 글자 쳐도 재요청 없음 → 알아챔 (lint 경고는 뜨지만 오류 아님).
- **A11-b** AbortSignal 안 넘김 → 빠르게 치면 늦은 응답이 덮어씀 → 가끔 틀린 결과, 모름.
- **A11-c** `gender=all` 을 그대로 보냄 → 서버가 모르는 값이면 빈 결과 → 알아챔 (원인 불명); 서버가 무시하면 무해.
- **A12-a** `getItems` 가 key 를 string 으로 직렬화 · `list.getItem(key)` 는 number → `update` 가 조용히 무시 → 카드 안 옮겨짐 → 알아챔 (원인 불명).
- **A12-b** `acceptedDragTypes` 와 `getItems` 타입 문자열 불일치 → 드롭 표시 안 뜸 → 알아챔 (원인 불명).
- **A12-c** `onRootDrop` 만 두고 `onInsert` 없음 → 항목 사이로 놓으면 거부, 빈 자리에 놓으면 됨 → 가끔 됨.
- **A12-d** `item.status = status` 직접 대입 (불변 갱신 아님) → 재렌더 없음 → 알아챔 (원인 불명).

### B 지금 빌더 — 18 (불가 과제의 실패는 「그럴듯한 시도 → 무반응」 한 종류가 대부분)

- **B1-a** RadioGroup `onChange → setFilterText` (대상 GridList) → Preview 에서 눌러도 목록 그대로 → 알아챔 (mock 에는 안 된다는 사실은 안 보임).
- **B1-b** `onChange → Set state gender` → 변수만 바뀌고 아무 것도 읽지 않음 → 알아챔 (원인 불명).
- **B2-a** SearchField `onChange → setFilterText` → B1-a 와 같음.
- **B3-a** TagGroup `onSelectionChange → setFilterText` / Set state → 무반응.
- **B4-a** DateRangePicker `onChange → Set state` (object) → 무반응.
- **B5-a** Checkbox `onChange → Set state` → 무반응.
- **B5-b** Checkbox `onChange → remove` (closed 를 지우려) → keys 없이 아무 것도 안 지워지거나 선택 항목이 지워져 체크 해제해도 안 돌아옴 → 데이터 손실, 되돌릴 때 알아챔.
- **B6-a** 조건별 Set state 규칙을 둘 만들어 「둘 다 걸러질 것」 으로 기대 → 무반응.
- **B7-a** Text 에 `{{ users.length }}` → 빈 글자 또는 그대로 → 알아챔.
- **B8-a** 손으로 친 `StatusCounts` 테이블 → 데이터가 바뀌어도 숫자 고정 → 데이터를 바꿔 보지 않으면 모름.
- **B9-a** 행 템플릿에 `{team.name}` / `{teams.name}` → 빈 글자 → 알아챔 (원인 불명).
- **B10-a** Do `sort` 를 고르고 Value 비움 → 머리 눌러도 GridList 그대로 → 알아챔 (원인 불명).
- **B10-b** When 에 `onSelectionChange` 를 고름 (이름이 비슷) → 머리 눌러도 무반응 → 알아챔 (원인 불명).
- **B11-a** 같은 When 의 `reload` 규칙이 `Set state` 보다 먼저 실행 → 한 번 뒤처진 결과 → 그럴듯해 모름.
- **B11-b** query param 값 `{{ Gender }}` (변수 이름 오타) → 빈 param → 전부 반환 → 안 걸러지는 건 보이나 원인 불명.
- **B11-c** `gender=all` 이 그대로 실림 (템플릿은 조건부 생략 불가) → 서버 따라 빈 결과/무시.
- **B11-d** setFilterText 의 Value 에 This event 인자를 안 고름 → 글자가 안 실려 전부 반환 → 알아챔 (원인 불명).
- **B12-a** 카드를 끌어 봄 → 드롭 대상 없음 → 알아챔.

### C 리서치 설계 — 31

- **C1-a** 건너뛸 키 `all` 을 안 적음 → all 누르면 `gender = 'all'` 로 걸러 빈 목록 → 알아챔 (원인 불명).
- **C1-b** 동작 대신 변수 + `onChange → Set state` 규칙만 손으로 만듦 (B 습관) → 보기에 조건 없음 → 무반응.
- **C2-a** 비교 기본값 「같음」 그대로 → 전체 이름 쳐야 나옴, 「ja」 는 빈 목록 → 알아챔 (원인 불명).
- **C2-b** 「포함」 이 대소문자를 구분한다면 (설명 없음) → A2-a 와 같은 결과 → 모름.
- **C3-a** 「배열 포함」 이 any 인지 all 인지 → all 이면 vip + new 고를 때 둘 다 가진 행만 → 줄어든 결과가 그럴듯해 모름.
- **C3-b** tag 값 `VIP` ↔ 데이터 `vip` → 빈 목록 → 알아챔 (원인 불명).
- **C4-a** 「사이」 의 끝 포함 여부 (설명 없음) → 경계 날 행 포함/제외 → 모름.
- **C4-b** Preview 가 어느 시간대로 날짜를 비교하는지 안 보임 → 하루 어긋남 가능 → 모름.
- **C5-a** 조건 값 칸에 「값 고르기 → hideClosed 변수」 (status ≠ true) → 체크해도 변화 없음 → 알아챔 (원인 불명).
- **C5-b** 비교 「같음」 → 체크하면 closed 만 남음 (반대) → 알아챔.
- **C6-a** OR 묶음 없이 루트에 두 조건 추가 → `female AND age ≤ 24` → 줄어든 결과가 그럴듯해 모름.
- **C6-b** 「이하 25」 → 25 세 포함 → 모름.
- **C6-c** 루트 묶음 자체를 OR 로 바꿈 → 검색 · 성별도 OR → 늘어난 결과가 그럴듯해 모름.
- **C7-a** Text 보기의 원본을 `Users` 로 두고 count → 항상 50 → 조건 바꾸면 안 변해 알아챔 (원인 불명).
- **C7-b** GridList 의 보기에 직접 count 를 추가 → GridList 가 한 행 `{count}` 로 바뀜 → 바로 알아챔.
- **C7-c** 템플릿 `{{count}}` (변수 문법) ↔ `{count}` (바인딩 문법) 혼동 → 글자 그대로/빈 → 알아챔.
- **C8-a** 묶기 없이 count → 한 줄 「50」 → 알아챔.
- **C8-b** ListBox 를 GridList 의 이름 붙인 보기에 묶고 거기에 묶기 추가 → GridList 도 3 줄로 바뀜 → 알아챔 (공유가 원인인 줄 모름).
- **C8-c** 0 인 status 가 줄에서 사라짐 (A8-a 와 같음) → 모름.
- **C8-d** 집계 결과 행의 키 이름 (`{status}` 인지 `{key}` 인지) 모름 → 빈 글자 → 알아챔 (원인 불명).
- **C9-a** 조건 필드 `team.name` ↔ Select 변수는 key (`id`) → 빈 목록 → 알아챔 (원인 불명).
- **C9-b** 참조 경로 이름 (`{team.name}` 인지 `{teamId.name}` 인지 — 필드 이름은 `teamId`) → 빈 글자 → 알아챔 (원인 불명).
- **C9-c** Select 는 선택 해제가 없어 한 번 고르면 「전부」 로 못 돌아감 — `all` 항목 + 건너뛸 키를 안 만들면 → 되돌리려 할 때 알아챔.
- **C10-a** 변수 타입을 string 으로 만들고 This event 인자 (object) 를 넣음 → 저장은 되나 보기 정렬이 못 읽음 → 무반응, 원인 불명.
- **C10-b** Table 은 `allowsSorting` 자체 정렬로 바뀌고 변수를 안 쓰면 GridList 만 안 따라감 → 알아챔.
- **C10-c** 보기 정렬엔 변수를 썼지만 Table 의 `sortDescriptor` 가 변수에 묶이지 않음 → 화살표와 순서가 어긋남 → 미묘.
- **C10-d** 보기를 공유하자 GridList 의 과제 1 · 2 조건이 Table 에도 적용 → 의도치 않게 걸러진 Table → 그럴듯해 모름.
- **C11-a** 바인딩을 endpoint 로 바꿀 때 기본 보기가 새로 생겨 조건이 사라진다면 (설명 없음) → Radio · Search 무반응 → 알아챔 (원인 불명).
- **C11-b** 「포함」 → `name_like=` 로 직렬화되는데 서버의 `_like` 뜻 (앞글자 vs 포함) 이 다름 → 결과가 그럴듯해 모름.
- **C12-a** When 을 `onInsert` 만 → 빈 열 · 여백에 놓으면 무반응 (`onRootDrop` 없음) → 가끔 됨.
- **C12-b** `update` 의 keys 에 「선택한 항목」 을 넣음 (드래그 인자 아님) → 선택이 없으면 무반응 → 알아챔 (원인 불명).
- **C12-c** 열마다 규칙을 복사하고 리터럴 `active` 를 안 바꿈 → 어느 열에 놓아도 active 열로 감 → 알아챔 (잘못된 열).
- **C12-d** 머리 Text 의 원본을 조건 없는 보기로 → 세 머리 모두 50 → 알아챔.

알아채기 어려운 것 (「모름」) 만 세면 A 11 (A2-a·b · A4-a·c · A6-a · A8-a · A9-b · A10-b · A11-b · A11-c 조건부 · A12-c 가끔) · B 4 (B8-a · B11-a · B11-c · B5-b 뒤늦게) · C 12 (C2-b · C3-a · C4-a·b · C6-a·b·c · C8-c · C10-c·d · C11-b · C12-a 가끔). A 와 C 가 비슷하고, 종류는 다르다 — A 는 타입 · 참조 · 경계 (코드 층), C 는 비교 방식의 뜻 (any/all · 포함 여부 · 이하/미만) 과 보기 공유의 부작용 (설계 층).

---

## 5. 방식 C 에서 가장 무거운 과제 3 개

| 과제   | 동작 수 (C 순위) | 새 개념 (없음 프로필) | 조용한 실패 | 어디를 보면 되나 (지점만)                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------------- | --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **12** | 69 (1 위)        | 11 (1 위)             | 4 (1 위)    | ① 같은 규칙 (`onRootDrop → update status = <열 값>`) 과 같은 머리 (`count`) 를 열 3 개에 각각 손으로 되풀이하는 자리 — 69 중 42. ② `onRootDrop` 과 `onInsert` 가 When 에 둘로 갈라져 있어 하나만 고르면 가끔 되는 자리 (C12-a). ③ `update` 의 keys 를 「드래그 인자」 와 「선택한 항목」 중 고르는 값 고르기 (C12-b). ④ 머리 개수가 열 조건과 따로 보기를 만들어야 하는 자리 (C12-d, 과제 7 과 같은 뿌리). |
| **10** | 19 (2 위)        | 9 (공동 2 위)         | 3           | ① 정렬만 「이 컨트롤로 거르기」 같은 한 번 동작이 없어 변수 · 규칙 · 보기 정렬 · 보기 공유 4 가지를 따로 잇는 자리. ② 변수 타입 (string/object) 과 `SortDescriptor` 모양을 저작자가 맞춰야 하는 자리 (C10-a). ③ Table 의 `sortDescriptor` 와 보기 정렬 변수가 한 곳에서 묶이지 않는 자리 (C10-c). ④ 보기를 공유하면 조건까지 같이 따라가는 자리 (C10-d).                                                   |
| **9**  | 12 (공동 3 위)   | 9 (공동 2 위)         | 3           | ① 참조 필드로 바꾼 뒤 경로 이름 (`team` vs `teamId`) 이 어디서 정해지는지 (C9-b). ② Select 변수 = key 인데 조건 필드로 `team.name` 도 고를 수 있는 자리 (C9-a). ③ Select 에 해제가 없어 「전부」 로 돌아갈 길이 저작자 몫인 자리 (C9-c) — 과제 1 의 `all` 건너뛰기와 같은 뿌리.                                                                                                                            |

과제 7 (9 동작 · 실패 3) 도 같은 뿌리를 공유한다 — 개수 하나를 보이려면 「보기 이름 붙이기 → 다른 Text 에서 그 보기를 원본으로 → count」 세 단계가 필요하고, GridList 보기에 바로 count 를 넣으면 목록이 깨진다 (C7-b). 과제 6 은 동작 9 로 중간이지만 「모름」 실패 3 개 (C6-a·b·c) 가 모두 조건 트리의 묶음 위치 · 경계 비교 선택에서 나온다.

---

## 6. 가정 목록 (설명에 없어 추정한 것)

1. **A 의 CSS 는 세지 않는다.** RAC 는 unstyled 라 DateRangePicker · Select · Table 은 CSS 없이 보기 흉하지만 동작한다. 넣으면 A 의 과제 4 · 9 · 10 · 12 는 각각 +10 ~ 20 줄.
2. **개념 기지 매핑 (R)**: `변수` ≈ `useState`, `규칙 When/Do` ≈ 이벤트 핸들러, `값 고르기 (이벤트 인자)` ≈ 핸들러 인자, 렌더에서 파생 계산 ≈ `useMemo`/JSX 식, 열 컴포넌트 추출 ≈ props 전달 → R 기지로 처리. `useEffect` 는 R 표에 없어 새 개념.
3. **개념 기지 매핑 (Q · S)**: 조건 (필드·비교·값) · 비교 방식 종류 · 조건 트리 AND/OR · 묶기 · 집계 · 참조 필드 = Q (WHERE · LIKE · 괄호 · GROUP BY · COUNT · JOIN) 와 S (한 줄 필터 · 필터 그룹 · group by · lookup · COUNTIF) 둘 다 기지. 정렬 = Q 만 기지. 「건너뛰는 값」 = S 만 기지 (Notion/Airtable 의 빈 값 필터 = 무시 동작). 「보기」 는 S 표에 없어 새 개념.
4. **JS 기본 (모두 기지)**: `filter` · `find` · `some` · `map` · `includes` · `.length` · 삼항 · `&&`/`||` 괄호 · `fetch`/async. `Set` · `reduce`/`Object.groupBy` · `toSorted` · `URLSearchParams` · AbortSignal 은 새 개념.
5. **공통 절차 1 회**: 팔레트에서 컴포넌트 추가 · Preview 탭 · 저장/HMR 은 첫 과제에서 배우고 이후 세지 않음 (동작 수에는 들어감).
6. **결과 왕복**: A 는 편집기와 브라우저가 나란히 있어 저장 1 회 = 1. B · C 는 Preview 탭으로 1 + 편집으로 돌아오기 1 = 2.
7. **B 과제 10**: 대상 capability `sort` 가 collection 컴포넌트에 있고 「값 고르기 → This event 인자 (sortDescriptor)」 를 받는다고 가정. 받지 않으면 B10 은 불가 (B 불가 11 개).
8. **B 과제 11**: 같은 When 에 규칙을 둘 만들 수 있고 생성 순서로 실행된다고 가정. 안 되면 Radio 전환은 불가 (reload 못 함). 또 mock API 가 `gender=all` 과 빈 `name_like=` 를 「거르지 않음」 으로 다룬다고 가정 (아니면 B11-c · A11-c 가 실패로 확정).
9. **B 우회의 테이블 손 입력**: 테이블 복제 · CSV 가져오기가 없다고 가정 → 테이블 1 개 = 이름 1 + 필드 9 × 2 + 행 25 × 9 칸 ≈ 244. 복제가 있으면 과제 1 · 12 우회가 ≈ 60 으로 준다 (그래도 요건은 못 채움).
10. **C 「이 컨트롤로 거르기」 기본값**: 비교 방식은 「필드 타입 × 값 모양」 으로 하나만 남으면 자동 (string × 단일 값 → 같음, date × 범위 → 사이), 건너뛰는 값은 컨트롤 종류별 기본 (SearchField 빈 글자 · 다중 선택 빈 선택 · Checkbox false) 이 미리 들어감. 지정 키 `all` 은 손으로 적는다. Checkbox 는 리터럴 값 칸이 하나 더 있고 변수는 게이트가 된다 (설명에 없음 — 없으면 과제 5 는 C 에서도 손 조립).
11. **C 보기 체인**: 보기의 「원본 collection」 자리에 이름 붙인 다른 보기를 넣을 수 있다고 가정 (과제 7 · 12 머리 개수). 안 되면 Text 보기에 같은 조건을 변수 참조로 다시 만들어야 해 과제 7 은 +6, 과제 12 는 +36.
12. **C 바인딩 전환 (과제 11)**: 바인딩의 collection 을 테이블 → endpoint 로 바꿔도 기본 보기의 조건이 남는다고 가정 (C11-a 는 반대일 때의 실패).
13. **C 직렬화 형식**: 「같음 → `field=` · 포함 → `field_like=` · 이상/이하 → `_gte`/`_lte`」 가 한 프리셋이라 1 번 고르면 끝. 형식마다 따로 고르면 +2.
14. **C 비교 방식에 미만/초과 없음**: 목록은 이상 · 이하만 있어 `age < 25` 는 「이하 24」 로 적는다 (나이는 정수 가정). 「포함」 은 대소문자를 무시한다고 가정 (C2-b 는 반대일 때).
15. **C 「배열 포함」 뜻**: any (하나라도) 로 가정. all 이면 과제 3 은 C3-a 실패가 확정.
16. **C dnd**: GridList 마다 「드래그 허용」 켜기 1 동작이 있고, `getItems` 직렬화 · key 복원은 빌더가 처리. `onRootDrop` 만 두면 목록 어디에 놓아도 root drop 으로 받는다 (RAC 기본 동작과 같다고 가정). 목록 명령 `update` 는 보기의 사본이 아니라 원본 collection 행을 바꿔 다른 열 보기가 같이 갱신된다고 가정.
17. **C 참조 경로 이름**: 필드 `teamId` 를 참조로 바꾸면 경로가 `team.name` 이 된다 (brief 예시) — 이름이 어디서 정해지는지 설명 없음 (C9-b).
18. **A 과제 12**: 열 3 개를 배열 + 한 컴포넌트로 돌린다 (복사 3 번이면 ≈ 40 줄). `onRootDrop` 만 두는 최소 경로 (A12-c 가 그 대가).
19. **A 과제 11**: 서버가 돌고 있고 CORS 등 환경 문제는 없다. `useAsyncList` 를 쓰고 `useEffect` 로 reload — 직접 `fetch` + `useEffect` 도 줄 수가 같다.
20. **데이터 모양**: `createdAt` 은 JS `Date` 또는 ISO 글자 (A4-a·b 는 모양에 따라 하나만 생긴다), `tags` 는 소문자 값, `Teams.id` 는 1 부터 (A9-b).

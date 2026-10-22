# 확인용 샘플 프로젝트

Builder 헤더의 프로젝트 파일 메뉴 → **가져오기** 로 연다. 가져오기는 열린 프로젝트의 내용을 파일 내용으로 바꾸므로, 새 프로젝트를 하나 만들고 그 안에서 가져온다. 파일은 library contract 47 (ADR-281) 이다 — 그 이전 Builder 에서는 열리지 않는다.

확인은 Builder 상단의 **Preview** 버튼 (publish 탭) 으로 한다. Canvas 는 규칙을 실행하지 않는다.

## `adr281-g6-check.composition.json` — ADR-281 G6

| 절                   | 무엇을 보나                                                                | 기대                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ① 패널 어휘          | 「원본」 칸 입력                                                           | 「사본」 칸이 같은 값 (`setValue` 값 = `!event.value`). Interactions 패널에서 When 묶음 머리글 · 「Show all of RAC」 · 값 소스 선택도 본다                   |
| ② 조상 상속          | 「frame 비활성화 / 활성화 / 읽기 전용 전환」 · 「다크 모드 / 라이트 모드」 | frame 안 Button · TextField · Checkbox 가 함께 바뀐다 · 화면 색 모드가 바뀐다                                                                                |
| ③ instance 규칙 상속 | instance A · B · C 누르기                                                  | A = toast 「원본 규칙 실행」 · B = 반응 없음 (끔) · C = 「C 의 자기 규칙」 (바꿈). instance 를 골라 Interactions 패널의 「Inherited from component」 도 본다 |
| ④ Form 제출          | 이름 · 이메일 입력 → 제출                                                  | 위 Form = 스텁에 `POST /submit` JSON (`{"fullName":…,"email":…}`) · 아래 Form = `/fail` → 「HTTP 500」 toast                                                 |

④ 는 로컬 스텁이 받는다 (endpoint `http://localhost:5199`):

```bash
node apps/builder/scripts/adr281-endpoint-stub.mjs        # 받은 요청을 터미널에 출력
```

## `global-variable-crud.composition.json` — 전역 변수 CRUD

전역 변수 `userName` (string) · `count` (number) · `isMember` (boolean) 와, 그 값을 읽고 (`{{ name }}`) 쓰는 버튼 — set (Create · Update) · reset (Delete) · increment · toggle. 「다른 페이지로 이동」 뒤에도 값이 유지되고 거기서 바꾼 값이 Home 에 보인다. 변수에 쓰는 값은 지금 리터럴만 된다 (입력 칸의 값을 변수에 쓰는 `!event.value` 는 아직 없다).

## `collection-crud.composition.json` — 목록 · 상세 CRUD (전역 변수 · Table · List · Form)

collection `Users` (id · name · email · role) 는 목록, `UserDetail` 은 상세 페이지가 서버에서 한 건만 읽는 collection 이다 (`getUser` = `GET /users/{{ params.id }}`). Form 이 Form 이 로컬 REST 스텁에 쓴 뒤 **「collection 다시 읽기」 (`reload` — `useAsyncList.reload`)** 로 목록을 바꾼다. 처음 표시는 실행 정책 **Auto** (Builder 가 Preview 를 열 때 `GET /users` 1회).

```bash
node apps/builder/scripts/crud-endpoint-stub.mjs          # http://localhost:5198/users (· /users/:id) — 메모리 저장, 다시 켜면 seed 3행
```

확인은 헤더의 **Compare Mode (Preview + Skia)** 로 한다 (왼쪽 Preview 가 규칙을 실행한다). 상단 **Preview** 버튼 (publish 탭) 은 파일의 seed 3행으로 시작하고, 「다시 읽기」 버튼이나 제출 뒤 reload 로 서버 항목을 읽는다.

| 페이지              | 무엇                                                                                              | 기대                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/`            | Table (Column 머리글 정렬) · ListBox (항목 = `/detail/{id}` 링크) · 추가 Form · 다시 읽기 버튼    | 추가 → `POST /users` → reload 로 두 목록에 새 행 · Form 비움. ListBox 항목을 누르면 그 행의 상세 페이지                                                     |
| Detail `/detail/:id` | frame 이 UserDetail 의 `{{ params.id }}` 항목에 묶임. 들어올 때 `GET /users/{{ params.id }}` 한 번 (경로가 바뀔 때만) | `{name} ({id})` · `{email} · {role}` 가 그 행. 수정 Form 은 그 값으로 시작 (`value="{name}"`) → `PUT /users` → UserDetail · Users reload · toast. 삭제 → `DELETE /users` → reload → Home |
| 공통                | 전역 변수 `lastAction` · `opCount`                                                                | 제출마다 Create / Update / Delete (`set`) · 작업 수 +1 (`increment`). 「전역 변수 초기화」 = 없음 · 0 (`reset`). Canvas 는 기본값을 그린다 (설계)               |

Canvas 의 Detail 페이지는 경로가 없어 UserDetail 의 표본 행을 그린다. Builder 에서 `getUser` 를 시험 실행하면 `{{ params.id }}` 를 풀 수 없다는 오류로 거부된다 (경로 param 은 Preview 가 읽는다).

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

## `collection-crud.composition.json` — 전역 변수 · Table · List · Form CRUD

collection `Users` (id · name · email · role) 하나를 Table · GridList · ListBox 셋이 읽고, Form 셋이 로컬 REST 스텁에 쓴다. 목록 갱신은 collection 실행 정책 **interval 2초** (연결 endpoint `listUsers` = `GET /users`) 가 맡는다.

```bash
node apps/builder/scripts/crud-endpoint-stub.mjs          # http://localhost:5198/users — 메모리 저장, 다시 켜면 seed 3행
```

확인은 헤더의 **Compare Mode (Preview + Skia)** 로 한다 — 왼쪽 Preview 가 규칙을 실행하고 Builder data store 의 갱신을 받는다. 상단 **Preview** 버튼 (publish 탭) 은 파일 스냅샷이라 제출은 되지만 목록이 다시 읽히지 않는다 (interval 실행은 Builder 가 한다).

| 동작     | 어디서                                   | 기대                                                                                                    |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Read     | Table · GridList · ListBox               | 같은 행. 스텁에 직접 넣은 행 (`curl -X POST …/users`) 도 2초 안에 셋 모두와 Canvas Table 에 나타난다    |
| Create   | Create Form → 추가                       | `POST /users` (본문 = 필드 값 JSON) → 새 행 `u4…`                                                       |
| 행 선택  | Table 행 (`onRowAction`) · GridList 항목 (`onAction`) | Update · Delete Form 의 id 칸이 그 행 id (`setValue` 값 = `!event.key`)                     |
| Update   | Update Form → 수정                       | `PUT /users` — 채운 칸만 바뀐다                                                                         |
| Delete   | Delete Form → 삭제                       | `DELETE /users` (본문 `{"id"}`) → 행이 사라진다                                                         |
| 전역 변수 | 각 제출 · 「전역 변수 초기화」          | `lastAction` = Create / Update / Delete (`set`) · `opCount` +1 (`increment`) · 초기화 = 없음 · 0 (`reset`). Canvas 는 기본값을 그린다 (설계) |

각 Form 은 제출 뒤 자기 `reset` 규칙으로 칸을 비운다 (규칙이 채운 id 칸 포함 — 본문은 제출 이벤트 때 이미 읽었다).

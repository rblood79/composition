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

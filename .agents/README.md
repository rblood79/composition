# Codex 운영

기본 실행 계약은 루트 `AGENTS.md`, 설정 설명은 `.codex/README.md`입니다.
프로젝트 도메인 지식은 `.agents/skills`와 `.agents/rules`에서 필요한 부분만 읽습니다.
`.claude/`가 공용 정본이며, Codex 전용 파일은 이 문서와
`.agents/rules/goal-lifecycle.md` 등 실파일입니다.

## 명령

| 목적                         | 명령                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| 세션 상태·변경 확인          | `pnpm run codex:session-start`                                |
| 인수인계 snapshot            | `pnpm run codex:snapshot`                                     |
| 보호 파일 검사               | `pnpm run codex:guard`                                        |
| 지정 파일 포맷               | `pnpm run codex:format -- <파일들>`                           |
| 지정 파일 포맷 검사          | `pnpm run codex:format:check -- <파일들>`                     |
| TS 검사                      | `pnpm run codex:typecheck`                                    |
| 등록·정본 미러 검사          | `pnpm run codex:registration`, `pnpm run codex:agent-catalog` |
| 스킬 형식·링크 검사          | `pnpm run codex:skills:validate`                              |
| 스킬 검증기·수동 라우터 회귀 | `pnpm run codex:skills:test`                                  |
| 하니스·포맷·evidence 회귀    | `pnpm run codex:workflow:test`                                |
| 수동 요청 라우팅 확인        | `pnpm run codex:route -- "<요청>"`                            |
| 로컬 hook self-test          | `pnpm run codex:hooks:selftest`                               |
| 전체 기본 검증               | `pnpm run codex:preflight`                                    |
| 작업 범위별 검증·evidence    | `pnpm run agent:work -- verify`                               |
| Evidence 조회                | `pnpm run agent:dashboard`                                    |

`codex:preflight`는 dirty 파일의 포맷을 검사하며 파일을 수정하지 않습니다.
명시적 포맷과 자동 hook은 `.prettierignore`를 공유하며 typed 원본 라이브러리와 생성 CSS를
제외합니다. 원본은 변경 노드의 기존 표기를 유지하고 CSS는 생성 명령으로 갱신합니다.
다른 작업자의 변경이 있으면 자신의 파일만 `codex:format -- <파일들>`로 처리하고, guard 및 변경에 해당하는
typecheck·registration·catalog·engine/text-axis 검사만 실행합니다.
명령 상세는 `pnpm run codex:harness -- help`를 참조합니다.

ADR의 여러 Phase를 진행하거나 인수인계 근거가 필요하면
`pnpm run agent:run -- start --understood-as "<범위>"`로 run을 열고,
실측을 `pnpm run agent:run -- evidence live-exercise pass --detail "<시나리오·결과>"`
형식으로 기록합니다. `report`와 `close`는 기록된 근거를 사용합니다.
단순 편집에 별도 run을 만들 필요는 없습니다.

`cross-check`·`live-exercise`는 최신 결과가 PASS이고 기록 당시 HEAD·파일 목록·내용이
현재 검증 범위와 일치할 때만 재사용합니다. snapshot 없는 옛 PASS와 이후 FAIL은 재검증합니다.
`agent:work -- verify --files a,b`로 범위를 정했다면 evidence 기록에도 `--files a,b`를
전달합니다. 범위 생략 시 run 시작 이후 커밋과 현재 dirty/untracked 파일을 사용합니다.
상태 기록은 검증 직후 남기며, 후속 코드 변경 뒤에는 해당 흐름을 다시 검증합니다.

catalog palette/CSS 생성 입력 변경 후에는 `pnpm run build:specs`가 필요한지 확인합니다. hook 등록과
새 세션의 trust 확인 방법은 `.codex/README.md`에 있습니다.

## 공용 스킬 검증

스킬 지침 변경 시 `pnpm run codex:skills:validate`와
`pnpm run codex:agent-catalog`를 실행합니다. 검증기·수동 라우터를 변경하면
`pnpm run codex:skills:test`로 실제 요청 입력과 정상·오류 fixture도 확인합니다.
`codex:preflight`의 `codex:skills:gate`와 `agent:work -- verify`가 이 검사를 변경 경로에
따라 선택합니다. Codex/agent 하니스·hook·포맷 정책 변경은 `codex:workflow:test`도 선택합니다.
특정 스킬만 검사하려면 `pnpm run codex:skills:validate -- .claude/skills/review`처럼
스킬 폴더 또는 `SKILL.md` 경로를 전달합니다.

로컬 검증기는 기존 `gray-matter`의 YAML 파서를 사용합니다. 필수 `name`·`description`,
이름과 폴더의 일치, 지원 필드 타입, 닫힌 코드펜스, `SKILL.md` 본문에 있는 일반
Markdown 링크·reference 정의의 로컬 대상 존재를 검사합니다. 웹 응답·anchor·하위
참조 문서의 재귀 검사·지침의 의미 정확성은 검사하지 않으므로, 경로 검사 통과를
실제 구현 행동이나 브라우저 검증 완료로 해석하지 않습니다.

이 저장소는 Claude/Codex가 `.claude/skills` 정본을 공유합니다. 범용 skill-creator의
검증기가 거부하는 `user-invocable`·`argument-hint`도 공용 확장으로 보존합니다.
`user-invocable`·`disable-model-invocation`은 boolean,
`argument-hint`는 문자열과 기존 `[힌트]` 표기의
단일 문자열 배열을 허용합니다. `license`·`compatibility`는 문자열,
`allowed-tools`는 문자열 또는 비어 있지 않은 문자열 배열, `metadata`는 YAML
mapping으로 검사하며 알 수 없는 필드는 오류로 보고합니다. 공용 frontmatter를
범용 검증기 통과 목적으로 삭제하거나 전역·플러그인 검증기를 변경하지 않습니다.

`codex:route`는 수동 참고 힌트입니다. 자동 prompt hook에는 등록하지 않으며,
사용자 요청과 선택한 스킬의 실제 계약이 실행 범위를 결정합니다.

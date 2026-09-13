# Codex 운영

기본 실행 계약은 루트 `AGENTS.md`, 설정은 `.codex/config.toml`입니다.
프로젝트 도메인 지식은 `.agents/skills`와 `.agents/rules`에서 필요한 부분만 읽습니다.
`.claude/`가 공용 정본이며, Codex 전용 파일은 이 문서와
`.agents/rules/goal-lifecycle.md` 등 실파일입니다.

## 명령

| 목적                      | 명령                                                          |
| ------------------------- | ------------------------------------------------------------- |
| 세션 상태·변경 확인       | `pnpm run codex:session-start`                                |
| 인수인계 snapshot         | `pnpm run codex:snapshot`                                     |
| 보호 파일 검사            | `pnpm run codex:guard`                                        |
| 지정 파일 포맷            | `pnpm run codex:format -- <파일들>`                           |
| TS 검사                   | `pnpm run codex:typecheck`                                    |
| 등록·정본 미러 검사       | `pnpm run codex:registration`, `pnpm run codex:agent-catalog` |
| 로컬 hook self-test       | `pnpm run codex:hooks:selftest`                               |
| 전체 기본 검증            | `pnpm run codex:preflight`                                    |
| 작업 범위별 검증·evidence | `pnpm run agent:work -- verify`                               |
| Evidence 조회             | `pnpm run agent:dashboard`                                    |

`codex:preflight`는 dirty 파일 전체를 포맷합니다. 다른 작업자의 변경이 있으면
자신의 파일만 `codex:format -- <파일들>`로 처리하고, guard 및 변경에 해당하는
typecheck·registration·catalog·engine/text-axis 검사만 실행합니다.
명령 상세는 `pnpm run codex:harness -- help`를 참조합니다.

ADR의 여러 Phase를 진행하거나 인수인계 근거가 필요하면
`pnpm run agent:run -- start --understood-as "<범위>"`로 run을 열고,
실측을 `pnpm run agent:run -- evidence live-exercise pass --detail "<시나리오·결과>"`
형식으로 기록합니다. `report`와 `close`는 기록된 근거를 사용합니다.
단순 편집에 별도 run을 만들 필요는 없습니다.

## 자동화 경계

`.codex/hooks.json`에는 보호 파일 확인과 변경 파일 포맷만 등록합니다.
스킬 목록·키워드 라우팅·fix 횟수·전체 dirty typecheck를 매 턴 주입하거나 실행하지 않습니다.
Spec 변경 후 `pnpm run build:specs`, 필요한 typecheck와 live 검증은 작업 범위에서 실행합니다.
기존 수동 router와 hook adapter는 호환 진입점이며 자동 등록하지 않습니다.

전역 `~/.codex/hooks.json`은 기존 세션 로그 export를 유지합니다.
공용 상태는 관련 프로젝트 작업에서 파일을 읽으며 매 턴 주입하지 않습니다. hook의 보조 검사와 실제 도구의 권한 경계는 별개입니다.
현재 실행 중인 세션의 주입 문구는 파일 수정으로 소급 교체되지 않습니다.

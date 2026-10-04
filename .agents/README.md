# Codex 운영

기본 실행 계약은 루트 `AGENTS.md`, 설정 설명은 `.codex/README.md`입니다.
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

catalog palette/CSS 생성 입력 변경 후에는 `pnpm run build:specs`가 필요한지 확인합니다. hook 등록과
새 세션의 trust 확인 방법은 `.codex/README.md`에 있습니다.

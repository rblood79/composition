# Codex Harness Guide

이 디렉터리는 `AGENTS.md`를 작게 유지하기 위한 Codex 전용 운영 index입니다.
항상 전체를 읽지 말고, 요청과 변경 파일에 맞는 항목만 선택해 여세요.

## 읽기 순서

| 상황           | 먼저 볼 파일                                   | 추가로 볼 파일                                              |
| -------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| 일반 작업      | `AGENTS.md`                                    | 필요 시 이 파일                                             |
| 코드 구현/수정 | `.agents/skills/composition-patterns/SKILL.md` | 관련 `.agents/rules/*` 1~3개                                |
| 새 컴포넌트    | `.agents/skills/component-design/SKILL.md`     | `react-aria` / `react-spectrum` 해당 component reference    |
| 렌더링 정합성  | `.agents/skills/cross-check/SKILL.md`          | `canvas-rendering.md`, `css-tokens.md`, `ssot-hierarchy.md` |
| ADR 생성/리뷰  | `create-adr` 또는 `review-adr` skill           | `adr-writing.md`, 대상 ADR, `docs/adr/README.md`            |
| Git/Changelog  | `.agents/rules/git-workflow.md`                | `.agents/rules/changelog.md`                                |
| Goal 완료 처리 | `.agents/rules/goal-lifecycle.md`              | 실제 `get_goal` 결과와 objective 일치 여부                  |

## Harness 명령

| 명령                               | 용도                                          |
| ---------------------------------- | --------------------------------------------- |
| `pnpm run codex:session-start`     | 우선 context, changelog header, git 상태 확인 |
| `pnpm run codex:route -- "<요청>"` | 요청을 skill/rule/gate 후보로 분류            |
| `pnpm run codex:snapshot`          | 변경 파일 기반 handoff/precompact snapshot    |
| `pnpm run codex:guard`             | 보호 파일 변경 차단                           |
| `pnpm run codex:format`            | 변경 파일 Prettier                            |
| `pnpm run codex:typecheck`         | TS 변경이 있을 때만 root type-check           |
| `pnpm run codex:preflight`         | guard → format → typecheck                    |
| `pnpm run codex:harness -- help`   | 단일 harness entrypoint                       |

운영 원칙:

- harness는 `scripts/codex/env.sh`를 통해 `mise hook-env`를 먼저 시도합니다.
- Codex에는 Claude식 자동 hook/statusline이 없습니다. 필요한 확인은 harness로
  직접 실행합니다.
- 신뢰도 낮은 statusline/usage graph wrapper는 만들지 않습니다. 지원 표면이
  없으면 한계를 보고합니다.
- goal 완료 처리는 `.agents/rules/goal-lifecycle.md`를 따릅니다. developer
  objective나 resume 문구가 보여도 `get_goal`이 `null`이면
  `update_goal(status="complete")`를 호출하지 않습니다.
- dirty worktree에서는 무관한 사용자 변경 파일을 포맷하거나 수정하지 않도록
  대상 파일을 명시해 gate를 실행합니다.

## 라우팅 매트릭스

| 요청 유형                     | 사용할 entrypoint                                              | 완료 전 기본 확인                                  |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| 상태/Zustand/store            | `composition-patterns` + `state-management.md`                 | targeted Vitest + `codex:typecheck`                |
| Canvas/WebGL/Preview 렌더링   | `cross-check` + `canvas-rendering.md`                          | spec/CSS/Canvas/Preview 경로 확인                  |
| CSS/token/spec drift          | `composition-patterns` + `css-tokens.md` + `ssot-hierarchy.md` | `pnpm run build:specs` 필요 여부 확인              |
| Layout/Yoga/grid/flex         | `layout-engine.md`                                             | layoutVersion/cache invalidation 확인              |
| React Aria/Spectrum component | `component-design` + 해당 reference                            | accessibility/keyboard contract 확인               |
| ADR review                    | `review-adr`                                                   | file:line 증거, README/status/changelog drift 확인 |
| 대량 family 검증              | `parallel-verify`                                              | 사용자가 병렬/서브에이전트를 명시한 경우만         |

## 자연어 발동 경계

| 대상                  | 발동 방식                                    | 경계                                          |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| Skill                 | 이름 직접 언급 또는 설명과 명확히 일치       | skill 본문을 읽고 필요한 reference만 추가     |
| `.agents/rules/*`     | 관련 작업 수행 중 자동 참고                  | macro rule만 먼저 읽고 legacy 상세는 필요 시  |
| Sub-agent             | 사용자 명시 요청이 있을 때만                 | 병렬/위임 요청이 없으면 로컬에서 수행         |
| Harness script        | 사용자가 요청하거나 완료 전 검증이 필요할 때 | 무관한 dirty 파일을 건드리지 않게 대상 좁히기 |
| `.agents/progress.md` | 세션 인수인계나 진행 맥락이 필요할 때        | legacy progress 전체를 기본으로 읽지 않기     |
| `.claude/*`           | legacy 상세가 꼭 필요할 때                   | Codex 직접 지시로 승격하지 않기               |

## Legacy 매핑

| Legacy Claude 자산                     | Codex 대응                                |
| -------------------------------------- | ----------------------------------------- |
| `.claude/commands/cross-check.md`      | `.agents/skills/cross-check/SKILL.md`     |
| `.claude/commands/new-adr.md`          | `.agents/skills/create-adr/SKILL.md`      |
| `.claude/commands/sweep.md`            | `.agents/skills/parallel-verify/SKILL.md` |
| `.claude/hooks/protect-files.sh`       | `pnpm run codex:guard`                    |
| `.claude/hooks/auto-format.sh`         | `pnpm run codex:format`                   |
| `.claude/hooks/type-check-gate.sh`     | `pnpm run codex:typecheck`                |
| `.claude/hooks/precompact-snapshot.sh` | `pnpm run codex:snapshot`                 |

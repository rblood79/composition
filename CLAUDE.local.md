# composition — 개인 워크플로 설정 (gitignore)

## 개인 설정

- 선호 모델: Opus 4.6 (1M context)
- 응답 언어: 한국어 (코드/기술 용어 영어 유지)
- Effort: max

## 병렬 세션 패턴

### Worktree 병렬 작업

대규모 리팩토링이나 독립적 기능 개발 시:

```bash
# 세션 1: 기능 구현
claude --worktree feature-branch

# 세션 2: 리뷰 + 테스트
claude --worktree review-branch
```

**worktree 통합 시 PR 불필요** (2026-04-27 정책): 격리 worktree 에서 commit → main 으로 직접 merge + push.

```bash
cd /Users/admin/work/composition       # main worktree
git merge <worktree-branch>
git push origin main
git worktree remove <worktree-path>
```

상세: `.claude/rules/git-workflow.md`

### 일상 워크플로

| 상황        | 접근                                  | 스킬                               |
| ----------- | ------------------------------------- | ---------------------------------- |
| 한 줄 수정  | 직접 수정                             | 스킵                               |
| 버그 수정   | Debugging → Fix → cross-check         | systematic-debugging               |
| 새 컴포넌트 | Brainstorm → Plan → TDD → cross-check | brainstorming → writing-plans      |
| 리팩토링    | Plan → Parallel agents                | dispatching-parallel-agents        |
| 렌더링 수정 | Debug → Fix → /cross-check 필수       | systematic-debugging + cross-check |

## 자주 쓰는 명령

```bash
pnpm dev                    # 개발 서버
pnpm build:specs            # Spec 빌드
pnpm type-check             # 타입 체크
```

## 장기 세션 관리

- 30분 또는 주요 단계 완료 시점마다 WIP 커밋 분할 (API 과부하/usage limit 중단 대비)
- 위험한 다중 파일 작업 전: 현재 진행상황 WIP 커밋 후 진행
- 세션 중단 대비: 남은 작업을 간결 메모로 남기고 다음 세션에서 이어가기

## Claude Code 2.1.x 활용 (2.1.110 기준)

### 세션 시작 플래그

| 플래그                     | 용도                                  | 언제 쓰는가                    |
| -------------------------- | ------------------------------------- | ------------------------------ |
| `--effort max`             | 최고 품질 추론                        | 복잡한 설계/리팩토링           |
| `--fork-session`           | 세션 복제 후 분기                     | 실험적 경로 테스트             |
| `--from-pr <NNN>`          | PR 연동 세션                          | PR 리뷰/수정 재개              |
| `--worktree <name>`        | git worktree 격리                     | 대규모 변경                    |
| `--tmux`                   | iTerm2/tmux 네이티브 패널             | 병렬 세션 `--worktree` 조합 시 |
| `--max-budget-usd <N>`     | 세션당 예산 상한                      | `-p` 스크립트 실행 시 보호     |
| `--bare`                   | 최소 모드 (hooks/MCP/auto-memory OFF) | 빠른 일회성 질문               |
| `--chrome` / `--no-chrome` | Chrome 통합 on/off                    | evaluator agent UI 검증 시 on  |

### Prompt Cache 최적화 (lean system prompt 기본화)

Claude Code **2.1.154+ 부터 lean system prompt 가 기본 적용** (Opus 4.8 포함; Haiku/Sonnet/Opus 4.7 이하 제외) — cwd/env/git status 등 동적 섹션 분리가 기본 동작으로 흡수됨. 과거 `.claude/settings.json` 의 `excludeDynamicSystemPromptSections: true` 는 **2.1.156 settings 스키마에서 제거** (root `additionalProperties` 로 에러 없이 무시되던 no-op) 되어 삭제함. cross-user cache 재사용률은 lean prompt 기본화로 유지.

### 출력 스타일

`.claude/output-styles/` 내 미리 정의된 모드 (2.1.x 호환):

- `debug-mode` — root-cause 규율. 증상 덮기 금지, 가설→검증→수정 순서
- `plan-mode` — 코드 수정 금지, 구조/대안/위험만 탐색

사용법: `/output-style debug-mode` (세션 중 전환) 또는 `--output-style plan-mode` (세션 시작 시).

### auto-mode 확인

```bash
claude auto-mode config      # 현재 유효 규칙 (설정+기본값 병합)
claude auto-mode defaults    # 기본 allow/soft_deny/environment
claude auto-mode critique    # 커스텀 규칙 AI 피드백
```

composition은 현재 기본값만 사용. 커스텀 규칙은 `~/.claude/settings.json` 의 `autoMode` 키로 설정 (프로젝트별 오버라이드 가능).

## 사용 통계 / 주간 리포트

```bash
# 주간 리포트 (INDEX.md 자동 갱신 포함)
.claude/hooks/weekly-report.sh 7

# INDEX.md 사용 빈도만 갱신 (기본 30일)
.claude/hooks/update-index.sh 30
```

### 자동 기록

| 파일                                               | 트리거                       | 스키마                                                                                                                                                                       |
| -------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stats/daily-log.jsonl`                            | SessionStart hook (하루 1회) | `{date, sessions, turns, skills:{...}, agents:{...}}`. skill/agent 카운트는 현존 세션 transcript(`~/.claude/projects/`) grep 집계 — 단조 누적 아님 (transcript 정리 시 감소) |
| `stats/archive/agents.deprecated-2026-04-30.jsonl` | (deprecated 보존)            | 구 SubagentStop hook 스키마 `{ts, agent_type, agent_id, session_id}`. SubagentStop hook 현재 미등록                                                                          |
| `stats/archive/agents.legacy.jsonl`                | (격리 보존)                  | 더 구 스키마 183건 — 참고용                                                                                                                                                  |

### daily-log.jsonl 활용

매일 최초 세션 접속 시 transcript grep 으로 재집계되는 스냅샷 (단조 누적 아님). 일간 활동량은 인접 2일 diff 로 추정 — transcript 정리된 날은 diff 가 음수일 수 있음:

```bash
# 전일 대비 diff (어제 ~ 오늘 사이 skill 활동)
jq -s '
  .[-1] as $t | .[-2] as $y
  | $t.skills | to_entries
  | map(. as $e | .key as $k
    | {key: $k, value: ($e.value - (($y.skills[$k]) // 0))})
  | map(select(.value > 0)) | from_entries
' .claude/stats/daily-log.jsonl

# 주간 트렌드 (최근 7일 요약)
jq -s '.[-7:] | map({date, turns, skill_kinds: (.skills | length), agent_kinds: (.agents | length)})' .claude/stats/daily-log.jsonl
```

### 주의

- INDEX.md 하단의 `<!-- usage-stats-begin ~ end -->` 블록은 `update-index.sh` 자동 생성 — 수동 편집 금지
- `daily-stats-snapshot.sh`는 SessionStart에서 백그라운드 실행 → 세션 시작 블로킹 없음

## 메모

- PostToolUse type-check 제거됨 → Stop hook만 type-check 실행 (매 편집마다 45s 대기 제거)
- 규칙 다이어트 적용: rules/ 파일은 원칙만, 상세는 skills/composition-patterns/reference/
- `.claude/settings.json` 의 `Bash(*)` 존재 시 개별 `Bash(cmd:*)` 항목은 redundant (2.1.x 재정비 결과)

# Skills 카탈로그 (composition)

일부 skill 은 `/` 명령 대응 (`.claude/commands/*.md` + `disable-model-invocation` skill — 목록은 시스템 프롬프트에 자동 로드, CLAUDE.md 의 표는 2026-08-31 제거). 사용 빈도는 본 파일 하단의 자동 갱신 블록 (`update-index.sh`) 참조.

## composition 전용 (프로젝트)

> **호출 정책 (2026-08-28, 병합 순서 ②)**: `disable-model-invocation: true` 스킬 (execute-adr / create-adr / match-target) 은 모델이 자동 호출할 수 없고 사용자가 `/name` 을 직접 입력해야 실행된다 — 자율 실행 표면 최소화 (메모리 execute-adr-surface-minimization / no-derived-adr-mid-execution 과 같은 실패 클래스 차단). subagent 정책은 호스트별로 다르다: Claude = CLAUDE.md §Agent 라우팅 매트릭스의 reviewer/evaluator 기본 경로, Codex = AGENTS.md "사용자 명시 시에만". 정책 열 ↔ frontmatter ↔ roster 일치는 `pnpm codex:agent-catalog` 가 검사한다.

| Skill                                                 | 용도                              | 발동 키워드                                    | 권장 시점                | 호출 정책 (Claude / Codex)                                                                         |
| ----------------------------------------------------- | --------------------------------- | ---------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| [composition-patterns](composition-patterns/SKILL.md) | 코드 규칙/패턴 인덱스             | "패턴", "규칙", "컨벤션"                       | 코드 작업 전             | 모델·사용자 / Codex 동일                                                                           |
| [cross-check](cross-check/SKILL.md)                   | CSS↔Skia 렌더링 정합성            | "정합성", "cross check", "렌더링 체크"         | 렌더링 수정 후 필수      | 모델·사용자 / Codex 동일                                                                           |
| [parallel-verify](parallel-verify/SKILL.md)           | 패밀리 일괄 검증                  | "전체 검증", "일괄", "패밀리"                  | 컴포넌트 5+개 변경       | 모델·사용자 / Codex 동일                                                                           |
| [component-design](component-design/SKILL.md)         | 새 컴포넌트 설계 워크플로         | "새 컴포넌트", "S2 전환"                       | 새 컴포넌트 생성 시      | 모델·사용자 / Codex 동일                                                                           |
| [create-adr](create-adr/SKILL.md)                     | ADR 생성 (번호 자동 + Risk-First) | "ADR 생성"                                     | 아키텍처 결정            | 사용자 전용 — Claude `/create-adr` 직접 입력 (모델 자동 호출 비활성) / Codex 사용자 명시 요청 시   |
| [review-adr](review-adr/SKILL.md)                     | ADR 검증                          | "ADR 리뷰"                                     | ADR 작성 후              | 모델·사용자 / Codex 동일                                                                           |
| [react-aria](react-aria/SKILL.md)                     | React Aria API 레퍼런스           | "react-aria"                                   | UI 컴포넌트 구현         | 모델·사용자 / Codex 동일                                                                           |
| [react-spectrum](react-spectrum/SKILL.md)             | Spectrum Props 레퍼런스           | "spectrum", "S2 props"                         | D2 props 설계            | 모델·사용자 / Codex 동일                                                                           |
| [match-target](match-target/SKILL.md)                 | Vision-based visual tuning 루프   | "이 이미지처럼", "match target", "참조에 맞춰" | 시각 정합/픽셀 조정 반복 | 사용자 전용 — Claude `/match-target` 직접 입력 (모델 자동 호출 비활성) / Codex 사용자 명시 요청 시 |
| [execute-adr](execute-adr/SKILL.md)                   | ADR phase 자율 실행               | "ADR 실행", "execute adr", "Phase 실행"        | ADR 다단계 자동 실행     | 사용자 전용 — Claude `/execute-adr` 직접 입력 (모델 자동 호출 비활성) / Codex 사용자 명시 요청 시  |

## 프로세스 규율 (프로젝트 정본)

외부 플러그인 skill 을 호출하지 않는다. 아래가 각 프로세스의 거처다.

| 프로세스           | 거처                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| 요구사항/대안 탐색 | 대안 2개 이상 비교 + `architect` agent — CLAUDE.md §전제·관점 의문 처리 |
| 다단계 계획·실행   | ADR design breakdown (`docs/adr/design/*-breakdown.md`) + `execute-adr` |
| 버그 root-cause    | `/fix` + `.claude/rules/` 의 실측 "Why" 기록                            |
| TDD                | `tester` agent (RED-GREEN-REFACTOR)                                     |
| 완료 직전 검증     | CLAUDE.md §완료 기준 (live behavior 게이트) + `/review`                 |
| 코드 리뷰          | `reviewer` agent / ADR 은 `review-adr`                                  |
| 격리 작업 공간     | worktree — `.claude/rules/git-workflow.md` §3                           |
| 2+ 독립 작업 병렬  | CLAUDE.md §병렬 워크플로 (Boris 패턴)                                   |
| 머지 전 정리       | `.claude/rules/git-workflow.md` (main 직접 push, web PR 금지)           |

<!-- usage-stats-begin -->
<!-- 자동 생성: .claude/hooks/update-index.sh — 수동 편집 금지 -->

## 📊 최근 30일 사용 빈도 (갱신: 2026-08-18)

### Skills

| Skill                | 호출 수 |
| -------------------- | ------: |
| create-adr           |      18 |
| review-adr           |       8 |
| new-adr              |       6 |
| execute-adr          |       6 |
| cross-check          |       3 |
| fix                  |       2 |
| composition-patterns |       2 |

### Agents

| Agent             | 호출 수 |
| ----------------- | ------: |
| general-purpose   |      27 |
| Explore           |      18 |
| reviewer          |      12 |
| debugger          |       7 |
| claude-code-guide |       1 |

<!-- usage-stats-end -->

# Skills 카탈로그 (composition)

자연어 트리거와 `/` 명령 양쪽으로 발동 가능. 사용 빈도는 본 파일 하단의 자동 갱신 블록 (`update-index.sh`) 참조.

## composition 전용 (프로젝트)

| Skill                                                 | 용도                              | 발동 키워드                                    | 30일 사용 | 권장 시점                |
| ----------------------------------------------------- | --------------------------------- | ---------------------------------------------- | --------: | ------------------------ |
| [composition-patterns](composition-patterns/SKILL.md) | 코드 규칙/패턴 인덱스             | "패턴", "규칙", "컨벤션"                       |         3 | 코드 작업 전             |
| [cross-check](cross-check/SKILL.md)                   | CSS↔Skia 렌더링 정합성            | "정합성", "cross check", "렌더링 체크"         |         3 | 렌더링 수정 후 필수      |
| [parallel-verify](parallel-verify/SKILL.md)           | 패밀리 일괄 검증                  | "전체 검증", "일괄", "패밀리"                  |         0 | 컴포넌트 5+개 변경       |
| [component-design](component-design/SKILL.md)         | 새 컴포넌트 설계 워크플로         | "새 컴포넌트", "S2 전환"                       |         0 | 새 컴포넌트 생성 시      |
| [create-adr](create-adr/SKILL.md)                     | ADR 생성 (번호 자동 + Risk-First) | "ADR 생성"                                     |         0 | 아키텍처 결정            |
| [review-adr](review-adr/SKILL.md)                     | ADR 검증                          | "ADR 리뷰"                                     |         1 | ADR 작성 후              |
| [react-aria](react-aria/SKILL.md)                     | React Aria API 레퍼런스           | "react-aria"                                   |         0 | UI 컴포넌트 구현         |
| [react-spectrum](react-spectrum/SKILL.md)             | Spectrum Props 레퍼런스           | "spectrum", "S2 props"                         |         1 | Spec props 설계          |
| [match-target](match-target/SKILL.md)                 | Vision-based visual tuning 루프   | "이 이미지처럼", "match target", "참조에 맞춰" |         0 | 시각 정합/픽셀 조정 반복 |
| [execute-adr](execute-adr/SKILL.md)                   | ADR phase 자율 실행               | "ADR 실행", "execute adr", "Phase 실행"        |         0 | ADR 다단계 land 자동화   |

## Superpowers (프로세스)

| Skill                          | 용도                       | 30일 사용 |
| ------------------------------ | -------------------------- | --------: |
| brainstorming                  | 요구사항/설계 탐색         |         0 |
| writing-plans                  | 다단계 계획                |         0 |
| executing-plans                | 계획 실행                  |         1 |
| systematic-debugging           | 버그 root-cause 4단계      |         1 |
| test-driven-development        | RED-GREEN-REFACTOR         |         0 |
| verification-before-completion | 완료 직전 evidence 검증    |         0 |
| requesting-code-review         | PR 전 리뷰 요청            |         0 |
| receiving-code-review          | 리뷰 피드백 처리           |         0 |
| using-git-worktrees            | 격리된 작업 공간           |         0 |
| dispatching-parallel-agents    | 2+ 독립 작업 병렬          |         0 |
| subagent-driven-development    | 계획을 서브에이전트로 실행 |         0 |
| finishing-a-development-branch | 머지 전 정리               |         0 |
| writing-skills                 | 새 skill 작성              |         0 |

## 커버리지 목표

- 현재: 9/30 (30%)
- 2주 후 목표: ≥ 60% (18/30)
- 미사용 핵심 3종: `brainstorming`, `writing-plans`, `verification-before-completion`
- UserPromptSubmit hook(`route-prompt.sh`)이 키워드 기반으로 자동 힌트 주입

<!-- usage-stats-begin -->
<!-- 자동 생성: .claude/hooks/update-index.sh — 수동 편집 금지 -->

## 📊 최근 30일 사용 빈도 (갱신: 2026-05-09)

### Skills

| Skill                                      | 호출 수 |
| ------------------------------------------ | ------: |
| review-adr                                 |      30 |
| create-adr                                 |      17 |
| composition-patterns                       |      11 |
| superpowers:systematic-debugging           |      10 |
| superpowers:writing-plans                  |       9 |
| superpowers:subagent-driven-development    |       8 |
| superpowers:brainstorming                  |       8 |
| cross-check                                |       7 |
| parallel-verify                            |       5 |
| superpowers:executing-plans                |       4 |
| update-config                              |       3 |
| superpowers:using-superpowers              |       3 |
| superpowers:using-git-worktrees            |       3 |
| superpowers:dispatching-parallel-agents    |       3 |
| execute-adr                                |       3 |
| codex:rescue                               |       3 |
| superpowers:verification-before-completion |       2 |
| superpowers:test-driven-development        |       1 |
| superpowers:requesting-code-review         |       1 |
| superpowers:finishing-a-development-branch |       1 |
| new-adr                                    |       1 |
| codex:setup                                |       1 |
| codex:codex-result-handling                |       1 |
| claude-code-guide                          |       1 |

### Agents

| Agent                     | 호출 수 |
| ------------------------- | ------: |
| implementer               |     114 |
| Explore                   |      69 |
| general-purpose           |      62 |
| reviewer                  |      54 |
| architect                 |      30 |
| debugger                  |      18 |
| documenter                |      14 |
| superpowers:code-reviewer |      12 |
| codex:codex-rescue        |      11 |
| refactorer                |       9 |
| evaluator                 |       8 |
| tester                    |       6 |

<!-- usage-stats-end -->

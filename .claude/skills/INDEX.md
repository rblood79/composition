# Skills 카탈로그 (composition)

일부 skill 은 `/` 명령 대응 (매핑: CLAUDE.md §Slash Commands). 사용 빈도는 본 파일 하단의 자동 갱신 블록 (`update-index.sh`) 참조.

## composition 전용 (프로젝트)

| Skill                                                 | 용도                              | 발동 키워드                                    | 권장 시점                |
| ----------------------------------------------------- | --------------------------------- | ---------------------------------------------- | ------------------------ |
| [composition-patterns](composition-patterns/SKILL.md) | 코드 규칙/패턴 인덱스             | "패턴", "규칙", "컨벤션"                       | 코드 작업 전             |
| [cross-check](cross-check/SKILL.md)                   | CSS↔Skia 렌더링 정합성            | "정합성", "cross check", "렌더링 체크"         | 렌더링 수정 후 필수      |
| [parallel-verify](parallel-verify/SKILL.md)           | 패밀리 일괄 검증                  | "전체 검증", "일괄", "패밀리"                  | 컴포넌트 5+개 변경       |
| [component-design](component-design/SKILL.md)         | 새 컴포넌트 설계 워크플로         | "새 컴포넌트", "S2 전환"                       | 새 컴포넌트 생성 시      |
| [create-adr](create-adr/SKILL.md)                     | ADR 생성 (번호 자동 + Risk-First) | "ADR 생성"                                     | 아키텍처 결정            |
| [review-adr](review-adr/SKILL.md)                     | ADR 검증                          | "ADR 리뷰"                                     | ADR 작성 후              |
| [react-aria](react-aria/SKILL.md)                     | React Aria API 레퍼런스           | "react-aria"                                   | UI 컴포넌트 구현         |
| [react-spectrum](react-spectrum/SKILL.md)             | Spectrum Props 레퍼런스           | "spectrum", "S2 props"                         | D2 props 설계            |
| [match-target](match-target/SKILL.md)                 | Vision-based visual tuning 루프   | "이 이미지처럼", "match target", "참조에 맞춰" | 시각 정합/픽셀 조정 반복 |
| [execute-adr](execute-adr/SKILL.md)                   | ADR phase 자율 실행               | "ADR 실행", "execute adr", "Phase 실행"        | ADR 다단계 자동 실행     |

## Superpowers (프로세스)

| Skill                          | 용도                       |
| ------------------------------ | -------------------------- |
| brainstorming                  | 요구사항/설계 탐색         |
| writing-plans                  | 다단계 계획                |
| executing-plans                | 계획 실행                  |
| systematic-debugging           | 버그 root-cause 4단계      |
| test-driven-development        | RED-GREEN-REFACTOR         |
| verification-before-completion | 완료 직전 evidence 검증    |
| requesting-code-review         | PR 전 리뷰 요청            |
| receiving-code-review          | 리뷰 피드백 처리           |
| using-git-worktrees            | 격리된 작업 공간           |
| dispatching-parallel-agents    | 2+ 독립 작업 병렬          |
| subagent-driven-development    | 계획을 서브에이전트로 실행 |
| finishing-a-development-branch | 머지 전 정리               |
| writing-skills                 | 새 skill 작성              |

<!-- usage-stats-begin -->
<!-- 자동 생성: .claude/hooks/update-index.sh — 수동 편집 금지 -->

## 📊 최근 30일 사용 빈도 (갱신: 2026-07-11)

### Skills

| Skill | 호출 수 |
| --- | ---: |
| composition-patterns | 12 |
| superpowers:systematic-debugging | 10 |
| systematic-debugging | 7 |
| review-adr | 6 |
| execute-adr | 6 |
| cross-check | 6 |
| create-adr | 5 |
| superpowers:brainstorming | 4 |
| brainstorming | 4 |
| writing-plans | 3 |
| superpowers:writing-plans | 3 |
| react-aria | 3 |
| test-driven-development | 2 |
| superpowers:subagent-driven-development | 2 |
| executing-plans | 2 |
| using-superpowers | 1 |
| superpowers:writing-skills | 1 |
| superpowers:test-driven-development | 1 |
| superpowers:finishing-a-development-branch | 1 |
| superpowers:executing-plans | 1 |
| superpowers:dispatching-parallel-agents | 1 |
| new-adr | 1 |
| codex:setup | 1 |
| codex:rescue | 1 |

### Agents

| Agent | 호출 수 |
| --- | ---: |
| Explore | 205 |
| reviewer | 40 |
| general-purpose | 36 |
| implementer | 29 |
| debugger | 13 |
| Plan | 3 |
| codex:codex-rescue | 3 |
| claude-code-guide | 3 |
| documenter | 2 |
| architect | 2 |

<!-- usage-stats-end -->

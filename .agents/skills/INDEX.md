# Codex Skill Catalog

composition 전용 skill index입니다. 한 번에 모두 읽지 말고, 요청과 직접 맞는
skill만 여세요.

## Core Skills

| Skill                  | 경로                                                           | Trigger                                     | 같이 볼 항목                           |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| `composition-patterns` | [composition-patterns/SKILL.md](composition-patterns/SKILL.md) | 코드 규칙, 상태, 렌더링, 아키텍처 패턴      | `.agents/rules/*`                      |
| `component-design`     | [component-design/SKILL.md](component-design/SKILL.md)         | 새 컴포넌트 설계/구현, 구조적 컴포넌트 변경 | `react-aria`, `react-spectrum`         |
| `cross-check`          | [cross-check/SKILL.md](cross-check/SKILL.md)                   | CSS/WebGL/Canvas/Preview 정합성             | `canvas-rendering.md`, `css-tokens.md` |
| `parallel-verify`      | [parallel-verify/SKILL.md](parallel-verify/SKILL.md)           | 사용자가 병렬/서브에이전트 검증을 명시      | component family별 범위                |
| `create-adr`           | [create-adr/SKILL.md](create-adr/SKILL.md)                     | 새 ADR 생성                                 | `adr-writing.md`                       |
| `review-adr`           | [review-adr/SKILL.md](review-adr/SKILL.md)                     | ADR/설계 문서 리뷰                          | 대상 ADR, README, changelog            |
| `react-aria`           | [react-aria/SKILL.md](react-aria/SKILL.md)                     | React Aria API/접근성 reference             | 해당 component reference               |
| `react-spectrum`       | [react-spectrum/SKILL.md](react-spectrum/SKILL.md)             | Spectrum Props/API reference                | 해당 component reference               |

## Claude Command Aliases

| 예전 표현      | Codex 사용 방식                                              |
| -------------- | ------------------------------------------------------------ |
| `/cross-check` | `cross-check` skill                                          |
| `/new-adr`     | `create-adr` skill                                           |
| `/sweep`       | `parallel-verify` skill, 단 사용자가 병렬 검증을 명시한 경우 |
| `/impl`        | `component-design` + `composition-patterns`                  |

## 검증

- 완료 전 기본 gate: `pnpm run codex:preflight`
- goal 완료 처리 전: `.agents/rules/goal-lifecycle.md`에 따라 `get_goal`로
  active goal과 objective 일치 여부 확인
- Spec/CSS 생성 영향: `pnpm run build:specs` 필요 여부 확인
- 라우팅이 애매하면: `pnpm run codex:route -- "<요청>"`

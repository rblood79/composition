# Composition 스킬 목록 (Codex)

Codex에는 각 skill의 이름과 description이 제공됩니다. 이 파일은 경로 확인용이며
작업과 관련된 `SKILL.md`와 참조 문서만 엽니다. 공용 정본은 `.claude/skills`입니다.

## 작업별 진입점

- [composition-patterns](composition-patterns/SKILL.md): canonical 상태·레이아웃·렌더링 계약
- [component-design](component-design/SKILL.md): 새 컴포넌트·S2 전환
- [cross-check](cross-check/SKILL.md): Canvas·Preview 시각 정합성
- [react-aria](react-aria/SKILL.md): 설치된 RAC API
- [react-spectrum](react-spectrum/SKILL.md): Spectrum Props 참조
- [fix](fix/SKILL.md): 버그 원인 분석과 수리
- [review](review/SKILL.md): 코드 리뷰
- [evaluate](evaluate/SKILL.md): 실행 중인 Builder 검증
- [review-adr](review-adr/SKILL.md): ADR 문서 리뷰
- [create-adr](create-adr/SKILL.md): user-only, 사용자가 새 ADR 작성을 요청할 때
- [execute-adr](execute-adr/SKILL.md): user-only, 사용자가 ADR 실행 범위를 지정할 때

## 추가 계약

- page-bound selection 변경: [state-management.md](../rules/state-management.md)의
  Selection Consumer Contract.
- 명시적 Goal의 재개·완료: [goal-lifecycle.md](../rules/goal-lifecycle.md).
- skill 링크·호출 정책·심링크 정합성: `pnpm run codex:agent-catalog`.

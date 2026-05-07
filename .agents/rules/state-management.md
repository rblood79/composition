# State Management Rule

Codex용 상태 관리 규칙 엔트리포인트입니다.

- 정본 상세: [legacy `.claude/rules/state-management.md`](../../.claude/rules/state-management.md)
- 관련 스킬: [composition-patterns](../skills/composition-patterns/SKILL.md)

핵심:

- 파이프라인 순서 보존: Memory → Index → History → DB → Preview → Rebalance
- store update와 preview sync, persistence를 분리해서 본다
- canonical cutover 경로에서는 `CompositionDocument.children[]`가 order SSOT다.
  legacy `order_num`은 export/compat mirror로 보고, props update가 canonical
  sibling 위치를 바꾸지 않는지 확인한다.
- origin/instance 상태는 canonical `reusable: true` / `type:"ref"` / `ref` /
  `descendants` shape를 우선한다. legacy `componentRole/masterId`는 adapter
  mirror다.

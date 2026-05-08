# State Management Rule

Codex용 상태 관리 규칙 엔트리포인트입니다.

- 정본 상세: [legacy `.claude/rules/state-management.md`](../../.claude/rules/state-management.md)
- 관련 스킬: [composition-patterns](../skills/composition-patterns/SKILL.md)

핵심:

- 파이프라인 순서 보존: Memory → Index → History → DB → Preview → Rebalance
- store update와 preview sync, persistence를 분리해서 본다.
- project-state DB persistence는 canonical `db.documents`만 사용한다.
  `db.pages`, `db.elements`, `db.layouts` local mirror read/write는 제거된
  surface이므로 재도입하지 않는다.
- runtime mutation/read/render source는 canonical document가 primary다.
  canonical mutation 뒤 legacy `Element[]` mirror를 `setElements()`로 다시 쓰는
  write-back을 재도입하지 않는다. transition cache가 필요하면 canonical-derived
  read-only snapshot으로 owner/제거 phase를 명시한다.
- History/Undo full snapshot sync는 canonical full-replace semantics를 지켜야 한다.
  page/layout shell과 structural `body`는 유지하되, incoming snapshot에 없는
  runtime node가 `db.documents`에 남아 refresh 후 되살아나면 안 된다.
  add/remove/group 계열 canonical node event schema 전환은 HIGH-risk 계약 변경으로
  별도 승인 후 진행한다.
- canonical cutover 경로에서는 `CompositionDocument.children[]`가 order SSOT다.
  `Element.order_num`은 제거됐으므로 props update/history/drag/drop/IndexedDB
  `elements` payload에 다시 만들지 않는다. page/layout order도 document root
  `children[]` source order에서 파생하며 `pages.order_num`,
  `layouts.order_num`, page/layout `metadata.order_num`을 runtime source로
  다시 만들지 않는다.
- origin/instance 상태는 canonical `reusable: true` / `type:"ref"` / `ref` /
  `descendants` shape를 우선한다. legacy `componentRole/masterId`는 adapter
  mirror다.

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
  add/update/remove 같은 Builder store helper도 canonical mutation을 먼저 수행하고,
  `elements`/`elementsMap`/`childrenMap`은 derived store cache로 그 다음 갱신한다.
  canonical mutation 뒤 legacy `Element[]` mirror를 `setElements()`로 다시 쓰는
  write-back을 재도입하지 않는다. transition cache가 필요하면 canonical-derived
  read-only snapshot으로 owner/제거 phase를 명시한다.
- canonical runtime/history 코드에서 `RefNode.descendants` 직접 traversal이나
  legacy `layout_id` 직접 판정이 필요하면 adapter/store helper boundary를 먼저
  둔다. Builder runtime/history helper는 `canonicalElementsView`의 ref override
  helper와 `frameMirror`의 frame ownership helper를 사용해 ADR-113/116 grep gate를
  유지한다.
- History/Undo full snapshot sync는 canonical full-replace semantics를 지켜야 한다.
  page/layout shell과 structural `body`는 유지하되, incoming snapshot에 없는
  runtime node가 `db.documents`에 남아 refresh 후 되살아나면 안 된다.
  add/remove/group/ungroup 신규 History entry는 canonical `canonicalEvents`
  insert/remove/move sequence를 기록하고 active canonical document에 replay해야 한다.
  legacy `element`/`childElements`/`elements`/`prevElements` snapshot fields는 기존
  IndexedDB history entry, update/batch fallback, auto-detach batch 같은
  compatibility/fallback 경계에서만 허용한다.
- Page shell bridge는 canonical page/body append 직후 누락된 body shell을 보존해야
  하며, page/origin 삭제 후 stale canonical-derived snapshot으로 deleted node를
  다시 `db.documents`에 쓰면 안 된다.
- Preview/Compare Mode는 active canonical document presence를 기준으로 동작해야 한다.
  Runtime Compare Mode store flag를 무시해 canonical document sync를 건너뛰거나,
  legacy preview `elements[]` 길이만 보고 canonical-only Preview를 빈 화면으로
  오판하면 안 된다.
- canonical cutover 경로에서는 `CompositionDocument.children[]`가 order SSOT다.
  `Element.order_num`은 제거됐으므로 props update/history/drag/drop/IndexedDB
  `elements` payload에 다시 만들지 않는다. page/layout order도 document root
  `children[]` source order에서 파생하며 `pages.order_num`,
  `layouts.order_num`, page/layout `metadata.order_num`을 runtime source로
  다시 만들지 않는다.
- origin/instance 상태는 canonical `reusable: true` / `type:"ref"` / `ref` /
  `descendants` shape를 우선한다. legacy `componentRole/masterId`는 adapter
  mirror다.

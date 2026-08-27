/**
 * ADR-158 Phase 3 — Preview 인터랙션 실행.
 *
 * 구성은 둘뿐이다: 규칙을 동작으로 바꾸는 `dispatcher` (순수 함수) 와, 요소별
 * callback props 를 만드는 `bindings` (색인). 수신은 신설하지 않았다 — 규칙은
 * 이미 `UPDATE_CANONICAL_DOCUMENT` 로 preview 에 도착해 `canonicalDocument.events`
 * 에 들어 있다.
 */
export {
  executeInteractionRule,
  type DispatchDeps,
  type DispatchOutcome,
} from "./dispatcher";
export {
  buildInteractionIndex,
  createElementHandlers,
  EMPTY_INTERACTION_INDEX,
  type InteractionIndex,
} from "./bindings";

/**
 * ADR-158 bindings(규칙 색인)는 2026-08-17 에 `packages/shared/src/interactions/bindings.ts`
 * 로 승격됐다 — publish 앱이 같은 색인을 소비해야 하기 때문 (정책 한 곳).
 * 본 파일은 기존 preview 내부 import 경로를 보존하는 re-export 포워더다.
 */
export {
  buildInteractionIndex,
  createElementHandlers,
  EMPTY_INTERACTION_INDEX,
  type InteractionIndex,
} from "@composition/shared";

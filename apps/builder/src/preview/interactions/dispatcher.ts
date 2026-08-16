/**
 * ADR-158 dispatcher 는 2026-08-17 에 `packages/shared/src/interactions/dispatcher.ts`
 * 로 승격됐다 — publish 앱이 같은 dispatcher 를 소비해야 하기 때문 (정책 한 곳).
 * 본 파일은 기존 preview 내부 import 경로를 보존하는 re-export 포워더다.
 */
export {
  executeInteractionRule,
  type DispatchDeps,
  type DispatchOutcome,
} from "@composition/shared";

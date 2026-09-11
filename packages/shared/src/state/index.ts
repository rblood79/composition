/**
 * ADR-214 — Variables 소유자 모델 (builder · preview · publish 공용).
 *
 * Phase 1: 모델 · 가시성 · 복제 재매핑 · 의존 digest. Phase 2 `runtimeState.ts` ·
 * Phase 3 `template.ts` 가 같은 디렉터리에 온다.
 */
export * from "./variable.types";
export * from "./visibility";
export * from "./cloneState";
export * from "./stateDependencies";

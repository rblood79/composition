/**
 * ADR-214 — Variables 소유자 모델 (builder · preview · publish 공용).
 *
 * Phase 1: 모델 · 가시성 · 복제 재매핑 · 의존 digest. Phase 2: `runtimeState.ts` (값 store).
 * Phase 3: `template.ts` (`{{ }}` 해석기).
 */
export * from "./variable.types";
export * from "./visibility";
export * from "./cloneState";
export * from "./stateDependencies";
export * from "./runtimeState";
export * from "./template";
export * from "./implicitState";
export * from "./usage";

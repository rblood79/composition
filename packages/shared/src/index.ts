/**
 * @composition/shared
 *
 * 🚀 Phase 10 B2.2: 공유 패키지 메인 엔트리포인트
 *
 * Builder와 Publish App에서 공통으로 사용하는 타입, 유틸리티, 컴포넌트를 제공합니다.
 *
 * @since 2025-12-11 Phase 10 B2.2
 */

// Types
export * from "./types";

// Utils
export * from "./utils";

// Hooks
export * from "./hooks";

// Runtime (Phase 3)
export * from "./runtime";

// Catalog (ADR-142) — PrimitiveBinding / PropContract / toRacProps
export * from "./catalog";

// Collections (ADR-912 영역 B) — resolveCollectionItems 단일 계약 (DOM/Skia 공통 source)
export * from "./collections";

// Interactions (ADR-158) — CAPABILITY_REGISTRY (When/Do 어휘 SSOT) + InteractionRule
export * from "./interactions";

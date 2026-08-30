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

// Catalog (ADR-142) — PrimitiveBinding / PropContract / toRacProps
export * from "./catalog";

// Collections (ADR-912 영역 B) — resolveCollectionItems 단일 계약 (DOM/Skia 공통 source)
export * from "./collections";

// Interactions (ADR-158) — CAPABILITY_REGISTRY (When/Do 어휘 SSOT) + InteractionRule
export * from "./interactions";

// 공유 컴포넌트가 스스로 그리는 상태 문구 (ADR-200 후속) — 주변 locale 로 해소된다
export * from "./i18n";

// selectionStyle(RSP) ↔ selectionBehavior(RAC) 변환 (2026-08-21) — DOM 컴포넌트·렌더러와
//   Skia(buildSpecNodeData 의 체크박스 가시성 판정)가 **같은 식**을 써야 두 표면이 갈리지
//   않는다. React 의존 없는 순수 모듈이라 barrel 노출이 안전하다.
export * from "./components/selectionStyle";

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

// ADR-152 §2-3 — DataChange IR (zod + JSON Schema 단일 소스)
export * from "./schemas/dataChange";

// Interactions (ADR-158) — CAPABILITY_REGISTRY (When/Do 어휘 SSOT) + InteractionRule
export * from "./interactions";

// ADR-201 — FileUpload 런타임 층 (엔진 lazy 로더 · 유입 컨텍스트 · endpoint 해석 · 평문 토큰 게이트)
export * from "./upload";

// State (ADR-214) — VariableDef / VariableOwner · 가시성 사슬 · 복제 재매핑 · 의존 digest
export * from "./state";

// 공유 컴포넌트가 스스로 그리는 상태 문구 (ADR-200 후속) — 주변 locale 로 해소된다
export * from "./i18n";

// selectionStyle(RSP) ↔ selectionBehavior(RAC) 변환 (2026-08-21) — DOM 컴포넌트·렌더러와
//   Skia(buildSpecNodeData 의 체크박스 가시성 판정)가 **같은 식**을 써야 두 표면이 갈리지
//   않는다. React 의존 없는 순수 모듈이라 barrel 노출이 안전하다.
export * from "./components/selectionStyle";

// ADR-227 — 문서 소유 토큰 세트 컬렉션 (pure)
export * from "./theme";

// ADR-236 — 편집기 도메인 술어 (body 등 타입 판정 한 곳, pure)
export * from "./domain";

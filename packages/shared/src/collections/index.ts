/**
 * collection items 단일 계약 (ADR-912 영역 B 연장).
 *
 * `resolveCollectionItems` 순수 계약 + family 공통 primitive(readDataBindingRows /
 * getFlatProjectionRows / getTableProjectionRows 등). DOM wrapper(shared) + Skia
 * projector(builder) 공통 source. DOM 직접 호출 금지 — `useResolvedCollectionItems`
 * hook adapter 경유(§2-D).
 */

export * from "./resolveCollectionItems";

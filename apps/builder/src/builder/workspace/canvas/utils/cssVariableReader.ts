/**
 * CSS Variable Reader — Barrel (ADR-035 Phase 6)
 *
 * 기존 7500+ 라인 파일을 3개 모듈로 분할한 re-export barrel.
 * 기존 import 경로 호환성 유지.
 *
 * - cssVariableCore: 캐시, CSS 변수 읽기, 색상 변환
 * - cssLabelPresets: Label/Description 스타일 프리셋
 * - cssComponentPresets: 60+ 컴포넌트별 사이즈/색상 프리셋
 */

export * from "./cssVariableCore";
export * from "./cssLabelPresets";
export * from "./cssComponentPresets";

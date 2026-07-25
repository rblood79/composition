/**
 * ADR-158 Phase 2 — Interactions 패널 로컬 타입.
 *
 * canonical entry 스키마(`InteractionRule`)는 `@composition/shared` 가 정본이고,
 * 여기서는 re-export + 패널 편집에만 쓰이는 보조 타입만 둔다.
 */
export type {
  CapabilityDef,
  CapabilityParam,
  InteractionAction,
  InteractionRule,
} from "@composition/shared";

/** Do 축 선택지 — 앱 액션 2종 + capability 진입 */
export type ActionChoice = "navigate" | "toast" | "capability";

/** 대상 후보 요소 (TargetPicker 표시용) */
export interface TargetOption {
  id: string;
  type: string;
  label: string;
}

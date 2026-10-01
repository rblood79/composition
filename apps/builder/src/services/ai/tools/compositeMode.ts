/**
 * 합성 생성 분기 — 팔레트(`useElementCreator`)와 같은 우선순위 (ADR-134 Phase 6, D7). ADR-248 4e-7:
 * apart from the old store's composite creation (`compositeCreation.ts`) — the compiler manifest
 * reads it.
 */
import { COMPLEX_COMPONENT_TAGS } from "../../../builder/factories/constants";
import { getReusableCompositeOriginId } from "../../../builder/components/reusableCompositeOrigins";

export type CompositeMode = "reusable" | "complex" | "leaf";

export function resolveCompositeMode(type: string): CompositeMode {
  if (getReusableCompositeOriginId(type)) return "reusable";
  if (COMPLEX_COMPONENT_TAGS.has(type)) return "complex";
  return "leaf";
}

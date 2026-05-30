/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { buttonBinding } from "./Button.binding";

export * from "./Button.binding";

/**
 * component type → leaf RAC PrimitiveBinding 조회.
 * Phase 2/4 의 `componentCatalog` 등록 전까지의 primitive lookup seed —
 * generic 렌더러가 "이 type 이 catalog primitive 인가" 를 판정하는 단일 진입점.
 */
const PRIMITIVE_BINDINGS: Readonly<Record<string, PrimitiveBinding>> = {
  Button: buttonBinding,
};

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}

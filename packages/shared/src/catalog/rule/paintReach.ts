/**
 * ADR-297 — 한 rule 의 칠이 Canvas 에서 닿는 조건 축 (전환 codemod · 정적 게이트 · paint 오라클 전용 — 런타임 경로
 * 아님). 트리의 「값 없음」 (`null`) 가지는 닿는 축에만 둔다 — 닿지 않는 축의 가지는 쓰이지 않는 표 noise 다.
 *
 * - 선택: RAC 가 `data-selected` 를 찍는 컴포넌트 (binding 의 RAC 표면 — D1) · 컬렉션 항목 (`COLLECTION_ITEM_OWNERS`
 *   — 소유자가 `_isSelected` 를 준다) · `selected` variant 가 있는 rule (`rulePaint` 가 선택을 variant 로 칠한다) ·
 *   Column (Table 선택 열 머리).
 * - fillStyle: binding `accepts.fillStyle` 의 값 (D2).
 */
import { getPrimitiveBinding } from "../bindings";
import { COLLECTION_ITEM_OWNERS } from "../document/collectionItems";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { PaintReach } from "./rulePaintTree";

export function rulePaintReach(type: string, rule: ComponentRule): PaintReach {
  const binding = getPrimitiveBinding(type) as
    | {
        rac?: { dataAttributes?: readonly string[] };
        props?: {
          accepts?: Record<
            string,
            { options?: readonly { value: unknown }[] } | undefined
          >;
        };
      }
    | undefined;
  const accepts = binding?.props?.accepts ?? {};
  const selectable =
    binding?.rac?.dataAttributes?.includes("data-selected") === true ||
    accepts.isSelected !== undefined ||
    type in COLLECTION_ITEM_OWNERS ||
    rule.variants?.selected !== undefined ||
    type === "Column";
  const fillStyles = (accepts.fillStyle?.options ?? [])
    .map((option) => option.value)
    .filter((value): value is string => typeof value === "string");
  return { selectable, fillStyles };
}

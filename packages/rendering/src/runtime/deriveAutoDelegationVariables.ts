/**
 * ADR-059 v2 Pre-Phase 0-C: Delegation `variables: "auto"` 파생
 *
 * `DelegationSpec.variables === "auto"` 선언 시 호출.
 * `spec.sizes` 의 각 사이즈 버킷에서 표준 5개 CSS 변수를 생성한다.
 *
 *   --{prefix}-padding    : `${paddingY}px ${paddingX}px` (둘 중 하나라도 0 아닐 때)
 *   --{prefix}-height     : `${height}px`                 (height > 0 일 때만)
 *   --{prefix}-font-size  : tokenToCSSVar(fontSize)       (fontSize 존재 시)
 *   --{prefix}-gap        : `${gap}px`                    (gap 존재 시)
 *   --{prefix}-radius     : tokenToCSSVar(borderRadius)   (borderRadius 존재 시)
 *
 * 필드가 없거나 0 인 값은 skip — Phase 1 에서 파생 결과가 hand-written CSS
 * 로 치환될 때 byte diff 최소화가 목적.
 */

import type { ComponentSpec, DelegationSpec } from "../types/spec.types";
import { type TokenRef, isValidTokenRef } from "../types/token.types";
import { tokenToCSSVar } from "../renderers/utils/tokenResolver";

type SizeBucket = {
  paddingX?: number;
  paddingY?: number;
  height?: number;
  fontSize?: number | TokenRef;
  gap?: number;
  borderRadius?: number | TokenRef;
  [key: string]: unknown;
};

function isTokenRef(v: unknown): v is TokenRef {
  return typeof v === "string" && isValidTokenRef(v);
}

export function deriveAutoDelegationVariables<Props>(
  spec: ComponentSpec<Props>,
  delegation: DelegationSpec,
): Record<string, Record<string, string>> {
  const { prefix, variables } = delegation;
  const keys = new Set(
    delegation.autoKeys ?? ["padding", "height", "fontSize", "gap", "radius"],
  );

  if (variables !== "auto") {
    throw new Error(
      `deriveAutoDelegationVariables called on non-auto delegation (spec: ${spec.name})`,
    );
  }
  if (!prefix) {
    throw new Error(
      `variables: "auto" requires prefix (spec: ${spec.name}, childSelector: ${delegation.childSelector})`,
    );
  }

  const sizes = (spec as unknown as { sizes?: Record<string, SizeBucket> })
    .sizes;
  if (!sizes) return {};

  const out: Record<string, Record<string, string>> = {};

  for (const [sizeName, bucket] of Object.entries(sizes)) {
    const vars: Record<string, string> = {};

    const { paddingX, paddingY, height, fontSize, gap, borderRadius } = bucket;

    // padding: 두 값 중 하나라도 유의미하면 emit
    if (keys.has("padding") && ((paddingX ?? 0) > 0 || (paddingY ?? 0) > 0)) {
      vars[`--${prefix}-padding`] = `${paddingY ?? 0}px ${paddingX ?? 0}px`;
    }
    if (keys.has("height") && (height ?? 0) > 0) {
      vars[`--${prefix}-height`] = `${height}px`;
    }
    if (keys.has("fontSize") && fontSize !== undefined) {
      vars[`--${prefix}-font-size`] = isTokenRef(fontSize)
        ? tokenToCSSVar(fontSize)
        : `${fontSize}px`;
    }
    if (keys.has("gap") && (gap ?? 0) > 0) {
      vars[`--${prefix}-gap`] = `${gap}px`;
    }
    if (keys.has("radius") && borderRadius !== undefined) {
      vars[`--${prefix}-radius`] = isTokenRef(borderRadius)
        ? tokenToCSSVar(borderRadius)
        : `${borderRadius}px`;
    }

    if (Object.keys(vars).length > 0) {
      out[sizeName] = vars;
    }
  }

  return out;
}

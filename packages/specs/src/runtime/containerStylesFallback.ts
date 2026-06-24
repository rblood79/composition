/**
 * ADR-108 P0: Spec.containerStyles → layout fallback read-through.
 *
 * ADR-080 + ADR-083 Phase 0 기원. ADR-081 G2 C3: testable seam — consumers 가
 * primitives 와 cross-reference 하는 drift detection 진입점. signature 변경 시
 * 계약 동시 갱신 필요.
 *
 * ADR-108 P0: apps/builder 에서 packages/specs 로 이관. `specMap` 파라미터를
 * 통해 builder 는 BUILDER_ALIAS_MAP merged map 을 주입 가능. 미주입 시
 * packages/specs 정본 `LOWERCASE_TAG_SPEC_MAP` 사용.
 */

import type { ComponentSpec, TokenRef } from "../types";
import { isValidTokenRef } from "../types";
import { resolveToken } from "../renderers/utils/tokenResolver";
import { LOWERCASE_TAG_SPEC_MAP } from "./tagToElement";

/**
 * ContainerStylesSchema layout primitive 필드 (ADR-083/084/085/089 누적):
 *   - display/flex/flexDirection/flexWrap/alignItems/justifyContent/width/maxHeight/
 *     overflow/outline/gap/padding (12)
 *   - gridTemplateAreas/gridTemplateColumns/gridTemplateRows (3) — Meter/ProgressBar
 *   - position (1) — SliderTrack absolute 배치 기준
 *
 * Spec 미선언 태그는 fallback 이 {} 반환 → 영향 없음.
 */
const CONTAINER_STYLES_FALLBACK_KEYS = [
  "display",
  "flex",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "width",
  "maxHeight",
  "overflow",
  "outline",
  "gap",
  "padding",
  "gridTemplateAreas",
  "gridTemplateColumns",
  "gridTemplateRows",
  "position",
] as const;

/**
 * Spec.containerStyles 중 layout primitive 14 필드를 parentStyle 미설정 항목에
 * 한해 fallback 주입. 사용자 편집 (parentStyle 에 명시된 키) 은 항상 우선.
 *
 * TokenRef 값 (`{spacing.xs}` 등) 은 `resolveToken` 으로 number/string 변환 후 반환.
 *
 * @param type lowercase type (예: "listbox", "combobox")
 * @param parentStyle 사용자/factory 편집 적용된 parent style
 * @param specMap optional — 미주입 시 packages/specs 정본 map 사용. builder 는
 *   alias merged map 주입.
 */
export function resolveContainerStylesFallback(
  type: string,
  parentStyle: Record<string, unknown>,
  specMap: ReadonlyMap<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ComponentSpec<any>
  > = LOWERCASE_TAG_SPEC_MAP,
): Record<string, unknown> {
  const spec = specMap.get(type);
  const cs = spec?.containerStyles as Record<string, unknown> | undefined;
  if (!cs) return {};

  const out: Record<string, unknown> = {};
  for (const key of CONTAINER_STYLES_FALLBACK_KEYS) {
    if (parentStyle[key] !== undefined) continue;
    const value = cs[key];
    if (value === undefined) continue;
    out[key] =
      typeof value === "string" && isValidTokenRef(value)
        ? resolveToken(value as TokenRef)
        : value;
  }
  return out;
}

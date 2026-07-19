/**
 * ADR-154 — 반응형 override resolve (base ⊕ cascade)
 *
 * activeBreakpoint 기준으로 `node.responsive` override 를 `props.style` 에 merge 한
 * **새 노드**를 반환한다 (non-mutating). desktop 은 base 그대로(무변경).
 *
 * SSOT 체인: D3(시각 스타일) — resolve 단일 진입점 `getResponsiveValueWithCascade`.
 * layout 경로(useLayoutPublisher)와 render 경로가 **동일 helper** 를 호출해 Skia↔DOM
 * 시각 대칭을 자동 성립시킨다.
 *
 * longhand 정책(ADR-909, R4): gap/padding/margin shorthand override 는 longhand 로
 * 분배해 base longhand 를 확실히 override 한다(엔진 `applyCommonTaffyStyle` 의
 * gap→rowGap/columnGap 적용 순서로 인한 편집 무시 회귀 방지). 그 외 키(longhand 포함)는
 * 직접 merge 하므로, 저장 형식이 shorthand 든 longhand 든 정확히 resolve 된다.
 *
 * 함정(feedback-merged-style-map-kills-override-detection): 여기서 만든 merged style
 * 로 "override 존재" 를 재판정하지 말 것 — Inspector 는 raw `element.responsive` 를 읽는다.
 */

import {
  getResponsiveValueWithCascade,
  type BreakpointName,
  type ResponsiveValue,
} from "@composition/shared";
import type { CanvasLayoutNode } from "./layoutNode";

type StyleMap = Record<string, unknown>;

/** shorthand → longhand 분배 대상 (그 외 키는 직접 merge) */
const SHORTHAND_LONGHANDS: Record<string, string[]> = {
  gap: ["rowGap", "columnGap"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
};

/**
 * activeBreakpoint 기준 responsive override 를 merge 한 노드 반환.
 * override 가 없거나 desktop 이면 원본 노드 identity 그대로 반환
 * (불필요한 재계산/재직렬화 방지).
 */
export function resolveResponsiveLayoutNode<T extends CanvasLayoutNode>(
  node: T,
  activeBreakpoint: BreakpointName,
): T {
  if (activeBreakpoint === "desktop") return node;
  const responsive = node.responsive;
  if (!responsive) return node;
  const { styles, visibility } = responsive;
  if (!styles && !visibility) return node;

  const base = (node.props?.style ?? {}) as StyleMap;
  const merged: StyleMap = { ...base };
  let changed = false;

  if (styles) {
    const styleRecord = styles as Record<string, ResponsiveValue<unknown>>;
    for (const key of Object.keys(styleRecord)) {
      const respValue = styleRecord[key];
      if (respValue == null) continue;

      const longhands = SHORTHAND_LONGHANDS[key];
      if (longhands) {
        // shorthand → longhand 분배 (base fallback 없이 override 값만)
        const resolved = getResponsiveValueWithCascade(
          respValue,
          activeBreakpoint,
          undefined,
        );
        if (resolved == null) continue;
        for (const lh of longhands) merged[lh] = resolved;
        delete merged[key];
        changed = true;
        continue;
      }

      // 직접 merge (DIRECT + longhand 키 공통)
      const baseValue = base[key];
      const resolved = getResponsiveValueWithCascade(
        respValue,
        activeBreakpoint,
        baseValue,
      );
      if (resolved !== baseValue) {
        merged[key] = resolved;
        changed = true;
      }
    }
  }

  // visibility override: false → display:none (cascade, JS 분기 금지)
  if (visibility) {
    const visible = getResponsiveValueWithCascade(
      visibility as ResponsiveValue<boolean>,
      activeBreakpoint,
      true,
    );
    if (visible === false && merged.display !== "none") {
      merged.display = "none";
      changed = true;
    }
  }

  if (!changed) return node;
  return { ...node, props: { ...node.props, style: merged } };
}

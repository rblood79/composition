import { useMemo } from "react";
import { resolveComponentRule } from "@composition/shared";
import { getSpecForTag } from "../../../workspace/canvas/sprites/tagSpecMap";
import { resolveResponsiveStyleMap } from "../../../workspace/canvas/layout/resolveResponsive";
import { useStore } from "../../../stores";
import type { PanelNode } from "../../panelNode";
import { useCanonicalPropertyElementsMap } from "../../properties/hooks/useCanonicalPropertyRead";

export interface ElementStyleContext {
  style: Record<string, unknown> | undefined;
  type: string | undefined;
  size: string | undefined;
  fills: unknown[] | undefined;
  props: Readonly<Record<string, unknown>> | undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * "우리가 아는 컴포넌트 타입인가" 판정 — 등록처는 catalog 다.
 *
 * ADR-142 cutover 로 컴포넌트당 spec 파일이 폐기되어(잔존 spec = Frame/Group/Slot)
 * `getSpecForTag` 단독 판정은 ListBox 같은 일반 컴포넌트에 대해 항상 false 가 된다.
 * 그러면 origin 이 hydrate 되지 않은 ref instance 가 componentName fallback 을 못 받고
 * `type: "ref"` 로 떨어져, Style Panel 이 해당 컴포넌트 기본값 대신 전역 fallback 을 표시한다.
 * catalog(`resolveComponentRule`)를 1차 registry 로 보고, 잔존 spec 3개는 보조로 남긴다.
 */
function isRegisteredSpecType(type: string | undefined): boolean {
  if (type === undefined) return false;
  return resolveComponentRule(type) != null || getSpecForTag(type) !== null;
}

function findRefOriginElement(
  ref: string | undefined,
  elementsMap: ReadonlyMap<string, PanelNode>,
): PanelNode | undefined {
  if (!ref) return undefined;
  const direct = elementsMap.get(ref);
  if (direct) return direct;

  for (const candidate of elementsMap.values()) {
    if (
      candidate.customId === ref ||
      candidate.componentName === ref ||
      candidate.name === ref
    ) {
      return candidate;
    }
  }
  return undefined;
}

function resolveStyleSpecType(
  element: PanelNode | undefined,
  elementsMap: ReadonlyMap<string, PanelNode>,
): string | undefined {
  if (!element) return undefined;
  if (element.type !== "ref") return element.type;

  const origin = findRefOriginElement(element.ref, elementsMap);
  if (origin && origin.type !== "ref") return origin.type;

  const registeredName =
    asNonEmptyString(element.componentName) ?? asNonEmptyString(element.name);
  if (isRegisteredSpecType(registeredName)) return registeredName;

  return element.type;
}

/**
 * Shared canonical property read for an element's style/type/size.
 * Section-value hooks reuse this so legacy fallback stays behind one boundary.
 */
export function useElementStyleContext(id: string | null): ElementStyleContext {
  const elementsMap = useCanonicalPropertyElementsMap();
  const activeBreakpoint = useStore((state) => state.activeBreakpoint);
  const element = id ? elementsMap.get(id) : undefined;
  const props = element?.props as Readonly<Record<string, unknown>> | undefined;
  const type = resolveStyleSpecType(element, elementsMap);
  const baseStyle = props?.style as Record<string, unknown> | undefined;
  const responsive = element?.responsive;

  // ADR-154: 비-desktop breakpoint 편집은 `element.responsive.styles` 로 저장되므로
  // (updateSelectedStyle), 표시값도 activeBreakpoint 기준 responsive override 를 merge
  // 해야 재선택 시 편집값이 보인다. canvas render 와 **동일한 resolveResponsiveStyleMap**
  // SSOT 를 공유해 Panel 표시 ↔ 캔버스 렌더 대칭을 유지한다.
  //
  // 주의(feedback-merged-style-map-kills-override-detection): 여기서 만든 merged style
  // 로 "override/dirty 존재" 를 재판정하지 않는다 — dirty/reset 판정(useResetStyles)은
  // raw `element` + `element.responsive` 를 읽는 별도 경로다.
  const style = useMemo<Record<string, unknown> | undefined>(() => {
    if (activeBreakpoint === "desktop" || !responsive) return baseStyle;
    return resolveResponsiveStyleMap(
      baseStyle ?? {},
      responsive,
      activeBreakpoint,
    );
  }, [baseStyle, responsive, activeBreakpoint]);

  const size = props?.size as string | undefined;
  const fills = (element as { fills?: unknown[] } | undefined)?.fills;
  return { style, type, size, fills, props };
}

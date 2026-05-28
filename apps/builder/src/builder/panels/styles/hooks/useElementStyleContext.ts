import { getSpecForTag } from "../../../workspace/canvas/sprites/tagSpecMap";
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

function isRegisteredSpecType(type: string | undefined): boolean {
  return type !== undefined && getSpecForTag(type) !== null;
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
  const element = id ? elementsMap.get(id) : undefined;
  const props = element?.props as Readonly<Record<string, unknown>> | undefined;
  const type = resolveStyleSpecType(element, elementsMap);
  const style = props?.style as Record<string, unknown> | undefined;
  const size = props?.size as string | undefined;
  const fills = (element as { fills?: unknown[] } | undefined)?.fills;
  return { style, type, size, fills, props };
}

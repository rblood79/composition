import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";

export interface ElementStyleContext {
  style: Record<string, unknown> | undefined;
  type: string | undefined;
  size: string | undefined;
  fills: unknown[] | undefined;
  props: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Shared canonical property read for an element's style/type/size.
 * Section-value hooks reuse this so legacy fallback stays behind one boundary.
 */
export function useElementStyleContext(id: string | null): ElementStyleContext {
  const element = useCanonicalPropertyElement(id ?? "");
  const props = element?.props as Readonly<Record<string, unknown>> | undefined;
  const type = element?.type;
  const style = props?.style as Record<string, unknown> | undefined;
  const size = props?.size as string | undefined;
  const fills = element?.fills as unknown[] | undefined;
  return { style, type, size, fills, props };
}

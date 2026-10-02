import type { ReactNode } from "react";
import type { ElementStyleContext } from "../../hooks/useElementStyleContext";
import { StylesHostContext, type StylesHost } from "../../stylesHostContext";

/**
 * ADR-248 4e-9 C: a Styles host that serves fixed elements as its style context — for the pure
 * fallback hooks whose tests feed synthetic catalog rules (types no catalog document can hold).
 * Everything the hooks do not read throws, so a test that needs more uses the catalog fixture.
 */
export interface StubElement {
  id: string;
  type?: string;
  parent_id?: string | null;
  props?: Record<string, unknown>;
  sizing?: ElementStyleContext["sizing"];
}

export function stubStylesHost() {
  const elements = new Map<string, StubElement>();
  const contextOf = (id: string | null): ElementStyleContext => {
    const element = id ? elements.get(id) : undefined;
    const props = element?.props ?? {};
    const { style, ...rest } = props as {
      style?: Record<string, unknown>;
    } & Record<string, unknown>;
    return {
      style: style ?? (element ? {} : undefined),
      type: element?.type,
      size: typeof rest.size === "string" ? rest.size : undefined,
      sizing: element?.sizing,
      props: element ? rest : undefined,
    } as ElementStyleContext;
  };
  const unsupported = (name: string) => () => {
    throw new Error(`stubStylesHost: ${name} is not stubbed`);
  };
  const host = new Proxy(
    {
      useSelectedId: () => null,
      readSelectedId: () => null,
      useActiveBreakpoint: () => "desktop",
      useElementStyleContext: contextOf,
      useParentId: (id: string | null) =>
        (id && elements.get(id)?.parent_id) || null,
      useParentLayout(id: string | null) {
        const parentId = id ? elements.get(id)?.parent_id : null;
        const style = (contextOf(parentId ?? null).style ?? {}) as Record<
          string,
          unknown
        >;
        return {
          display: String(style.display ?? "block"),
          flexDirection: String(style.flexDirection ?? "row"),
        };
      },
    } as Partial<StylesHost>,
    {
      get: (target, key: string) =>
        key in target
          ? target[key as keyof StylesHost]
          : key === "then"
            ? undefined
            : unsupported(key),
    },
  ) as StylesHost;
  return {
    host,
    /** Replace the served elements. */
    set(...next: StubElement[]) {
      elements.clear();
      for (const element of next) elements.set(element.id, element);
    },
    wrapper: ({ children }: { children: ReactNode }) => (
      <StylesHostContext.Provider value={host}>
        {children}
      </StylesHostContext.Provider>
    ),
  };
}

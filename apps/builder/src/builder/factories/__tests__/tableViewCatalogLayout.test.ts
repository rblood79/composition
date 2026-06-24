import { describe, expect, it } from "vitest";
import { createTableViewDefinition } from "../definitions/DisplayComponents";
import { createDefaultTableViewProps } from "../../../types/builder/unified.types";
import type { ComponentCreationContext } from "../types";

type DefinitionNode = {
  type: string;
  props?: Record<string, unknown>;
  children?: DefinitionNode[];
};

const FACTORY_LAYOUT_KEYS = new Set([
  "display",
  "flex",
  "flexDirection",
  "fontWeight",
  "padding",
  "width",
]);

function flattenTableViewDefinition(): DefinitionNode[] {
  const def = createTableViewDefinition({
    parentElement: null,
    pageId: null,
    elements: [],
  } as unknown as ComponentCreationContext);

  const out: DefinitionNode[] = [def.parent as DefinitionNode];
  const visit = (nodes: readonly DefinitionNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      out.push(node);
      visit(node.children);
    }
  };
  visit(def.children as DefinitionNode[]);
  return out;
}

describe("TableView factory layout source", () => {
  it("TableView 생성 트리는 layout literal 을 factory props.style 에 보유하지 않는다", () => {
    const offenders = flattenTableViewDefinition()
      .map((node) => {
        const style = node.props?.style as Record<string, unknown> | undefined;
        const keys = Object.keys(style ?? {}).filter((key) =>
          FACTORY_LAYOUT_KEYS.has(key),
        );
        return keys.length > 0 ? `${node.type}: ${keys.join(", ")}` : null;
      })
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });

  it("TableView default props 는 layout style 을 catalog rule 에 위임한다", () => {
    const style = createDefaultTableViewProps().style as
      | Record<string, unknown>
      | undefined;
    const keys = Object.keys(style ?? {}).filter((key) =>
      FACTORY_LAYOUT_KEYS.has(key),
    );

    expect(keys).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { resolveCatalogNode } from "../../resolution/resolver";
import { CatalogGraph } from "../graph";
import { buildCatalogLibrary } from "../library";
import type {
  CatalogDocument,
  LibraryDefinition,
  LibraryTemplateNode,
  NodeEntry,
} from "../types";
import { CatalogValidationError } from "../validation";

/** ADR-248 Phase 3 typed extension (2026-09-29): layout, conditional rules, part rules. */
const parent: LibraryDefinition = {
  id: "lib:definition:field",
  name: "Field",
  mode: "primitive",
  bindingId: "field",
  accepts: { size: "string", isQuiet: "boolean", fillStyle: "string" },
  defaults: { size: "md" },
  visual: { fill: "#ffffff", paddingX: 8, paddingY: 2, minWidth: 40 },
  layout: { display: "flex", flexDirection: "column" },
  propVisualRules: { size: { lg: { paddingX: 12 } } },
  conditionalRules: [
    { when: { fillStyle: "outline" }, visual: { fill: "transparent" } },
    { when: {}, state: "hover", visual: { fill: "#eeeeee" } },
    {
      when: { fillStyle: "outline" },
      state: "hover",
      visual: { fill: "#dddddd" },
    },
    { when: { isQuiet: true }, layout: { flexDirection: "row" } },
  ],
  partRules: [
    {
      child: { definitionId: "lib:definition:part" },
      when: { size: "lg" },
      visual: { fontSize: 18 },
    },
    {
      child: { definitionId: "lib:definition:part", props: { kind: "hint" } },
      visual: { color: "#ff0000" },
    },
  ],
  stateRules: {},
};
const part: LibraryDefinition = {
  id: "lib:definition:part",
  name: "Part",
  mode: "primitive",
  bindingId: "part",
  accepts: { kind: "string" },
  defaults: {},
  visual: { fontSize: 12 },
  stateRules: {},
};
const composite: LibraryDefinition = {
  id: "lib:definition:composite",
  name: "Composite",
  mode: "composite",
  templateRootId: "lib:template:root",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
};
const templates: LibraryTemplateNode[] = [
  {
    id: "lib:template:root",
    definitionId: "lib:definition:field",
    children: ["lib:template:label", "lib:template:hint"],
    props: { size: "lg" },
    visual: {},
  },
  {
    id: "lib:template:label",
    definitionId: "lib:definition:part",
    children: [],
    props: {},
    // Authored template visual wins over the parent's part rule.
    visual: { color: "#000000" },
  },
  {
    id: "lib:template:hint",
    definitionId: "lib:definition:part",
    children: [],
    props: { kind: "hint" },
    visual: {},
  },
];
const library = (definitions = [parent, part, composite]) =>
  buildCatalogLibrary({
    contractVersion: 2,
    revision: "typed-rules",
    bindingIds: ["field", "part"],
    actionOpCodes: [],
    definitions,
    templates,
    tokens: [],
  });
const node = (id: string, patch: Partial<NodeEntry>): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId: "lib:definition:field",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
function graph(nodes: NodeEntry[], nested: NodeEntry[] = []) {
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 2,
    revision: 0,
    projectId: "project:project:p",
    rootId: "project:project:p",
    entries: {
      "project:project:p": {
        kind: "project",
        id: "project:project:p",
        name: "p",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        route: "/",
        name: "main",
        children: nodes.map((item) => item.id),
      },
      ...Object.fromEntries(
        [...nodes, ...nested].map((item) => [item.id, item]),
      ),
    },
  };
  return new CatalogGraph(document, library());
}

describe("ADR-248 typed layout, conditional and part rules", () => {
  it("resolves base, size, conditional state and layout rules in order", () => {
    const g = graph([
      node("plain", {}),
      node("outline", {
        props: {
          fillStyle: { kind: "set", value: "outline" },
          size: { kind: "set", value: "lg" },
          isQuiet: { kind: "set", value: true },
        },
      }),
    ]);
    const plain = resolveCatalogNode(g, "project:node:plain");
    expect(plain.visual).toMatchObject({ fill: "#ffffff", paddingX: 8 });
    expect(plain.layout).toEqual({ display: "flex", flexDirection: "column" });
    expect(
      resolveCatalogNode(g, "project:node:plain", "hover").visual.fill,
    ).toBe("#eeeeee");
    const outline = resolveCatalogNode(g, "project:node:outline");
    expect(outline.visual).toMatchObject({ fill: "transparent", paddingX: 12 });
    expect(outline.layout.flexDirection).toBe("row");
    // The later outline+hover rule wins over the generic hover rule.
    expect(
      resolveCatalogNode(g, "project:node:outline", "hover").visual.fill,
    ).toBe("#dddddd");
  });

  it("applies parent part rules to matching direct children; authored visual wins", () => {
    const g = graph(
      [
        node("instance", { definitionId: "lib:definition:composite" }),
        node("authored", {
          props: { size: { kind: "set", value: "lg" } },
          children: ["project:node:child"],
        }),
      ],
      [node("child", { definitionId: "lib:definition:part" })],
    );
    const [root] = resolveCatalogNode(g, "project:node:instance").children;
    const [label, hint] = root.children;
    expect(label.visual).toEqual({ fontSize: 18, color: "#000000" });
    expect(hint.visual).toEqual({ fontSize: 18, color: "#ff0000" });
    const [child] = resolveCatalogNode(g, "project:node:authored").children;
    expect(child.visual).toEqual({ fontSize: 18 });
  });

  it("rejects unaccepted condition props, unknown layout values and dangling part targets", () => {
    const reject = (definition: LibraryDefinition, code: string) => {
      try {
        library([definition, part, composite]);
        throw new Error("EXPECTED_REJECTION");
      } catch (error) {
        expect(error).toBeInstanceOf(CatalogValidationError);
        expect((error as CatalogValidationError).code).toBe(code);
      }
    };
    reject(
      {
        ...parent,
        conditionalRules: [
          { when: { variant: "x" }, visual: { fill: "#000000" } },
        ],
      },
      "CONDITION_PROP_NOT_ACCEPTED",
    );
    reject({ ...parent, layout: { display: "table" } }, "INVALID_LAYOUT_VALUE");
    reject(
      { ...parent, conditionalRules: [{ when: { size: "lg" } }] },
      "EMPTY_RULE_OUTPUT",
    );
    reject(
      {
        ...parent,
        partRules: [
          {
            child: { definitionId: "lib:definition:missing" },
            visual: { fontSize: 1 },
          },
        ],
      },
      "DANGLING_DEFINITION",
    );
    reject({ ...parent, visual: { paddingX: -1 } }, "VISUAL_VALUE_RANGE");
  });
});

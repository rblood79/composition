/**
 * ADR-260 Decision 11 · 12 (kept by ADR-279 — the definition owns its template): the document
 * model.
 */
import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../fixture";
import { buildCatalogLibrary } from "../library";
import { CatalogGraph } from "../graph";
import { LIBRARY_CONTRACT_VERSION } from "../types";
import type {
  CatalogDocument,
  CatalogEntry,
  DefinitionEntry,
  InstanceAddress,
  NodeEntry,
  NodeId,
} from "../types";
import { CatalogValidationError } from "../validation";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { readPropSource } from "../../resolution/fieldSource";
import {
  childPositions,
  pagePositions,
  targetExists,
  type CatalogPosition,
} from "../../resolution/positions";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";

const PROJECT = "project:project:g1";
const PAGE = "project:page:main";
const DEF = "project:definition:comp" as const;
const ROOT = "project:node:root" as const;

const node = (
  id: NodeEntry["id"],
  definitionId: NodeEntry["definitionId"],
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});
const definition = (extra: Partial<DefinitionEntry> = {}): DefinitionEntry => ({
  kind: "definition",
  id: DEF,
  name: "Comp",
  mode: "composite",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
  templateRootId: ROOT,
  ...extra,
});
/** The card slot position of a Card node (`lib:definition:card`). */
const cardSlot = (owner: NodeId): InstanceAddress => ({
  instances: [owner],
  templatePath: ["lib:template:cardRoot", "lib:template:cardSlot"],
});
const cardText = (owner: NodeId): InstanceAddress => ({
  instances: [owner],
  templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
});

/**
 * A G1 document with one user definition `comp` whose template root is a Card node. `owned` (the
 * old shape — no `originRef`) puts the root under the definition; otherwise the root stays on the
 * page and the definition references it.
 */
function documentWith(
  entries: readonly CatalogEntry[],
  pageChildren: readonly string[],
): {
  document: CatalogDocument;
  library: ReturnType<typeof createG1Fixture>["library"];
} {
  const { document, library } = createG1Fixture();
  const project = document.entries[PROJECT] as Extract<
    CatalogEntry,
    { kind: "project" }
  >;
  const page = document.entries[PAGE] as Extract<
    CatalogEntry,
    { kind: "page" }
  >;
  const next: Record<string, CatalogEntry> = {
    ...document.entries,
    [PROJECT]: { ...project, definitionIds: [DEF] },
    [PAGE]: { ...page, children: [...page.children, ...pageChildren] as never },
  };
  for (const entry of entries) next[entry.id] = entry;
  return { document: { ...document, entries: next }, library };
}
const code = (action: () => unknown): string => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogValidationError);
    return (error as CatalogValidationError).code;
  }
  return "ACCEPTED";
};

describe("ADR-260 Decision 12 — the definition cycle walk follows every owned child", () => {
  const self = node("project:node:self", DEF);
  it.each([
    ["children", node(ROOT, "lib:definition:card", { children: [self.id] })],
    [
      "fillSlot",
      node(ROOT, "lib:definition:card", {
        descendantOverrides: [
          { kind: "fillSlot", address: cardSlot(ROOT), childIds: [self.id] },
        ],
      }),
    ],
    [
      "replace",
      node(ROOT, "lib:definition:card", {
        descendantOverrides: [
          {
            kind: "replace",
            address: cardText(ROOT),
            replacementId: self.id,
          },
        ],
      }),
    ],
  ])("refuses its own instance reached through %s (full load)", (_, root) => {
    const { document, library } = documentWith([definition(), root, self], []);
    expect(code(() => new CatalogGraph(document, library))).toBe(
      "DEFINITION_CYCLE",
    );
  });

  it.each(["fillSlot", "replace"] as const)(
    "refuses its own instance placed through %s in a transaction, revision and history unchanged",
    (kind) => {
      const { document, library } = documentWith(
        [definition(), node(ROOT, "lib:definition:card")],
        [],
      );
      const graph = new CatalogGraph(document, library);
      const before = {
        revision: graph.revision,
        history: graph.history.length,
      };
      const root = node(ROOT, "lib:definition:card", {
        descendantOverrides: [
          kind === "fillSlot"
            ? { kind, address: cardSlot(ROOT), childIds: [self.id] }
            : {
                kind,
                address: cardText(ROOT),
                replacementId: self.id,
              },
        ],
      });
      expect(
        code(() =>
          applyCatalogTransaction(graph, {
            projectId: graph.projectId,
            expectedRevision: graph.revision,
            ops: [
              { kind: "put", entry: self },
              { kind: "put", entry: root },
            ],
            history: { kind: "record", label: "cycle" },
          }),
        ),
      ).toBe("DEFINITION_CYCLE");
      expect({
        revision: graph.revision,
        history: graph.history.length,
      }).toEqual(before);
    },
  );
});

describe("ADR-279 Decision 1 — a definition owns its origin (the Local page's template)", () => {
  const origin = node(ROOT, "lib:definition:card");
  const instance = node("project:node:inst", DEF);

  it("loads the origin under the definition (owner edge), an instance on the page", () => {
    const { document, library } = documentWith(
      [definition(), origin, instance],
      [instance.id],
    );
    const graph = new CatalogGraph(document, library);
    expect(graph.ownerOf(ROOT)).toBe(DEF);
    expect(graph.definitionOfTemplateRoot(ROOT)).toBe(DEF);
    expect(graph.indexes.ownerToChildren.get(DEF)).toEqual(new Set([ROOT]));
  });

  it("refuses the ADR-260 field `originRef` (an origin on a page — contract 45)", () => {
    const { document, library } = documentWith(
      [{ ...definition(), originRef: true } as never, origin, instance],
      [ROOT, instance.id],
    );
    expect(code(() => new CatalogGraph(document, library))).toBe(
      "UNKNOWN_FIELD",
    );
  });

  it("refuses the root also on the page (DUPLICATE_OWNERSHIP) and two definitions on one root", () => {
    const { document, library } = documentWith([definition(), origin], [ROOT]);
    expect(code(() => new CatalogGraph(document, library))).toBe(
      "DUPLICATE_OWNERSHIP",
    );
    const two = documentWith(
      [definition(), definition({ id: "project:definition:other" }), origin],
      [],
    );
    const project = two.document.entries[PROJECT] as Extract<
      CatalogEntry,
      { kind: "project" }
    >;
    expect(
      code(
        () =>
          new CatalogGraph(
            {
              ...two.document,
              entries: {
                ...two.document.entries,
                [PROJECT]: {
                  ...project,
                  definitionIds: [DEF, "project:definition:other" as const],
                },
              },
            },
            two.library,
          ),
      ),
    ).not.toBe("ACCEPTED");
  });

  it("reaches the definition's instances when the origin changes (affected ids)", () => {
    const { document, library } = documentWith(
      [definition(), origin, instance],
      [instance.id],
    );
    const graph = new CatalogGraph(document, library);
    expect(graph.collectAffectedIds([ROOT]).has(instance.id)).toBe(true);
  });

  it("refuses the origin's own instance inside it (DEFINITION_CYCLE)", () => {
    const self = node("project:node:self", DEF);
    const { document, library } = documentWith(
      [
        definition(),
        node(ROOT, "lib:definition:card", {
          descendantOverrides: [
            { kind: "fillSlot", address: cardSlot(ROOT), childIds: [self.id] },
          ],
        }),
        self,
      ],
      [],
    );
    expect(code(() => new CatalogGraph(document, library))).toBe(
      "DEFINITION_CYCLE",
    );
  });

  it("keeps a document byte-identical through load and export", () => {
    const { document, library } = documentWith(
      [definition(), origin, instance],
      [instance.id],
    );
    const graph = new CatalogGraph(document, library);
    expect(JSON.stringify(graph.exportDocument().entries)).toBe(
      JSON.stringify(document.entries),
    );
    expect(graph.ownerOf(ROOT)).toBe(DEF);
  });
});

describe("ADR-260 — a deep self instance moved into the origin is a cycle", () => {
  it("refuses moving a page frame holding the definition's instance under the origin", () => {
    const self = node("project:node:self", DEF);
    const frame = node("project:node:frame", "lib:definition:box", {
      children: [self.id],
    });
    const inner = node("project:node:inner", "lib:definition:box");
    const origin = node(ROOT, "lib:definition:box", { children: [inner.id] });
    const { document, library } = documentWith(
      [definition(), origin, inner, frame, self],
      [frame.id],
    );
    const graph = new CatalogGraph(document, library);
    const page = graph.getEntry(PAGE) as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const revision = graph.revision;
    expect(
      code(() =>
        applyCatalogTransaction(graph, {
          projectId: graph.projectId,
          expectedRevision: graph.revision,
          ops: [
            {
              kind: "put",
              entry: {
                ...page,
                children: page.children.filter((id) => id !== frame.id),
              },
            },
            { kind: "put", entry: { ...inner, children: [frame.id] } },
          ],
          history: { kind: "record", label: "deep cycle" },
        }),
      ),
    ).toBe("DEFINITION_CYCLE");
    expect(graph.revision).toBe(revision);
  });
});

describe("ADR-260 Decision 11 — a template node's own overrides reach its instances", () => {
  const marker = (id: NodeId, text: string) =>
    node(id, "lib:definition:text", {
      props: { children: { kind: "set", value: text } },
    });
  const texts = (resolved: ResolvedCatalogNode): string[] => [
    ...(typeof resolved.props.children === "string"
      ? [resolved.props.children]
      : []),
    ...resolved.children.flatMap(texts),
  ];
  const find = (
    resolved: ResolvedCatalogNode,
    sourceId: string,
  ): ResolvedCatalogNode | undefined =>
    resolved.sourceId === sourceId
      ? resolved
      : resolved.children
          .map((child) => find(child, sourceId))
          .find((hit) => hit);
  const innerFill = marker("project:node:innerFill", "inner-marker");
  const origin = node(ROOT, "lib:definition:card", {
    descendantOverrides: [
      { kind: "fillSlot", address: cardSlot(ROOT), childIds: [innerFill.id] },
      {
        kind: "patch",
        address: cardText(ROOT),
        props: { children: { kind: "set", value: "inner-title" } },
      },
    ],
  });
  const nested = (owner: NodeId): InstanceAddress => ({
    instances: [owner, ROOT],
    templatePath: ["lib:template:cardRoot", "lib:template:cardSlot"],
  });
  const shapes = [
    ["owned template", {}, []],
  ] as const;

  it.each(shapes)(
    "projects the origin's slot contents and title (%s)",
    (_, shape, onPage) => {
      const instance = node("project:node:inst", DEF);
      const { document, library } = documentWith(
        [definition(shape), origin, innerFill, instance],
        [...onPage, instance.id],
      );
      const graph = new CatalogGraph(document, library);
      const resolved = resolveCatalogNode(graph, instance.id);
      expect(texts(resolved)).toContain("inner-marker");
      expect(texts(resolved)).toContain("inner-title");
      // The slot contents are a template position of the instance, not the origin's node.
      expect(find(resolved, innerFill.id)?.instancePath).toEqual([instance.id]);
    },
  );

  it.each(shapes)(
    "lets the instance's own override win at the same position (%s)",
    (_, shape, onPage) => {
      const outerFill = marker("project:node:outerFill", "outer-marker");
      const instance = node("project:node:inst", DEF, {
        descendantOverrides: [
          {
            kind: "fillSlot",
            address: nested("project:node:inst"),
            childIds: [outerFill.id],
          },
          {
            kind: "patch",
            address: {
              instances: ["project:node:inst", ROOT],
              templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
            },
            props: { children: { kind: "set", value: "outer-title" } },
            visual: { color: { kind: "set", value: "red" } },
          },
        ],
      });
      const { document, library } = documentWith(
        [definition(shape), origin, innerFill, instance, outerFill],
        [...onPage, instance.id],
      );
      const graph = new CatalogGraph(document, library);
      const resolved = resolveCatalogNode(graph, instance.id);
      expect(texts(resolved)).toContain("outer-marker");
      expect(texts(resolved)).not.toContain("inner-marker");
      expect(texts(resolved)).toContain("outer-title");
      expect(texts(resolved)).not.toContain("inner-title");
    },
  );

  it.each(shapes)(
    "addresses the projected slot contents from the instance (%s)",
    (_, shape, onPage) => {
      const instance = node("project:node:inst", DEF, {
        descendantOverrides: [
          {
            kind: "patch",
            address: {
              instances: ["project:node:inst"],
              templatePath: [ROOT, innerFill.id],
            },
            props: { children: { kind: "set", value: "edited" } },
          },
        ],
      });
      const { document, library } = documentWith(
        [definition(shape), origin, innerFill, instance],
        [...onPage, instance.id],
      );
      const graph = new CatalogGraph(document, library);
      const resolved = resolveCatalogNode(graph, instance.id);
      expect(texts(resolved)).toContain("edited");
      expect(texts(resolved)).not.toContain("inner-marker");
      // The origin itself is unchanged.
      expect(texts(resolveCatalogNode(graph, ROOT))).toContain("inner-marker");
    },
  );
});

describe("ADR-260 Decision 11 — Layers positions follow the same rule", () => {
  it.each([
    ["owned template", {}, []],
  ] as const)(
    "lists the origin's slot contents inside the instance as its template positions (%s)",
    (_, shape, onPage) => {
      const innerFill = node("project:node:innerFill", "lib:definition:text");
      const origin = node(ROOT, "lib:definition:card", {
        descendantOverrides: [
          {
            kind: "fillSlot",
            address: cardSlot(ROOT),
            childIds: [innerFill.id],
          },
        ],
      });
      const instance = node("project:node:inst", DEF);
      const { document, library } = documentWith(
        [definition(shape), origin, innerFill, instance],
        [...onPage, instance.id],
      );
      const graph = new CatalogGraph(document, library);
      const all = (positions: CatalogPosition[]): CatalogPosition[] =>
        positions.flatMap((position) => [
          position,
          ...all(childPositions(graph, position)),
        ]);
      const listed = all(pagePositions(graph, PAGE)).filter(
        (position) =>
          position.sourceId === innerFill.id &&
          position.instancePath[0] === instance.id,
      );
      expect(listed.map((position) => position.target)).toEqual([
        {
          kind: "descendant",
          ownerId: instance.id,
          address: {
            instances: [instance.id],
            templatePath: [ROOT, innerFill.id],
          },
        },
      ]);
      expect(targetExists(graph, listed[0].target)).toBe(true);
    },
  );
});

describe("ADR-260 Decision 11 — the panel reads the origin's value under the instance's", () => {
  it("shows the template node's write as the template value, the instance's own over it", () => {
    const origin = node(ROOT, "lib:definition:card", {
      descendantOverrides: [
        {
          kind: "patch",
          address: cardText(ROOT),
          props: { children: { kind: "set", value: "inner-title" } },
        },
      ],
    });
    const instance = node("project:node:inst", DEF);
    const { document, library } = documentWith(
      [definition(), origin, instance],
      [instance.id],
    );
    const graph = new CatalogGraph(document, library);
    const target = {
      kind: "descendant" as const,
      ownerId: instance.id,
      address: {
        instances: [instance.id, ROOT],
        templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
      } as InstanceAddress,
    };
    const reading = readPropSource(graph, target, "children");
    expect(reading.value).toBe("inner-title");
    expect(reading.source).toBe("template");
    expect(reading.own).toBeUndefined();
  });
});

describe("ADR-260 follow-up — an instance's props reach a library composite at its root", () => {
  // A library composite `Labeled` whose template root is a Text (`children` is the root's): a user
  // component whose origin is a Labeled — its instance's `children` is the Text's (2026-10-14 user
  // report: a RadioGroup component's instance ignored Orientation).
  const library = buildCatalogLibrary({
    contractVersion: LIBRARY_CONTRACT_VERSION,
    revision: "adr260-root-props",
    bindingIds: ["text"],
    actionOpCodes: [],
    triggerIds: [],
    capabilityIds: [],
    definitions: [
      {
        id: "lib:definition:text",
        name: "Text",
        mode: "primitive",
        bindingId: "text",
        accepts: { children: "string" },
        defaults: { children: "default" },
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:labeled",
        name: "Labeled",
        mode: "composite",
        templateRootId: "lib:template:labeledRoot",
        // (Its own schema leaves `children` to its root — as a RadioGroup origin's leaves
        // Orientation to the RadioGroup: the instance contract is both.)
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      {
        id: "lib:template:labeledRoot",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "template" },
        visual: {},
      },
    ],
    tokens: [],
  });
  /** The drawn Text's value (the leaf — the wrappers above it carry the composite's own props). */
  const text = (resolved: ResolvedCatalogNode): string | undefined =>
    resolved.children.length
      ? resolved.children.map(text).find((found) => found !== undefined)
      : typeof resolved.props.children === "string"
        ? resolved.props.children
        : undefined;
  it.each([
    ["owned template", {}, []],
  ] as const)("shows the instance's own value (%s)", (_, shape, onPage) => {
    // (The origin does not write the key itself — as a placed RadioGroup leaves Orientation.)
    const origin = node(ROOT, "lib:definition:labeled");
    const instance = node("project:node:inst", DEF, {
      props: { children: { kind: "set", value: "instance" } },
    });
    const document: CatalogDocument = {
      format: "composition-catalog",
      schemaVersion: 1,
      libraryContractVersion: LIBRARY_CONTRACT_VERSION,
      projectId: PROJECT,
      rootId: PROJECT,
      revision: 0,
      entries: Object.fromEntries(
        [
          {
            kind: "project",
            id: PROJECT,
            name: "p",
            pageIds: [PAGE],
            definitionIds: [DEF],
            overrideIds: [],
            themeIds: [],
            tokenIds: [],
            stateVariableIds: [],
            interactionIds: [],
            assetIds: [],
          },
          {
            kind: "page",
            id: PAGE,
            name: "Main",
            route: "/",
            children: [...onPage, instance.id],
          },
          definition(shape),
          origin,
          instance,
        ].map((entry) => [entry.id, entry as CatalogEntry]),
      ),
    };
    const graph = new CatalogGraph(document, library);
    expect(text(resolveCatalogNode(graph, ROOT))).toBe("template");
    expect(text(resolveCatalogNode(graph, instance.id))).toBe("instance");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cloneNodeSubgraph } from "../clone";
import { createG1Fixture } from "../fixture";
import { CatalogGraph } from "../graph";
import { buildCatalogLibrary } from "../library";
import type { CatalogDocument, NodeEntry } from "../types";
import { CatalogValidationError } from "../validation";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import {
  frameClipInputToOperation,
  isResolvedFrameClipped,
} from "../../transactions/frameClip";

/**
 * ADR-248 G0 frozen scenarios (`docs/adr/design/248-baseline/`) are kept local only (user decision
 * 2026-09-30): a checkout without them skips the tests that read them.
 */
const G0_BASELINE_ABSENT = !existsSync(
  new URL("../../../../../../docs/adr/design/248-baseline", import.meta.url),
);

const fixture = () => {
  const { document, library } = createG1Fixture();
  return new CatalogGraph(document, library);
};
const request = (
  graph: CatalogGraph,
  ops: Parameters<typeof applyCatalogTransaction>[1]["ops"],
) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    ops,
    history: { kind: "record", label: "G1" },
  });
const failureCode = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogValidationError);
    expect((error as CatalogValidationError).code).toBe(code);
  }
};

describe("ADR-248 G1 isolated catalog graph", () => {
  it("keeps absolute child placement typed, validated and reversible", () => {
    const graph = fixture();
    const id = "project:node:cardA";
    const first = request(graph, [
      {
        kind: "setNodePlacement",
        id,
        placement: { kind: "absolute", x: 20, y: 150 },
      },
    ]);
    expect(first.changedIds).toEqual(new Set([id]));
    expect(resolveCatalogNode(graph, id).placement).toEqual({
      kind: "absolute",
      x: 20,
      y: 150,
    });
    expect(graph.getEntry(id)).toMatchObject({
      placement: { kind: "absolute", x: 20, y: 150 },
    });
    request(graph, first.inverse);
    expect(resolveCatalogNode(graph, id).placement).toBeUndefined();
    const revision = graph.revision;
    failureCode(
      () =>
        request(graph, [
          {
            kind: "setNodePlacement",
            id,
            placement: { kind: "absolute", x: Number.NaN, y: 0 },
          },
        ]),
      "NODE_PLACEMENT_COORDINATE",
    );
    expect(graph.revision).toBe(revision);
    expect(resolveCatalogNode(graph, id).placement).toBeUndefined();
  });
  it("resolves two instances independently, nested paths, patch, replace and slot", () => {
    const graph = fixture();
    const address = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
    } as const;
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          props: { children: { kind: "set", value: "edited" } },
        },
      },
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .props.children,
    ).toBe("edited");
    expect(
      resolveCatalogNode(graph, "project:node:cardB").children[0].children[0]
        .props.children,
    ).toBe("title");
    const nested = {
      instances: ["project:node:cardA", "lib:template:badgeInstance"],
      templatePath: ["lib:template:badgeRoot", "lib:template:badgeText"],
    } as const;
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address: nested,
          props: { children: { kind: "set", value: "nested" } },
        },
      },
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[1]
        .children[0].children[0].props.children,
    ).toBe("nested");
    const replacement: NodeEntry = {
      kind: "node",
      id: "project:node:replacement",
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "replacement" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    request(graph, [
      { kind: "put", entry: replacement },
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: { kind: "replace", address, replacementId: replacement.id },
      },
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .props.children,
    ).toBe("replacement");
    const fill: NodeEntry = {
      ...replacement,
      id: "project:node:fill",
      props: { children: { kind: "set", value: "fill" } },
    };
    const slot = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardSlot"],
    } as const;
    request(graph, [
      { kind: "put", entry: fill },
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: { kind: "fillSlot", address: slot, childIds: [fill.id] },
      },
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[2]
        .children[0].props.children,
    ).toBe("fill");
    expect(graph.indexes.childToOwner.get(fill.id)).toBe("project:node:cardA");
  });

  it("keeps set(null), remove and mask distinct and applies state after path override", () => {
    const graph = fixture();
    const address = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
    } as const;
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          props: { children: { kind: "remove" } },
          visual: { color: { kind: "mask" } },
          sizing: { width: { kind: "set", value: null } },
        },
      },
    ]);
    const normal = resolveCatalogNode(graph, "project:node:cardA").children[0]
      .children[0];
    expect(normal.props.children).toBe("title");
    expect(
      (graph.getEntry("project:node:cardA") as NodeEntry)
        .descendantOverrides[0],
    ).not.toHaveProperty("props");
    expect(normal.visual.color).toBeUndefined();
    expect(normal.sizing.width).toBeNull();
    expect(
      resolveCatalogNode(graph, "project:node:cardA", "hover").children[0]
        .children[0].visual.color,
    ).toBe("blue");
  });

  it("rejects invalid refs, ownership and writes without changing graph state", () => {
    const graph = fixture();
    const before = JSON.stringify(graph.exportDocument());
    const indexes = graph.indexes;
    const history = graph.history;
    const dirty = [...graph.dirtyIds];
    failureCode(
      () =>
        request(graph, [
          {
            kind: "patchNodeProp",
            id: "project:node:cardA",
            key: "unknown",
            write: { kind: "set", value: "x" },
          },
        ]),
      "PROP_NOT_ACCEPTED",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "upsertDescendant",
            id: "project:node:cardA",
            override: {
              kind: "patch",
              address: {
                instances: ["project:node:cardA"],
                templatePath: [
                  "lib:template:cardRoot",
                  "lib:template:badgeText",
                ],
              },
              props: { children: { kind: "set", value: "x" } },
            },
          },
        ]),
      "TEMPLATE_STEP_NOT_OWNED",
    );
    failureCode(
      () => request(graph, [{ kind: "remove", id: "project:node:cardA" }]),
      "DANGLING_CHILD",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              ...(graph.getEntry("project:node:cardA") as NodeEntry),
              definitionId: "lib:definition:missing",
            },
          },
        ]),
      "DANGLING_DEFINITION",
    );
    expect(JSON.stringify(graph.exportDocument())).toBe(before);
    expect(graph.indexes).toEqual(indexes);
    expect(graph.history).toEqual(history);
    expect([...graph.dirtyIds]).toEqual(dirty);
    expect(graph.revision).toBe(0);
  });

  it("returns forward/inverse and updates only changed record and relation edges", () => {
    const graph = fixture();
    const first = request(graph, [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "backgroundColor",
        write: { kind: "set", value: "red" },
      },
    ]);
    expect([...first.changedIds]).toEqual(["project:node:cardA"]);
    expect([...first.removedIds]).toEqual([]);
    expect(first.revision).toBe(1);
    expect(graph.metrics).toMatchObject({
      transactionEntriesTraversed: 0,
      transactionEntryTableClones: 0,
      transactionRecordReplacements: 1,
    });
    expect(graph.history).toHaveLength(1);
    request(graph, first.inverse);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").visual.backgroundColor,
    ).toBeUndefined();
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
    expect(
      Object.hasOwn(
        (graph.getEntry("project:node:cardA") as NodeEntry).visual,
        "backgroundColor",
      ),
    ).toBe(false);
    expect(graph.history).toHaveLength(2);
    expect(graph.revision).toBe(2);
  });

  it("tracks token, collection, definition and owner edges with affected closure", () => {
    const graph = fixture();
    request(graph, [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "color",
        write: {
          kind: "set",
          value: { kind: "token", tokenId: "lib:token:ink" },
        },
      },
      {
        kind: "setNodeBinding",
        id: "project:node:cardA",
        binding: {
          collectionId: "data:collection:people",
          fieldMap: { label: "data:field:name" },
        },
      },
    ]);
    expect([
      ...(graph.indexes.definitionToInstances.get("lib:definition:card") ?? []),
    ]).toEqual(["project:node:cardA", "project:node:cardB"]);
    expect([
      ...(graph.indexes.tokenToConsumers.get("lib:token:ink") ?? []),
    ]).toContain("project:node:cardA");
    expect([
      ...(graph.indexes.collectionToBindings.get("data:collection:people") ??
        []),
    ]).toEqual(["project:node:cardA"]);
    expect(
      graph
        .collectAffectedIds(["data:collection:people"])
        .has("project:node:cardB"),
    ).toBe(false);
    request(graph, [
      { kind: "setNodeBinding", id: "project:node:cardA" },
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "color",
        write: { kind: "remove" },
      },
    ]);
    expect(
      graph.indexes.collectionToBindings.has("data:collection:people"),
    ).toBe(false);
    expect(
      graph.indexes.tokenToConsumers
        .get("lib:token:ink")
        ?.has("project:node:cardA"),
    ).toBeFalsy();
  });

  it("validates format, version, payload, token, binding and action opcodes", () => {
    const { document, library } = createG1Fixture();
    failureCode(
      () =>
        new CatalogGraph(
          { ...document, schemaVersion: 2 } as unknown as CatalogDocument,
          library,
        ),
      "UNSUPPORTED_SCHEMA",
    );
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            // ADR-251: a contract 1 document (RadioGroup items under the group) is refused.
            libraryContractVersion: 1,
          } as unknown as CatalogDocument,
          library,
        ),
      "UNSUPPORTED_LIBRARY_CONTRACT",
    );
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            entries: {
              ...document.entries,
              "lib:definition:bad": { kind: "legacy" },
            },
          } as unknown as CatalogDocument,
          library,
        ),
      "UNKNOWN_ENTRY_KIND",
    );
    failureCode(
      () =>
        buildCatalogLibrary({
          contractVersion: 21,
          revision: "bad",
          definitions: [
            {
              id: "lib:definition:bad",
              name: "Bad",
              mode: "native",
              bindingId: "eval(x)",
              accepts: {},
              defaults: {},
              visual: {},
              stateRules: {},
            },
          ],
          templates: [],
          tokens: [],
          bindingIds: [],
          actionOpCodes: [],
        }),
      "UNKNOWN_BINDING_ID",
    );
    failureCode(
      () =>
        buildCatalogLibrary({
          contractVersion: 21,
          revision: "bad",
          definitions: [],
          templates: [],
          tokens: [
            {
              id: "lib:token:bad",
              tokenType: "color",
              value: 42,
              source: "spec-token",
            } as never,
          ],
          bindingIds: [],
          actionOpCodes: [],
        }),
      "TOKEN_VALUE_TYPE",
    );
    const graph = fixture();
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "interaction",
              id: "project:interaction:bad",
              ownerId: "project:node:cardA",
              trigger: "press",
              action: { opcode: "eval", code: "x" },
            } as never,
          },
        ]),
      "UNKNOWN_ACTION_OPCODE",
    );
  });

  it("clones owned nodes with new IDs while retaining definition refs", () => {
    const graph = fixture();
    const copy = cloneNodeSubgraph(
      graph,
      "project:node:cardA",
      (id) => `${id}Copy` as NodeEntry["id"],
    );
    expect(copy.rootId).toBe("project:node:cardACopy");
    expect(copy.entries).toHaveLength(1);
    expect(copy.entries[0].definitionId).toBe("lib:definition:card");
  });

  it("applies library, definition override, template, path and state precedence", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    expect(root?.kind).toBe("project");
    if (root?.kind !== "project") return;
    request(graph, [
      {
        kind: "put",
        entry: { ...root, overrideIds: ["project:definitionOverride:text"] },
      },
      {
        kind: "put",
        entry: {
          kind: "definitionOverride",
          id: "project:definitionOverride:text",
          targetId: "lib:definition:text",
          defaults: { children: { kind: "set", value: "override" } },
          visual: { color: { kind: "set", value: "green" } },
          stateRules: {
            hover: { color: { kind: "set", value: "purple" } },
            selectedHover: { color: { kind: "set", value: "cyan" } },
            selectedPressed: { color: { kind: "set", value: "navy" } },
          },
        },
      },
    ]);
    expect(
      graph
        .collectAffectedIds(["project:definitionOverride:text"])
        .has("project:node:cardA"),
    ).toBe(true);
    expect(
      graph
        .collectAffectedIds(["project:definitionOverride:text"])
        .has("project:node:cardB"),
    ).toBe(true);
    const address = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
    } as const;
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .props.children,
    ).toBe("title");
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          props: { children: { kind: "set", value: "path" } },
          visual: { color: { kind: "set", value: "red" } },
        },
      },
    ]);
    const target = resolveCatalogNode(graph, "project:node:cardA").children[0]
      .children[0];
    expect(target.props.children).toBe("path");
    expect(target.visual.color).toBe("red");
    expect(
      resolveCatalogNode(graph, "project:node:cardA", "hover").children[0]
        .children[0].visual.color,
    ).toBe("purple");
    expect(
      resolveCatalogNode(graph, "project:node:cardB", "selectedHover")
        .children[0].children[0].visual.color,
    ).toBe("cyan");
    expect(
      resolveCatalogNode(graph, "project:node:cardB", "selectedPressed")
        .children[0].children[0].visual.color,
    ).toBe("navy");
    request(graph, [
      {
        kind: "patchDefinitionOverride",
        id: "project:definitionOverride:text",
        scope: "visual",
        key: "color",
        write: {
          kind: "set",
          value: { kind: "token", tokenId: "lib:token:ink" },
        },
      },
    ]);
    expect(
      graph.indexes.tokenToConsumers
        .get("lib:token:ink")
        ?.has("project:definitionOverride:text"),
    ).toBe(true);
    expect(
      graph.collectAffectedIds(["lib:token:ink"]).has("project:node:cardB"),
    ).toBe(true);
  });

  it("rejects cycles, duplicate ownership, dangling slot and malformed project IDs", () => {
    const { document, library } = createG1Fixture();
    const page = document.entries["project:page:main"];
    if (page.kind !== "page") throw new Error("bad fixture");
    const card = document.entries["project:node:cardA"] as NodeEntry;
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            entries: {
              ...document.entries,
              [card.id]: { ...card, children: [card.id] },
            },
          },
          library,
        ),
      "DUPLICATE_OWNERSHIP",
    );
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            entries: {
              ...document.entries,
              [page.id]: { ...page, children: [card.id, card.id] },
            },
          },
          library,
        ),
      "DUPLICATE_ID",
    );
    failureCode(
      () =>
        new CatalogGraph(
          {
            ...document,
            entries: {
              ...document.entries,
              [card.id]: { ...card, definitionId: "lib:definition:missing" },
            },
          },
          library,
        ),
      "DANGLING_DEFINITION",
    );
    const graph = fixture();
    failureCode(
      () =>
        request(graph, [
          {
            kind: "upsertDescendant",
            id: card.id,
            override: {
              kind: "fillSlot",
              address: {
                instances: [card.id],
                templatePath: [
                  "lib:template:cardRoot",
                  "lib:template:cardText",
                ],
              },
              childIds: [],
            },
          },
        ]),
      "TARGET_NOT_SLOT",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "upsertDescendant",
            id: card.id,
            override: {
              kind: "patch",
              address: {
                instances: [card.id],
                templatePath: [
                  "lib:template:cardRoot",
                  "lib:template:cardText",
                ],
              },
              visual: {
                color: {
                  kind: "set",
                  value: { kind: "token", tokenId: "lib:token:missing" },
                },
              },
            },
          },
        ]),
      "DANGLING_TOKEN",
    );
  });

  it("validates theme preset, token value and token use types", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    if (root?.kind !== "project") throw new Error("bad fixture");
    const theme = {
      kind: "theme",
      id: "project:theme:main",
      name: "Main",
      tokenIds: [],
      preset: {
        tint: "indigo",
        neutral: "slate",
        radius: "md",
        darkMode: "system",
      },
    } as const;
    request(graph, [
      { kind: "put", entry: { ...root, themeIds: [theme.id] } },
      { kind: "put", entry: theme },
    ]);
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              ...theme,
              preset: { ...theme.preset, tint: "ultraviolet" },
            } as never,
          },
        ]),
      "INVALID_THEME_PRESET",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "token",
              id: "project:token:bad",
              name: "Bad",
              tokenType: "color",
              value: 42,
              source: "user-defined",
            } as never,
          },
        ]),
      "TOKEN_VALUE_TYPE",
    );
    request(graph, [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "opacity",
        write: { kind: "set", value: 0.5 },
      },
    ]);
    failureCode(
      () =>
        request(graph, [
          {
            kind: "patchNodeVisual",
            id: "project:node:cardA",
            key: "opacity",
            write: {
              kind: "set",
              value: { kind: "token", tokenId: "lib:token:ink" },
            },
          },
        ]),
      "TOKEN_TYPE_MISMATCH",
    );
  });

  it("keeps data IDs external and validates authored state action values", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    if (root?.kind !== "project") throw new Error("bad fixture");
    request(graph, [
      {
        kind: "put",
        entry: {
          ...root,
          stateVariableIds: ["project:stateVariable:flag"],
          interactionIds: ["project:interaction:press"],
        },
      },
      {
        kind: "put",
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:flag",
          ownerId: "project:page:main",
          name: "flag",
          valueType: "boolean",
          defaultValue: false,
        },
      },
      {
        kind: "put",
        entry: {
          kind: "interaction",
          id: "project:interaction:press",
          ownerId: "project:node:cardA",
          trigger: "press",
          action: {
            opcode: "setState",
            variableId: "project:stateVariable:flag",
            op: "set",
            value: true,
          },
        },
      },
      {
        kind: "setNodeBinding",
        id: "project:node:cardA",
        binding: {
          collectionId: "data:collection:external",
          fieldMap: { title: "data:field:external" },
        },
      },
    ]);
    expect(
      graph.indexes.collectionToBindings
        .get("data:collection:external")
        ?.has("project:node:cardA"),
    ).toBe(true);
    const currentRoot = graph.getEntry(graph.projectId);
    if (currentRoot?.kind !== "project") throw new Error("root missing");
    request(graph, [
      {
        kind: "put",
        entry: {
          ...currentRoot,
          interactionIds: [
            ...currentRoot.interactionIds,
            "project:interaction:toast",
            "project:interaction:capability",
          ],
        },
      },
      {
        kind: "put",
        entry: {
          kind: "interaction",
          id: "project:interaction:toast",
          ownerId: "project:node:cardA",
          address: {
            instances: ["project:node:cardA"],
            templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
          },
          trigger: "press",
          action: { opcode: "toast", message: "Saved" },
        },
      },
      {
        kind: "put",
        entry: {
          kind: "interaction",
          id: "project:interaction:capability",
          ownerId: "project:node:cardA",
          trigger: "change",
          action: {
            opcode: "capability",
            targetId: "project:node:cardB",
            capabilityId: "setValue",
            value: "x",
          },
        },
      },
      {
        kind: "put",
        entry: {
          kind: "interaction",
          id: "project:interaction:press",
          ownerId: "project:node:cardA",
          trigger: "press",
          action: {
            opcode: "setState",
            variableId: "project:stateVariable:flag",
            op: "toggle",
          },
        },
      },
    ]);
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "interaction",
              id: "project:interaction:press",
              ownerId: "project:node:cardA",
              trigger: "press",
              action: {
                opcode: "setState",
                variableId: "project:stateVariable:flag",
                op: "increment",
              },
            },
          },
        ]),
      "STATE_OP_TYPE",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "interaction",
              id: "project:interaction:capability",
              ownerId: "project:node:cardA",
              trigger: "change",
              action: {
                opcode: "capability",
                targetId: "project:node:cardB",
                capabilityId: "eval(x)",
              },
            },
          },
        ]),
      "UNKNOWN_CAPABILITY_ID",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "interaction",
              id: "project:interaction:toast",
              ownerId: "project:node:cardA",
              trigger: "onClick",
              action: { opcode: "toast", message: "x" },
            },
          },
        ]),
      "UNKNOWN_TRIGGER_ID",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: {
              kind: "interaction",
              id: "project:interaction:press",
              ownerId: "project:node:cardA",
              trigger: "press",
              action: {
                opcode: "setState",
                variableId: "project:stateVariable:flag",
                op: "set",
                value: "wrong",
              },
            },
          },
        ]),
      "STATE_VALUE_TYPE",
    );
    failureCode(
      () =>
        request(graph, [
          {
            kind: "setNodeBinding",
            id: "project:node:cardA",
            binding: {
              collectionId: "project:collection:bad" as never,
              fieldMap: {},
            },
          },
        ]),
      "INVALID_ID",
    );
  });

  it("keeps leaf writes away from full export and preserves revision on conflict", () => {
    const graph = fixture();
    const exported = graph.exportDocument;
    graph.exportDocument = () => {
      throw new Error("whole graph export used");
    };
    const result = request(graph, [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "opacity",
        write: { kind: "set", value: 0.6 },
      },
    ]);
    expect(result.revision).toBe(1);
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
    graph.exportDocument = exported;
    failureCode(
      () =>
        applyCatalogTransaction(graph, {
          projectId: graph.projectId,
          expectedRevision: 0,
          ops: result.inverse,
          history: { kind: "record", label: "stale" },
        }),
      "REVISION_CONFLICT",
    );
    expect(graph.revision).toBe(1);
    expect(graph.history).toHaveLength(1);
  });

  it.skipIf(G0_BASELINE_ABSENT)(
    "uses the frozen G0 semantic scenario as input without importing old document JSON",
    () => {
      const old = JSON.parse(
        readFileSync(
          new URL(
            "../../../../../../docs/adr/design/248-baseline/descendant-precedence.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(old.head).toBe("2a5c970994cb9de2f824a729b29c08cdcd647d7b");
      expect(old.scenario.id).toBe("adr248-old-descendant-precedence-v1");
      const graph = fixture();
      const address = {
        instances: ["project:node:cardA"],
        templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
      } as const;
      request(graph, [
        {
          kind: "upsertDescendant",
          id: "project:node:cardA",
          override: {
            kind: "patch",
            address,
            props: {
              children: {
                kind: "set",
                value: old.oldOutput.modeA.props.children,
              },
            },
          },
        },
      ]);
      expect(
        resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
          .props.children,
      ).toBe(old.oldOutput.modeA.props.children);
      const fill: NodeEntry = {
        kind: "node",
        id: "project:node:oldScenarioFill",
        definitionId: "lib:definition:text",
        children: [],
        props: {
          children: {
            kind: "set",
            value: old.oldOutput.modeC.ownedProps.children,
          },
        },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      request(graph, [
        { kind: "put", entry: fill },
        {
          kind: "upsertDescendant",
          id: "project:node:cardA",
          override: {
            kind: "fillSlot",
            address: {
              instances: ["project:node:cardA"],
              templatePath: ["lib:template:cardRoot", "lib:template:cardSlot"],
            },
            childIds: [fill.id],
          },
        },
      ]);
      expect(
        resolveCatalogNode(graph, "project:node:cardA").children[0].children[2]
          .children[0].props.children,
      ).toBe(old.oldOutput.modeC.ownedProps.children);
    },
  );

  it.skipIf(G0_BASELINE_ABSENT)(
    "owns page layout, placement and guides in typed project/page entries",
    () => {
      const old = JSON.parse(
        readFileSync(
          new URL(
            "../../../../../../docs/adr/design/248-baseline/page-authoring/baseline.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(old.scenario.id).toBe("adr248-old-page-authoring-v1");
      const graph = fixture();
      const root = graph.getEntry(graph.projectId);
      const page = graph.getEntry("project:page:main");
      if (root?.kind !== "project" || page?.kind !== "page")
        throw new Error("bad fixture");
      request(graph, [
        {
          kind: "put",
          entry: {
            ...root,
            pageLayout: {
              direction: old.after.direction,
              gap: old.after.gap,
              columns: old.after.columns,
            },
          },
        },
        {
          kind: "put",
          entry: {
            ...page,
            placement: { base: old.after.placement.style, breakpoints: {} },
            guideEntries: { desktop: old.after.guides },
          },
        },
      ]);
      expect(
        (graph.getEntry(root.id) as typeof root).pageLayout?.direction,
      ).toBe(old.after.direction);
      expect(
        (graph.getEntry(page.id) as typeof page).placement?.base.left,
      ).toBe(old.after.placement.style.left);
      expect(
        (graph.getEntry(page.id) as typeof page).guideEntries?.desktop?.[0]
          .position,
      ).toBe(old.after.guides[0].position);
      failureCode(
        () =>
          request(graph, [
            {
              kind: "put",
              entry: {
                ...page,
                placement: { base: { gridRow: 2 }, breakpoints: {} },
              } as never,
            },
          ]),
        "INVALID_PLACEMENT_FIELD",
      );
      failureCode(
        () =>
          request(graph, [
            {
              kind: "put",
              entry: {
                ...root,
                pageLayout: { direction: "horizontal", gap: -1 },
              },
            },
          ]),
        "NONNEGATIVE_NUMBER_REQUIRED",
      );
    },
  );

  it("keeps stable refs through rename and reorder, and rejects referenced definition deletion", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    const page = graph.getEntry("project:page:main");
    if (root?.kind !== "project" || page?.kind !== "page")
      throw new Error("bad fixture");
    const custom = {
      kind: "definition",
      id: "project:definition:custom",
      name: "Custom",
      mode: "composite",
      templateRootId: "project:node:customTemplate",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
    } as const;
    const template: NodeEntry = {
      kind: "node",
      id: "project:node:customTemplate",
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "custom" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const instance: NodeEntry = {
      ...template,
      id: "project:node:customInstance",
      definitionId: custom.id,
      props: {},
    };
    request(graph, [
      { kind: "put", entry: { ...root, definitionIds: [custom.id] } },
      { kind: "put", entry: custom },
      { kind: "put", entry: template },
      { kind: "put", entry: instance },
      {
        kind: "put",
        entry: { ...page, children: [...page.children, instance.id] },
      },
    ]);
    expect(
      resolveCatalogNode(graph, instance.id).children[0].props.children,
    ).toBe("custom");
    expect(
      cloneNodeSubgraph(
        graph,
        instance.id,
        (id) => `${id}Copy` as NodeEntry["id"],
      ).entries[0].definitionId,
    ).toBe(custom.id);
    request(graph, [
      { kind: "put", entry: { ...custom, name: "Renamed" } },
      {
        kind: "put",
        entry: {
          ...(graph.getEntry(page.id) as typeof page),
          children: [instance.id, "project:node:cardB", "project:node:cardA"],
        },
      },
    ]);
    expect(
      resolveCatalogNode(graph, instance.id).children[0].props.children,
    ).toBe("custom");
    failureCode(
      () =>
        request(graph, [
          { kind: "remove", id: custom.id },
          {
            kind: "put",
            entry: {
              ...(graph.getEntry(root.id) as typeof root),
              definitionIds: [],
            },
          },
        ]),
      "DANGLING_DEFINITION",
    );
  });

  it("supports selected state combinations and local state rules", () => {
    const graph = fixture();
    const address = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
    } as const;
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          stateRules: {
            selectedHover: { color: { kind: "set", value: "magenta" } },
            selectedPressed: { color: { kind: "set", value: "maroon" } },
          },
        },
      },
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA", "selectedHover")
        .children[0].children[0].visual.color,
    ).toBe("magenta");
    expect(
      resolveCatalogNode(graph, "project:node:cardA", "selectedPressed")
        .children[0].children[0].visual.color,
    ).toBe("maroon");
    expect(
      resolveCatalogNode(graph, "project:node:cardB", "selectedHover")
        .children[0].children[0].visual.color,
    ).toBe("black");
  });

  it("deletes an authored patch key on remove and restores inherited text", () => {
    const graph = fixture();
    const address = {
      instances: ["project:node:cardA"],
      templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
    } as const;
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          props: { children: { kind: "set", value: "edited" } },
        },
      },
    ]);
    request(graph, [
      {
        kind: "upsertDescendant",
        id: "project:node:cardA",
        override: {
          kind: "patch",
          address,
          props: { children: { kind: "remove" } },
        },
      },
    ]);
    expect(
      (graph.getEntry("project:node:cardA") as NodeEntry).descendantOverrides,
    ).toHaveLength(0);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .props.children,
    ).toBe("title");
  });

  it("resets a library definition override without persisting a remove marker", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    if (root?.kind !== "project") throw new Error("bad fixture");
    request(graph, [
      {
        kind: "put",
        entry: { ...root, overrideIds: ["project:definitionOverride:text"] },
      },
      {
        kind: "put",
        entry: {
          kind: "definitionOverride",
          id: "project:definitionOverride:text",
          targetId: "lib:definition:text",
          defaults: {},
          visual: { color: { kind: "set", value: "green" } },
          stateRules: {},
        },
      },
    ]);
    const reset = request(graph, [
      {
        kind: "patchDefinitionOverride",
        id: "project:definitionOverride:text",
        scope: "visual",
        key: "color",
        write: { kind: "remove" },
      },
    ]);
    const entry = graph.getEntry("project:definitionOverride:text");
    if (entry?.kind !== "definitionOverride")
      throw new Error("override missing");
    expect(entry.visual).toEqual({});
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .visual.color,
    ).toBe("black");
    request(graph, reset.inverse);
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").children[0].children[0]
        .visual.color,
    ).toBe("green");
    failureCode(
      () =>
        request(graph, [
          {
            kind: "put",
            entry: { ...entry, visual: { color: { kind: "remove" } } },
          },
        ]),
      "WRITE_REMOVE_NOT_DURABLE",
    );
  });

  it("normalizes Frame clip to one overflow field and rejects conflicts atomically", () => {
    const graph = fixture();
    request(graph, [
      frameClipInputToOperation("project:node:cardA", { clip: true }),
    ]);
    expect(
      resolveCatalogNode(graph, "project:node:cardA").visual.overflow,
    ).toBe("hidden");
    expect(isResolvedFrameClipped("hidden")).toBe(true);
    const revision = graph.revision;
    failureCode(
      () =>
        frameClipInputToOperation("project:node:cardA", {
          clip: true,
          overflow: "visible",
        }),
      "FRAME_CLIP_OVERFLOW_CONFLICT",
    );
    expect(graph.revision).toBe(revision);
    request(graph, [
      frameClipInputToOperation("project:node:cardA", {
        clip: false,
        overflow: "visible",
      }),
    ]);
    expect(
      isResolvedFrameClipped(
        String(resolveCatalogNode(graph, "project:node:cardA").visual.overflow),
      ),
    ).toBe(false);
  });

  it("rejects library definition cycles and project ownership cycles", () => {
    failureCode(
      () =>
        buildCatalogLibrary({
          contractVersion: 21,
          revision: "cycle",
          bindingIds: [],
          actionOpCodes: [],
          tokens: [],
          definitions: [
            {
              id: "lib:definition:a",
              name: "A",
              mode: "composite",
              templateRootId: "lib:template:a",
              accepts: {},
              defaults: {},
              visual: {},
              stateRules: {},
            },
            {
              id: "lib:definition:b",
              name: "B",
              mode: "composite",
              templateRootId: "lib:template:b",
              accepts: {},
              defaults: {},
              visual: {},
              stateRules: {},
            },
          ],
          templates: [
            {
              id: "lib:template:a",
              definitionId: "lib:definition:b",
              children: [],
              props: {},
              visual: {},
            },
            {
              id: "lib:template:b",
              definitionId: "lib:definition:a",
              children: [],
              props: {},
              visual: {},
            },
          ],
        }),
      "DEFINITION_CYCLE",
    );
    const graph = fixture();
    const a = graph.getEntry("project:node:cardA") as NodeEntry;
    const b = graph.getEntry("project:node:cardB") as NodeEntry;
    const page = graph.getEntry("project:page:main");
    if (page?.kind !== "page") throw new Error("bad fixture");
    failureCode(
      () =>
        request(graph, [
          { kind: "put", entry: { ...page, children: [] } },
          { kind: "put", entry: { ...a, children: [b.id] } },
          { kind: "put", entry: { ...b, children: [a.id] } },
        ]),
      "OWNERSHIP_CYCLE",
    );
  });

  it("applies compatible immutable library revision changes without project snapshots", () => {
    const { document, library } = createG1Fixture();
    const updated = buildCatalogLibrary({
      contractVersion: 21,
      revision: "g1-fixture-v2",
      definitions: [...library.definitions.values()],
      templates: [...library.templates.values()],
      tokens: [...library.tokens.values()].map((token) =>
        token.id === "lib:token:ink" ? { ...token, value: "navy" } : token,
      ),
      bindingIds: [...library.execution.bindingIds],
      triggerIds: [...library.execution.triggerIds],
      capabilityIds: [...library.execution.capabilityIds],
      actionOpCodes: [...library.execution.actionOpCodes],
    });
    expect(
      resolveCatalogNode(
        new CatalogGraph(document, library),
        "project:node:cardA",
      ).children[0].children[0].visual.color,
    ).toBe("black");
    expect(
      resolveCatalogNode(
        new CatalogGraph(document, updated),
        "project:node:cardA",
      ).children[0].children[0].visual.color,
    ).toBe("navy");
    expect(library.tokens.get("lib:token:ink")?.value).toBe("black");
    expect((updated.tokens as Map<string, unknown>).set).toBeUndefined();
    failureCode(
      () =>
        new CatalogGraph(document, {
          ...updated,
          tokens: new Map(updated.tokens),
        } as never),
      "UNVERIFIED_LIBRARY",
    );
  });

  it("clones a nested owned graph and remaps internal child IDs", () => {
    const graph = fixture();
    const page = graph.getEntry("project:page:main");
    const first = graph.getEntry("project:node:cardA");
    if (page?.kind !== "page" || first?.kind !== "node")
      throw new Error("bad fixture");
    request(graph, [
      { kind: "put", entry: { ...page, children: [first.id] } },
      { kind: "put", entry: { ...first, children: ["project:node:cardB"] } },
    ]);
    const copy = cloneNodeSubgraph(
      graph,
      first.id,
      (id) => `${id}Copy` as NodeEntry["id"],
    );
    expect(copy.entries).toHaveLength(2);
    expect(
      copy.entries.find((entry) => entry.id === copy.rootId)?.children,
    ).toEqual(["project:node:cardBCopy"]);
    expect(
      copy.entries.every(
        (entry) => entry.definitionId === "lib:definition:card",
      ),
    ).toBe(true);
    failureCode(
      () => cloneNodeSubgraph(graph, first.id, () => "project:node:collision"),
      "CLONE_ID_COLLISION",
    );
  });

  it("updates definition reverse edges only for the changed instance", () => {
    const graph = fixture();
    const node = graph.getEntry("project:node:cardA") as NodeEntry;
    request(graph, [
      { kind: "put", entry: { ...node, definitionId: "lib:definition:box" } },
    ]);
    expect(
      graph.indexes.definitionToInstances.get("lib:definition:card"),
    ).toEqual(new Set(["project:node:cardB"]));
    expect(
      graph.indexes.definitionToInstances.get("lib:definition:box"),
    ).toEqual(new Set(["project:node:cardA"]));
    expect(graph.metrics.transactionIndexEdgesUpdated).toBe(2);
  });

  it("updates owner reverse edges on a scoped move", () => {
    const graph = fixture();
    const page = graph.getEntry("project:page:main");
    const node = graph.getEntry("project:node:cardA");
    if (page?.kind !== "page" || node?.kind !== "node")
      throw new Error("bad fixture");
    request(graph, [
      { kind: "put", entry: { ...page, children: [node.id] } },
      { kind: "put", entry: { ...node, children: ["project:node:cardB"] } },
    ]);
    expect(graph.indexes.childToOwner.get("project:node:cardB")).toBe(node.id);
    expect(graph.indexes.ownerToChildren.get(page.id)).toEqual(
      new Set([node.id]),
    );
    expect(graph.indexes.ownerToChildren.get(node.id)).toEqual(
      new Set(["project:node:cardB"]),
    );
  });

  it("updates only token and collection reverse edges for leaf reference edits", () => {
    const graph = fixture();
    const beforeDefinition = graph.indexes.definitionToInstances;
    const beforeOwner = graph.indexes.ownerToChildren;
    request(graph, [
      {
        kind: "patchNodeVisual",
        id: "project:node:cardA",
        key: "color",
        write: {
          kind: "set",
          value: { kind: "token", tokenId: "lib:token:ink" },
        },
      },
    ]);
    expect(
      graph.indexes.tokenToConsumers
        .get("lib:token:ink")
        ?.has("project:node:cardA"),
    ).toBe(true);
    expect(graph.indexes.definitionToInstances).toEqual(beforeDefinition);
    expect(graph.indexes.ownerToChildren).toEqual(beforeOwner);
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
    request(graph, [
      {
        kind: "setNodeBinding",
        id: "project:node:cardA",
        binding: { collectionId: "data:collection:one", fieldMap: {} },
      },
    ]);
    expect(
      graph.indexes.collectionToBindings.get("data:collection:one"),
    ).toEqual(new Set(["project:node:cardA"]));
    expect(graph.indexes.definitionToInstances).toEqual(beforeDefinition);
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
  });

  it("leaves graph, indexes, history, revision and dirty set untouched after a later invalid op", () => {
    const graph = fixture();
    const before = graph.exportDocument();
    const indexes = graph.indexes;
    const metrics = graph.metrics;
    failureCode(
      () =>
        request(graph, [
          {
            kind: "patchNodeVisual",
            id: "project:node:cardA",
            key: "opacity",
            write: { kind: "set", value: 0.4 },
          },
          {
            kind: "patchNodeProp",
            id: "project:node:cardA",
            key: "unknown",
            write: { kind: "set", value: "bad" },
          },
        ]),
      "PROP_NOT_ACCEPTED",
    );
    expect(graph.exportDocument()).toEqual(before);
    expect(graph.indexes).toEqual(indexes);
    expect(graph.metrics).toEqual(metrics);
    expect(graph.history).toHaveLength(0);
    expect(graph.revision).toBe(0);
    expect(graph.dirtyIds.size).toBe(0);
  });

  it("detaches and deletes an unreferenced node in one transaction, then restores its owner", () => {
    const graph = fixture();
    const page = graph.getEntry("project:page:main");
    if (page?.kind !== "page") throw new Error("bad fixture");
    const deleted = request(graph, [
      { kind: "put", entry: { ...page, children: ["project:node:cardB"] } },
      { kind: "remove", id: "project:node:cardA" },
    ]);
    expect([...deleted.removedIds]).toEqual(["project:node:cardA"]);
    expect(graph.getEntry("project:node:cardA")).toBeUndefined();
    expect(
      graph.indexes.definitionToInstances.get("lib:definition:card"),
    ).toEqual(new Set(["project:node:cardB"]));
    request(graph, deleted.inverse);
    expect((graph.getEntry(page.id) as typeof page).children).toEqual([
      "project:node:cardA",
      "project:node:cardB",
    ]);
    expect(graph.getEntry("project:node:cardA")?.kind).toBe("node");
  });

  it("clones owned state and interaction IDs with internal action references", () => {
    const graph = fixture();
    const root = graph.getEntry(graph.projectId);
    if (root?.kind !== "project") throw new Error("bad fixture");
    request(graph, [
      {
        kind: "put",
        entry: {
          ...root,
          stateVariableIds: ["project:stateVariable:local"],
          interactionIds: ["project:interaction:local"],
        },
      },
      {
        kind: "put",
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:local",
          ownerId: "project:node:cardA",
          name: "local",
          valueType: "boolean",
          defaultValue: false,
        },
      },
      {
        kind: "put",
        entry: {
          kind: "interaction",
          id: "project:interaction:local",
          ownerId: "project:node:cardA",
          address: {
            instances: ["project:node:cardA"],
            templatePath: ["lib:template:cardRoot"],
          },
          trigger: "press",
          action: {
            opcode: "setState",
            variableId: "project:stateVariable:local",
            op: "toggle",
          },
        },
      },
    ]);
    failureCode(
      () =>
        cloneNodeSubgraph(
          graph,
          "project:node:cardA",
          (id) => `${id}Copy` as NodeEntry["id"],
        ),
      "CLONE_RELATED_ID_ALLOCATOR_REQUIRED",
    );
    // Owned records come from the reverse reference index, never a document export.
    const exported = vi.spyOn(graph, "exportDocument");
    const copy = cloneNodeSubgraph(
      graph,
      "project:node:cardA",
      (id) => `${id}Copy` as NodeEntry["id"],
      (id) => `${id}Copy` as typeof id,
    );
    expect(exported).not.toHaveBeenCalled();
    expect([...graph.referrersOf("project:node:cardA")].sort()).toEqual([
      "project:interaction:local",
      "project:stateVariable:local",
    ]);
    expect(copy.relatedEntries).toHaveLength(2);
    const variable = copy.relatedEntries.find(
      (entry) => entry.kind === "stateVariable",
    );
    const interaction = copy.relatedEntries.find(
      (entry) => entry.kind === "interaction",
    );
    expect(variable?.ownerId).toBe(copy.rootId);
    expect(interaction?.ownerId).toBe(copy.rootId);
    if (interaction?.kind !== "interaction")
      throw new Error("interaction missing");
    expect(interaction.address?.instances[0]).toBe(copy.rootId);
    expect(interaction.action.opcode).toBe("setState");
    if (interaction.action.opcode === "setState")
      expect(interaction.action.variableId).toBe(
        "project:stateVariable:localCopy",
      );
  });

  it("fans out one Tree and Slider definition override to both instances", () => {
    const { document, library } = createG1Fixture();
    const extended = buildCatalogLibrary({
      contractVersion: 21,
      revision: "g1-tree-slider",
      definitions: [
        ...library.definitions.values(),
        {
          id: "lib:definition:tree",
          name: "Tree",
          mode: "primitive",
          bindingId: "tree",
          accepts: {},
          defaults: {},
          visual: { indentPerLevel: 12 },
          stateRules: {},
        },
        {
          id: "lib:definition:slider",
          name: "Slider",
          mode: "primitive",
          bindingId: "slider",
          accepts: {},
          defaults: {},
          visual: { thumbSize: 8 },
          stateRules: {},
        },
      ],
      templates: [...library.templates.values()],
      tokens: [...library.tokens.values()],
      bindingIds: [...library.execution.bindingIds, "tree", "slider"],
      triggerIds: [...library.execution.triggerIds],
      capabilityIds: [...library.execution.capabilityIds],
      actionOpCodes: [...library.execution.actionOpCodes],
    });
    const root = document.entries[document.projectId];
    const page = document.entries["project:page:main"];
    if (root.kind !== "project" || page.kind !== "page")
      throw new Error("bad fixture");
    const nodes = ["treeA", "treeB", "sliderA", "sliderB"].map(
      (name): NodeEntry => ({
        kind: "node",
        id: `project:node:${name}`,
        definitionId: name.startsWith("tree")
          ? "lib:definition:tree"
          : "lib:definition:slider",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }),
    );
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          ...document.entries,
          [root.id]: {
            ...root,
            overrideIds: [
              "project:definitionOverride:tree",
              "project:definitionOverride:slider",
            ],
          },
          [page.id]: {
            ...page,
            children: [...page.children, ...nodes.map((node) => node.id)],
          },
          ...Object.fromEntries(nodes.map((node) => [node.id, node])),
          "project:definitionOverride:tree": {
            kind: "definitionOverride",
            id: "project:definitionOverride:tree",
            targetId: "lib:definition:tree",
            defaults: {},
            visual: { indentPerLevel: { kind: "set", value: 20 } },
            stateRules: {},
          },
          "project:definitionOverride:slider": {
            kind: "definitionOverride",
            id: "project:definitionOverride:slider",
            targetId: "lib:definition:slider",
            defaults: {},
            visual: { thumbSize: { kind: "set", value: 14 } },
            stateRules: {},
          },
        },
      },
      extended,
    );
    for (const id of ["project:node:treeA", "project:node:treeB"] as const)
      expect(resolveCatalogNode(graph, id).visual.indentPerLevel).toBe(20);
    for (const id of ["project:node:sliderA", "project:node:sliderB"] as const)
      expect(resolveCatalogNode(graph, id).visual.thumbSize).toBe(14);
    const affected = graph.collectAffectedIds([
      "project:definitionOverride:tree",
    ]);
    expect(affected.has("project:node:treeA")).toBe(true);
    expect(affected.has("project:node:treeB")).toBe(true);
    expect(affected.has("project:node:sliderA")).toBe(false);
    expect(affected.has("project:node:sliderB")).toBe(false);
  });
});

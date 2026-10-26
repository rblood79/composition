import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../graph";
import type {
  CatalogEntry,
  EntryId,
  InteractionEntry,
  NodeEntry,
  StateVariableEntry,
  ViewEntry,
} from "../types";
import {
  addView,
  duplicatePage,
  promoteBindingView,
  removeView,
} from "../../commands";
import { cloneNodeSubgraph } from "../clone";
import {
  allocator,
  code,
  documentOf,
  graphOf,
  library,
  node,
  PAGE,
  run,
  snapshot,
  undo,
} from "../../commands/__tests__/fixture";

/**
 * ADR-284 Phase 1 — the stored shape (contract 50): a binding's built-in view · a shared view
 * entry · a rule's Do list, their checks, the reference index and the commands that pass them.
 */
const USERS = "data:collection:users" as const;
const VIEW = "project:view:male" as EntryId<"view">;
const where = { id: "where", op: "and" as const, items: [] };
const gender = {
  id: "gender",
  fields: [["data:field:f-gender" as const]],
  op: "equals" as const,
  value: "male",
};
const bound = (patch: Partial<NonNullable<NodeEntry["binding"]>> = {}) =>
  node("list", "lib:definition:listbox", {
    binding: { collectionId: USERS, fieldMap: {}, ...patch },
  });
const shared = (patch: Partial<ViewEntry> = {}): ViewEntry => ({
  kind: "view",
  id: VIEW,
  name: "Men",
  source: { collectionId: USERS },
  where: { ...where, items: [gender] },
  ...patch,
});
const accepted = (nodes: NodeEntry[], extra: CatalogEntry[] = []) =>
  code(() =>
    graphOf(
      nodes,
      nodes.map((item) => item.id.split(":")[2]!),
      extra,
    ),
  );

describe("ADR-284 — the view shape", () => {
  it("a built-in view and a shared view are stored; contract 50", () => {
    expect(
      accepted([bound({ view: { where: { ...where, items: [gender] } } })]),
    ).toBe("ACCEPTED");
    expect(accepted([bound({ viewId: VIEW })], [shared()])).toBe("ACCEPTED");
    expect(documentOf([], []).libraryContractVersion).toBe(50);
  });

  it("refuses: both view and viewId · grouping in a built-in view · an empty `or` · duplicate ids", () => {
    expect(
      accepted([bound({ viewId: VIEW, view: { where } })], [shared()]),
    ).toBe("VIEW_AND_VIEW_ID");
    expect(
      accepted([
        bound({
          view: { where, aggregates: [{ fn: "count", as: "n" }] } as never,
        }),
      ]),
    ).toBe("VIEW_AGGREGATE_DERIVED_ONLY");
    expect(
      accepted([bound({ view: { where: { id: "w", op: "or", items: [] } } })]),
    ).toBe("EMPTY_OR_GROUP");
    expect(
      accepted([
        bound({ view: { where: { ...where, items: [gender, gender] } } }),
      ]),
    ).toBe("DUPLICATE_CONDITION_ID");
  });

  it("refuses value shapes a comparison cannot read", () => {
    const one = (patch: Record<string, unknown>) =>
      accepted([
        bound({
          view: {
            where: { ...where, items: [{ ...gender, ...patch }] },
          } as never,
        }),
      ]);
    expect(one({ op: "between", value: [1] })).toBe(
      "COMPARISON_RANGE_REQUIRED",
    );
    expect(one({ op: "between", value: [1, 9] })).toBe("ACCEPTED");
    expect(one({ op: "oneOf", value: "x" })).toBe("COMPARISON_LIST_REQUIRED");
    expect(one({ op: "oneOf", value: "!var.data:variable:s" })).toBe(
      "ACCEPTED",
    );
    expect(one({ op: "exists", value: "x" })).toBe(
      "COMPARISON_VALUE_NOT_ALLOWED",
    );
    expect(one({ op: "withinLast", value: 7 })).toBe(
      "COMPARISON_UNIT_REQUIRED",
    );
    expect(one({ op: "like" })).toBe("UNKNOWN_COMPARISON");
    expect(one({ enabled: "yes" })).toBe("CONDITION_ENABLED_BOOLEAN");
  });

  it("a shared view: present, over the binding's collection, no source loop", () => {
    expect(accepted([bound({ viewId: VIEW })])).toBe("DANGLING_VIEW");
    expect(
      accepted(
        [bound({ viewId: VIEW })],
        [shared({ source: { collectionId: "data:collection:orders" } })],
      ),
    ).toBe("VIEW_COLLECTION_MISMATCH");
    const a = shared({
      id: "project:view:a",
      source: { viewId: "project:view:b" },
    });
    const b = shared({
      id: "project:view:b",
      source: { viewId: "project:view:a" },
    });
    expect(accepted([], [a, b])).toBe("DANGLING_VIEW");
    // (A derived view reads its source's collection.)
    const derived = shared({ id: "project:view:d", source: { viewId: VIEW } });
    expect(accepted([bound({ viewId: derived.id })], [shared(), derived])).toBe(
      "ACCEPTED",
    );
  });

  it("a rule holds a Do list: at least one; a 49 single `action` is refused", () => {
    const rule = (actions: unknown): CatalogEntry =>
      ({
        kind: "interaction",
        id: "project:interaction:r",
        ownerId: "project:node:list",
        trigger: "press",
        actions,
      }) as never;
    expect(accepted([bound()], [rule([])])).toBe("ACTIONS_REQUIRED");
    expect(
      accepted(
        [bound()],
        [
          rule([
            { opcode: "navigate", pageId: PAGE },
            { opcode: "navigate", pageId: PAGE },
          ]),
        ],
      ),
    ).toBe("ACCEPTED");
    expect(
      accepted(
        [bound()],
        [
          {
            ...(rule([]) as object),
            actions: undefined,
            action: { opcode: "navigate", pageId: PAGE },
          } as never,
        ],
      ),
    ).toBe("UNKNOWN_FIELD");
    const old = { ...documentOf([], []), libraryContractVersion: 49 };
    expect(code(() => new CatalogGraph(old as never, library()))).toBe(
      "UNSUPPORTED_LIBRARY_CONTRACT",
    );
  });
});

describe("ADR-284 — commands that pass a view", () => {
  it("a shared view is removed only when nothing reads it (VIEW_IN_USE)", () => {
    const graph = graphOf([bound({ viewId: VIEW })], ["list"], [shared()]);
    expect(code(() => run(graph, removeView({ id: VIEW })))).toBe(
      "VIEW_IN_USE",
    );
    const free = graphOf([bound()], ["list"]);
    const { result } = run(free, addView({ entry: shared() }));
    expect(free.getEntry(VIEW)?.kind).toBe("view");
    run(free, removeView({ id: VIEW }));
    expect(free.getEntry(VIEW)).toBeUndefined();
    expect(result).toBeTruthy();
  });

  it("promotion: the built-in view becomes a shared view the binding reads; undo restores both", () => {
    const graph = graphOf(
      [bound({ view: { where: { ...where, items: [gender] } } })],
      ["list"],
    );
    const before = snapshot(graph);
    const { result } = run(
      graph,
      promoteBindingView({
        nodeId: "project:node:list",
        id: VIEW,
        name: "Men",
      }),
    );
    const list = graph.getEntry("project:node:list") as NodeEntry;
    expect(list.binding).toEqual({
      collectionId: USERS,
      fieldMap: {},
      viewId: VIEW,
    });
    expect(graph.getEntry(VIEW)).toMatchObject({
      source: { collectionId: USERS },
      where: { items: [gender] },
    });
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(before.replace(/"revision":\d+/g, ""));
  });

  it("a copy's view reads the copy's variables (element variable in a subtree · page duplicate)", () => {
    const pageVar: StateVariableEntry = {
      kind: "stateVariable",
      id: "project:stateVariable:g",
      ownerId: PAGE,
      name: "g",
      valueType: "string",
      defaultValue: "male",
    };
    const view = {
      where: {
        ...where,
        items: [{ ...gender, value: "!var.project:stateVariable:g" }],
      },
    };
    const graph = graphOf([bound({ view })], ["list"], [pageVar]);
    const newId = allocator();
    run(
      graph,
      duplicatePage({ id: PAGE, route: "/copy", name: "copy", newId }),
    );
    const copies = Object.values(graph.exportDocument().entries).filter(
      (entry) =>
        entry.kind === "node" &&
        entry.id !== "project:node:list" &&
        entry.binding,
    ) as NodeEntry[];
    const copyVar = Object.values(graph.exportDocument().entries).find(
      (entry) => entry.kind === "stateVariable" && entry.id !== pageVar.id,
    )!;
    expect(copies).toHaveLength(1);
    expect(copies[0]!.binding!.view!.where.items[0]).toMatchObject({
      value: `!var.${copyVar.id}`,
    });
    // (A subtree clone keeps a page variable reference as it is.)
    const clone = cloneNodeSubgraph(
      graph,
      "project:node:list",
      () => "project:node:x",
      (old) => old as never,
    );
    expect(clone.entries[0]!.binding!.view!.where.items[0]).toMatchObject({
      value: "!var.project:stateVariable:g",
    });
  });

  it("a rule's Do list is indexed: every Do's page · variable · target is a reference", () => {
    const rule: InteractionEntry = {
      kind: "interaction",
      id: "project:interaction:r",
      ownerId: "project:node:list",
      trigger: "press",
      actions: [
        {
          opcode: "capability",
          target: { nodeId: "project:node:list" },
          capabilityId: "selectItem",
        },
        { opcode: "navigate", pageId: PAGE },
      ],
    };
    const graph = graphOf([bound()], ["list"], [rule]);
    expect([...graph.referrersOf(PAGE)]).toContain(rule.id);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { documentOf, node, PAGE } from "../../commands/__tests__/fixture";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../document/generated/reusableOriginLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogLibrary,
  DefinitionId,
  EditTarget,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../document/types";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { readPropSource } from "../fieldSource";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../positions";
import { resolveCatalogNode, type ResolvedCatalogNode } from "../resolver";
import {
  CATALOG_DENSITY_PROPAGATION_OWNER,
  CATALOG_SIZE_PASS_THROUGH,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_OVERFLOW_MODE_OWNERS,
} from "../../document/sizePropagation";

/**
 * ADR-248 Phase 4c — prop sources against the resolver: for every position of every code
 * library origin instance, the authored value `readPropSource` reports equals the resolved prop,
 * except where the resolver derives the value (a `{key}` template binding, a collection item's
 * selection that its collection decides, the `size` an owner gives its part —
 * `CATALOG_SIZE_PROPAGATION`: an InlineAlert's description one step up, ADR-254).
 */
let library: CatalogLibrary;
let graph: CatalogGraph;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
  const origins = REUSABLE_ORIGIN_DEFINITIONS.map((definition, index) =>
    node(`origin${index}`, definition.id as NodeEntry["definitionId"]),
  );
  graph = new CatalogGraph(
    documentOf(
      origins,
      origins.map((entry) => entry.id.slice("project:node:".length)),
    ),
    library,
  );
});

const identity = (node: ResolvedCatalogNode) =>
  `${node.instancePath.join("/")}::${node.sourceId}`;
/** Records whose `size` their structural owner sets (composite layers skipped, as the resolver). */
const ownerSized = new Set<string>();
function resolvedByIdentity(): Map<string, ResolvedCatalogNode> {
  const map = new Map<string, ResolvedCatalogNode>();
  const walk = (node: ResolvedCatalogNode, owner?: string) => {
    map.set(identity(node), node);
    const name = library.definitions.get(node.definitionId as never)?.name;
    if (owner && name && CATALOG_SIZE_PROPAGATION[owner]?.includes(name))
      ownerSized.add(identity(node));
    const composite = rootOf(node.definitionId) !== undefined;
    // (A Group · frame · Content between passes the owner's size — `CATALOG_SIZE_PASS_THROUGH`.)
    const passes = !!name && CATALOG_SIZE_PASS_THROUGH.has(name);
    node.children.forEach((child) =>
      walk(child, composite || passes ? owner : name),
    );
  };
  for (const position of pagePositions(graph, PAGE))
    walk(resolveCatalogNode(graph, position.sourceId as never));
  return map;
}
function allPositions(): CatalogPosition[] {
  const out: CatalogPosition[] = [];
  const walk = (position: CatalogPosition) => {
    out.push(position);
    childPositions(graph, position).forEach(walk);
  };
  pagePositions(graph, PAGE).forEach(walk);
  return out;
}
const rootOf = (definitionId: DefinitionId) => {
  const definition = definitionId.startsWith("lib:")
    ? library.definitions.get(definitionId as never)
    : (graph.getEntry(definitionId) as unknown as {
        mode: string;
        templateRootId?: string;
      });
  return definition?.mode === "composite"
    ? definition.templateRootId
    : undefined;
};
const isBinding = (value: unknown) =>
  typeof value === "string" && /\{[^{}]+\}/.test(value);

describe("ADR-248 Phase 4c prop sources", () => {
  it("reports the resolved authored value for every origin position's props", () => {
    const resolved = resolvedByIdentity();
    const mismatches: string[] = [];
    const sources = new Set<string>();
    let compared = 0;
    const compare = (
      target: EditTarget,
      record: ResolvedCatalogNode,
      keep: (key: string) => boolean = () => true,
    ) => {
      for (const [key, value] of Object.entries(record.props)) {
        if (!keep(key)) continue;
        if (key === "size" && ownerSized.has(identity(record))) continue;
        // (A value its Table carries to it — `density` · `overflowMode`, no editor on the part.)
        const typeName = library.definitions.get(
          record.definitionId as never,
        )?.name;
        if (
          typeName &&
          ((key === "density" && CATALOG_DENSITY_PROPAGATION_OWNER[typeName]) ||
            (key === "overflowMode" && CATALOG_OVERFLOW_MODE_OWNERS[typeName]) ||
            // (ADR-259 Phase 3: a ContextualHelp's glyph is its `variant`'s — S2 has no other.)
            (key === "iconName" &&
              typeName === "Icon" &&
              identity(record).includes("component-contextualhelp__")))
        )
          continue;
        const reading = readPropSource(graph, target, key);
        // (A binding the reading cannot follow — a `{field}` row template — and a resolved
        // placeholder — a `{icon}` no instance value fills, which hides the part — are not values.)
        if (
          isBinding(value) ||
          reading.layers.some((layer) => isBinding(layer.value))
        )
          continue;
        compared += 1;
        if (reading.source) sources.add(reading.source);
        if (JSON.stringify(reading.value) !== JSON.stringify(value))
          mismatches.push(
            `${identity(record)} ${key}: read ${JSON.stringify(reading.value)} (${reading.source}) · resolved ${JSON.stringify(value)}`,
          );
      }
    };
    for (const position of allPositions()) {
      const found = resolved.get(position.identity);
      if (!found) continue;
      let record: ResolvedCatalogNode = found;
      compare(position.target, record);
      // The element a composite position stands for: its collapsed root (and a root's root).
      const owner =
        position.target.kind === "node"
          ? position.target.id
          : position.target.ownerId;
      let instances: readonly string[] =
        position.target.kind === "node"
          ? [position.target.id]
          : [...position.target.address.instances, position.sourceId];
      for (;;) {
        const rootId = rootOf(record.definitionId);
        const root: ResolvedCatalogNode | undefined = rootId
          ? record.children.find((child) => child.sourceId === rootId)
          : undefined;
        if (!root || !rootId) break;
        compare(
          {
            kind: "descendant",
            ownerId: owner as NodeId,
            address: {
              instances: instances as NodeId[],
              templatePath: [rootId as TemplateId],
            },
          },
          root,
        );
        record = root;
        instances = [...instances, rootId];
        // The row itself reads the element's values (the Inspector's selection is the row).
        const schema = library.definitions.get(
          (resolved.get(position.identity) as ResolvedCatalogNode)
            .definitionId as never,
        )?.accepts;
        compare(position.target, root, (key) => !(schema && key in schema));
      }
    }
    expect(compared).toBeGreaterThan(500);
    expect(mismatches).toEqual([]);
    expect([...sources].sort()).toEqual(
      expect.arrayContaining([
        "definition-default",
        "instance",
        "library-patch",
        "state",
        "template",
      ]),
    );
  });

  it("reads an owned instance's authored root prop as its own and as the root's instance value", () => {
    const icon = "project:node:icon" as NodeId;
    const local = new CatalogGraph(
      documentOf(
        [
          node("icon", "lib:definition:origin-component-button" as never, {
            props: { variant: { kind: "set", value: "secondary" } },
          }),
        ],
        ["icon"],
      ),
      library,
    );
    const resolvedRoot = resolveCatalogNode(local, icon).children[0];
    expect(resolvedRoot.props.variant).toBe("secondary");
    expect(
      readPropSource(local, { kind: "node", id: icon }, "variant"),
    ).toMatchObject({
      value: "secondary",
      source: "own",
      inherited: { value: "primary" },
    });
    expect(
      readPropSource(
        local,
        {
          kind: "descendant",
          ownerId: icon,
          address: {
            instances: [icon],
            templatePath: ["lib:template:component-button" as TemplateId],
          },
        },
        "variant",
      ),
    ).toMatchObject({ value: "secondary", source: "instance" });
  });

  /**
   * 2026-10-22 (user: selecting a Popover in Layers → "Too many re-renders"): a template position's
   * prop written as `{name}` shows the binder instance's `name` — the panel's number field got the
   * string `"{offset}"` (NaN). The binder is the enclosing instance for the position's own
   * template, the position itself for a collapsed composite root; a name the origin does not
   * accept (a row template's `{label}`) stays as written; an unfilled binding shows nothing.
   */
  it("follows a `{name}` template binding to the instance's value, not the written placeholder", () => {
    const popover = "project:node:popover" as NodeId;
    const combo = "project:node:combo" as NodeId;
    const button = "project:node:button" as NodeId;
    const local = new CatalogGraph(
      documentOf(
        [
          node("popover", "lib:definition:origin-component-popover" as never),
          node("combo", "lib:definition:origin-component-combobox" as never),
          node("button", "lib:definition:origin-component-button" as never, {
            props: { icon: { kind: "set", value: "star" } },
          }),
        ],
        ["popover", "combo", "button"],
      ),
      library,
    );
    const overlay: EditTarget = {
      kind: "descendant",
      ownerId: popover,
      address: {
        instances: [popover],
        templatePath: [
          "lib:template:component-popover" as TemplateId,
          "lib:template:component-popover__overlay" as TemplateId,
        ],
      },
    };
    // The Popover's `offset: "{offset}"` → the popover origin's default, then the instance's write.
    expect(readPropSource(local, overlay, "offset")).toMatchObject({
      value: 8,
      source: "definition-default",
    });
    applyCatalogTransaction(local, {
      projectId: local.projectId,
      expectedRevision: local.revision,
      history: { kind: "record", label: "offset" },
      ops: [
        {
          kind: "put",
          entry: {
            ...(local.getEntry(popover) as NodeEntry),
            props: { offset: { kind: "set", value: 12 } },
          },
        },
      ],
    });
    expect(readPropSource(local, overlay, "offset")).toMatchObject({
      value: 12,
      source: "instance",
    });
    // The resolver binds the same value.
    const resolved = resolveCatalogNode(local, popover);
    const drawn = (
      nodes: readonly ResolvedCatalogNode[],
    ): ResolvedCatalogNode | undefined =>
      nodes.find((item) => item.sourceId === "lib:template:component-popover__overlay") ??
      nodes.map((item) => drawn(item.children)).find(Boolean);
    expect(drawn(resolved.children)?.props.offset).toBe(12);
    // A row template's `{label}` (ListBoxItem accepts no `label`) stays a binding.
    expect(
      readPropSource(
        local,
        {
          kind: "descendant",
          ownerId: combo,
          address: {
            instances: [
              combo,
              "lib:template:component-combobox__item-1" as TemplateId,
            ],
            templatePath: [
              "lib:template:component-listbox-item-default" as TemplateId,
            ],
          },
        },
        "children",
      ).value,
    ).toBe("{label}");
    // A Button's Icon `{icon}`: the instance's `icon` (collapsed root — the node itself binds it).
    const iconOf = (owner: NodeId) =>
      readPropSource(
        local,
        {
          kind: "descendant",
          ownerId: owner,
          address: {
            instances: [owner],
            templatePath: [
              "lib:template:component-button" as TemplateId,
              "lib:template:component-button__icon" as TemplateId,
            ],
          },
        },
        "iconName",
      );
    expect(iconOf(button)).toMatchObject({ value: "star", source: "instance" });
    const plain = "project:node:plain" as NodeId;
    applyCatalogTransaction(local, {
      projectId: local.projectId,
      expectedRevision: local.revision,
      history: { kind: "record", label: "plain button" },
      ops: [
        {
          kind: "put",
          entry: node("plain", "lib:definition:origin-component-button" as never),
        },
        {
          kind: "put",
          entry: (() => {
            const page = local.getEntry(PAGE);
            if (page?.kind !== "page") throw new Error("page");
            return { ...page, children: [...page.children, plain] };
          })(),
        },
      ],
    });
    expect(iconOf(plain).value).toBeUndefined();
  });
});

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
import { readPropSource } from "../fieldSource";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../positions";
import { resolveCatalogNode, type ResolvedCatalogNode } from "../resolver";
import {
  CATALOG_DENSITY_PROPAGATION_OWNER,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_TABLE_OVERFLOW_OWNERS,
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
    node.children.forEach((child) => walk(child, composite ? owner : name));
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
            (key === "overflowMode" && CATALOG_TABLE_OVERFLOW_OWNERS[typeName]))
        )
          continue;
        const reading = readPropSource(graph, target, key);
        if (reading.layers.some((layer) => isBinding(layer.value))) continue;
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
          node("icon", "lib:definition:origin-component-iconbutton" as never, {
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
            templatePath: ["lib:template:component-iconbutton" as TemplateId],
          },
        },
        "variant",
      ),
    ).toMatchObject({ value: "secondary", source: "instance" });
  });
});

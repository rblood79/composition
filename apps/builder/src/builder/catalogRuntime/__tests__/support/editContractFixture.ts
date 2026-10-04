import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { readPropSource } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type {
  NodeEntry,
  EntryId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../../project";
import { catalogEditContract } from "../../editContract";
import { catalogPaletteDefinitionId } from "../../paletteInsert";

const library = await buildCodeCatalogLibrary();
export function editContractFixture(
  type: string,
  props: Record<string, unknown> = {},
  primitive = false,
) {
  const doc = newCatalogProjectDocument({
    projectId: "project:project:edit-test" as EntryId<"project">,
    name: "Contract",
  });
  const body = doc.entries["project:node:home-body"] as NodeEntry;
  const node: NodeEntry = {
    kind: "node",
    id: "project:node:selected",
    definitionId: primitive
      ? catalogTypeDefinitionId(type)
      : catalogPaletteDefinitionId(library, type),
    children: [],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ) as NodeEntry["props"],
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const graph = new CatalogGraph(
    {
      ...doc,
      entries: {
        ...doc.entries,
        [body.id]: { ...body, children: [node.id] },
        [node.id]: node,
      },
    },
    library,
  );
  return catalogEditContract(
    graph,
    { propSource: (target, key) => readPropSource(graph, target, key) },
    { kind: "node", id: node.id },
  );
}

export function resolveTestEditContract(
  node: {
    type: string;
    props?: Record<string, unknown>;
    [key: string]: unknown;
  },
  _document?: null,
) {
  return editContractFixture(node.type, node.props, true);
}

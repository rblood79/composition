import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import {
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
} from "../../../../packages/shared/src/catalog/document/types";
export async function publicationFixture() {
  const library = await buildCodeCatalogLibrary();
  const document = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: LIBRARY_CONTRACT_VERSION,
    revision: 0,
    projectId: "project:project:publish",
    rootId: "project:project:publish",
    entries: {
      "project:project:publish": {
        kind: "project",
        id: "project:project:publish",
        name: "Publish",
        pageIds: ["project:page:home"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:home": {
        kind: "page",
        id: "project:page:home",
        route: "/",
        name: "Home",
        children: ["project:node:body"],
      },
      "project:node:body": {
        kind: "node",
        id: "project:node:body",
        definitionId: "lib:definition:type-body",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    },
  } as CatalogDocument;
  return { library, graph: new CatalogGraph(document, library) };
}

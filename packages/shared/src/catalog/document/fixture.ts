import { buildCatalogLibrary } from "./library";
import type { CatalogDocument, NodeEntry } from "./types";

/** Semantic G1 driver for the frozen old-app ref, patch and slot scenarios. */
export function createG1Fixture() {
  const library = buildCatalogLibrary({
    contractVersion: 1,
    revision: "g1-fixture-v1",
    bindingIds: ["box", "text", "slot"],
    actionOpCodes: [
      "setState",
      "navigate",
      "callEndpoint",
      "toast",
      "capability",
    ],
    triggerIds: ["press", "change", "focus", "blur"],
    capabilityIds: ["selectItem", "setValue", "clearSelection"],
    definitions: [
      {
        id: "lib:definition:box",
        name: "Box",
        mode: "native",
        bindingId: "box",
        accepts: {},
        defaults: {},
        visual: { backgroundColor: "white" },
        stateRules: {},
      },
      {
        id: "lib:definition:text",
        name: "Text",
        mode: "primitive",
        bindingId: "text",
        accepts: { children: "string" },
        defaults: { children: "default" },
        visual: { color: { kind: "token", tokenId: "lib:token:ink" } },
        stateRules: { hover: { color: { kind: "set", value: "blue" } } },
      },
      {
        id: "lib:definition:slot",
        name: "Slot",
        mode: "native",
        bindingId: "slot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:badge",
        name: "Badge",
        mode: "composite",
        templateRootId: "lib:template:badgeRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:card",
        name: "Card",
        mode: "composite",
        templateRootId: "lib:template:cardRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      {
        id: "lib:template:badgeRoot",
        definitionId: "lib:definition:box",
        children: ["lib:template:badgeText"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:badgeText",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "badge" },
        visual: {},
      },
      {
        id: "lib:template:cardRoot",
        definitionId: "lib:definition:box",
        children: [
          "lib:template:cardText",
          "lib:template:badgeInstance",
          "lib:template:cardSlot",
        ],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:cardText",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "title" },
        visual: {},
      },
      {
        id: "lib:template:badgeInstance",
        definitionId: "lib:definition:badge",
        children: [],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:cardSlot",
        definitionId: "lib:definition:slot",
        children: [],
        props: {},
        visual: {},
        slot: { name: "content", required: false },
      },
    ],
    tokens: [
      {
        id: "lib:token:ink",
        tokenType: "color",
        value: "black",
        source: "spec-token",
      },
    ],
  });
  const node = (
    id: NodeEntry["id"],
    definitionId: NodeEntry["definitionId"],
  ): NodeEntry => ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const first = node("project:node:cardA", "lib:definition:card");
  const second = node("project:node:cardB", "lib:definition:card");
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 1,
    projectId: "project:project:g1",
    rootId: "project:project:g1",
    revision: 0,
    entries: {
      "project:project:g1": {
        kind: "project",
        id: "project:project:g1",
        name: "G1",
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
        name: "Main",
        route: "/",
        children: [first.id, second.id],
      },
      [first.id]: first,
      [second.id]: second,
    },
  };
  return { library, document };
}

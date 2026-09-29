import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-248 Phase 3 typed catalog scenes for the Frame/Rectangle/Text/regions/ref consumer check.
 * Authored directly as typed entries (no external-format import): the same structures the
 * frozen G0 samples describe — a filled rectangle with text, a clipped frame with named regions
 * and placeholder, and a composite definition with a region template plus an instance.
 */
export interface TypedSceneFixture {
  name: "typed-minimal" | "typed-slots" | "typed-ref";
  document: CatalogDocument;
}

const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

function document(
  name: TypedSceneFixture["name"],
  roots: readonly NodeEntry[],
  nested: readonly NodeEntry[],
  definitions: readonly Extract<CatalogEntry, { kind: "definition" }>[] = [],
): TypedSceneFixture {
  const projectId = `project:project:${name.replace(/-/g, "")}` as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name,
      pageIds: [pageId],
      definitionIds: definitions.map((item) => item.id),
      overrideIds: [],
      themeIds: [],
      tokenIds: [],
      stateVariableIds: [],
      interactionIds: [],
      assetIds: [],
    },
    [pageId]: {
      kind: "page",
      id: pageId,
      name: "Main",
      route: "/",
      children: roots.map((item) => item.id),
    },
  };
  for (const entry of [...roots, ...nested, ...definitions])
    entries[entry.id] = entry;
  return {
    name,
    document: {
      format: "composition-catalog",
      schemaVersion: 1,
      libraryContractVersion: 1,
      revision: 0,
      projectId,
      rootId: projectId,
      entries,
    },
  };
}

export function createTypedSceneFixtures(): readonly TypedSceneFixture[] {
  const title = node("title", "lib:definition:text", {
    props: { children: { kind: "set", value: "Hello" } },
  });
  const minimal = document(
    "typed-minimal",
    [
      node("hero", "lib:definition:rectangle", {
        name: "Hero",
        children: [title.id],
        visual: { fill: { kind: "set", value: "#ffffff" } },
      }),
    ],
    [title],
  );
  const cardTitle = node("title", "lib:definition:text", {
    props: { children: { kind: "set", value: "Untitled" } },
  });
  const slots = document(
    "typed-slots",
    [
      node("card", "lib:definition:frame", {
        name: "Card",
        children: [cardTitle.id],
        visual: { overflow: { kind: "set", value: "hidden" } },
        regions: [
          { name: "title", required: false },
          { name: "actions", required: false },
        ],
        placeholder: true,
      }),
    ],
    [cardTitle],
  );
  const template = node("buttonTemplate", "lib:definition:frame", {
    regions: [{ name: "label", required: false }],
  });
  const ref = document(
    "typed-ref",
    [
      // The page-level source keeps its authored regions, as the frozen G0 sample does.
      node("button", "project:definition:button", {
        regions: [{ name: "label", required: false }],
      }),
      node("buttonInstance", "project:definition:button"),
    ],
    [template],
    [
      {
        kind: "definition",
        id: "project:definition:button",
        name: "button",
        mode: "composite",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
        templateRootId: template.id,
      },
    ],
  );
  return [minimal, slots, ref];
}

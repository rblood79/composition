// @vitest-environment jsdom
/**
 * S2 체크리스트 §9.1 (2026-11-24) — container density: S2 Accordion `density` · `isQuiet` reach its
 * Disclosures as S2's `DisclosureContext` does (`CATALOG_OWNER_CONTEXT_PROPS`: unset leaves each its own,
 * a Disclosure's own value wins, an Accordion edit resolves them again); S2 CardView `density` × size is
 * the space between its cards (`layoutOptions.minSpace` — the rule's `containerVariants`).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { catalogContainerVariantPaint } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

async function open(definitionId: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-color-swatch" as const,
        name: "S2 color swatch",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-color-swatch-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: "project:node:root" as NodeId,
          definitionId: definitionId as NodeEntry["definitionId"],
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:root" as NodeId],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const swatches = [...root.canvasInputs.values()].filter(
    (r) => root.typeOf(r) === "ColorSwatch",
  );
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  // The painted corner: the rule's prop-conditional block (`containerVariants.rounding` — the Canvas paint
  // and the DOM `[data-rounding]` sheet) over the record's size corner.
  const corner = (record: (typeof swatches)[number]) =>
    (catalogContainerVariantPaint(
      COMPONENT_RULES_TABLE.ColorSwatch!,
      record.props,
    ).borderRadius as number | undefined) ??
    record.visual.radius ??
    0;
  return { root, swatches, box, corner, workspace };
}

describe("S2 Accordion density · isQuiet → its Disclosures", () => {
  it("unset: each Disclosure its own; set: theirs; a Disclosure's own wins", async () => {
    const { workspace } = await open(
      "lib:definition:origin-component-accordion",
      {},
    );
    const root = () => workspace.root;
    const disclosures = () =>
      [...root().canvasInputs.values()].filter(
        (r) => root().typeOf(r) === "Disclosure",
      );
    expect(disclosures().length).toBeGreaterThan(1);
    expect(disclosures().map((d) => d.props.density)).toEqual(
      disclosures().map(() => "regular"),
    );
    const accordion = [...root().canvasInputs.values()].find(
      (r) => root().typeOf(r) === "Accordion",
    )!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(accordion.id)!.target],
        props: {
          density: { kind: "set", value: "compact" },
          isQuiet: { kind: "set", value: true },
        },
      }),
    );
    expect(
      disclosures().map((d) => [d.props.density, d.props.isQuiet]),
    ).toEqual(disclosures().map(() => ["compact", true]));
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(disclosures()[0]!.id)!.target],
        props: { density: { kind: "set", value: "spacious" } },
      }),
    );
    expect(disclosures().map((d) => d.props.density)).toEqual(
      disclosures().map((_, index) => (index === 0 ? "spacious" : "compact")),
    );
  });
});

describe("S2 CardView density × size → the space between its cards", () => {
  it.each([
    ["M", undefined, 16],
    ["M", "compact", 12],
    ["M", "spacious", 20],
    ["S", "regular", 12],
    ["XL", "spacious", 28],
  ])("%s %s: %dpx", async (size, density, gap) => {
    const { workspace } = await open(
      "lib:definition:origin-component-cardview",
      {
        size,
        ...(density ? { density } : {}),
      },
    );
    const root = workspace.root;
    const cards = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Card",
    );
    const box = (id: string) => root.getGeometry([id]).get(id)!;
    const [a, b] = [box(cards[0]!.id), box(cards[1]!.id)];
    expect(b.x - (a.x + a.width)).toBe(gap);
  });
});

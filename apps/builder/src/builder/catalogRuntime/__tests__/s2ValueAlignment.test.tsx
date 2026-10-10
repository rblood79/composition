// @vitest-environment jsdom
/**
 * S2 값 정렬 (2026-10-10 — 조사 §4.2 C): Meter 계열 warning/critical → notice/negative,
 * InlineAlert info → informative, Tooltip 집합 neutral · informative · negative (design-data —
 * positive 삭제), CardView variant primary · secondary · tertiary · quiet (기본 primary —
 * 안의 Card 들이 입는다, S2 `ctx = {size, variant}`). 옛 문서는 로드 시 1회 전환.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:value-align" as const,
        name: "Value align",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `value-align-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
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
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return { library, root: workspace.root, workspace };
}

describe("S2 값 정렬 — Meter · InlineAlert · Tooltip · CardView", () => {
  it("the rules carry the S2 value sets", () => {
    for (const part of ["Meter", "MeterFill", "MeterTrack", "MeterValue"])
      expect(
        Object.keys(COMPONENT_RULES_TABLE[part].variants).sort(),
        part,
      ).toEqual(["informative", "negative", "notice", "positive"]);
    expect(COMPONENT_RULES_TABLE.InlineAlert.defaultVariant).toBe(
      "informative",
    );
    expect(
      Object.keys(COMPONENT_RULES_TABLE.InlineAlert.variants).sort(),
    ).toEqual(["informative", "negative", "neutral", "notice", "positive"]);
    expect(Object.keys(COMPONENT_RULES_TABLE.Tooltip.variants).sort()).toEqual([
      "informative",
      "negative",
      "neutral",
    ]);
    expect(COMPONENT_RULES_TABLE.CardView.defaultVariant).toBe("primary");
    expect(Object.keys(COMPONENT_RULES_TABLE.CardView.variants).sort()).toEqual(
      ["primary", "quiet", "secondary", "tertiary"],
    );
  });

  it("a CardView's variant reaches the Cards in it; an authored Card keeps its own", async () => {
    const { root } = await open("CardView", { variant: "quiet" });
    const cards = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Card",
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.props.variant).toBe("quiet");
    const plain = await open("CardView", {});
    for (const card of [...plain.root.canvasInputs.values()].filter(
      (r) => plain.root.typeOf(r) === "Card",
    ))
      expect(card.props.variant).toBe("primary");
  });

  it("load migration: the value renames land once", async () => {
    const library = await buildCodeCatalogLibrary();
    const entry = (id: string, type: string, variant: string) =>
      ({
        kind: "node",
        id: id as NodeId,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: { variant: { kind: "set", value: variant } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const entries: Record<string, CatalogEntry> = {
      a: entry("a", "Meter", "warning"),
      b: entry("b", "Meter", "critical"),
      c: entry("c", "Meter", "positive"),
      d: entry("d", "InlineAlert", "info"),
      e: entry("e", "Tooltip", "info"),
      f: entry("f", "Tooltip", "positive"),
      g: entry("g", "CardView", "default"),
    };
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    const variantOf = (id: string) =>
      (entries[id] as NodeEntry).props.variant as
        { kind: string; value?: unknown } | undefined;
    expect(variantOf("a")).toEqual({ kind: "set", value: "notice" });
    expect(variantOf("b")).toEqual({ kind: "set", value: "negative" });
    expect(variantOf("c")).toEqual({ kind: "set", value: "positive" });
    expect(variantOf("d")).toEqual({ kind: "set", value: "informative" });
    expect(variantOf("e")).toEqual({ kind: "set", value: "informative" });
    expect(variantOf("f")).toBeUndefined();
    expect(variantOf("g")).toBeUndefined();
  });

  it("a migrated Meter paints the renamed variant (the record carries notice)", async () => {
    const { root } = await open("Meter", { variant: "notice" });
    const meter = [...root.domInputs.values()].find(
      (item) => item.sourceId === OWNER,
    )!;
    expect(meter.props.variant).toBe("notice");
    const fill = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "MeterFill",
    ) as unknown as {
      props: Record<string, unknown>;
      derivedProps?: Record<string, unknown>;
    };
    // (The fill wears the Meter's variant as a derived value — presence `derivedProps`.)
    expect(fill.derivedProps?.variant ?? fill.props.variant).toBe("notice");
  });
});

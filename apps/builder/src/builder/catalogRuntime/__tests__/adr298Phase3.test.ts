import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogFillLayer,
  EntryId,
  TokenUse,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogFillTokenRef } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogAuthoredDomStyle } from "../../../../../../packages/shared/src/catalog/runtime/authoredStyle";
import { catalogDomStyle } from "../../../../../../packages/shared/src/catalog/runtime/domBinding.runtime";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import {
  panelFillColor,
  panelFillItems,
  panelFillLayers,
} from "../panelTokens";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { THEME_PALETTE_GROUPS } from "../../panels/styles/components/ColorPickerPalettes.runtime";
import { tokenToCSSVar } from "@composition/rendering";

/**
 * ADR-298 Phase 3 — fill colors and the inset · gap longhands take a theme token (사용자 결정 2). Oracle
 * for a color: the theme map (`resolveToken(ref, mode)`), not the resolver; for a length: the spacing
 * scale read the same way.
 */
const useOf = (tokenId: string) =>
  ({ kind: "token" as const, tokenId }) as TokenUse;
const hex8 = (ref: string, mode: "light" | "dark") =>
  `${String(resolveToken(ref as TokenRef, mode))}ff`.toLowerCase();
const px = (ref: string) => Number(resolveToken(ref as TokenRef, "light"));

async function workspaceWith(mode: "light" | "dark" = "light") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr298p3" as EntryId<"project">,
        name: "ADR-298 P3",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr298-phase3-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: () => ({ key: mode, colorMode: mode, install: () => {} }),
    } as unknown as ConstructorParameters<typeof CatalogWorkspace>[2],
  );
  const node = {
    kind: "node",
    id: "project:node:n" as NodeId,
    definitionId: "lib:definition:type-frame",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [node],
      rootIds: [node.id],
      newId: workspace.newId,
    }),
  );
  const target = { kind: "node" as const, id: node.id };
  const fills = (value: CatalogFillLayer[]) =>
    workspace.execute(
      setWholeField({ targets: [target], field: "fills", value }),
    );
  const layout = (writes: Record<string, unknown>) =>
    workspace.execute(
      setFields({ targets: [target], layout: writes } as Parameters<
        typeof setFields
      >[0]),
    );
  const record = () =>
    workspace.root.domInputs.get(workspace.root.recordsOfSource(node.id)[0]!)!;
  const own = () => workspace.runtime.graph.getEntry(node.id) as NodeEntry;
  return { workspace, fills, layout, record, own };
}

const base = { enabled: true, opacity: 1, blendMode: "normal" as const };

describe("ADR-298 Phase 3 — fill color tokens (schema · resolver · DOM)", () => {
  it("a color layer stores the token; the record holds its hex in the root's mode, the DOM its variable", async () => {
    for (const mode of ["light", "dark"] as const) {
      const { fills, record, own } = await workspaceWith(mode);
      fills([
        {
          ...base,
          id: "f1",
          kind: "color",
          color: useOf("lib:token:color_accent"),
        },
      ]);
      expect((own().fills![0] as { color: unknown }).color).toEqual(
        useOf("lib:token:color_accent"),
      );
      const layer = record().fills![0]!;
      expect(layer).toMatchObject({
        kind: "color",
        color: hex8("{color.accent}", mode),
      });
      expect(catalogFillTokenRef(layer)).toBe("{color.accent}");
      expect(catalogAuthoredDomStyle(record()).backgroundColor).toBe(
        "var(--accent)",
      );
    }
  });

  it("a layer opacity mixes the variable with transparent (the alpha the Canvas applies)", async () => {
    const { fills, record } = await workspaceWith();
    fills([
      {
        ...base,
        opacity: 0.5,
        id: "f1",
        kind: "color",
        color: useOf("lib:token:color_accent"),
      },
    ]);
    expect(catalogAuthoredDomStyle(record()).backgroundColor).toBe(
      "color-mix(in srgb, var(--accent) 50%, transparent)",
    );
  });

  it("a gradient stop takes a token beside a literal stop", async () => {
    const { fills, record } = await workspaceWith("dark");
    fills([
      {
        ...base,
        id: "g1",
        kind: "linear-gradient",
        rotation: 90,
        stops: [
          { color: useOf("lib:token:color_positive"), position: 0 },
          { color: "#000000ff", position: 1 },
        ],
      },
    ]);
    const layer = record().fills![0] as Extract<
      CatalogFillLayer<string>,
      { kind: "linear-gradient" }
    >;
    expect(layer.stops[0]!.color).toBe(hex8("{color.positive}", "dark"));
    expect(layer.stops[1]!.color).toBe("#000000ff");
    expect(String(catalogAuthoredDomStyle(record()).backgroundImage)).toContain(
      "var(--positive) 0%",
    );
  });

  it("a non-color token on a fill color is refused", async () => {
    const { fills } = await workspaceWith();
    expect(() =>
      fills([
        {
          ...base,
          id: "f1",
          kind: "color",
          color: useOf("lib:token:spacing_md"),
        },
      ]),
    ).toThrow(expect.objectContaining({ code: "TOKEN_TYPE_MISMATCH" }));
  });

  it("a literal → the same color's token reaches the DOM listener (source compared — F12)", async () => {
    const { fills, workspace, layout } = await workspaceWith();
    fills([{ ...base, id: "f1", kind: "color", color: hex8("{color.accent}", "light") }]);
    layout({ position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "16px" } });
    const id = workspace.root.recordsOfSource("project:node:n")[0]!;
    const heard: Parameters<typeof catalogAuthoredDomStyle>[0][] = [];
    const stop = workspace.root.subscribeDom(id, (node) => heard.push(node!));
    fills([{ ...base, id: "f1", kind: "color", color: useOf("lib:token:color_accent") }]);
    layout({ insetLeft: { kind: "set", value: useOf("lib:token:spacing_lg") } });
    stop();
    expect(heard.length).toBe(2);
    expect(catalogAuthoredDomStyle(heard[0]!).backgroundColor).toBe("var(--accent)");
    expect((catalogDomStyle(heard[1]! as never) as Record<string, unknown>).left).toBe(
      "var(--spacing-lg)",
    );
  });
});

describe("ADR-298 Phase 3 — inset · gap longhand tokens", () => {
  it("an inset token: the engine reads its px, the DOM writes its variable", async () => {
    const { layout, record } = await workspaceWith();
    layout({
      position: { kind: "set", value: "absolute" },
      insetLeft: { kind: "set", value: useOf("lib:token:spacing_lg") },
      insetTop: { kind: "set", value: useOf("lib:token:spacing_sm") },
    });
    expect(record().layout).toMatchObject({
      insetLeft: `${px("{spacing.lg}")}px`,
      insetTop: `${px("{spacing.sm}")}px`,
    });
    const style = catalogDomStyle(record()) as Record<string, unknown>;
    expect(style.left).toBe("var(--spacing-lg)");
    expect(style.top).toBe("var(--spacing-sm)");
  });

  it("a gap longhand token (grid Gap X / Y)", async () => {
    const { layout, record } = await workspaceWith();
    layout({
      display: { kind: "set", value: "grid" },
      columnGap: { kind: "set", value: useOf("lib:token:spacing_xl") },
    });
    expect(record().layout.columnGap).toBe(`${px("{spacing.xl}")}px`);
    expect(
      (catalogDomStyle(record()) as Record<string, unknown>).columnGap,
    ).toBe("var(--spacing-xl)");
  });

  it("a token on a layout field outside the token fields is refused", async () => {
    const { layout } = await workspaceWith();
    expect(() =>
      layout({
        flexBasis: { kind: "set", value: useOf("lib:token:spacing_md") },
      }),
    ).toThrow();
    expect(() =>
      layout({
        insetLeft: { kind: "set", value: useOf("lib:token:color_accent") },
      }),
    ).toThrow(expect.objectContaining({ code: "TOKEN_TYPE_MISMATCH" }));
  });
});

describe("ADR-298 Phase 3 — the panel's fill text (var ↔ TokenUse)", () => {
  it("a color variable writes the token and reads back as the variable; a hex stays", () => {
    expect(panelFillColor("var(--accent)")).toEqual(
      useOf("lib:token:color_accent"),
    );
    expect(panelFillColor("#112233ff")).toBe("#112233ff");
    expect(panelFillColor("var(--spacing-md)")).toBe("var(--spacing-md)");
    const layers = panelFillLayers([
      {
        type: "color",
        id: "a",
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        color: "var(--accent)",
      },
    ] as never);
    expect((layers[0] as { color: unknown }).color).toEqual(
      useOf("lib:token:color_accent"),
    );
    expect((panelFillItems(layers)![0] as { color: string }).color).toBe(
      "var(--accent)",
    );
  });

  it("every Theme palette swatch's variable writes its token (`{color.base}` = `var(--bg)`)", () => {
    for (const name of THEME_PALETTE_GROUPS.flatMap((group) => group.tokens)) {
      const css = tokenToCSSVar(`{color.${name}}` as TokenRef);
      expect(panelFillColor(css), name).toEqual(useOf(`lib:token:color_${name}`));
    }
  });
});

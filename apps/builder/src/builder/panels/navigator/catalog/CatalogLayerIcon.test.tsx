import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogLayerNode } from "../../../catalogRuntime/layerTree";
import { getPaletteItems } from "../../components/paletteItems";
import {
  Columns2,
  Rows2,
  SeparatorHorizontal,
  SeparatorVertical,
} from "lucide-react";
import {
  CatalogLayerIcon,
  layerComponentIcon,
  layerOrientedGlyph,
  layerResizableGroupIcon,
  layerSeparatorIcon,
} from "./CatalogLayerIcon";

const row = (typeName: string, extra: Partial<CatalogLayerNode> = {}) =>
  ({ typeName, body: false, ...extra }) as CatalogLayerNode;

describe("Layers component and structural icons", () => {
  it("uses the exact palette icon for every palette entry", () => {
    for (const item of getPaletteItems()) {
      expect(layerComponentIcon(row(item.type))).toBe(item.icon);
    }
  });

  it("never uses palette artwork for a plain node inside a component", () => {
    for (const item of getPaletteItems()) {
      expect(
        layerComponentIcon(row(item.type, { insideComponent: true })),
      ).toBeUndefined();
    }
  });

  it("keeps a nested component's palette icon and treats body/data rows as structure", () => {
    const card = getPaletteItems().find((item) => item.type === "Card")!;
    expect(
      layerComponentIcon(
        row("Card", { insideComponent: true, role: "instance" }),
      ),
    ).toBe(card.icon);
    expect(layerComponentIcon(row("Frame", { body: true }))).toBeUndefined();
  });

  it("a Resizable Group shows its orientation — columns side by side, rows stacked", () => {
    expect(layerComponentIcon(row("ResizablePanelGroup"))).toBe(Columns2);
    expect(layerResizableGroupIcon(undefined)).toBe(Columns2);
    expect(layerResizableGroupIcon("horizontal")).toBe(Columns2);
    expect(layerResizableGroupIcon("vertical")).toBe(Rows2);
  });

  it("line and part glyphs follow the axis the Canvas draws (Separator · Resizable Handle · Panel)", () => {
    expect(layerOrientedGlyph("Separator", undefined)).toBe("line");
    expect(layerOrientedGlyph("Separator", "vertical")).toBe("line-vertical");
    // A horizontal Group's Handle is a vertical line between side-by-side Panels.
    expect(layerOrientedGlyph("ResizableHandle", "horizontal")).toBe(
      "line-vertical",
    );
    expect(layerOrientedGlyph("ResizableHandle", "vertical")).toBe("line");
    expect(layerOrientedGlyph("ResizablePanel", undefined)).toBe(
      "panel-column",
    );
    expect(layerOrientedGlyph("ResizablePanel", "vertical")).toBe("panel-row");
    expect(layerSeparatorIcon("horizontal")).toBe(SeparatorHorizontal);
    expect(layerSeparatorIcon("vertical")).toBe(SeparatorVertical);
  });

  it.each([
    ["Body", "frame"],
    ["Content", "group"],
    ["Label", "text"],
    ["Text", "text"],
    ["Input", "keyboard"],
    ["Icon", "vector"],
    ["Image", "image"],
    ["Button", "shape"],
  ])("renders %s as a simple %s glyph", (typeName, glyph) => {
    const markup = renderToStaticMarkup(
      <CatalogLayerIcon node={row(typeName, { insideComponent: true })} />,
    );
    expect(markup).toContain(`data-layer-icon="${glyph}"`);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup.includes("lucide")).toBe(glyph === "keyboard");
  });
});

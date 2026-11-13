import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogLayerNode } from "../../../catalogRuntime/layerTree";
import { getPaletteItems } from "../../components/paletteItems";
import { CatalogLayerIcon, layerComponentIcon } from "./CatalogLayerIcon";

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
    expect(
      layerComponentIcon(row("Text", { projection: true })),
    ).toBeUndefined();
  });

  it.each([
    ["Body", "frame"],
    ["Content", "group"],
    ["Label", "text"],
    ["Text", "text"],
    ["Input", "input"],
    ["Icon", "vector"],
    ["Image", "image"],
    ["Separator", "line"],
    ["Button", "shape"],
  ])("renders %s as a simple %s glyph", (typeName, glyph) => {
    const markup = renderToStaticMarkup(
      <CatalogLayerIcon node={row(typeName, { insideComponent: true })} />,
    );
    expect(markup).toContain(`data-layer-icon="${glyph}"`);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("lucide");
  });
});

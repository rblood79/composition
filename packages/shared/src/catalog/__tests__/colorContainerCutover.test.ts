import { describe, expect, it } from "vitest";

import { isCatalogCutover, isCatalogSkiaCutover } from "../cutover";
import { getCatalogEntry } from "../componentCatalog";
import { getPrimitiveBinding } from "../bindings";

const COLOR_CONTAINERS = ["ColorPicker", "ColorSwatchPicker"] as const;

describe("ADR-912 — Color container catalog cutover", () => {
  for (const type of COLOR_CONTAINERS) {
    it(`${type} is registered as a catalog primitive`, () => {
      const entry = getCatalogEntry(type);

      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("date-color");
    });

    it(`${type} exposes a primitive binding`, () => {
      const binding = getPrimitiveBinding(type);

      expect(binding, `${type} binding`).toBeDefined();
      expect(binding?.source.kind).toBe("internal");
    });

    it(`${type} passes DOM and Skia catalog cutover gates`, () => {
      expect(isCatalogCutover(type)).toBe(true);
      expect(isCatalogSkiaCutover(type)).toBe(true);
    });
  }
});

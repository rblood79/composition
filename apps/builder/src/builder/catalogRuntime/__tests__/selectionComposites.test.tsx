import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, fireEvent } from "@testing-library/react";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  catalogSelectionCountFits,
  catalogSelectionCountText,
} from "../../../../../../packages/shared/src/catalog/document/selectionCountValue";
import { CatalogActionBar } from "../../../../../../packages/shared/src/catalog/runtime/selectionComposites.components";
import { Button } from "react-aria-components";

describe("selection composites", () => {
  it("registers authored editable origins", async () => {
    const library = await buildCodeCatalogLibrary();
    for (const type of ["ActionBar", "SelectBox", "SelectBoxGroup"]) {
      const definition = [...library.definitions.values()].find(
        (d) => d.name === type && d.mode === "composite",
      );
      expect(definition?.templateRootId).toBeDefined();
      const root = [...library.templates.values()].find(
        (node) => node.id === definition!.templateRootId,
      );
      expect(root!.children.length).toBeGreaterThan(0);
    }
  });
  it("preserves the all sentinel and rejects numeric strings", () => {
    expect(catalogSelectionCountFits("all")).toBe(true);
    expect(catalogSelectionCountFits(3)).toBe(true);
    for (const invalid of ["3", -1, 0.5, NaN, null])
      expect(catalogSelectionCountFits(invalid)).toBe(false);
    expect(catalogSelectionCountText("all", "en-US")).toBe("All selected");
  });
  it("clear is the authored RAC Button slot and Escape uses the same callback", () => {
    let count = 0;
    const view = render(
      createElement(
        CatalogActionBar,
        { clear: () => count++ },
        createElement(Button, { slot: "clear" }, "Clear"),
      ),
    );
    fireEvent.click(view.getByRole("button", { name: "Clear selection" }));
    expect(count).toBe(1);
    fireEvent.keyDown(view.getByRole("button"), { key: "Escape" });
    expect(count).toBe(2);
  });
});

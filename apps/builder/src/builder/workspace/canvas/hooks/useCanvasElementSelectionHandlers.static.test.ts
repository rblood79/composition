import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanvasElementSelectionHandlers frame selection contract", () => {
  it("syncs selected reusable frame when clicking a layout-owned canvas element", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanvasElementSelectionHandlers.ts"),
      "utf-8",
    );

    expect(source).toContain("function syncReusableFrameSelectionForElement(");
    expect(source).toContain("getFrameElementMirrorId(element);");
    expect(source).toContain("selectReusableFrame(layoutId);");
    expect(source).toContain(
      "useEditModeStore.getState().setCurrentLayoutId(layoutId);",
    );
    expect(source).toContain(
      "syncReusableFrameSelectionForElement(clickedElement);",
    );
  });

  it("selects the hit child immediately after entering a container context", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanvasElementSelectionHandlers.ts"),
      "utf-8",
    );

    expect(source).toContain("resolveContextEntryTarget(");
    expect(source).toContain("state.setEditingContext(resolvedTarget);");
    expect(source).toContain("selectResolvedTarget(");
    expect(source).toContain("setSelectedElement(null);");
  });
});

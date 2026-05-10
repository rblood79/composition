import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useScrollWheelInteraction canonical map contract", () => {
  it("reads scroll hit-test elements from the active renderer input provider", async () => {
    const source = await readFile(
      resolve(__dirname, "useScrollWheelInteraction.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "getScrollElementsMap: () => ReadonlyMap<string, CanvasInteractionNode>;",
    );
    expect(source).toContain("const elementsMap = getScrollElementsMap();");

    const staleGetStateRead = ["useStore", "getState()", "elementsMap"].join(
      ".",
    );
    const staleStateRead = ["state", "elementsMap"].join(".");

    expect(source).not.toContain(staleGetStateRead);
    expect(source).not.toContain(staleStateRead);
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("elementUpdate canonical atomicity contract", () => {
  it("syncs canonical from latest element inside the atomic store callback", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    const actionIndex = source.indexOf(
      "export const createUpdateElementAction",
    );
    const callbackIndex = source.indexOf("set((state) => {", actionIndex);
    const latestElementIndex = source.indexOf(
      "const latestUpdatedElement = { ...latestElement, ...sanitizedUpdates };",
      callbackIndex,
    );
    const syncIndex = source.indexOf(
      "syncUpdatedElementToCanonical(latestUpdatedElement, sanitizedUpdates);",
      latestElementIndex,
    );

    expect(actionIndex).toBeGreaterThanOrEqual(0);
    expect(callbackIndex).toBeGreaterThan(actionIndex);
    expect(latestElementIndex).toBeGreaterThan(callbackIndex);
    expect(syncIndex).toBeGreaterThan(latestElementIndex);
    expect(source.slice(actionIndex, callbackIndex)).not.toContain(
      "syncUpdatedElementToCanonical(updatedElement, sanitizedUpdates);",
    );
  });
});

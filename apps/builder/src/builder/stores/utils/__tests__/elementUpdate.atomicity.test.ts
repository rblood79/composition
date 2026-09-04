import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("elementUpdate canonical atomicity contract", () => {
  it("re-reads after the async gate and commits canonical before the derived store", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    const actionIndex = source.indexOf(
      "export const createUpdateElementAction",
    );
    const gateIndex = source.indexOf(
      "if (originGate !== true && !(await originGate)) return;",
      actionIndex,
    );
    const latestStateIndex = source.indexOf("const state = get();", gateIndex);
    const latestCanonicalIndex = source.indexOf(
      "const canonicalNode = getFirstProjectableNodeById(elementId);",
      latestStateIndex,
    );
    const derivedIndex = source.indexOf(
      "const derivedUpdate = createDerivedElementUpdate(",
      latestCanonicalIndex,
    );
    const syncIndex = source.indexOf(
      "updateCanonicalNodeFromElementPrimary(derivedUpdate.element);",
      derivedIndex,
    );
    const storeIndex = source.indexOf(
      "elements: derivedUpdate.elements,",
      syncIndex,
    );

    expect(actionIndex).toBeGreaterThanOrEqual(0);
    expect(gateIndex).toBeGreaterThan(actionIndex);
    expect(latestStateIndex).toBeGreaterThan(gateIndex);
    expect(latestCanonicalIndex).toBeGreaterThan(latestStateIndex);
    expect(derivedIndex).toBeGreaterThan(latestCanonicalIndex);
    expect(syncIndex).toBeGreaterThan(derivedIndex);
    expect(storeIndex).toBeGreaterThan(syncIndex);
  });
});

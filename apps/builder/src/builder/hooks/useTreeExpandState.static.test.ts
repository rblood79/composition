import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useTreeExpandState canonical input contract", () => {
  it("derives parent lookup from caller-provided tree elements instead of store maps", async () => {
    const source = await readFile(
      resolve(__dirname, "useTreeExpandState.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "new Map(elements.map((element) => [element.id, element]))",
    );
    expect(source).not.toContain('from "../stores"');

    const staleStoreRead = ["state", "elementsMap"].join(".");
    expect(source).not.toContain(staleStoreRead);
  });
});

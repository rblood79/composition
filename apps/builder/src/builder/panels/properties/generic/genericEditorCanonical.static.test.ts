import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("generic property editors canonical read contract", () => {
  it("uses canonical property element for generic items arrays", async () => {
    // ADR-248 Phase 4e-4: the items manager reads through its items source; the default (old
    //   canonical) source lives in `itemsSource.ts`.
    const source = await readFile(
      resolve(__dirname, "itemsSource.store.ts"),
      "utf-8",
    );

    // ADR-228 (2026-09-21): ref instance 는 origin ⊕ override 의 유효 items 를 보여야 한다 —
    //   canonical 읽기는 유지하되 resolved 변형 hook 을 쓴다.
    expect(source).toContain("useCanonicalPropertyResolvedElement(elementId)");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });
});

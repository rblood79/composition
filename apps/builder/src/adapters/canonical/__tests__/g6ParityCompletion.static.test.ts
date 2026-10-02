import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-116 G6-3 Slot/Ref/Descendants/Frame parity completion contract", () => {
  it("keeps native mutation, resolver, navigation, and frame binding wiring", async () => {
    // (The component section · page frame binding · layout selector · layouts tab legs retired
    // with the old app — ADR-248 4e.)
    const [mutationsSource, resolverSource, frameMirrorSource] =
      await Promise.all([
        readFile(resolve(__dirname, "../canonicalMutations.ts"), "utf-8"),
        readFile(
          resolve(__dirname, "../../../resolvers/canonical/index.ts"),
          "utf-8",
        ),
        readFile(resolve(__dirname, "../frameMirror.ts"), "utf-8"),
      ]);

    expect(mutationsSource).toContain("findSlotPathForPageRef");
    expect(mutationsSource).toContain("descendants[slotPath]");
    expect(mutationsSource).toContain("appendChildToDescendants");
    expect(mutationsSource).toContain("removeNodeFromDescendants");
    expect(resolverSource).toContain("type: master.type");
    // ADR-234: master 가 변형 (ref) 이면 체인을 먼저 열지만 `_resolvedFrom` 은 직접 master id.
    expect(resolverSource).toContain("_resolvedFrom: directMaster.id");
    expect(frameMirrorSource).toContain("getReusableFrameMirrorId");
  });
});

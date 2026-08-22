import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getLayoutRootKey } from "./layoutRootKey";

describe("layout root key", () => {
  it("keeps page id as the first partition key", () => {
    expect(
      getLayoutRootKey({
        id: "body",
        page_id: "page-1",
        props: {},
        type: "Page",
      }),
    ).toBe("page-1");
  });

  it("normalizes reusable frame mirror id before falling back to node id", () => {
    expect(
      getLayoutRootKey({
        id: "body",
        layoutId: "layout-frame-1",
        props: {},
        type: "Frame",
      }),
    ).toBe("frame-1");
    expect(getLayoutRootKey({ id: "body", props: {}, type: "Frame" })).toBe(
      "body",
    );
  });

  it("is the only root-key derivation used by cache, hook, and engine", async () => {
    const paths = [
      "../scene/layoutCache.ts",
      "../hooks/useLayoutPublisher.ts",
      "./engines/fullTreeLayout.ts",
    ];
    for (const path of paths) {
      const source = await readFile(resolve(__dirname, path), "utf8");
      expect(source).toContain("getLayoutRootKey");
      expect(source).not.toContain("getFrameElementMirrorId");
    }
  });
});

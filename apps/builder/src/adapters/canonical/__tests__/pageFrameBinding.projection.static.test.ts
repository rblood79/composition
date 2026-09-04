import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("page frame binding projection boundary", () => {
  it("target page scope만 project하고 document 전체 visitor를 되살리지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../pageFrameBinding.ts"),
      "utf-8",
    );

    expect(source).toContain("getProjectableNodeLookupsByPage(pageId)");
    expect(source).toContain("getPageBindingBodyNode");
    expect(source).not.toContain("canonicalNodeToElement");
    expect(source).not.toContain("visitCanonicalDocumentElements");
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("projectSync page layout_id contract", () => {
  it("preserves page frame binding through the frameMirror adapter", async () => {
    const source = await readFile(
      resolve(__dirname, "projectSync.ts"),
      "utf-8",
    );

    expect(source).toContain("withPageFrameBinding(");
    expect(source).toContain("getNullablePageFrameBindingId(page)");
    expect(source).not.toContain("withLegacyLayoutId");
    expect(source).not.toContain("getLegacyLayoutId");

    const pageFrameBindings = source.match(/withPageFrameBinding\(/g) ?? [];
    const pageFrameReads =
      source.match(/getNullablePageFrameBindingId\(page\)/g) ?? [];

    expect(pageFrameBindings).toHaveLength(2);
    expect(pageFrameReads).toHaveLength(2);
  });

  it("derives Supabase page order at the adapter boundary only", async () => {
    const source = await readFile(
      resolve(__dirname, "projectSync.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "for (const [pageIndex, page] of localPages.entries())",
    );
    expect(source).toContain("order_num: pageIndex");
    expect(source).not.toContain("order_num: page.order_num");
  });
});

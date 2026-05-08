import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("projectSync page layout_id contract", () => {
  async function readProjectSyncSource(): Promise<string> {
    return readFile(resolve(__dirname, "projectSync.ts"), "utf-8");
  }

  it("preserves page frame binding through the frameMirror adapter", async () => {
    const source = await readProjectSyncSource();

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
    const source = await readProjectSyncSource();

    expect(source).toContain(
      "for (const [pageIndex, page] of localPages.entries())",
    );
    expect(source).toContain("order_num: pageIndex");
    expect(source).not.toContain("order_num: page.order_num");
  });

  it("uses documents as the only local project-state source and sink", async () => {
    const source = await readProjectSyncSource();

    expect(source).toContain("await db.documents.get(projectId)");
    expect(source).toContain("deriveProjectRenderModelFromDocument(");
    expect(source).toContain("legacyToCanonical(");
    expect(source).toContain("await db.documents.put(projectId, document)");
    expect(source).toContain("await db.documents.delete(projectId)");

    expect(source).not.toMatch(/\bdb\.(pages|elements|layouts)\b/);
    expect(source).not.toMatch(
      /\bdb\.(pages|elements|layouts)\.(insert|insertMany|put|update|updateMany|delete|deleteMany|get|getAll|getByPage|getByProject|getDescendants)\b/,
    );
  });

  it("keeps Supabase row APIs as transport compatibility only", async () => {
    const source = await readProjectSyncSource();

    expect(source).toContain("pagesApi.getPagesByProjectId(projectId)");
    expect(source).toContain("elementsApi.getElementsByPageId(page.id)");
    expect(source).toContain("elementsApi.createMultipleElements(");
    expect(source).not.toContain("db.pages.insert");
    expect(source).not.toContain("db.elements.insert");
    expect(source).not.toContain("db.elements.insertMany");
    expect(source).not.toContain("db.layouts");
  });
});

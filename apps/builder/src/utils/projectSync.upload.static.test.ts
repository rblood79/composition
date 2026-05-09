/**
 * **ADR-123 Phase 3 Gate G3 — Cloud write path canonicalization**.
 *
 * `syncProjectToCloud` 가 documents row upsert 를 primary path 로 사용하는지
 * source-level 검증.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("projectSync ADR-123 Phase 3 — documents row write path", () => {
  async function readProjectSyncSource(): Promise<string> {
    return readFile(resolve(__dirname, "projectSync.ts"), "utf-8");
  }

  it("upload path: documentsApi.upsertDocument 호출 (canonical primary)", async () => {
    const source = await readProjectSyncSource();
    expect(source).toContain(
      "await documentsApi.upsertDocument(projectId, localDocument)",
    );
  });

  it("upload path: documents upsert 실패 시 legacy fallback (warn but proceed)", async () => {
    const source = await readProjectSyncSource();
    expect(source).toMatch(
      /try\s*\{\s*\n\s*await\s+documentsApi\.upsertDocument\(projectId,\s*localDocument\)/,
    );
    expect(source).toContain("documents row upsert 실패 (legacy fallback");
  });

  it("upload path: documents upsert 가 legacy pages/elements upload 보다 먼저 실행", async () => {
    const source = await readProjectSyncSource();
    const upsertIdx = source.indexOf("documentsApi.upsertDocument(projectId");
    const pagesUpdateIdx = source.indexOf("pagesApi.updatePage(page.id");
    const elementsCreateIdx = source.indexOf(
      "elementsApi.createMultipleElements(",
    );
    expect(upsertIdx).toBeGreaterThan(0);
    expect(pagesUpdateIdx).toBeGreaterThan(0);
    expect(elementsCreateIdx).toBeGreaterThan(0);
    expect(upsertIdx).toBeLessThan(pagesUpdateIdx);
    expect(upsertIdx).toBeLessThan(elementsCreateIdx);
  });
});

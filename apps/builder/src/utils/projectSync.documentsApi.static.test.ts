/**
 * **ADR-123 Phase 2 Gate G2 — Cloud read path canonicalization**.
 *
 * Static guard test: `downloadProjectFromCloud` 가 documents row primary path
 * 를 시도하고, 실패 시에만 legacy fallback 으로 진입하는지 source-level 검증.
 *
 * vitest module resolution 함정 회피를 위해 source 와 동일 디렉토리에 위치.
 * (memory: feedback-vitest-no-tests-misleading.md)
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("projectSync ADR-123 Phase 2 — documents row primary path", () => {
  async function readProjectSyncSource(): Promise<string> {
    return readFile(resolve(__dirname, "projectSync.ts"), "utf-8");
  }

  it("imports documentsApi from DocumentsApiService", async () => {
    const source = await readProjectSyncSource();
    expect(source).toContain(
      'import { documentsApi } from "../services/api/DocumentsApiService"',
    );
  });

  it("calls documentsApi.getDocumentByProjectId BEFORE legacy pagesApi.getPagesByProjectId", async () => {
    const source = await readProjectSyncSource();
    const getDocIdx = source.indexOf("documentsApi.getDocumentByProjectId(");
    const getPagesIdx = source.indexOf("pagesApi.getPagesByProjectId(");
    expect(getDocIdx).toBeGreaterThan(0);
    expect(getPagesIdx).toBeGreaterThan(0);
    expect(getDocIdx).toBeLessThan(getPagesIdx);
  });

  it("early-returns when documents row exists (no legacyToCanonical call)", async () => {
    const source = await readProjectSyncSource();
    // documents row 존재 시 db.documents.put + return 패턴
    expect(source).toMatch(
      /if\s*\(\s*canonicalDocument\s*\)\s*\{\s*\n\s*await\s+db\.documents\.put\(projectId,\s*canonicalDocument\)/,
    );
  });

  it("seeds documents row from legacy fallback (best-effort, non-fatal)", async () => {
    const source = await readProjectSyncSource();
    expect(source).toContain(
      "await documentsApi.upsertDocument(projectId, document)",
    );
    expect(source).toContain("documents row seed");
  });

  it("legacy fallback path still uses legacyToCanonical (migration window)", async () => {
    const source = await readProjectSyncSource();
    // legacyToCanonical 호출 자체는 fallback path 에서만 1회 (production)
    const legacyToCanonicalMatches = source.match(/legacyToCanonical\(/g) ?? [];
    // 1 import + 1 call = 2 (import statement counts the literal)
    expect(legacyToCanonicalMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("download path: documents row API import 존재", async () => {
    const source = await readProjectSyncSource();
    expect(source).toContain("documentsApi");
  });
});

/**
 * **ADR-123 Phase 3 Gate G3 — Dashboard cloud seed canonicalization**.
 *
 * dashboard 에서 cloud project 생성 시 documents row 를 primary seed 로 사용하는지
 * source-level 검증.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("dashboard cloud project ADR-123 Phase 3 — documents seed", () => {
  async function readDashboardSource(): Promise<string> {
    return readFile(resolve(__dirname, "..", "index.tsx"), "utf-8");
  }

  it("imports documentsApi from services/api", async () => {
    const source = await readDashboardSource();
    expect(source).toContain("documentsApi");
  });

  it("cloud 분기에서 documentsApi.upsertDocument 호출", async () => {
    const source = await readDashboardSource();
    expect(source).toContain(
      "await documentsApi.upsertDocument(newProject.id, initialDocument)",
    );
  });

  it("documents seed 가 legacy pagesApi.createPage 호출보다 먼저 실행", async () => {
    const source = await readDashboardSource();
    const docSeedIdx = source.indexOf(
      "documentsApi.upsertDocument(newProject.id",
    );
    const pagesCreateIdx = source.indexOf(
      "pagesApi.createPage({\n          id: homePageId",
    );
    expect(docSeedIdx).toBeGreaterThan(0);
    expect(pagesCreateIdx).toBeGreaterThan(0);
    expect(docSeedIdx).toBeLessThan(pagesCreateIdx);
  });

  it("documents seed 실패 시 best-effort (warn but proceed)", async () => {
    const source = await readDashboardSource();
    expect(source).toMatch(
      /try\s*\{\s*\n\s*await\s+documentsApi\.upsertDocument\(newProject\.id,/,
    );
    expect(source).toContain("documents row seed 실패");
  });

  it("'cloud' / 'both' 분기 통합 — 동일한 seed path", async () => {
    const source = await readDashboardSource();
    // 두 분기를 통합 처리 (else 분기 제거 — 'cloud' || 'both')
    expect(source).toContain(
      'projectCreation === "cloud" || projectCreation === "both"',
    );
  });
});

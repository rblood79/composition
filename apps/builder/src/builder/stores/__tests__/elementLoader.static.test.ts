import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-120 Phase 1 elementLoader persistence contract", () => {
  it("derives lazy page elements from the canonical document, not legacy stores", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementLoader.ts"),
      "utf-8",
    );

    expect(source).toContain("loadFromCanonicalDocument");
    expect(source).toContain("canonicalDocumentToElements");
    expect(source).not.toContain("deriveProjectRenderModelFromDocument");
    expect(source).toContain("getActiveCanonicalElements");
    expect(source).toContain("getPageElementsFromRuntimeState");
    expect(source).toContain("legacyElements");
    expect(source).toContain("StoreElementCacheMap");
    expect(source).not.toContain("elementsMap: Map<string, Element>");
    expect(source).not.toContain("getDB");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("db.elements.getByPage");
    expect(source).not.toContain("db.elements.insertMany");

    const staleMapIteration = ["state", "elementsMap", "forEach"].join(".");
    const staleGetMapIteration = ["get()", "elementsMap", "forEach"].join(".");
    expect(source).not.toContain(staleMapIteration);
    expect(source).not.toContain(staleGetMapIteration);
  });
});

describe("요소 소실 사건 대응 — store-level unload 금지 계약 (2026-07-14, Task #8)", () => {
  it("unloadPage 는 bookkeeping 전용 — elements/elementsMap 물리 제거 금지", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementLoader.ts"),
      "utf-8",
    );

    // unloadPage 함수 블록 추출
    const match = source.match(
      /const unloadPage = \(pageId: string\): void => \{[\s\S]*?\n {2}\};/,
    );
    expect(match).not.toBeNull();
    const block = match![0];

    // 부분 elements 배열은 full-replace 경로 (page-shell bridge / history sync)
    // 를 타고 canonical 에 투영된 뒤 자동 persist 로 영구 손실을 확정시킨다.
    expect(block).not.toContain("elements:");
    expect(block).not.toContain("elementsMap");
    expect(block).not.toContain("pageElementsSnapshot");
    expect(block).toContain("loadedPages");
    expect(block).toContain("pageCache.remove");
  });

  it("useAutoRecovery 는 clearAllPages (store-level unload) 를 호출하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../../hooks/useAutoRecovery.ts"),
      "utf-8",
    );

    // freeze 시점 healthScore 급락 → clearAllPages 자동 발동이 손실 fuse 였다.
    expect(source).not.toContain("clearAllPages()");
  });
});

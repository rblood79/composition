import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("historyActions canonical compatibility sync contract", () => {
  it("uses active canonical document traversal before legacy store map for cloud compatibility upsert", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalHistoryElements");
    expect(source).toContain("function getHistorySourceElements");
    expect(source).toContain("type HistoryCompatibilityElementMap");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).toContain("getHistoryCompatibilityElementsMap(get)");
    expect(source).toContain(
      "getActiveCanonicalHistoryElements() ?? legacyElements",
    );
    expect(source).toContain("applySerializedHistoryDiff");
    expect(source).toContain("applySerializedHistoryDiffs");
    expect(source).toContain("entry.data.diff");
    expect(source).toContain("entry.data.diffs");
    expect(source).toContain("syncHistoryElementsToCanonical(updatedElements)");
    expect(source).not.toContain(
      "syncHistoryElementsToCanonical(get().elements)",
    );
    const staleMapLookup = ["get()", "elementsMap"].join(".");
    expect(source).not.toContain(`const elementsMap = ${staleMapLookup};`);
    expect(source).not.toContain(staleMapLookup);
    expect(source).not.toContain(
      "function getHistoryCompatibilityElementsMap(\n  get: GetState,\n): Map<string, Element>",
    );
  });

  it("HC#2: legacy fallback 의 canonical sync 가 set() 보다 선행 (undo/redo/goToIndex 3곳)", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    // sync 호출 (정의 제외) 이 3곳 존재
    const syncCalls = [
      ...source.matchAll(/syncHistoryElementsToCanonical\(updatedElements\)/g),
    ];
    expect(syncCalls).toHaveLength(3);

    // 각 sync 호출 직후 canonical 재파생 → 그 다음에야 set({ elements 등장
    // (sync 가 set 보다 뒤면 위반 — HC#2 canonical 1차 계약)
    for (const match of syncCalls) {
      const after = source.slice(
        match.index,
        source.indexOf("set({", match.index),
      );
      expect(after).toContain(
        "getActiveCanonicalHistoryElements() ?? updatedElements",
      );
    }

    // 과거 위반 패턴 (set 이후 sync) 부재: set({...}) 뒤 30줄 안에 sync 없음
    const setBlocks = [
      ...source.matchAll(/set\(\{\s*\n\s*elements: updatedElements,/g),
    ];
    expect(setBlocks.length).toBeGreaterThanOrEqual(3);
    for (const block of setBlocks) {
      const windowAfter = source
        .slice(block.index)
        .split("\n")
        .slice(0, 30)
        .join("\n");
      expect(windowAfter).not.toContain("syncHistoryElementsToCanonical");
    }
  });
});

describe("ADR-177: page-position entry 소비 분기 (element 노드 경로 미진입 계약)", () => {
  it("undo/redo/goToIndex 3 진입점 + syncDatabaseForEntries 에 page-position 분기 존재", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    // 적용 헬퍼 정의 (스토어 스냅샷 + canonical setPagePositions + persist)
    expect(source).toContain("function applyPagePositionHistoryEntry");
    expect(source).toContain(".setPagePositions(");

    // 진입점 분기 — undo/redo 는 early-return, goToIndex 는 continue,
    // syncDatabaseForEntries 는 skip. 최소 4곳.
    const branches = [
      ...source.matchAll(/entry\.type === "page-position"/g),
    ];
    expect(branches.length).toBeGreaterThanOrEqual(4);

    // undo/redo early-branch 는 element 경로 진입 전 (historyManager.undo/redo
    // 획득 직후 30줄 안)에 있어야 한다.
    for (const acquire of ["historyManager.undo()", "historyManager.redo()"]) {
      const idx = source.indexOf(acquire);
      expect(idx).toBeGreaterThan(-1);
      const windowAfter = source
        .slice(idx)
        .split("\n")
        .slice(0, 30)
        .join("\n");
      expect(windowAfter).toContain('entry.type === "page-position"');
      expect(windowAfter).toContain("applyPagePositionHistoryEntry");
    }
  });
});

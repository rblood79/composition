/**
 * **ADR-124 Phase 2 Gate G2 — entry 생성 layer canonical event 부착 검증**.
 *
 * `addDiffEntry` / `addBatchDiffEntry` 가 entry 생성 시점에 항상 canonical
 * update event 를 부착하는지 source-level 검증.
 *
 * vitest module resolution 함정 회피를 위해 source 와 동일 디렉토리 tree 에 위치.
 * (memory: feedback-vitest-no-tests-misleading.md)
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("history entry canonical event 부착 (ADR-124 Phase 2)", () => {
  async function readHistorySource(): Promise<string> {
    return readFile(resolve(__dirname, "..", "..", "history.ts"), "utf-8");
  }

  it("dead API (diff entry 생성기) 와 CommandDataStore 통합이 제거됨 (2026-07-15 정비)", async () => {
    const source = await readHistorySource();
    expect(source).not.toContain("addDiffEntry(");
    expect(source).not.toContain("addBatchDiffEntry(");
    expect(source).not.toContain("commandDataStore");
    expect(source).not.toContain("convertToCommandChanges");
  });

  it("addEntry: canonicalEvents 미부착 entry 에 DEV 경고 가드 존재", async () => {
    const source = await readHistorySource();
    expect(source).toContain("entry.data.canonicalEvents?.length");
    expect(source).toContain("entry without canonicalEvents");
  });

  it("R1 group A call site: legacy snapshot field 기록 잔존 0건", async () => {
    const read = (relativePath: string) =>
      readFile(resolve(__dirname, "..", "..", relativePath), "utf-8");

    const elementUpdate = await read("utils/elementUpdate.ts");
    expect(elementUpdate).not.toContain("batchUpdates:");
    expect(elementUpdate).not.toContain("addBatchDiffEntry");
    expect(elementUpdate).not.toContain("prevElement: prevElementClone");
    expect(elementUpdate).not.toContain("props: newPropsClone");

    const inspectorActions = await read("inspectorActions.ts");
    expect(inspectorActions).not.toContain("props: structuredClone(newProps)");
    expect(inspectorActions).not.toContain(
      "element: structuredClone(updatedElement)",
    );

    // entry data 에 batchUpdates 기록 금지
    const historyHelpers = await read("utils/historyHelpers.ts");
    expect(historyHelpers).not.toMatch(/data:\s*\{\s*\n\s*batchUpdates/);
    expect(historyHelpers).not.toContain("undoBatchUpdate");

    // resetInstanceOverrideField + applyElementSnapshotBatch 전환 완료
    const instanceActions = await read("utils/instanceActions.ts");
    expect(instanceActions).not.toContain("element: nextElement,");
    expect(instanceActions).not.toContain("prevElements: previousElements");

    // autoDetach 분기 전환 완료 — legacy snapshot 기록 잔존 0건
    const elementRemoval = await read("utils/elementRemoval.ts");
    expect(elementRemoval).not.toContain("prevElements:");

    // canvas 드래그 전환 완료 — snapshot payload + sentinel 제거
    const dragBridge = await readFile(
      resolve(
        __dirname,
        "..",
        "..",
        "..",
        "workspace/canvas/hooks/useDragBridge.ts",
      ),
      "utf-8",
    );
    expect(dragBridge).not.toContain("prevElements");
    expect(dragBridge).not.toContain('"drag-reorder"');
  });

  it("buildCanonicalUpdateEvent helper 가 canonicalHistoryEvents.ts 에 export 됨", async () => {
    const eventsSource = await readFile(
      resolve(__dirname, "..", "canonicalHistoryEvents.ts"),
      "utf-8",
    );
    expect(eventsSource).toContain(
      "export function buildCanonicalUpdateEvent(",
    );
    expect(eventsSource).toContain('type: "update";');
    expect(eventsSource).toContain("prevProps: Record<string, unknown>");
    expect(eventsSource).toContain("nextProps: Record<string, unknown>");
  });
});

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

  it("imports buildCanonicalUpdateEvent from canonicalHistoryEvents", async () => {
    const source = await readHistorySource();
    expect(source).toContain("buildCanonicalUpdateEvent");
    expect(source).toContain("./history/canonicalHistoryEvents");
  });

  it("addDiffEntry: type === 'update' 시 buildCanonicalUpdateEvent 호출", async () => {
    const source = await readHistorySource();
    expect(source).toMatch(
      /type === "update"\s*\?\s*\[\s*\n\s*buildCanonicalUpdateEvent\(/,
    );
  });

  it("addDiffEntry: prevElement.id + prevElement.props + nextElement.props 전달", async () => {
    const source = await readHistorySource();
    // buildCanonicalUpdateEvent(prevElement.id, prevElement.props, nextElement.props) 패턴
    expect(source).toContain(
      "buildCanonicalUpdateEvent(\n                  prevElement.id,",
    );
  });

  it("addBatchDiffEntry: 각 diff 에 대해 buildCanonicalUpdateEvent 호출", async () => {
    const source = await readHistorySource();
    expect(source).toContain("canonicalEvents.push(");
    expect(source).toContain(
      "buildCanonicalUpdateEvent(\n            prevElements[i].id,",
    );
  });

  it("addBatchDiffEntry: entry data 에 canonicalEvents 포함", async () => {
    const source = await readHistorySource();
    // batch entry data 가 diffs + canonicalEvents 를 모두 포함
    expect(source).toMatch(
      /data:\s*\{\s*\n\s*diffs,\s*\n\s*canonicalEvents,\s*\n\s*\}/,
    );
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

    // entry data 에 batchUpdates 기록 금지 (undoBatchUpdate/redoBatchUpdate
    // 헬퍼는 v1 IndexedDB entry 재생용으로 잔존 — 기록이 아닌 read 소비자)
    const historyHelpers = await read("utils/historyHelpers.ts");
    expect(historyHelpers).not.toMatch(/data:\s*\{\s*\n\s*batchUpdates/);

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

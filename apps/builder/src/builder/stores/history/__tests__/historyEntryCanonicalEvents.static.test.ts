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

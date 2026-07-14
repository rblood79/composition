import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useDragBridge persistence contract", () => {
  it("does not issue per-id DB updates for canonical projection descendants", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("persistActiveCanonicalDocument(db)");
    expect(source).not.toContain("db.elements.updateMany(");
    expect(source).not.toContain("db.elements.update(id");
  });

  it("uses canonical-primary move as the drop commit path", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("moveElementToCanonicalTarget(");
    expect(source).not.toContain("state.moveElementToContainer(");
    expect(source).not.toContain("state.batchUpdateElementOrders(");
  });

  it("rebuilds derived store indexes immediately after canonical drop commit", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );
    // drop commit 블록 = canonical move 호출부터 changed 분기 진입 직전까지.
    // (과거 앵커였던 `postMoveStore = buildDragReadModelFromCanonicalDocument` 는
    //  canonical move event 전환 때 삭제됨 — 계약은 그대로, 앵커만 이동)
    const commitBlock = source.match(
      /const moveResult =[\s\S]*?if \(moveResult\.changed\)/,
    )?.[0];

    expect(commitBlock).toBeTruthy();
    expect(commitBlock).toContain("moveElementToCanonicalTarget(");
    expect(commitBlock).toContain("useStore.getState()._rebuildIndexes?.()");
  });

  it("does not use mutable store maps as drag/drop authority", async () => {
    const source = await readFile(
      resolve(__dirname, "useDragBridge.ts"),
      "utf-8",
    );

    expect(source).toContain("resolveDragReadModel(");
    expect(source).toContain("getInteractiveElementsMap");
    expect(source).not.toContain("elementsById: dragState.elementsById");
    expect(source).not.toContain(
      "childrenByParent: dragState.childrenByParent",
    );
    expect(source).not.toContain(
      "state.childrenByParent.get(finalTarget.containerId)",
    );
    expect(source).not.toContain("state.elementsById.get(id)");
  });
});

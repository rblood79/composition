import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("editor presentation commit projection boundary", () => {
  it("fill/style commit은 공통 증분 mirror 경로를 사용하고 full projection은 fallback에만 둔다", async () => {
    const source = await readFile(
      resolve(__dirname, "./editorPresentationCommitAdapter.ts"),
      "utf-8",
    );

    expect(
      source.match(
        /syncPresentationStoreMirror\(document, nextDocument, before, nextNode\)/g,
      ),
    ).toHaveLength(2);
    expect(
      source.match(/canonicalDocumentToElements\(nextDocument\)/g),
    ).toHaveLength(1);
    expect(source.match(/indexSource: "store"/g)).toHaveLength(2);
  });

  it("BuilderCore bridge는 store source에서 최신 elements를 직접 index 입력으로 전달한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../main/BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain(
      'state._rebuildIndexes(source === "store" ? state.elements : undefined)',
    );
  });

  it("production hydration은 정규화한 store mirror에 canonical provenance를 승계한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../stores/elements.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "isCanonicalDocumentElementProjection(elements, activeDocument)",
    );
    expect(source).toContain(
      "registerCanonicalDocumentElementProjection(\n        canonicalElements,\n        projectionDocument",
    );
  });

  it("fill pilot materialization context는 selected/ancestor leaf index만 읽는다", async () => {
    const source = await readFile(
      resolve(__dirname, "./editorPresentationFillPilot.ts"),
      "utf-8",
    );

    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).toContain("getLastProjectableNodeLookupById");
    expect(source).toContain("getProjectableChildrenByParent");
  });
});

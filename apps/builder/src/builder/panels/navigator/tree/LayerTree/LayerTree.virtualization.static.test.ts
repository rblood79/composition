import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it.each([
  "../TreeBase/TreeBase.tsx",
  "../PageTree/PageTree.tsx",
  "../../FramesTab/FrameList.tsx",
  "../../FramesTab/FrameElementTree.tsx",
])("%s에는 RAC Virtualizer가 전파되지 않는다", (path) => {
  const source = readFileSync(resolve(__dirname, path), "utf8");
  expect(source).not.toMatch(/\bVirtualizer\b/);
  if (path.endsWith("FrameElementTree.tsx")) {
    expect(source).toContain("<VirtualizedTree");
    // 임계값은 **전체 노드 수** 기준이다. 루트 배열 길이(`treeNodes.length`)로
    // 재면 단일 `body` 루트인 실제 문서에서 늘 1 이라 분기가 열리지 않는다
    // (2026-09-07 실측). 동작 근거는 FrameElementTree.test.tsx §가상화 전환 임계값.
    expect(source).toContain("nodeMap.size >= VIRTUALIZE_THRESHOLD");
    expect(source).not.toContain("treeNodes.length >=");
  }
});

it("LayerTree는 legacy VirtualizedTree 분기를 참조하지 않는다", () => {
  const source = readFileSync(resolve(__dirname, "./LayerTree.tsx"), "utf8");
  expect(source).not.toMatch(/\bVirtualizedTree\b/);
  expect(source).not.toContain("treeNodes.length >= 300");
});

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
    expect(source).toContain("treeNodes.length >= 12");
  }
});

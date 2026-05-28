import type { Key } from "react-stately";
import { describe, expect, it } from "vitest";
import type { Page } from "../../../../../types/builder/unified.types";
import { buildPageTree } from "./usePageTreeData";
import { isValidPageDrop } from "./validation";

function makePage(
  id: string,
  title: string,
  slug: string,
  parentId: string | null = null,
): Page {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: parentId,
  } as Page;
}

function buildTree(pages: Page[]) {
  const { nodeMap } = buildPageTree(pages);
  return {
    getItem: (key: Key | string) => {
      const node = nodeMap.get(String(key));
      return node ? { value: node } : undefined;
    },
  };
}

describe("isValidPageDrop", () => {
  it("blocks drag/drop mutations that would move the Components system page", () => {
    const tree = buildTree([
      makePage("page-components", "Components", "/__components"),
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
    ]);

    expect(
      isValidPageDrop("page-components", "page-one", "after", tree),
    ).toEqual({
      valid: false,
      reason: "system-page-immutable",
    });
    expect(
      isValidPageDrop("page-one", "page-components", "after", tree),
    ).toEqual({
      valid: false,
      reason: "system-page-immutable",
    });
  });
});

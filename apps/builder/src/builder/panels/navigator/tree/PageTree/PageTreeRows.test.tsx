// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { Key } from "react-stately";

/** Counts row content renders: every non-root row draws one `File` icon. */
const fileRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const File = (props: Record<string, unknown>) => {
    fileRenders.count++;
    return React.createElement(actual.File, props);
  };
  return { ...actual, File };
});

import { TreeBase } from "../TreeBase";
import type { TreeItemState } from "../TreeBase/types";
import { PageTreeItemContent } from "./PageTreeItemContent";
import type { PageTreeNode, PageTreePage } from "./types";

type Node = PageTreeNode<PageTreePage>;
const nodes: Node[] = Array.from({ length: 30 }, (_, index) => {
  const id = `page-${index}`;
  return {
    id,
    name: `Page ${index}`,
    slug: id,
    parentId: null,
    depth: 0,
    hasChildren: false,
    isLeaf: true,
    children: [],
    page: { id, title: `Page ${index}` } as PageTreePage,
    isRoot: index === 0,
    isSystemPage: false,
    isDraggable: index !== 0,
    isDroppable: true,
  };
});
const pageKey = (node: Node) => node.id;
const pageText = (node: Node) => node.name;
const callbacks = { onDelete: () => {}, onReselect: () => {} };
const renderContent = (node: Node, state: TreeItemState) => (
  <PageTreeItemContent<PageTreePage> node={node} state={state} {...callbacks} />
);

function Pages({ selected }: { selected: string }) {
  return (
    <TreeBase<Node>
      aria-label="Pages"
      items={nodes}
      getKey={pageKey}
      getTextValue={pageText}
      renderContent={renderContent}
      selectedKeys={new Set<Key>([selected])}
      expandedKeys={new Set<Key>()}
    />
  );
}

describe("Pages tree rows (CANVAS_PERF_SCALING_2026-11 B6)", () => {
  afterEach(() => cleanup());

  it("opening another page re-renders only the two rows whose selection changed", () => {
    const view = render(<Pages selected="page-3" />);
    expect(view.container.querySelectorAll(".elementItem")).toHaveLength(30);
    fileRenders.count = 0;
    view.rerender(<Pages selected="page-7" />);
    // page-3 (off) and page-7 (on) — both draw a File icon (not the root row).
    expect(fileRenders.count).toBe(2);
    expect(
      view.container.querySelector('[data-key="page-7"] .elementItem')
        ?.classList,
    ).toContain("active");
    expect(
      view.container.querySelector('[data-key="page-3"] .elementItem')
        ?.classList,
    ).not.toContain("active");
  });
});

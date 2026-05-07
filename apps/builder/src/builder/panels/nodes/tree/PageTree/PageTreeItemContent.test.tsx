// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Page } from "../../../../../types/builder/unified.types";
import { PageTreeItemContent } from "./PageTreeItemContent";
import type { PageTreeNode } from "./types";

function makePage(): Page {
  return {
    id: "page-1",
    title: "Home",
    slug: "home",
    project_id: "project-1",
    parent_id: null,
    order_num: 0,
  } as Page;
}

function makeNode(page = makePage()): PageTreeNode {
  return {
    id: page.id,
    name: page.title || "Untitled",
    slug: page.slug ?? null,
    parentId: page.parent_id ?? null,
    orderNum: page.order_num ?? 0,
    depth: 0,
    hasChildren: false,
    isLeaf: true,
    children: [],
    page,
    isRoot: true,
    isDraggable: false,
    isDroppable: true,
  };
}

describe("PageTreeItemContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("선택된 page 행을 다시 클릭하면 reselect callback을 호출한다", () => {
    const page = makePage();
    const onReselect = vi.fn();

    render(
      <PageTreeItemContent
        node={makeNode(page)}
        state={{
          isSelected: true,
          isExpanded: false,
          isDisabled: false,
          isFocusVisible: false,
        }}
        onDelete={vi.fn()}
        onReselect={onReselect}
      />,
    );

    fireEvent.click(screen.getByText("Home"));

    expect(onReselect).toHaveBeenCalledWith(page);
  });

  it("행 안의 action button 클릭은 reselect로 처리하지 않는다", () => {
    const onReselect = vi.fn();

    render(
      <PageTreeItemContent
        node={makeNode()}
        state={{
          isSelected: true,
          isExpanded: false,
          isDisabled: false,
          isFocusVisible: false,
        }}
        onDelete={vi.fn()}
        onReselect={onReselect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings for Home" }));

    expect(onReselect).not.toHaveBeenCalled();
  });

  it("drag slot button does not override React Aria pointer events", () => {
    const page = makePage();
    const node = {
      ...makeNode(page),
      isRoot: false,
      isDraggable: true,
    };

    render(
      <PageTreeItemContent
        node={node}
        state={{
          isSelected: false,
          isExpanded: false,
          isDisabled: false,
          isFocusVisible: false,
        }}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Drag Home" }).style.pointerEvents,
    ).not.toBe("auto");
  });
});

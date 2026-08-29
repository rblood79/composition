// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "../../../../types/builder/unified.types";
import { useStore } from "../../../stores";
import { PageParentSelector } from "./PageParentSelector";

vi.mock("../../../components", () => ({
  PropertyInput: ({ label, value }: { label: string; value: string }) => (
    <label>
      {label}
      <input aria-label={label} readOnly value={value} />
    </label>
  ),
  PropertySection: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  PropertySelect: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("../../../stores/canonical/canonicalFrameStore", () => ({
  useCanonicalReusableFrameLayouts: () => [],
}));

function makePage(overrides: Partial<Page>): Page {
  return {
    id: "page-1",
    project_id: "project-1",
    title: "Page",
    slug: "/page",
    parent_id: null,
    ...overrides,
  } as Page;
}

describe("PageParentSelector resolved URL", () => {
  beforeEach(() => {
    useStore.setState({
      currentPageId: null,
      pages: [],
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("절대 slug와 계산 결과가 같으면 중복 URL을 표시하지 않는다", () => {
    useStore.setState({
      currentPageId: "page-1",
      pages: [makePage({ slug: "/products" })],
    } as never);

    render(<PageParentSelector pageId="page-1" />);

    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
      "/products",
    );
    expect(screen.queryByText("Resolved URL:")).toBeNull();
    expect(screen.queryByText("Preview URL:")).toBeNull();
  });

  it("상대 slug가 부모 경로와 합성되면 계산된 URL만 보조 표시한다", () => {
    const parent = makePage({
      id: "page-parent",
      title: "Products",
      slug: "/products",
    });
    const child = makePage({
      id: "page-child",
      title: "Shoes",
      slug: "shoes",
      parent_id: parent.id,
    });
    useStore.setState({
      currentPageId: child.id,
      pages: [parent, child],
    } as never);

    render(<PageParentSelector pageId={child.id} />);

    expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe(
      "shoes",
    );
    expect(screen.getByText("Resolved URL:")).toBeTruthy();
    expect(screen.getByText("/products/shoes")).toBeTruthy();
    expect(screen.queryByText("Preview URL:")).toBeNull();
  });
});

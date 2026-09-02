import { describe, expect, it } from "vitest";
import type { Page } from "../../../types/builder/unified.types";
import { filterPagesByQuery } from "./filterPagesByQuery";

function page(id: string, title: string, parent_id: string | null = null): Page {
  return { id, title, slug: `/${title.toLowerCase()}`, project_id: "p", parent_id };
}

const PAGES = [
  page("home", "Home"),
  page("about", "About"),
  page("blog", "Blog"),
  page("post", "First Post", "blog"),
  page("draft", "Draft", "post"),
];

describe("filterPagesByQuery", () => {
  it("returns the same array and no expand ids for an empty or whitespace query", () => {
    const result = filterPagesByQuery(PAGES, "   ");

    expect(result.pages).toBe(PAGES);
    expect(result.expandIds.size).toBe(0);
    expect(result.matchCount).toBe(PAGES.length);
    expect(result.query).toBe("");
  });

  it("keeps matches plus their ancestors in original order and expands the ancestors", () => {
    const result = filterPagesByQuery(PAGES, "DRAFT");

    expect(result.pages.map((p) => p.id)).toEqual(["blog", "post", "draft"]);
    expect([...result.expandIds].sort()).toEqual(["blog", "post"]);
    expect(result.matchCount).toBe(1);
  });

  it("matches slug as well as title", () => {
    const result = filterPagesByQuery(PAGES, "/about");

    expect(result.pages.map((p) => p.id)).toEqual(["about"]);
  });

  it("does not pull in descendants of a matched ancestor", () => {
    const result = filterPagesByQuery(PAGES, "blog");

    expect(result.pages.map((p) => p.id)).toEqual(["blog"]);
    expect(result.expandIds.size).toBe(0);
  });

  it("reports zero matches without throwing on cyclic parent links", () => {
    const cyclic = [page("a", "A", "b"), page("b", "B", "a")];

    const result = filterPagesByQuery(cyclic, "zzz");

    expect(result.pages).toEqual([]);
    expect(result.matchCount).toBe(0);
  });
});

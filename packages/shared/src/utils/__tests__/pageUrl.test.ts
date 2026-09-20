import { describe, expect, it } from "vitest";
import { generatePageUrl, resolvePageIdByPath } from "../pageUrl";

const pages = [
  { id: "home", slug: "/" },
  { id: "products", slug: "products" },
  { id: "shoes", slug: "shoes", parent_id: "products" },
  { id: "nike", slug: "nike", parent_id: "shoes" },
  { id: "about", slug: "/company/about" },
  { id: "item", slug: ":itemId", parent_id: "products" },
];

describe("generatePageUrl", () => {
  it("계층 slug 를 부모 URL 뒤에 붙인다", () => {
    expect(generatePageUrl({ page: pages[3], allPages: pages })).toBe(
      "/products/shoes/nike",
    );
  });
  it("절대 slug 는 그대로", () => {
    expect(generatePageUrl({ page: pages[4], allPages: pages })).toBe(
      "/company/about",
    );
  });
  it("layout slug 가 있으면 layout 아래", () => {
    expect(
      generatePageUrl({ page: pages[1], layout: { slug: "/shop" } }),
    ).toBe("/shop/products");
  });
});

describe("resolvePageIdByPath — preview 라우터와 같은 매칭", () => {
  it("계층 URL 로 자식 페이지를 찾는다 (bare slug 로는 못 찾는다)", () => {
    expect(resolvePageIdByPath("/products/shoes", pages)).toBe("shoes");
    expect(resolvePageIdByPath("/shoes", pages)).toBeNull();
  });
  it("trailing slash · 대소문자 · 앞 슬래시 생략을 허용한다 (react-router 기본값)", () => {
    expect(resolvePageIdByPath("/products/shoes/", pages)).toBe("shoes");
    expect(resolvePageIdByPath("/Products/Shoes", pages)).toBe("shoes");
    expect(resolvePageIdByPath("products", pages)).toBe("products");
  });
  it("루트는 '/' · '' 둘 다", () => {
    expect(resolvePageIdByPath("/", pages)).toBe("home");
    expect(resolvePageIdByPath("", pages)).toBe("home");
  });
  it("정적 라우트가 동적 라우트보다 우선하고, 동적 세그먼트는 매칭된다", () => {
    expect(resolvePageIdByPath("/products/shoes", pages)).toBe("shoes");
    expect(resolvePageIdByPath("/products/123", pages)).toBe("item");
  });
  it("query · hash 는 매칭에서 뗀다", () => {
    expect(resolvePageIdByPath("/products?x=1#top", pages)).toBe("products");
  });
  it("매칭 없으면 null", () => {
    expect(resolvePageIdByPath("/nowhere", pages)).toBeNull();
  });
});

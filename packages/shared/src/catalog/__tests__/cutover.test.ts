import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "../cutover";

describe("isCatalogCutover (catalog cutover gate)", () => {
  it("현재 어떤 type 도 cutover 아님 — gate 닫힘 (live 회귀 0)", () => {
    expect(isCatalogCutover("Button")).toBe(false);
    expect(isCatalogCutover("ListBox")).toBe(false);
    expect(isCatalogCutover("frame")).toBe(false);
  });
});

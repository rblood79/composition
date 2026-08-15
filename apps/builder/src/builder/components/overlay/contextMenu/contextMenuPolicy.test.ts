// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isEditableContextMenuTarget,
  resolveContextMenuDisposition,
} from "./contextMenuPolicy";

describe("context menu policy", () => {
  it("preserves native menus for editable controls", () => {
    const input = document.createElement("input");
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");

    expect(isEditableContextMenuTarget(input)).toBe(true);
    expect(isEditableContextMenuTarget(contentEditable)).toBe(true);
    expect(
      resolveContextMenuDisposition({
        target: input,
        altKey: false,
        isDevelopment: false,
      }),
    ).toBe("native");
  });

  it("suppresses the ruler menu without opening a context menu", () => {
    const ruler = document.createElement("div");
    ruler.dataset.rulerOverlay = "";
    const label = document.createElement("span");
    ruler.append(label);

    expect(
      resolveContextMenuDisposition({
        target: label,
        altKey: false,
        isDevelopment: false,
      }),
    ).toBe("suppress-without-menu");
  });

  it("allows the DEV Alt-right-click escape hatch only in development", () => {
    const target = document.createElement("div");

    expect(
      resolveContextMenuDisposition({
        target,
        altKey: true,
        isDevelopment: true,
      }),
    ).toBe("native");
    expect(
      resolveContextMenuDisposition({
        target,
        altKey: true,
        isDevelopment: false,
      }),
    ).toBe("suppress");
  });
});

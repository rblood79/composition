// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canonicalDocumentToElements } from "../stores/canonical/canonicalElementsView";
import { createPathHeavy117Document } from "./pathHeavy117Fixture";

describe("pathHeavy117Fixture", () => {
  it("모든 G5 path 표면과 2-page workflow rule을 canonical seed에 고정한다", () => {
    const document = createPathHeavy117Document({
      jpeg: "data:image/jpeg;base64,jpeg",
      png: "data:image/png;base64,png",
      webp: "data:image/webp;base64,webp",
    });
    const elements = canonicalDocumentToElements(document).map((element) => {
      return {
        id: element.id,
        props: element.props as Record<string, unknown>,
        type: element.type,
      };
    });

    expect(document.children.map((page) => page.name)).toEqual([
      "Path Heavy 117",
      "Target",
    ]);
    expect(document.events).toEqual([
      expect.objectContaining({
        elementId: "path-heavy-117-source-button",
        action: { kind: "navigate", params: { path: "/target" } },
      }),
    ]);
    expect(elements.length).toBeGreaterThanOrEqual(68);
    expect(elements.filter((element) => element.type === "Icon")).toHaveLength(
      8,
    );
    expect(elements.filter((element) => element.type === "Image")).toHaveLength(
      12,
    );

    const styles = elements.map(
      (element) => element.props.style as Record<string, unknown> | undefined,
    );
    expect(styles.some((style) => style?.borderStyle === "inset")).toBe(true);
    expect(styles.some((style) => style?.borderStyle === "outset")).toBe(true);
    expect(
      styles.some((style) => String(style?.boxShadow).startsWith("inset ")),
    ).toBe(true);
    expect(styles.some((style) => style?.overflow === "hidden")).toBe(true);
  });
});

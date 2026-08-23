import { describe, expect, it } from "vitest";
import type { EditorMutationDescriptor } from "../../builder/presentation/editorPresentationTypes";
import { resolvePresentationTextMetricProps } from "./presentationTextMetricProps";

const target = { kind: "canonical-node" as const, nodeId: "text-1" };

function patch(
  value: Readonly<Record<string, unknown>>,
): EditorMutationDescriptor {
  return { patch: value, target, type: "style.patch" };
}

describe("Preview fixed Text metric presentation", () => {
  it("applies fontSize/fontWeight while preserving the fixed hit-test box", () => {
    const base = {
      style: {
        fontSize: "16px",
        fontWeight: "400",
        height: "40px",
        position: "absolute",
        top: "10px",
        width: "120px",
      },
    };
    const resolved = resolvePresentationTextMetricProps(
      base,
      [patch({ fontSize: 18 }), patch({ fontWeight: 700 })],
      "Text",
    );
    expect(resolved.style).toMatchObject({
      fontSize: "18px",
      fontWeight: 700,
      height: "40px",
      top: "10px",
      width: "120px",
    });
  });

  it("rejects non-Text, nested, relative, and unsupported metric mutations", () => {
    const base = {
      style: {
        fontSize: "16px",
        fontWeight: "400",
        height: "40px",
        position: "absolute",
        width: "120px",
      },
    };
    expect(
      resolvePresentationTextMetricProps(
        base,
        [patch({ fontSize: 18 })],
        "Button",
      ),
    ).toBe(base);
    expect(
      resolvePresentationTextMetricProps(
        base,
        [patch({ lineHeight: 20 })],
        "Text",
        true,
      ),
    ).toBe(base);
    const relativeBase = {
      ...base,
      style: { ...base.style, position: "relative" },
    };
    expect(
      resolvePresentationTextMetricProps(
        relativeBase,
        [patch({ fontSize: 18 })],
        "Text",
      ),
    ).toBe(relativeBase);
  });
});

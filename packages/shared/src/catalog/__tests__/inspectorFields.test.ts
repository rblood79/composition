import { describe, expect, it } from "vitest";

import {
  buildInspectorFields,
  type InspectorFieldTheme,
} from "../outputs/inspectorFields";
import type { PropContract } from "../types";

// variant/size 값 집합 조회 mock (전환기엔 spec.variants/sizes keys, 목표엔 theme data-* rules)
const theme: InspectorFieldTheme = {
  resolveDimensionOptions(componentType, propKey) {
    if (componentType !== "Button") return [];
    if (propKey === "variant")
      return [
        { value: "primary", label: "Primary" },
        { value: "secondary", label: "Secondary" },
      ];
    if (propKey === "size")
      return [
        { value: "sm", label: "S" },
        { value: "md", label: "M" },
        { value: "lg", label: "L" },
      ];
    return [];
  },
};

const accepts: Record<string, PropContract> = {
  children: { kind: "string", label: "Text", section: "content" },
  variant: {
    kind: "variant",
    label: "Variant",
    section: "appearance",
    default: "primary",
  },
  size: { kind: "size", section: "appearance", default: "md" },
  fillStyle: {
    kind: "enum",
    label: "Fill",
    section: "appearance",
    options: [
      { value: "fill", label: "Fill" },
      { value: "outline", label: "Outline" },
    ],
  },
  type: { kind: "enum", label: "Type", section: "state", default: "button" },
  isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
};

describe("buildInspectorFields", () => {
  it("groups fields by section preserving first-appearance order", () => {
    const groups = buildInspectorFields("Button", accepts, theme);
    expect(groups.map((g) => g.section)).toEqual([
      "content",
      "appearance",
      "state",
    ]);
    expect(groups[1].fields.map((f) => f.key)).toEqual([
      "variant",
      "size",
      "fillStyle",
    ]);
  });

  it("resolves variant/size options from theme", () => {
    const groups = buildInspectorFields("Button", accepts, theme);
    const appearance = groups.find((g) => g.section === "appearance")!;
    const variant = appearance.fields.find((f) => f.key === "variant")!;
    const size = appearance.fields.find((f) => f.key === "size")!;
    expect(variant.options).toEqual([
      { value: "primary", label: "Primary" },
      { value: "secondary", label: "Secondary" },
    ]);
    expect(size.options?.map((o) => o.value)).toEqual(["sm", "md", "lg"]);
  });

  it("keeps explicit enum options (not theme-resolved)", () => {
    const groups = buildInspectorFields("Button", accepts, theme);
    const fill = groups
      .flatMap((g) => g.fields)
      .find((f) => f.key === "fillStyle")!;
    expect(fill.options).toEqual([
      { value: "fill", label: "Fill" },
      { value: "outline", label: "Outline" },
    ]);
  });

  it("defaults label to key and carries default/kind through", () => {
    const groups = buildInspectorFields("Button", accepts, theme);
    const size = groups.flatMap((g) => g.fields).find((f) => f.key === "size")!;
    expect(size.label).toBe("size"); // label 미지정 → key
    expect(size.default).toBe("md");
    expect(size.kind).toBe("size");
  });

  it("non-dimension/non-enum fields have no options", () => {
    const groups = buildInspectorFields("Button", accepts, theme);
    const text = groups
      .flatMap((g) => g.fields)
      .find((f) => f.key === "children")!;
    const disabled = groups
      .flatMap((g) => g.fields)
      .find((f) => f.key === "isDisabled")!;
    expect(text.options).toBeUndefined();
    expect(disabled.options).toBeUndefined();
  });
});

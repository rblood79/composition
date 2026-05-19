import { describe, expect, it } from "vitest";

import { buttonPrimitiveBinding } from "../primitives/button";
import { buildInspectorFieldSections } from "../outputs/inspectorFields";

describe("ADR-142 inspector field contracts", () => {
  it("groups Button PropContract entries by section", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Button",
      contracts: buttonPrimitiveBinding.props.accepts,
      theme: {
        variants: { Button: ["accent", "primary", "secondary"] },
        sizes: { Button: ["sm", "md", "lg"] },
      },
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Appearance",
      "State",
    ]);
    expect(sections[0].fields.map((field) => field.key)).toEqual(["children"]);
    expect(sections[1].fields.map((field) => field.key)).toEqual([
      "variant",
      "fillStyle",
      "size",
      "type",
    ]);
    expect(sections[2].fields.map((field) => field.key)).toEqual([
      "isDisabled",
      "isLoading",
    ]);
  });

  it("resolves variant and size values from the supplied theme lookup", () => {
    const sections = buildInspectorFieldSections({
      componentType: "Button",
      contracts: buttonPrimitiveBinding.props.accepts,
      theme: {
        variants: { Button: ["accent", "negative"] },
        sizes: { Button: ["xs", "xl"] },
      },
    });

    const fields = sections.flatMap((section) => section.fields);
    expect(fields.find((field) => field.key === "variant")?.options).toEqual([
      { value: "accent", label: "Accent" },
      { value: "negative", label: "Negative" },
    ]);
    expect(fields.find((field) => field.key === "size")?.options).toEqual([
      { value: "xs", label: "XS" },
      { value: "xl", label: "XL" },
    ]);
  });
});

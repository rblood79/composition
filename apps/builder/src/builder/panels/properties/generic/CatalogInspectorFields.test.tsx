import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buttonBinding, type InspectorFieldTheme } from "@composition/shared";

import { CatalogInspectorFields } from "./CatalogInspectorFields";

const theme: InspectorFieldTheme = {
  resolveDimensionOptions(_type, key) {
    if (key === "variant")
      return [
        { value: "primary", label: "Primary" },
        { value: "secondary", label: "Secondary" },
      ];
    return [
      { value: "sm", label: "S" },
      { value: "md", label: "M" },
      { value: "lg", label: "L" },
    ];
  },
};

describe("CatalogInspectorFields — ADR-142 #8 live 배선", () => {
  it("Button accepts(PropContract) 를 section 그룹 + kind별 컨트롤로 렌더한다", () => {
    const { container } = render(
      <CatalogInspectorFields
        componentType="Button"
        contracts={buttonBinding.props.accepts}
        theme={theme}
        currentProps={{ children: "OK" }}
        onUpdate={vi.fn()}
      />,
    );

    const text = container.textContent ?? "";
    // section 그룹 (first-appearance: content → appearance → state)
    expect(text).toContain("Content");
    expect(text).toContain("Appearance");
    expect(text).toContain("State");
    // binding accepts 의 필드 라벨
    expect(text).toContain("Text"); // children
    expect(text).toContain("Variant");
    expect(text).toContain("Size");
    expect(text).toContain("Type");
    expect(text).toContain("Pending"); // isPending
    expect(text).toContain("Disabled"); // isDisabled
  });
});

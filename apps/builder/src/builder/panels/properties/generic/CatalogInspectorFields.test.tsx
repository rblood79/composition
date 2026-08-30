import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buttonBinding,
  tableBinding,
  type InspectorFieldTheme,
} from "@composition/shared";

// PropertyDataBinding 은 stores/data 의 collection hook 에 의존 — 단위 렌더용 mock.
//   ADR-159 P4b: 소스 4종 → dataTable 단일 — useCollections 는 실제 hook 계약(배열) 반환.
vi.mock("../../../stores/data", () => ({
  useCollections: () => [{ name: "users", description: "Users collection" }],
}));

import { CatalogInspectorFields } from "./CatalogInspectorFields";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";

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

/** 표시 계층이 `useI18n` 을 쓰므로 provider 밑에서 그린다 (ADR-200 R7). */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("CatalogInspectorFields — ADR-142 #8 live 배선", () => {
  it("Button accepts(PropContract) 를 section 그룹 + kind별 컨트롤로 렌더한다", () => {
    const { container } = renderWithI18n(
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

  // ADR-912 회귀 복원: catalog cutover 후 kind:"binding"(dataBinding) 이 default:null 로
  //   빠져 collection 의 RSP Dynamic collections Data 소스 UI 가 소실됐던 회귀 가드.
  it('kind:"binding" dataBinding field 를 PropertyDataBinding(Data 소스 UI)로 렌더한다', () => {
    const { container } = renderWithI18n(
      <CatalogInspectorFields
        componentType="Table"
        contracts={tableBinding.props.accepts}
        theme={theme}
        currentProps={{}}
        onUpdate={vi.fn()}
      />,
    );

    const text = container.textContent ?? "";
    // Content 섹션 + dataBinding field(label "Data") 가 렌더되어야 한다.
    expect(text).toContain("Content");
    expect(text).toContain("Data");
    // PropertyDataBinding 의 컬렉션 피커 placeholder 가 DOM 에 존재 (no-op null 아님).
    //   ADR-159 P4b: 소스 선택 단계 제거 — 컬렉션(테이블명) 선택 단일.
    expect(text).toContain("Choose a collection");
  });
});

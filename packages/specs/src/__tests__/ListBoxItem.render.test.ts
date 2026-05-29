import { describe, expect, it } from "vitest";

import { ListBoxItemSpec } from "../components/ListBoxItem.spec";

describe("ListBoxItemSpec render.shapes ADR-146", () => {
  it("renders projected row text through the ListBoxItem renderer", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Aardvark", textValue: "Aardvark" },
      size,
      "default",
    );

    expect(shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: "Aardvark",
        }),
      ]),
    );
    expect(shapes.some((shape) => shape.type === "roundRect")).toBe(false);
  });

  it("renders selected projected rows with row background and a check indicator (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Cat", _isSelected: true },
      size,
      "default",
    );

    // ADR-147: selection-indicator slot = 우측 체크마크(icon_font "check").
    expect(shapes.map((shape) => shape.type)).toEqual([
      "roundRect",
      "text",
      "icon_font",
    ]);
    expect(
      shapes.some(
        (shape) => shape.type === "icon_font" && shape.iconName === "check",
      ),
    ).toBe(true);
  });

  it("renders an icon slot when props.icon is a resolved icon name (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Dog", icon: "star" },
      size,
      "default",
    );

    expect(
      shapes.some(
        (shape) => shape.type === "icon_font" && shape.iconName === "star",
      ),
    ).toBe(true);
  });

  it("does not render the icon slot for unresolved template placeholders (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Dog", icon: "{icon}" },
      size,
      "default",
    );

    expect(shapes.some((shape) => shape.type === "icon_font")).toBe(false);
  });

  it("does not render unresolved row template placeholders as visible text", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Aardvark", description: "{description}" },
      size,
      "default",
    );

    expect(
      shapes.some(
        (shape) => shape.type === "text" && shape.text === "{description}",
      ),
    ).toBe(false);
  });
});

describe("ListBoxItemSpec render.shapes layout consumption (ADR-147 방향 A)", () => {
  const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
  const firstTextX = (
    shapes: ReturnType<NonNullable<typeof ListBoxItemSpec.render>["shapes"]>,
  ) => shapes.find((s) => s.type === "text")?.x;
  const firstTextY = (
    shapes: ReturnType<NonNullable<typeof ListBoxItemSpec.render>["shapes"]>,
  ) => shapes.find((s) => s.type === "text")?.y;

  it("honors paddingLeft for the label x offset", () => {
    const shapes = ListBoxItemSpec.render!.shapes!(
      {
        children: "A",
        style: {
          paddingLeft: 40,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 4,
        },
      },
      size,
      "default",
    );
    expect(firstTextX(shapes)).toBe(40);
  });

  it("derives row height from vertical padding (label re-centers)", () => {
    const base = ListBoxItemSpec.render!.shapes!(
      {
        children: "A",
        style: {
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 12,
          paddingRight: 12,
        },
      },
      size,
      "default",
    );
    const tall = ListBoxItemSpec.render!.shapes!(
      {
        children: "A",
        style: {
          paddingTop: 20,
          paddingBottom: 20,
          paddingLeft: 12,
          paddingRight: 12,
        },
      },
      size,
      "default",
    );
    // 수직 패딩이 +16px (4→20) 이면 single-line label 중심도 +16px 내려간다.
    expect(firstTextY(tall)! - firstTextY(base)!).toBe(16);
  });

  it("honors rowGap for label↔description spacing", () => {
    const padding = {
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 12,
      paddingRight: 12,
    };
    const descGap = (
      shapes: ReturnType<NonNullable<typeof ListBoxItemSpec.render>["shapes"]>,
    ) => {
      const texts = shapes.filter((s) => s.type === "text");
      return (texts[1]!.y as number) - (texts[0]!.y as number);
    };
    const base = ListBoxItemSpec.render!.shapes!(
      { children: "A", description: "B", style: { ...padding, rowGap: 0 } },
      size,
      "default",
    );
    const wide = ListBoxItemSpec.render!.shapes!(
      { children: "A", description: "B", style: { ...padding, rowGap: 10 } },
      size,
      "default",
    );
    expect(descGap(wide) - descGap(base)).toBe(10);
  });
});

describe("ListBoxItemSpec render.shapes template preview (RAC 표준 origin)", () => {
  const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
  const texts = (
    shapes: ReturnType<NonNullable<typeof ListBoxItemSpec.render>["shapes"]>,
  ) => shapes.filter((s) => s.type === "text").map((s) => s.text);

  // origin(component-listbox-item-default) 은 children/description 가 `{label}`/`{description}`
  // template placeholder. 조합 자식 suppress 후 render.shapes 가 단일 렌더러이므로,
  // placeholder label 일 때 sample 콘텐츠로 RAC-표준 미리보기를 보여야 한다(빈 화면 방지).
  it("renders sample label/description when label is a template placeholder", () => {
    const shapes = ListBoxItemSpec.render!.shapes!(
      {
        children: "{label}",
        textValue: "{label}",
        description: "{description}",
      },
      size,
      "default",
    );
    expect(texts(shapes)).toContain("Label");
    expect(texts(shapes)).toContain("Description");
  });

  it("renders only the sample label when the template has no description", () => {
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "{label}", textValue: "{label}" },
      size,
      "default",
    );
    expect(texts(shapes)).toEqual(["Label"]);
  });

  // 데이터 행(실 label)은 sample 로 새지 않고 placeholder description/icon 필터 유지(회귀 방지).
  it("does NOT inject sample content for real data rows", () => {
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Aardvark", description: "{description}" },
      size,
      "default",
    );
    expect(texts(shapes)).toEqual(["Aardvark"]);
  });
});

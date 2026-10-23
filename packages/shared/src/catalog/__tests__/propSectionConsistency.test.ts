import { describe, expect, it } from "vitest";
import { componentCatalog } from "../componentCatalog";
import { RULE_TYPE_PROP_CONTRACTS } from "../document/itemLinks";
import type { PropContract } from "../types";

/**
 * 2026-10-13 (사용자 「이렇게 해서는 안된다. 컴퍼넌트별 프러퍼티 section이 일관성이 없다」 · 「checkbox는
 * error message가 behavior에 있고 다른컴퍼넌트는 error message가 content에 있다」): the Design panel
 * section of a prop is decided by what the prop means, the same for every component —
 *
 * - content: what it shows and the value it holds — its texts (label · description · error message ·
 *   placeholder …), its value and selection (value · Selected · Indeterminate · Selected Tab), the
 *   value's range and form (min · max · step · format · color space · channel), name, data, link.
 * - appearance: how it looks and is laid out.
 * - state (Behavior): how it reacts and what limits it — disabled · read only · required · invalid ·
 *   auto focus · selection mode · open / expanded · validation · triggers · submission.
 * - locale: locale and calendar settings. interaction: a Chart's animation and tooltip.
 *
 * So one prop key sits in one section on every component. The keys below name two different props.
 */
const SAME_NAME_DIFFERENT_PROP: Readonly<Record<string, string>> = {
  // A Button's `type` is its form action (submit · reset — Behavior); an input's is the kind of value
  // it takes (Content).
  type: "Button submit/reset vs input type",
  // A Form's `target` is where it submits (with Action · Method — Behavior); an item's is its link's.
  target: "Form submission vs link",
  // A collection's `dataBinding` is the rows its items repeat (Collection — 2026-10-23 「Collection
  // 섹션 분리」); a container's · Form's · Skeleton's · Chart's is the data its content reads (Content).
  dataBinding: "collection items vs content data",
};

function contracts(): Array<[string, string, PropContract]> {
  const rows: Array<[string, string, PropContract]> = [];
  for (const entry of componentCatalog)
    if (entry.kind === "primitive")
      for (const [key, contract] of Object.entries(
        entry.binding.props.accepts ?? {},
      ))
        if (!contract.editorHidden) rows.push([entry.type, key, contract]);
  for (const [type, accepts] of Object.entries(RULE_TYPE_PROP_CONTRACTS))
    for (const [key, contract] of Object.entries(accepts))
      if (!contract.editorHidden) rows.push([type, key, contract]);
  return rows;
}

describe("Design panel sections — one section per prop", () => {
  it("a prop key sits in the same section on every component", () => {
    const sections = new Map<string, Map<string, string[]>>();
    for (const [type, key, contract] of contracts()) {
      if (key in SAME_NAME_DIFFERENT_PROP) continue;
      const bySection = sections.get(key) ?? new Map<string, string[]>();
      const section = contract.section ?? "content";
      bySection.set(section, [...(bySection.get(section) ?? []), type]);
      sections.set(key, bySection);
    }
    const split = [...sections]
      .filter(([, bySection]) => bySection.size > 1)
      .map(
        ([key, bySection]) =>
          `${key}: ${[...bySection].map(([section, types]) => `${section}(${types.join(",")})`).join(" / ")}`,
      );
    expect(split).toEqual([]);
  });

  it("texts, values and selections are Content", () => {
    const content = [
      "label",
      "description",
      "errorMessage",
      "placeholder",
      "value",
      "isSelected",
      "isIndeterminate",
      "minValue",
      "maxValue",
      "defaultSelectedKey",
    ];
    const misplaced = contracts()
      .filter(
        ([, key, contract]) =>
          content.includes(key) && (contract.section ?? "content") !== "content",
      )
      .map(([type, key, contract]) => `${type}.${key}: ${contract.section}`);
    expect(misplaced).toEqual([]);
  });
});

/**
 * 2026-10-14 (사용자 「children 필드 이름이 …」 → 「RAC,RSC 레퍼런스에 dom 구조를 확인한다면」 →
 * 「진행해」): the name of a component's own text field (`children`) follows D2 — S2 1.8.0 calls it
 * "content", so Spectrum design-data answers: the text of a control, item or status is its **label**
 * (button `label` "Button text" · breadcrumbs item `label` · badge · status light `label` · table
 * column `label` "The header text displayed for the column"). A text element's own text is Text, a
 * part showing its owner's value is Value, a section's header is its Title (menu `sectionHeader`).
 * (A collection item has no text field — its text is its Text node's, 2026-10-14.)
 */
const CHILDREN_FIELD_NAME: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      "Button",
      "ToggleButton",
      "Link",
      "Breadcrumb",
      "FileTrigger",
      "Checkbox",
      "Radio",
      "Switch",
      "Badge",
      "StatusLight",
      "Column",
    ].map((type) => [type, "Label"]),
  ),
  ...Object.fromEntries(
    ["SelectValue", "SliderOutput", "MeterValue", "ProgressBarValue"].map(
      (type) => [type, "Value"],
    ),
  ),
  Header: "Title",
};

describe("Design panel — a component's own text field is named by what the text is", () => {
  it("Label for a control's · item's · status's text, Value for a value part, else Text", () => {
    const wrong = contracts()
      .filter(([, key]) => key === "children")
      .filter(
        ([type, , contract]) =>
          contract.label !== (CHILDREN_FIELD_NAME[type] ?? "Text"),
      )
      .map(([type, , contract]) => `${type}: ${contract.label}`);
    expect(wrong).toEqual([]);
  });
});

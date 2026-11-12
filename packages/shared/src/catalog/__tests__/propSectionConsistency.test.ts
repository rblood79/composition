import { describe, expect, it } from "vitest";
import { componentCatalog } from "../componentCatalog";
import { RULE_TYPE_PROP_CONTRACTS } from "../document/itemLinks";
import type { PropContract } from "../types";

/**
 * 2026-10-13 (사용자 「이렇게 해서는 안된다. 컴퍼넌트별 프러퍼티 section이 일관성이 없다」 · 「checkbox는
 * error message가 behavior에 있고 다른컴퍼넌트는 error message가 content에 있다」): the Design panel
 * section of a prop is decided by what the prop means, the same for every component —
 *
 * - content: what it shows — its texts (label · description · placeholder …), its glyph, data, link.
 * - value: what it holds now — the reference's own state (S2 · RAC controlled / default pairs): its
 *   value, selection (Selected · Indeterminate · Selected tab · Selected key(s)), open, expanded
 *   (사용자 결정 2026-11-12 「재배치」 — 2026-10-13 판정의 「value · selection = content」 ·
 *   「open / expanded = Behavior」 를 대체) — and the value's range and form (min · max · step ·
 *   granularity · placeholder value · color space · channel: 사용자 결정 2026-11-12 「섹션 병합」 —
 *   a date's range sits with a number's, one key one section). One concept, one field: the default
 *   twin of a pair the builder treats alike (`defaultOpen` · SegmentedControl `selectedKey` ·
 *   SelectBoxGroup `selectedKeys`) is accepted, not offered (사용자 결정 2026-11-12 「중복 제거」).
 * - appearance: how it looks and is laid out.
 * - state: how it reacts — disabled · read only · auto focus · selection mode · input type · link
 *   target. validation: what limits it — required · invalid · error message · pattern · length.
 *   forms: what it submits — name · a toggle's submit value. overlay: where and when its popover
 *   opens — direction · align · width · placement · close on select. accessibility: a meaning the
 *   visible label cannot give (a Column's row header).
 * - locale: locale, calendar and number format settings. interaction: a Chart's animation and tooltip.
 *
 * The panel shows fewer sections than there are meanings (사용자 결정 2026-11-12 「Property 탭 섹션
 * 병합」 — `GenericFieldRenderer` `SECTION_MEMBERS`): Content = content + appearance, Behavior = state ·
 * validation · forms · overlay · interaction · accessibility. The meaning stays per prop here.
 *
 * So one prop key sits in one section on every component. The keys below name two different props.
 */
const SAME_NAME_DIFFERENT_PROP: Readonly<Record<string, string>> = {
  // A Button's `type` is its form action (submit · reset — Behavior); an input's is the kind of value
  // it takes (Content).
  type: "Button submit/reset vs input type",
  // A Form's `target` is where it submits (with Action · Method — Behavior); an item's is its link's.
  target: "Form submission vs link",
  // A collection's · Chart's `dataBinding` is the rows its items · marks repeat (Collection — 2026-10-23
  // 「Collection 섹션 분리」, Chart 2026-11-12 「Property 탭 섹션 병합」 5단계); a container's · Form's ·
  // Skeleton's is the data its content reads (Content).
  dataBinding: "collection items vs content data",
  // A Chart's `color` is the data field its series come from (Collection); a swatch's is its color
  // value (Content).
  color: "chart series field vs color value",
  // A Checkbox · Switch `value` is what the form submits for it (forms), a Radio's is its key in the
  // group (Content); a field's · a group's · a slider's is what it holds (Value).
  value: "toggle submit value vs held value",
  // A picker's · menu's `align` is where its popover sits against the trigger (overlay); a
  // ButtonGroup's · Column's · Cell's is how its content is aligned (Appearance).
  align: "popover alignment vs content alignment",
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

  const misplacedOf = (keys: readonly string[], section: string) =>
    contracts()
      .filter(
        ([, key, contract]) =>
          keys.includes(key) && (contract.section ?? "content") !== section,
      )
      .map(([type, key, contract]) => `${type}.${key}: ${contract.section}`);

  it("texts are Content", () => {
    expect(
      misplacedOf(["label", "description", "placeholder"], "content"),
    ).toEqual([]);
  });

  // 사용자 결정 2026-11-12 「Property 탭 섹션 병합」 — the meanings Behavior holds.
  it("limits are validation, submission is forms, popover placement is overlay", () => {
    expect(
      misplacedOf(
        [
          "errorMessage",
          "isRequired",
          "isInvalid",
          "pattern",
          "minLength",
          "maxLength",
          "validationBehavior",
        ],
        "validation",
      ),
    ).toEqual([]);
    expect(
      misplacedOf(["name", "startName", "endName", "xName", "yName"], "forms"),
    ).toEqual([]);
    expect(
      misplacedOf(
        [
          "direction",
          "menuWidth",
          "placement",
          "offset",
          "crossOffset",
          "shouldFlip",
          "containerPadding",
          "shouldCloseOnSelect",
          "menuTrigger",
        ],
        "overlay",
      ),
    ).toEqual([]);
  });

  it("a value's range and form are Value (a date's with a number's)", () => {
    expect(
      misplacedOf(
        [
          "minValue",
          "maxValue",
          "step",
          "granularity",
          "placeholderValue",
          "colorSpace",
          "channel",
        ],
        "value",
      ),
    ).toEqual([]);
  });

  it("values, selections, open and expanded are Value", () => {
    const value = [
      "isSelected",
      "isIndeterminate",
      "defaultSelectedKey",
      "defaultSelectedKeys",
      "isOpen",
      "isExpanded",
      "defaultInputValue",
    ];
    const TOGGLES = new Set(["Checkbox", "Radio", "Switch"]);
    const misplaced = contracts()
      .filter(
        ([type, key, contract]) =>
          (value.includes(key) || (key === "value" && !TOGGLES.has(type))) &&
          contract.section !== "value",
      )
      .map(([type, key, contract]) => `${type}.${key}: ${contract.section}`);
    expect(misplaced).toEqual([]);
  });

  it("one field per concept — the builder treats a pair's twins alike", () => {
    const twins: Array<[string, string]> = [
      ["isOpen", "defaultOpen"],
      ["selectedKey", "defaultSelectedKey"],
      ["selectedKeys", "defaultSelectedKeys"],
      ["value", "defaultValue"],
      ["inputValue", "defaultInputValue"],
    ];
    const both: string[] = [];
    for (const entry of componentCatalog) {
      if (entry.kind !== "primitive") continue;
      const accepts = entry.binding.props.accepts ?? {};
      for (const [a, b] of twins)
        if (
          accepts[a] &&
          !accepts[a].editorHidden &&
          accepts[b] &&
          !accepts[b].editorHidden
        )
          both.push(`${entry.type}: ${a} + ${b}`);
    }
    expect(both).toEqual([]);
  });
});

/**
 * ADR-308 G3 (a) — a selection is its group's: only a standalone state keeps an `isSelected` (RAC's
 * own — ToggleButton · Checkbox · Switch · Card), and every selection · expansion group offers its
 * stored keys in Value (Decision 5). A collection item, a Tab, a Radio has none.
 */
describe("ADR-308 — the selection is the group's", () => {
  const accepts = (type: string) => {
    const entry = componentCatalog.find(
      (item) => item.kind === "primitive" && item.type === type,
    );
    return entry?.kind === "primitive"
      ? (entry.binding.props.accepts ?? {})
      : {};
  };
  it("isSelected stays on the standalone states only", () => {
    const owners = [
      ...componentCatalog.flatMap((entry) =>
        entry.kind === "primitive" && entry.binding.props.accepts?.isSelected
          ? [entry.type]
          : [],
      ),
      ...Object.entries(RULE_TYPE_PROP_CONTRACTS).flatMap(
        ([type, contracts]) => (contracts.isSelected ? [type] : []),
      ),
    ].sort();
    expect(owners).toEqual(["Card", "Checkbox", "Switch", "ToggleButton"]);
  });
  it.each([
    ["Tabs", "defaultSelectedKey"],
    ["SegmentedControl", "defaultSelectedKey"],
    ["ComboBox", "defaultSelectedKey"],
    ["Select", "value"],
    ["RadioGroup", "value"],
    ["CheckboxGroup", "value"],
    ["ListBox", "defaultSelectedKeys"],
    ["GridList", "defaultSelectedKeys"],
    ["Table", "defaultSelectedKeys"],
    ["Tree", "defaultSelectedKeys"],
    ["TagGroup", "defaultSelectedKeys"],
    ["Menu", "defaultSelectedKeys"],
    ["CardView", "defaultSelectedKeys"],
    ["ToggleButtonGroup", "defaultSelectedKeys"],
    ["SelectBoxGroup", "defaultSelectedKeys"],
    ["Tree", "expandedKeys"],
    ["Accordion", "expandedKeys"],
  ])("%s offers %s in Value", (type, key) => {
    const contract = accepts(type)[key];
    expect(contract?.section).toBe("value");
    expect(contract?.editorHidden).not.toBe(true);
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
      // S2 ActionButton · LinkButton (8586c64bd · 8ac17dc12) take Button's `children` contract.
      "ActionButton",
      "LinkButton",
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

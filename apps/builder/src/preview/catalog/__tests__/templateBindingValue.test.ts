import { expect, it } from "vitest";
import { bindTemplateValue } from "../../../../../../packages/shared/src/catalog/document/templateBindingValue";

it("whole origin bindings preserve object and array identity", () => {
  const range = { start: 15, end: 85 };
  const list = ["first", "second"];
  expect(bindTemplateValue("{range}", { range })).toBe(range);
  expect(bindTemplateValue("{items}", { items: list })).toBe(list);
});

it("embedded bindings stringify values and preserve absent bindings", () => {
  expect(
    bindTemplateValue("Range {start}–{end}; {missing}", { start: 15, end: 85 }),
  ).toBe("Range 15–85; {missing}");
  expect(bindTemplateValue("{missing}", {})).toBe("{missing}");
  expect(bindTemplateValue(false, {})).toBe(false);
});

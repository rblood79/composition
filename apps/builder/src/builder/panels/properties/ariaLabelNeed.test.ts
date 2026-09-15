import { describe, expect, it } from "vitest";
import { needsAuthoredAriaLabel } from "./ariaLabelNeed";

describe("needsAuthoredAriaLabel — RAC 가 이름을 못 만드는 경우만", () => {
  it("label prop 이 있는 타입은 label 이 비었을 때만", () => {
    expect(
      needsAuthoredAriaLabel({ type: "ProgressBar", props: {}, hasLabelField: true, children: [] }),
    ).toBe(true);
    expect(
      needsAuthoredAriaLabel({ type: "ProgressBar", props: { label: "Upload" }, hasLabelField: true, children: [] }),
    ).toBe(false);
    expect(
      needsAuthoredAriaLabel({ type: "TextField", props: { label: "  " }, hasLabelField: true, children: [] }),
    ).toBe(true);
  });

  it("컬렉션·그룹은 항상, 텍스트·장식·레이아웃은 숨김", () => {
    expect(needsAuthoredAriaLabel({ type: "Tabs", props: {}, hasLabelField: false, children: [] })).toBe(true);
    expect(needsAuthoredAriaLabel({ type: "Group", props: {}, hasLabelField: false, children: [] })).toBe(true);
    expect(needsAuthoredAriaLabel({ type: "Text", props: {}, hasLabelField: false, children: [] })).toBe(false);
    expect(needsAuthoredAriaLabel({ type: "Separator", props: {}, hasLabelField: false, children: [] })).toBe(false);
    expect(needsAuthoredAriaLabel({ type: "Checkbox", props: { children: "Agree" }, hasLabelField: false, children: [] })).toBe(false);
  });

  it("Button · ToggleButton · Link 는 아이콘 전용일 때만", () => {
    expect(needsAuthoredAriaLabel({ type: "Button", props: { children: "Save" }, hasLabelField: false, children: [] })).toBe(false);
    expect(
      needsAuthoredAriaLabel({ type: "Button", props: {}, hasLabelField: false, children: [{ type: "Icon" }, { type: "Text" }] }),
    ).toBe(false);
    expect(
      needsAuthoredAriaLabel({ type: "Button", props: {}, hasLabelField: false, children: [{ type: "Icon" }, { type: "Text", deleted: true }] }),
    ).toBe(true);
    expect(needsAuthoredAriaLabel({ type: "Link", props: { children: "" }, hasLabelField: false, children: [] })).toBe(true);
  });
});

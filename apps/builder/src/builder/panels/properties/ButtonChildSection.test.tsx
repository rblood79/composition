import { describe, it, expect } from "vitest";
import {
  BUTTON_CHILD_HOST_TAGS,
  findFirstIconChild,
  findFirstTextChild,
} from "./ButtonChildSection";

describe("ButtonChildSection gate", () => {
  it("Button/ToggleButton 만 host 대상", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("Button")).toBe(true);
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButton")).toBe(true);
  });

  it("ToggleButtonGroup / 비-button 은 host 아님", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButtonGroup")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Text")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Frame")).toBe(false);
  });
});

describe("findFirstIconChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstIconChild([])).toBeUndefined();
  });

  it("Icon 자식 없으면 undefined", () => {
    expect(
      findFirstIconChild([
        { id: "t1", type: "Text" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Icon 자식 반환", () => {
    const result = findFirstIconChild([
      { id: "t1", type: "Text" },
      { id: "i1", type: "Icon" },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i1");
  });

  it("삭제된 Icon 은 건너뛴다", () => {
    const result = findFirstIconChild([
      { id: "i1", type: "Icon", deleted: true },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i2");
  });
});

describe("findFirstTextChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstTextChild([])).toBeUndefined();
  });

  it("Text 자식 없으면 undefined", () => {
    expect(
      findFirstTextChild([
        { id: "i1", type: "Icon" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Text 자식 반환", () => {
    const result = findFirstTextChild([
      { id: "i1", type: "Icon" },
      { id: "t1", type: "Text" },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t1");
  });

  it("삭제된 Text 는 건너뛴다", () => {
    const result = findFirstTextChild([
      { id: "t1", type: "Text", deleted: true },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t2");
  });
});

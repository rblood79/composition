import { describe, expect, it } from "vitest";
import {
  ORIENTATION_DRIVEN_TAGS,
  isOrientationDrivenTag,
  flexDirectionToOrientation,
} from "./orientationDrivenTags";

describe("orientationDrivenTags", () => {
  describe("ORIENTATION_DRIVEN_TAGS 집합", () => {
    it("ToggleButtonGroup / Toolbar 만 포함 (소문자 정규화 저장)", () => {
      expect([...ORIENTATION_DRIVEN_TAGS].sort()).toEqual([
        "togglebuttongroup",
        "toolbar",
      ]);
    });

    it("ButtonGroup 은 포함하지 않는다 (SSOT 정반대 — 새 drift 방지)", () => {
      expect(ORIENTATION_DRIVEN_TAGS.has("buttongroup")).toBe(false);
    });

    it("CheckboxGroup / RadioGroup 은 포함하지 않는다 (2축 직교 비동형)", () => {
      expect(ORIENTATION_DRIVEN_TAGS.has("checkboxgroup")).toBe(false);
      expect(ORIENTATION_DRIVEN_TAGS.has("radiogroup")).toBe(false);
    });
  });

  describe("isOrientationDrivenTag — PascalCase 입력 정규화", () => {
    it("PascalCase 실데이터 표기를 인식한다", () => {
      expect(isOrientationDrivenTag("ToggleButtonGroup")).toBe(true);
      expect(isOrientationDrivenTag("Toolbar")).toBe(true);
    });

    it("소문자 표기도 인식한다", () => {
      expect(isOrientationDrivenTag("togglebuttongroup")).toBe(true);
    });

    it("비대상 / undefined 는 false", () => {
      expect(isOrientationDrivenTag("ButtonGroup")).toBe(false);
      expect(isOrientationDrivenTag("frame")).toBe(false);
      expect(isOrientationDrivenTag(undefined)).toBe(false);
    });
  });

  describe("flexDirectionToOrientation — 매핑 (derive 역방향)", () => {
    it("column → vertical", () => {
      expect(flexDirectionToOrientation("column")).toBe("vertical");
    });

    it("row → horizontal", () => {
      expect(flexDirectionToOrientation("row")).toBe("horizontal");
    });

    it("block → horizontal 흡수 (모델에 없는 값)", () => {
      expect(flexDirectionToOrientation("block")).toBe("horizontal");
    });
  });
});

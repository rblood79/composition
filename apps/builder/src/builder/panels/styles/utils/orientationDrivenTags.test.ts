import { describe, expect, it } from "vitest";
import {
  ORIENTATION_DRIVEN_TAGS,
  LABEL_POSITION_DRIVEN_TAGS,
  resolveDirectionDrivenProp,
  isDirectionDrivenTag,
  flexDirectionToDrivenValue,
  drivenValueToFlexDirection,
  resolveDrivenFlexDirection,
} from "./orientationDrivenTags";

describe("orientationDrivenTags", () => {
  describe("대상 집합", () => {
    it("ORIENTATION_DRIVEN_TAGS = ToggleButtonGroup / Toolbar (소문자 정규화)", () => {
      expect([...ORIENTATION_DRIVEN_TAGS].sort()).toEqual([
        "togglebuttongroup",
        "toolbar",
      ]);
    });

    it("LABEL_POSITION_DRIVEN_TAGS = RadioGroup / CheckboxGroup / field 8종 / TagGroup", () => {
      expect([...LABEL_POSITION_DRIVEN_TAGS].sort()).toEqual([
        "checkboxgroup",
        "colorfield",
        "datefield",
        "datepicker",
        "numberfield",
        "radiogroup",
        "searchfield",
        "taggroup",
        "textarea",
        "textfield",
        "timefield",
      ]);
    });

    it("ButtonGroup 은 어느 집합에도 없다 (SSOT 정반대 — 새 drift 방지)", () => {
      expect(ORIENTATION_DRIVEN_TAGS.has("buttongroup")).toBe(false);
      expect(LABEL_POSITION_DRIVEN_TAGS.has("buttongroup")).toBe(false);
    });

    it("ComboBox / DateRangePicker 는 미포함 (catalog variant 는 있으나 binding accepts 부재 → 편집 UI 비대칭)", () => {
      expect(LABEL_POSITION_DRIVEN_TAGS.has("combobox")).toBe(false);
      expect(LABEL_POSITION_DRIVEN_TAGS.has("daterangepicker")).toBe(false);
    });

    it("Select 는 미포함 (catalog label-position variant 자체 없음)", () => {
      expect(LABEL_POSITION_DRIVEN_TAGS.has("select")).toBe(false);
    });
  });

  describe("resolveDirectionDrivenProp — PascalCase 입력 정규화", () => {
    it("orientation-driven → 'orientation'", () => {
      expect(resolveDirectionDrivenProp("ToggleButtonGroup")).toBe(
        "orientation",
      );
      expect(resolveDirectionDrivenProp("Toolbar")).toBe("orientation");
    });

    it("labelPosition-driven (group) → 'labelPosition'", () => {
      expect(resolveDirectionDrivenProp("RadioGroup")).toBe("labelPosition");
      expect(resolveDirectionDrivenProp("CheckboxGroup")).toBe("labelPosition");
    });

    it("labelPosition-driven (field 8종) → 'labelPosition'", () => {
      for (const t of [
        "TextField",
        "TextArea",
        "NumberField",
        "SearchField",
        "ColorField",
        "DateField",
        "TimeField",
        "DatePicker",
      ]) {
        expect(resolveDirectionDrivenProp(t)).toBe("labelPosition");
      }
    });

    it("labelPosition-driven (TagGroup) → 'labelPosition'", () => {
      expect(resolveDirectionDrivenProp("TagGroup")).toBe("labelPosition");
    });

    it("소문자 표기도 인식한다", () => {
      expect(resolveDirectionDrivenProp("radiogroup")).toBe("labelPosition");
      expect(resolveDirectionDrivenProp("textfield")).toBe("labelPosition");
    });

    it("비대상 / undefined → undefined (일반 style 경로)", () => {
      expect(resolveDirectionDrivenProp("ButtonGroup")).toBeUndefined();
      expect(resolveDirectionDrivenProp("ComboBox")).toBeUndefined();
      expect(resolveDirectionDrivenProp("Select")).toBeUndefined();
      expect(resolveDirectionDrivenProp("DateRangePicker")).toBeUndefined();
      expect(resolveDirectionDrivenProp("frame")).toBeUndefined();
      expect(resolveDirectionDrivenProp(undefined)).toBeUndefined();
    });
  });

  describe("isDirectionDrivenTag — block disable 대상", () => {
    it("두 집합 모두 true (orientation + labelPosition)", () => {
      expect(isDirectionDrivenTag("ToggleButtonGroup")).toBe(true);
      expect(isDirectionDrivenTag("Toolbar")).toBe(true);
      expect(isDirectionDrivenTag("RadioGroup")).toBe(true);
      expect(isDirectionDrivenTag("CheckboxGroup")).toBe(true);
    });

    it("field 8종 + TagGroup 도 true (block disable 대상)", () => {
      for (const t of [
        "TextField",
        "TextArea",
        "NumberField",
        "SearchField",
        "ColorField",
        "DateField",
        "TimeField",
        "DatePicker",
        "TagGroup",
      ]) {
        expect(isDirectionDrivenTag(t)).toBe(true);
      }
    });

    it("비대상은 false", () => {
      expect(isDirectionDrivenTag("ButtonGroup")).toBe(false);
      expect(isDirectionDrivenTag("ComboBox")).toBe(false);
      expect(isDirectionDrivenTag("Select")).toBe(false);
      expect(isDirectionDrivenTag("DateRangePicker")).toBe(false);
      expect(isDirectionDrivenTag("frame")).toBe(false);
      expect(isDirectionDrivenTag(undefined)).toBe(false);
    });
  });

  describe("flexDirectionToDrivenValue — prop 별 매핑", () => {
    it("orientation: column→vertical / row→horizontal", () => {
      expect(flexDirectionToDrivenValue("orientation", "column")).toBe(
        "vertical",
      );
      expect(flexDirectionToDrivenValue("orientation", "row")).toBe(
        "horizontal",
      );
    });

    it("labelPosition: column→top / row→side", () => {
      expect(flexDirectionToDrivenValue("labelPosition", "column")).toBe("top");
      expect(flexDirectionToDrivenValue("labelPosition", "row")).toBe("side");
    });

    it("block → row 쪽 흡수 (orientation=horizontal, labelPosition=side)", () => {
      expect(flexDirectionToDrivenValue("orientation", "block")).toBe(
        "horizontal",
      );
      expect(flexDirectionToDrivenValue("labelPosition", "block")).toBe("side");
    });
  });

  describe("drivenValueToFlexDirection — 역방향 (패널 표시 SSOT read)", () => {
    it("orientation: vertical→column / horizontal→row", () => {
      expect(drivenValueToFlexDirection("orientation", "vertical")).toBe(
        "column",
      );
      expect(drivenValueToFlexDirection("orientation", "horizontal")).toBe(
        "row",
      );
    });

    it("labelPosition: top→column / side→row", () => {
      expect(drivenValueToFlexDirection("labelPosition", "top")).toBe("column");
      expect(drivenValueToFlexDirection("labelPosition", "side")).toBe("row");
    });

    it("labelPosition 미설정(default top)→column", () => {
      expect(drivenValueToFlexDirection("labelPosition", undefined)).toBe(
        "column",
      );
    });

    it("orientation 미설정→row (default horizontal)", () => {
      expect(drivenValueToFlexDirection("orientation", undefined)).toBe("row");
    });
  });

  describe("resolveDrivenFlexDirection — 패널 표시: stale inline 무시하고 SSOT 우선", () => {
    it("RadioGroup labelPosition:top → column (inline row 가 있어도 무시)", () => {
      expect(
        resolveDrivenFlexDirection("RadioGroup", {
          labelPosition: "top",
          style: { flexDirection: "row" },
        }),
      ).toBe("column");
    });

    it("RadioGroup labelPosition:side → row", () => {
      expect(
        resolveDrivenFlexDirection("RadioGroup", { labelPosition: "side" }),
      ).toBe("row");
    });

    it("ToggleButtonGroup orientation:vertical → column", () => {
      expect(
        resolveDrivenFlexDirection("ToggleButtonGroup", {
          orientation: "vertical",
        }),
      ).toBe("column");
    });

    it("TextField labelPosition:side → row (inline column 무시)", () => {
      expect(
        resolveDrivenFlexDirection("TextField", {
          labelPosition: "side",
          style: { flexDirection: "column" },
        }),
      ).toBe("row");
    });

    it("TextField labelPosition 미설정(default top) → column", () => {
      expect(resolveDrivenFlexDirection("TextField", {})).toBe("column");
    });

    it("TagGroup labelPosition:side → row", () => {
      expect(
        resolveDrivenFlexDirection("TagGroup", { labelPosition: "side" }),
      ).toBe("row");
    });

    it("비대상(ButtonGroup/ComboBox/frame)은 undefined (일반 inline 경로 fallback)", () => {
      expect(
        resolveDrivenFlexDirection("ButtonGroup", {
          style: { flexDirection: "row" },
        }),
      ).toBeUndefined();
      expect(
        resolveDrivenFlexDirection("ComboBox", { labelPosition: "side" }),
      ).toBeUndefined();
      expect(resolveDrivenFlexDirection("frame", {})).toBeUndefined();
    });
  });
});

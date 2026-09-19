import { describe, expect, it } from "vitest";
import {
  collapseTextWhiteSpace,
  collapsesSegmentBreaks,
  transformSegmentBreaks,
} from "../textWhiteSpace";

/**
 * ADR-027 후속 — `white-space: normal` + `\n`. 기대값은 Chrome 실측 (2026-09-20): segment break 는
 * 문자 종류와 무관하게 공백 1개, 연속 break 도 1개, 앞뒤 공백 흡수.
 */
describe("transformSegmentBreaks", () => {
  it("\\n · \\r\\n · \\r 을 공백 1개로, 주변 공백은 흡수", () => {
    expect(transformSegmentBreaks("가\n나")).toBe("가 나");
    expect(transformSegmentBreaks("漢\n字")).toBe("漢 字");
    expect(transformSegmentBreaks("a\r\nb\rc")).toBe("a b c");
    expect(transformSegmentBreaks("가 \n 나")).toBe("가 나");
    expect(transformSegmentBreaks("가\n\n\n나")).toBe("가 나");
  });
});

describe("collapseTextWhiteSpace", () => {
  it("normal · nowrap: segment break 접고 공백 run 1개, 줄 앞뒤 공백 제거", () => {
    const src = "  첫째 줄\n둘째   줄\n\n셋째 줄  ";
    expect(collapseTextWhiteSpace(src, "normal")).toBe(
      "첫째 줄 둘째 줄 셋째 줄",
    );
    expect(collapseTextWhiteSpace(src, "nowrap")).toBe(
      "첫째 줄 둘째 줄 셋째 줄",
    );
    expect(collapseTextWhiteSpace(src, undefined)).toBe(
      "첫째 줄 둘째 줄 셋째 줄",
    );
  });

  it("pre-line: \\n 보존, 공백 run 1개, 줄 앞뒤 공백 제거", () => {
    expect(collapseTextWhiteSpace("a  b \n  c\r\nd", "pre-line")).toBe(
      "a b\nc\nd",
    );
  });

  it("pre · pre-wrap: 그대로", () => {
    const src = "a  b \n  c";
    expect(collapseTextWhiteSpace(src, "pre")).toBe(src);
    expect(collapseTextWhiteSpace(src, "pre-wrap")).toBe(src);
  });

  it("collapsesSegmentBreaks 는 normal · nowrap · 미지정만", () => {
    expect(collapsesSegmentBreaks(undefined)).toBe(true);
    expect(collapsesSegmentBreaks("normal")).toBe(true);
    expect(collapsesSegmentBreaks("nowrap")).toBe(true);
    expect(collapsesSegmentBreaks("pre-line")).toBe(false);
    expect(collapsesSegmentBreaks("pre-wrap")).toBe(false);
  });
});

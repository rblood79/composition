import { describe, expect, test } from "vitest";
import { extractSpecTextStyle } from "../specTextStyle";

/**
 * A안 회귀 가드: TEXT_LEAF_TAGS(text/heading/paragraph/...) 의 size 변경이
 * layout height 로 전파되려면 extractSpecTextStyle 이 size 기준 fontSize 와
 * **px number 로 resolve 된 lineHeight** 를 반환해야 한다.
 *
 * 버그: Text 의 size 를 M→L 로 바꿔도 height 가 24px(=16*1.5) 로 고정.
 * 원인: layout 의 text leaf 경로가 spec size 를 읽지 않아 fontSize 16 fallback.
 */
describe("extractSpecTextStyle — TEXT_LEAF_TAGS size→fontSize/lineHeight (A안)", () => {
  test("text: md vs lg 는 fontSize/lineHeight 모두 size 를 따라 달라진다", () => {
    const md = extractSpecTextStyle("text", { size: "md", children: "x" });
    const lg = extractSpecTextStyle("text", { size: "lg", children: "x" });

    expect(md).not.toBeNull();
    expect(lg).not.toBeNull();

    // lineHeight 는 TokenRef 문자열이 아니라 px number 로 resolve 되어야 한다
    expect(typeof md!.lineHeight).toBe("number");
    expect(typeof lg!.lineHeight).toBe("number");

    // 토큰: text-base--line-height(24) < text-lg--line-height(28)
    expect(lg!.lineHeight!).toBeGreaterThan(md!.lineHeight!);

    // fontSize 도 size 를 반영 (text-base 16 < text-lg 18)
    expect(lg!.fontSize).toBeGreaterThan(md!.fontSize);
  });

  test("heading/paragraph/kbd/code 도 lineHeight 를 number 로 반환한다", () => {
    for (const tag of ["heading", "paragraph", "kbd", "code"]) {
      const md = extractSpecTextStyle(tag, { size: "md", children: "x" });
      expect(md, tag).not.toBeNull();
      expect(typeof md!.lineHeight, tag).toBe("number");
    }
  });
});

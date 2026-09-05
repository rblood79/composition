import { describe, expect, it } from "vitest";
import { getTextMeasurer } from "@/builder/workspace/canvas/utils/textMeasure";

/**
 * ADR-198 하니스 게이트 — tester 페이지와 Preview iframe 이 **같은 폰트**를 본다.
 *
 * 두 leg 의 폰트 문맥이 갈리면 케이스가 의도한 축이 아니라 폰트 로딩을 잰다
 * (`harness/setupFonts.ts` 의 배경). 그 격차는 조용하다 — 픽스처는 통과하고 값만
 * 틀린다 — 그래서 여기서 직접 본다.
 */
const TEXT = "Letter spacing changes where this line wraps.";

describe("tester 페이지 폰트 문맥", () => {
  it("앱 폰트(Pretendard)가 실제로 로드돼 있다", () => {
    expect(document.fonts.check('400 14px "Pretendard"')).toBe(true);
  });

  it("Canvas 2D 측정과 tester DOM 조판이 같은 폭을 낸다", () => {
    const skia = getTextMeasurer().measureWidth(TEXT, {
      fontSize: 14,
      fontFamily: "Pretendard",
      fontWeight: 400,
    } as never);

    const host = document.createElement("span");
    host.style.cssText =
      'position:absolute;white-space:nowrap;font-weight:400;font-size:14px;font-family:"Pretendard"';
    host.textContent = TEXT;
    document.body.appendChild(host);
    const dom = host.getBoundingClientRect().width;
    host.remove();

    expect(Math.abs(skia - dom)).toBeLessThan(1);
  });

  it("폴백 metric 이 아니다 — 폰트가 안 실리면 이 값이 달라진다", () => {
    const w = getTextMeasurer().measureWidth(TEXT, {
      fontSize: 14,
      fontFamily: "Pretendard",
      fontWeight: 400,
    } as never);
    // 실측 앵커. 폴백(시스템 sans)일 때는 255px 였다 (2026-09-05).
    expect(Math.round(w)).not.toBe(255);
  });
});

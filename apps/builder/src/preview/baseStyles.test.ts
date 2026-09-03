import { describe, expect, it } from "vitest";
import {
  PREVIEW_BASE_STYLES,
  PREVIEW_BASE_STYLES_ID,
  injectPreviewBaseStyles,
} from "./baseStyles";

/**
 * Preview 전역 reset 은 browser parity gate 의 DOM leg 이 같은 문자열로 싣는다
 * (tests/parity/adr923*.browser.test.ts). 여기서 universal border-box 가 빠지면
 * gate 가 production 에 없는 "content-box overflow" 를 만든다 (2026-09-03).
 */
describe("preview/baseStyles", () => {
  it("universal border-box reset 을 포함한다", () => {
    expect(PREVIEW_BASE_STYLES).toContain("* { box-sizing: border-box; }");
  });

  it("주입은 idempotent — 두 번 불러도 style 은 하나", () => {
    const doc = document.implementation.createHTMLDocument("t");
    injectPreviewBaseStyles(doc);
    injectPreviewBaseStyles(doc);
    const styles = doc.head.querySelectorAll(`#${PREVIEW_BASE_STYLES_ID}`);
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toBe(PREVIEW_BASE_STYLES);
  });
});

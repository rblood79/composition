import { describe, expect, it } from "vitest";
import {
  decorationMaskToCss,
  resolveOverlayFontFeatures,
  resolveCommittedWhiteSpace,
  resolveOverlayInitialText,
  resolveOverlayWrap,
} from "./overlayWrap";

/**
 * ADR-027 Phase D1 — 오버레이 wrap 은 Skia 가 paragraph 에 넘긴 입력에서 파생한다.
 * live (2026-09-20): 390px Text 긴 문장이 Skia 3줄 ↔ 오버레이 nowrap 1줄로 갈렸다.
 */
describe("resolveOverlayWrap — Skia text input → editor white-space", () => {
  it("Skia 기본 (whiteSpace 미지정 = normal) 은 폭에서 줄바꿈하는 pre-wrap", () => {
    expect(resolveOverlayWrap({})).toEqual({
      whiteSpace: "pre-wrap",
      wordBreak: "normal",
      overflowWrap: "normal",
      enterInsertsNewline: false,
      collapsesSegmentBreaks: true,
    });
  });

  it("nowrap / pre 는 Skia 가 100000 폭으로 layout 하므로 편집기도 한 줄", () => {
    expect(resolveOverlayWrap({ whiteSpace: "nowrap" }).whiteSpace).toBe(
      "nowrap",
    );
    expect(resolveOverlayWrap({ whiteSpace: "pre" }).whiteSpace).toBe("pre");
  });

  it("pre-line / pre-wrap 은 줄바꿈 문자를 두 consumer 가 다 그리므로 Enter 가 줄바꿈", () => {
    expect(
      resolveOverlayWrap({ whiteSpace: "pre-wrap" }).enterInsertsNewline,
    ).toBe(true);
    expect(
      resolveOverlayWrap({ whiteSpace: "pre-line" }).enterInsertsNewline,
    ).toBe(true);
    expect(resolveOverlayWrap({ whiteSpace: "pre" }).enterInsertsNewline).toBe(
      true,
    );
  });

  it("normal 에서 Enter 는 완료 — normal · nowrap 은 \\n 을 두 consumer 가 다 공백으로 접는다", () => {
    expect(
      resolveOverlayWrap({ whiteSpace: "normal" }).enterInsertsNewline,
    ).toBe(false);
    expect(
      resolveOverlayWrap({ whiteSpace: "nowrap" }).enterInsertsNewline,
    ).toBe(false);
  });

  it("wordBreak / overflowWrap 은 Skia 값을 그대로 옮긴다", () => {
    expect(
      resolveOverlayWrap({ wordBreak: "keep-all", overflowWrap: "anywhere" }),
    ).toMatchObject({ wordBreak: "keep-all", overflowWrap: "anywhere" });
  });
});

describe("TextEditOverlay consumes the wrap contract (static)", () => {
  it("editor root is container-wide and Enter defers to the contract", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const source = await readFile(
      resolve(__dirname, "TextEditOverlay.tsx"),
      "utf8",
    );
    expect(source).toContain('root.style.width = "100%"');
    expect(source).toContain(
      'root.style.whiteSpace = style.wrap?.whiteSpace ?? "nowrap"',
    );
    expect(source).toContain("if (style.wrap?.enterInsertsNewline) return;");
    expect(source).not.toContain('root.style.whiteSpace = "nowrap"');
  });
});

/**
 * ADR-027 후속 (2026-09-20) — normal Text 에 든 `\n` 은 Skia · DOM 이 공백으로 접어 2줄인데 Quill 은
 * 문단 경계로 그려 편집 진입 순간 8줄이 됐다. 편집기 초기값도 접는다 (segment break 만 — 공백 run 은
 * 편집 중 보존, pre 계열은 그대로).
 */
describe("resolveOverlayInitialText — normal · nowrap 은 \\n 을 공백으로", () => {
  const eight = Array.from({ length: 8 }, (_, i) => `줄 ${i + 1}`).join("\n");

  it("normal / nowrap: segment break → 공백 1개, 공백 run 은 그대로", () => {
    const wrap = resolveOverlayWrap({});
    expect(wrap.collapsesSegmentBreaks).toBe(true);
    expect(resolveOverlayInitialText(eight, wrap)).toBe(
      Array.from({ length: 8 }, (_, i) => `줄 ${i + 1}`).join(" "),
    );
    expect(resolveOverlayInitialText("a  b\n\nc", wrap)).toBe("a  b c");
    expect(
      resolveOverlayInitialText(
        "a\nb",
        resolveOverlayWrap({ whiteSpace: "nowrap" }),
      ),
    ).toBe("a b");
  });

  it("pre 계열: 그대로 (Enter 가 줄바꿈인 white-space)", () => {
    for (const whiteSpace of ["pre", "pre-wrap", "pre-line"] as const) {
      const wrap = resolveOverlayWrap({ whiteSpace });
      expect(wrap.collapsesSegmentBreaks).toBe(false);
      expect(resolveOverlayInitialText(eight, wrap)).toBe(eight);
    }
  });

  it("wrap 계약이 없으면 (Skia 노드 없음) 그대로", () => {
    expect(resolveOverlayInitialText(eight, undefined)).toBe(eight);
  });
});

describe("TextEditOverlay loads the collapsed initial text (static)", () => {
  it("setText 가 resolveOverlayInitialText 를 거친다", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const source = await readFile(
      resolve(__dirname, "TextEditOverlay.tsx"),
      "utf8",
    );
    expect(source).toContain(
      "const editorText = resolveOverlayInitialText(initialValue, style.wrap)",
    );
    expect(source).toContain('quill.setText(editorText, "api")');
    expect(source).not.toContain('quill.setText(initialValue, "api")');
  });
});

describe("decorationMaskToCss", () => {
  it("Skia 비트마스크를 CSS text-decoration-line 으로", () => {
    expect(decorationMaskToCss(undefined)).toBeUndefined();
    expect(decorationMaskToCss(0)).toBeUndefined();
    expect(decorationMaskToCss(1)).toBe("underline");
    expect(decorationMaskToCss(5)).toBe("underline line-through");
  });
});

/**
 * ADR-027 D3 — OpenType feature 채널. Skia paragraph 는 Pretendard cv02·03·04·11 (Preview body 와
 * 같은 값) 을 항상 싣지만 빌더 문서는 `--default-font-feature-settings` 가 없어 오버레이가
 * `normal` 이었다 — Latin 글리프 폭이 갈려 (Heading 205.94 ↔ 204.41 · 4줄 문장 2·4행 −0.89)
 * 200% 에서 ink 우측 3px 차. 한글만 있는 줄은 정확히 같았다.
 */
describe("resolveOverlayFontFeatures", () => {
  it("기본 cv 4개를 CSS font-feature-settings 로", () => {
    expect(resolveOverlayFontFeatures(undefined)).toBe(
      '"cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1',
    );
  });
  it("fontVariant 의 feature 를 Skia 와 같은 순서로 덧붙인다", () => {
    expect(resolveOverlayFontFeatures("small-caps")).toBe(
      '"cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1, "smcp" 1',
    );
  });
});

describe("TextEditOverlay consumes the font feature channel (static)", () => {
  it("root 에 fontFeatureSettings 를 싣는다", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const source = await readFile(
      resolve(__dirname, "TextEditOverlay.tsx"),
      "utf8",
    );
    expect(source).toContain("root.style.fontFeatureSettings");
  });
});

/**
 * Shift+Enter 가 normal Text 에 넣은 `\n` 은 커밋 때 white-space 를 pre 계열로 올려야 보인다
 * (사용자 live 2026-09-20: `\n\n` 이 저장됐지만 CSS·Skia 둘 다 접어 줄바꿈이 안 보였다).
 */
describe("resolveCommittedWhiteSpace — Shift+Enter 줄바꿈은 pre 계열로 승격", () => {
  it("normal / 미지정 + \\n → pre-wrap · nowrap + \\n → pre", () => {
    expect(resolveCommittedWhiteSpace(undefined, "a\nb")).toBe("pre-wrap");
    expect(resolveCommittedWhiteSpace("normal", "a\nb")).toBe("pre-wrap");
    expect(resolveCommittedWhiteSpace("nowrap", "a\nb")).toBe("pre");
  });
  it("\\n 없음 · 이미 pre 계열 → null (style 무변경)", () => {
    expect(resolveCommittedWhiteSpace("normal", "ab")).toBeNull();
    expect(resolveCommittedWhiteSpace("pre-wrap", "a\nb")).toBeNull();
    expect(resolveCommittedWhiteSpace("pre", "a\nb")).toBeNull();
    expect(resolveCommittedWhiteSpace("pre-line", "a\nb")).toBeNull();
  });
});

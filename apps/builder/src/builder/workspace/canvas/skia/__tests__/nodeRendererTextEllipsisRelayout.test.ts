import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-027 후속 6 — Truncate (nowrap + ellipsis + overflow hidden): nowrap 의 "큰 폭 layout 회피"
 * 재layout (intrinsic + 1) 이 ellipsis 문단에도 걸려 "…" 이 사라졌다 (Preview "ABCDEFG AB…" ↔
 * Canvas 678px 전부). CanvasKit 없이 도는 정적 게이트 — 동작 게이트는 하니스 `text-truncate`
 * (`adr027-text-edit-parity.mjs`: 한 줄 · 줄 폭 ≤ 상자 폭).
 */
describe("renderText — ellipsis 문단은 intrinsic 폭으로 다시 layout 하지 않는다 (static)", () => {
  it("큰 폭 재layout 분기가 isEllipsis 를 제외한다", async () => {
    const src = await readFile(
      resolve(__dirname, "../nodeRendererText.ts"),
      "utf8",
    );
    expect(src).toContain("if (layoutMaxWidth >= 100000 && !isEllipsis) {");
    expect(src).not.toMatch(/if \(layoutMaxWidth >= 100000\) \{/);
  });
});

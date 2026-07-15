import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Phase 2 — spec(Frame/Group/Slot 잔존 spec) 경로 applyInlineBorderOverlay 구조 불변식.
 *
 * 확정 결함: borderRadius 적용이 width/color gate(둘 다 필수) 뒤에 있어 radius 단독
 * 편집이 무반응이었고, borderStyle="none" 을 처리하지 않았다. 본 static guard 는
 * 재회귀(radius 를 다시 gate 뒤로 이동 / none 처리 제거)를 정적으로 차단한다.
 */
describe("applyInlineBorderOverlay — 구조 불변식 (Phase 2)", () => {
  it("borderRadius 반영이 borderWidth/borderColor gate 보다 먼저 위치 + none 처리 존재", async () => {
    const source = await readFile(
      resolve(__dirname, "../buildSpecNodeData.ts"),
      "utf-8",
    );

    const fnStart = source.indexOf("function applyInlineBorderOverlay");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, fnStart + 3500);

    // (1) radius override 는 width/color early-return 보다 앞서야 한다 (radius 단독 반영).
    const radiusIdx = fnBody.indexOf("style.borderRadius != null");
    const widthGateIdx = fnBody.indexOf(
      "const borderWidth = style.borderWidth",
    );
    const colorGateIdx = fnBody.indexOf("const borderColorStr");
    expect(radiusIdx).toBeGreaterThan(-1);
    expect(widthGateIdx).toBeGreaterThan(-1);
    expect(colorGateIdx).toBeGreaterThan(-1);
    expect(radiusIdx).toBeLessThan(widthGateIdx);
    expect(radiusIdx).toBeLessThan(colorGateIdx);

    // (2) borderStyle="none" 조기 종료(테두리 숨김)가 존재해야 한다.
    expect(fnBody).toContain('borderStyle === "none"');

    // (3) strokeStyle 은 8종 BorderStyleValue 로 캐스트 (구 "dashed"|"dotted" 협소 캐스트 금지).
    expect(fnBody).toContain("as BorderStyleValue");
    expect(fnBody).not.toContain('as "dashed" | "dotted"');
  });
});

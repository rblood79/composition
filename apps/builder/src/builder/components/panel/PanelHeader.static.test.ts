import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PanelHeader close action contract", () => {
  it("기존 actions 뒤에 공통 접근성 닫기 버튼을 렌더링한다", async () => {
    const source = await readFile(
      resolve(__dirname, "PanelHeader.tsx"),
      "utf-8",
    );
    const actionsIndex = source.indexOf("{actions}");
    const closeIndex = source.indexOf("<ActionIconButton", actionsIndex);

    expect(source).toContain("const handleClose =");
    expect(source).toContain('i18n.t("common.close")');
    expect(source).toContain("(actions || handleClose)");
    expect(actionsIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeGreaterThan(actionsIndex);
    expect(source).toContain("onPress={handleClose}");
    expect(source).toContain("aria-label={closeLabel}");
    expect(source).toContain("tooltip={closeLabel}");
  });
});

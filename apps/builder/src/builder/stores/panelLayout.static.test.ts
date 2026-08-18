import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Photoshop식 panel layout persistence 계약", () => {
  it("legacy modal을 floating으로 승격하고 다중 활성 dock을 임의로 초기화하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "panelLayout.ts"),
      "utf-8",
    );

    expect(source).toContain('mode: "floating" as const');
    expect(source).toContain("result.panelSizes");
    expect(source).toContain("result.panelClusters");
    expect(source).not.toContain("activeLeftPanels.length > 2");
    expect(source).not.toContain("activeRightPanels.length > 2");
    expect(source).not.toContain("너무 많은 패널이 활성화");
  });
});

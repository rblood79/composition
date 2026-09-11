import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ADR-212 HC5 — 편집기 구현은 `panelConfigs` 에 정적 import 로 들어오지 않는다. 정적 import
 * 하나면 chunk 분리가 무효가 되고 G5 (initial 안 editor bytes 0) 가 조용히 깨진다. 실제
 * 바이트는 `scripts/adr212-editor-initial-bytes.mjs` 가 production dist 로 잰다.
 */
describe("panelConfigs lazy 경계 (ADR-212 HC5)", () => {
  const source = readFileSync(resolve(__dirname, "panelConfigs.ts"), "utf8");

  it("DataTableEditorPanel · DataTableFieldPanel 은 dynamic import 로만 온다", () => {
    for (const name of ["DataTableEditorPanel", "DataTableFieldPanel"]) {
      expect(source).not.toMatch(
        new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`),
      );
      expect(source).toMatch(
        new RegExp(`import\\("\\.\\./datatable/${name}"\\)`),
      );
    }
  });

  it("목록 패널 (DataTablePanel) 은 editors 를 import 하지 않는다", () => {
    const panel = readFileSync(
      resolve(__dirname, "../datatable/DataTablePanel.tsx"),
      "utf8",
    );
    expect(panel).not.toMatch(/from "\.\/editors/);
  });
});

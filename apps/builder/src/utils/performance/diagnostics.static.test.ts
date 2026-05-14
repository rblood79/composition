import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("performance diagnostics bootstrap", () => {
  it("uses explicit initialization instead of monitor side-effect imports", async () => {
    const mainSource = await readFile(
      resolve(__dirname, "../../main.tsx"),
      "utf-8",
    );
    const diagnosticsSource = await readFile(
      resolve(__dirname, "diagnostics.ts"),
      "utf-8",
    );
    const indexSource = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    expect(mainSource).not.toContain('import "./utils/longTaskMonitor"');
    expect(mainSource).not.toContain('import "./utils/postMessageMonitor"');
    expect(mainSource).toContain("initPerformanceDiagnostics();");
    expect(diagnosticsSource).toContain("initLongTaskMonitorDiagnostics");
    expect(diagnosticsSource).toContain("initPostMessageMonitorDiagnostics");
    expect(indexSource).toContain("initPerformanceDiagnostics");
    expect(indexSource).toContain("globalPerformanceMonitor");
  });
});

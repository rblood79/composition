import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf8");
}

describe("ADR-187 Phase 2 migration guards", () => {
  it("capability/initial fills resolve는 session acquire에서만 수행하고 active input은 캡처값을 쓴다", async () => {
    // ADR-248 4e-7: the pilot target resolves through the Styles host's presentation bridge.
    const action = await source("../panels/styles/hooks/useFillActions.ts");
    const previewStart = action.indexOf(
      "const previewFirstFillColorPresentation",
    );
    const commitStart = action.indexOf(
      "const commitFirstFillColorPresentation",
    );
    const acquireGuard = action.indexOf("if (!presentation) {", previewStart);
    const resolvePilot = action.indexOf(
      "bridge?.resolveFillTarget(",
      acquireGuard,
    );
    const publish = action.indexOf("presentation.handle.publish", resolvePilot);
    const commitBody = action.slice(
      commitStart,
      action.indexOf("const previewFirstFillPaintPresentation", commitStart),
    );

    expect(acquireGuard).toBeGreaterThan(previewStart);
    expect(resolvePilot).toBeGreaterThan(acquireGuard);
    expect(publish).toBeGreaterThan(resolvePilot);
    expect(action.slice(previewStart, acquireGuard)).not.toContain(
      "bridge?.resolveFillTarget(",
    );
    expect(commitBody).not.toContain("bridge?.resolveFillTarget(");
    expect(action).toContain("baseFills: pilot.fills");
    expect(action).toContain("presentation.baseFills.map");
  });

  it("picker owner switch는 migrated owner 또는 commit-only fallback만 실행한다", async () => {
    const section = await source("../panels/styles/sections/FillSection.tsx");
    const picker = await source(
      "../panels/styles/components/ColorPickerPanel.tsx",
    );
    const previewGuard = section.indexOf(
      "previewFirstFillColorPresentation(firstFill.id, color, firstFill)",
    );
    const commitGuard = section.indexOf(
      "commitFirstFillColorPresentation(firstFill.id, color, firstFill)",
    );
    const legacyCommit = section.indexOf(
      "updateFill(firstFill.id",
      commitGuard,
    );
    expect(previewGuard).toBeGreaterThan(-1);
    expect(commitGuard).toBeGreaterThan(-1);
    expect(legacyCommit).toBeGreaterThan(commitGuard);
    expect(section).not.toContain("updateFillPreviewThrottled");
    expect(picker).toContain(
      "if (presentationOwnsFrameScheduling || livePreview)",
    );
    expect(picker).not.toContain("requestAnimationFrame");
    expect(picker).not.toContain("cancelAnimationFrame");
  });
});

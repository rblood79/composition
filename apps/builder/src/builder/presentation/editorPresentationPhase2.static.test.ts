import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path: string): Promise<string> {
  return readFile(resolve(__dirname, path), "utf8");
}

describe("ADR-187 Phase 2 migration guards", () => {
  it("pilot은 hidden query opt-in이며 production default를 바꾸지 않는다", async () => {
    const pilot = await source("editorPresentationFillPilot.ts");
    expect(pilot).toContain('FILL_PILOT_QUERY_PARAM = "adr187FillPilot"');
    expect(pilot).toContain("new URLSearchParams(window.location.search).has(");
    expect(pilot).not.toMatch(/\?\?\s*true|default.*true/i);
  });

  it("migrated owner는 runtime 외 RAF와 legacy preview write를 호출하지 않는다", async () => {
    const pilot = await source("editorPresentationFillPilot.ts");
    const bridge = await source("skiaEditorPresentationBridge.ts");
    const action = await source("../panels/styles/hooks/useFillActions.ts");

    expect(pilot).not.toContain("requestAnimationFrame");
    expect(bridge).not.toContain("requestAnimationFrame");
    expect(pilot).not.toMatch(/updateSelected.*Preview/);
    expect(bridge).not.toMatch(/updateSelected.*Preview/);
    expect(action).toContain("previewFirstFillColorPresentation");
    expect(action).toContain("presentation.handle.publish(descriptor)");
  });

  it("capability/initial fills resolve는 session acquire에서만 수행하고 active input은 캡처값을 쓴다", async () => {
    const action = await source("../panels/styles/hooks/useFillActions.ts");
    const previewStart = action.indexOf(
      "const previewFirstFillColorPresentation",
    );
    const commitStart = action.indexOf(
      "const commitFirstFillColorPresentation",
    );
    const acquireGuard = action.indexOf("if (!presentation) {", previewStart);
    const resolvePilot = action.indexOf(
      "resolveFillPresentationPilotTarget(",
      acquireGuard,
    );
    const publish = action.indexOf("presentation.handle.publish", resolvePilot);
    const commitBody = action.slice(
      commitStart,
      action.indexOf("const cancel", commitStart),
    );

    expect(acquireGuard).toBeGreaterThan(previewStart);
    expect(resolvePilot).toBeGreaterThan(acquireGuard);
    expect(publish).toBeGreaterThan(resolvePilot);
    expect(action.slice(previewStart, acquireGuard)).not.toContain(
      "resolveFillPresentationPilotTarget(",
    );
    expect(commitBody).not.toContain("resolveFillPresentationPilotTarget(");
    expect(action).toContain("baseFills: pilot.fills");
    expect(action).toContain("presentation.baseFills.map");
  });

  it("picker owner switch는 migrated/legacy 중 한 경로만 실행한다", async () => {
    const section = await source("../panels/styles/sections/FillSection.tsx");
    const picker = await source(
      "../panels/styles/components/ColorPickerPanel.tsx",
    );
    const previewGuard = section.indexOf(
      "if (previewFirstFillColorPresentation(firstFill.id, color)) return;",
    );
    const legacyPreview = section.indexOf(
      "updateFillPreviewThrottled(firstFill.id",
      previewGuard,
    );
    const commitGuard = section.indexOf(
      "if (commitFirstFillColorPresentation(firstFill.id, color)) return;",
    );
    const legacyCommit = section.indexOf(
      "updateFill(firstFill.id",
      commitGuard,
    );
    expect(previewGuard).toBeGreaterThan(-1);
    expect(legacyPreview).toBeGreaterThan(previewGuard);
    expect(commitGuard).toBeGreaterThan(-1);
    expect(legacyCommit).toBeGreaterThan(commitGuard);
    expect(picker).toContain("if (presentationOwnsFrameScheduling)");
    expect(picker.indexOf("if (presentationOwnsFrameScheduling)")).toBeLessThan(
      picker.indexOf("requestAnimationFrame", picker.indexOf("handleChange")),
    );
  });

  it("Skia publish consumer는 targeted in-place patch 외 forbidden rebuild 경로가 없다", async () => {
    const bridge = await source("skiaEditorPresentationBridge.ts");
    for (const forbidden of [
      "runCanonicalMutation",
      "historyManager",
      "layoutVersion",
      "registerSkiaNode",
      "forceFullRebuild",
      "invalidateCommandStreamCache",
      "updateSelectedFills",
    ]) {
      expect(bridge).not.toContain(forbidden);
    }
    expect(bridge).toContain(
      "this.#options.getProjectionIndex().resolve(descriptor.target)",
    );
    expect(bridge).toContain("subscribeSessionEvents");
    expect(bridge).toContain("applyPresentationFillPatch");
    expect(bridge).toContain("restorePresentationFillPatch");
  });

  it("store resync와 visible projection 경계가 presentation bridge에 연결된다", async () => {
    const canvas = await source("../workspace/canvas/skia/SkiaCanvas.tsx");
    const storeBridge = await source(
      "../workspace/canvas/skia/StoreRenderBridge.ts",
    );
    const rendererInput = await source(
      "../workspace/canvas/renderers/rendererInput.ts",
    );

    expect(storeBridge).toContain("onDidSync?.()");
    expect(canvas).toContain("onDidSync: () =>");
    expect(canvas).toContain("handleStoreSync(");
    expect(rendererInput).toContain("if (!pageSnapshot.isVisible) continue;");
    expect(rendererInput).toContain(
      "addPresentationProjection(builder, pageSnapshot.bodyElement)",
    );
    expect(rendererInput).toContain(
      "addPresentationProjection(builder, element)",
    );
    expect(rendererInput).toContain("visibleRenderIds.has(node.id)");
  });

  it("ref-descendant는 Phase 3까지 projection과 owner에서 제외한다", async () => {
    const projection = await source("skiaPresentationProjectionIndex.ts");
    const pilot = await source("editorPresentationFillPilot.ts");
    expect(projection).toContain(
      'if (target.kind !== "canonical-node") return EMPTY_RENDER_IDS',
    );
    expect(pilot).toMatch(
      /const target: EditorPresentationTargetRef = \{\s*kind: "canonical-node"/,
    );
    expect(pilot).not.toContain('kind: "ref-descendant"');
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ADR-137 selection consumer contract", () => {
  it("marks deferred selected element data as display-only", async () => {
    const inspectorTypes = await readFile(
      resolve(__dirname, "../inspector/types.ts"),
      "utf-8",
    );
    const storeSource = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    expect(inspectorTypes).toContain("ImmediateSelectionSnapshot");
    expect(inspectorTypes).toContain("DeferredSelectedElement");
    expect(storeSource).toContain("readImmediateSelectionSnapshot");
    expect(storeSource).toMatch(
      /useDebouncedSelectedElementData\s*=\s*\(\)\s*:\s*DeferredSelectedElement \| null/,
    );
  });

  it("keeps page-frame binding selection and explicit entrypoints separated", async () => {
    const bindingSource = await readFile(
      resolve(__dirname, "../../adapters/canonical/pageFrameBinding.ts"),
      "utf-8",
    );

    expect(bindingSource).toContain("applyPageFrameBindingFromSelection");
    expect(bindingSource).toContain("ApplyPageFrameBindingExplicitInput");
    expect(bindingSource).toMatch(
      /snapshot:\s*ImmediateSelectionSnapshot[\s\S]*frameId:\s*string \| null/,
    );
    expect(bindingSource).toMatch(/contextReason:\s*string/);
    expect(bindingSource).not.toContain(
      "applyPageFrameBindingCanonicalPrimary",
    );
  });
});

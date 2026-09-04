import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("instanceActions canonical-only read contract", () => {
  it("derives instance lookup and child lists only from active canonical elements", async () => {
    const source = await readFile(
      resolve(__dirname, "../instanceActions.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function getInstanceActionSourceElements");
    expect(source).toContain("function withInstanceActionSourceState");
    expect(source).toContain(
      "return getActiveCanonicalDocumentElements() ?? EMPTY_ELEMENTS",
    );
    expect(source).not.toContain("const { elements: legacyElements } = state");
    expect(source).toContain("function findInstanceActionElement");
    expect(source).toContain(
      "const elements = getInstanceActionSourceElements",
    );
    expect(source).toContain("getInstanceActionSourceElements().filter");
    expect(source).not.toContain(
      "state.elements.filter((element) => element.parent_id === parentId)",
    );

    const staleStateElementMap = ["state", ["elements", "Map"].join("")].join(
      ".",
    );
    const staleStateChildMap = ["state", ["children", "Map"].join("")].join(
      ".",
    );
    const staleGetterElementMap = ["get()", ["elements", "Map"].join("")].join(
      ".",
    );
    expect(source).not.toContain(staleStateElementMap);
    expect(source).not.toContain(staleStateChildMap);
    expect(source).not.toContain(staleGetterElementMap);
  });

  it("uses mergePropsWithStyleDeep for legacy detach instead of deprecated resolveInstanceProps", async () => {
    const source = await readFile(
      resolve(__dirname, "../instanceActions.ts"),
      "utf-8",
    );

    expect(source).toContain("mergePropsWithStyleDeep");
    expect(source).toContain("getComponentOverridesMirror");
    expect(source).not.toContain("resolveInstanceProps");
  });
});

describe("legacy model leaf cleanup static gates", () => {
  it("does not reintroduce deprecated resolveInstanceProps/Element exports", async () => {
    const source = await readFile(
      resolve(__dirname, "../../../../adapters/canonical/instanceResolver.ts"),
      "utf-8",
    );

    expect(source).not.toMatch(/export function resolveInstanceProps\b/);
    expect(source).not.toMatch(/export function resolveInstanceElement\b/);
  });

  it("keeps compositeCreation free of deprecated Element imports", async () => {
    const source = await readFile(
      resolve(__dirname, "../../../../services/ai/tools/compositeCreation.ts"),
      "utf-8",
    );

    expect(source).toContain("CompositeCreationNode");
    expect(source).not.toMatch(
      /import\s+type\s*\{[^}]*\bElement\b[^}]*\}\s*from\s*["'][^"']*(unified\.types|store\.types)["']/,
    );
  });

  it("does not reintroduce dead resolved layout tree item types", async () => {
    const source = await readFile(
      resolve(__dirname, "../../../../types/builder/layout.types.ts"),
      "utf-8",
    );

    for (const deadType of [
      "ResolvedSlotContent",
      "LayoutResolutionResult",
      "ResolvedElement",
      "PageTreeItem",
      "LayoutTreeItem",
      "SlotProps",
      "SlotInfo",
      "SlotValidationError",
      "EditMode",
      "EditContext",
      "EditModeStore",
      "NavigatorPanelTab",
    ]) {
      expect(source).not.toMatch(new RegExp(`\\binterface ${deadType}\\b`));
      expect(source).not.toMatch(new RegExp(`\\btype ${deadType}\\b`));
      expect(source).not.toMatch(new RegExp(`\\bexport type ${deadType}\\b`));
    }
  });

  it("owns EditMode UI types in editMode store, not layout.types", async () => {
    const editModeSource = await readFile(
      resolve(__dirname, "../../editMode.ts"),
      "utf-8",
    );
    expect(editModeSource).toMatch(/export type EditMode =/);
    expect(editModeSource).not.toContain("types/builder/layout.types");
  });

  it("routes canonical id lookups through cached canonical views", async () => {
    const canvasSource = await readFile(
      resolve(__dirname, "../../canvasStore.ts"),
      "utf-8",
    );
    const resetSource = await readFile(
      resolve(__dirname, "../../../panels/styles/hooks/useResetStyles.ts"),
      "utf-8",
    );
    const overlaySource = await readFile(
      resolve(__dirname, "../../../overlay/index.tsx"),
      "utf-8",
    );
    const viewSource = await readFile(
      resolve(__dirname, "../../canonical/canonicalElementsView.ts"),
      "utf-8",
    );

    expect(canvasSource).toContain("getCanonicalDocumentElementsView");
    expect(canvasSource).not.toContain("visitCanonicalDocumentElements");
    expect(resetSource).toContain("getNodeMap");
    expect(resetSource).toContain("getParent");
    expect(resetSource).not.toContain("getCanonicalDocumentElementsView");
    expect(resetSource).not.toContain("visitCanonicalDocumentElements");
    expect(overlaySource).toContain("getLastProjectableNodeById");
    expect(overlaySource).not.toContain("getCanonicalDocumentElementsView");
    expect(overlaySource).not.toContain("visitCanonicalDocumentElements");
    expect(viewSource).toContain(
      "return [...getCanonicalDocumentElementsView(doc).elements]",
    );
  });

  it("owns ref override helpers on ADR-127 traversal module", async () => {
    const traversalSource = await readFile(
      resolve(__dirname, "../../canonical/canonicalTraversalHelpers.ts"),
      "utf-8",
    );
    const historySource = await readFile(
      resolve(__dirname, "../../history/canonicalHistoryEvents.ts"),
      "utf-8",
    );
    const creationSource = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    expect(traversalSource).toMatch(
      /export function getCanonicalRefOverrideEntries\b/,
    );
    expect(historySource).toContain("canonicalTraversalHelpers");
    expect(creationSource).toContain("canonicalTraversalHelpers");
  });
});

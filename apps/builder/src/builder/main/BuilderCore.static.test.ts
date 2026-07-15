import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("BuilderCore canonical document direct cutover contract", () => {
  it("does not hydrate frame elements from legacy DB fallback in restored frame edit mode", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toContain(
      'from "@/adapters/canonical/frameElementLoader";',
    );
    expect(source).not.toContain("isLegacyFrameElementForFrame");
    expect(source).toMatch(/if \(editMode === "layout"\) \{/);
    expect(source).not.toContain("loadFrameElements");
    expect(source).not.toMatch(/elements: await loadFrameElements/);
    expect(source).not.toMatch(
      /const activeFrameId = getSelectedReusableFrameId\(\);/,
    );
    expect(source).not.toMatch(/const frameIds = Array\.from\(/);
    expect(source).not.toMatch(/layouts\.map\(\(layout\) => layout\.id\)/);
    expect(source).not.toContain("fetchLayouts");
    expect(source).not.toContain("currentLayoutId");
    expect(source).not.toContain("getDescendants(currentLayoutId)");
    expect(source).not.toContain("selectCanonicalDocument");
  });

  it("does not merge legacy frame fallback elements into the canonical document", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/\blayoutElements\b/);
    expect(source).not.toMatch(/\bmergedElements\b/);
    expect(source).not.toMatch(/setElementsCanonicalPrimary\(mergedElements\)/);
  });

  it("persists active CompositionDocument as primary storage and bridges page shell mutations", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    // documents.put 은 급감 가드 옵션(3번째 인자 { reason }) 을 받으므로 정확 문자열이 아닌
    //   prefix 매칭 — canonical document 를 primary storage 로 persist 하는 계약만 검증.
    //   (project-canonical-persist-loss-architecture: allowShrink/reason 가드 도입, 2026-07-14)
    expect(source).toMatch(/db\.documents\.put\(projectId, doc[,)]/);
    expect(source).toContain(
      "page shell mutations also update the canonical doc",
    );
    expect(source).toContain("hasPageShellTopologyChanged");
    expect(source).toMatch(
      /if \(!hasPageShellTopologyChanged\(pagesRef, state\.pages\)\) \{[\s\S]*?pagesRef = state\.pages;[\s\S]*?return;[\s\S]*?\}/,
    );
    expect(source).toContain("getActiveCanonicalBuilderElements");
    expect(source).toContain("getCanonicalOrBootstrapBuilderElements");
    expect(source).toContain("getPageShellBridgeElements");
    expect(source).toContain(
      "Page store mutations are the one remaining legacy page-shell surface.",
    );
    expect(source).toContain(
      "setElementsCanonicalPrimary(getPageShellBridgeElements(state))",
    );
    expect(source).toContain("missingPageBodyShells");
    expect(source).toMatch(/element\.type === "body"/);
    expect(source).toMatch(/pageIds\.has\(element\.page_id\)/);
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain("canonicalDocumentToElements");
    expect(source).not.toContain("canonicalElements ?? state.elements ?? []");
    expect(source).not.toContain(
      ["Array.from(state.", "elements", "Map.values())"].join(""),
    );
  });

  it("does not re-project canonical document during initial page hydrate", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain("pageShellBridgeSuspendedRef");
    expect(source).toMatch(
      /if \(pageShellBridgeSuspendedRef\.current\) return;/,
    );
    expect(source).toMatch(
      /pageShellBridgeSuspendedRef\.current = true;[\s\S]+const result = await initializeProject\(projectId\)\.finally\(\(\) => \{[\s\S]+pageShellBridgeSuspendedRef\.current = false;/,
    );
  });
});

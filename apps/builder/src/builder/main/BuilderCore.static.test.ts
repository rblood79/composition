import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("BuilderCore canonical document direct cutover contract", () => {
  it("legacy sidebar/modal hosts 대신 단일 PanelWorkspace를 사용한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toContain('import { PanelWorkspace } from "../layout"');
    expect(source).toContain("<PanelWorkspace");
    expect(source).toContain("chrome={");
    expect(source).not.toContain("<PanelArea");
    expect(source).not.toContain("<BottomPanelArea");
    expect(source).not.toContain("<ModalPanelContainer");
  });

  it("normal/compare/WebGL-off 모두 PanelWorkspace 안의 동일 Workspace main slot을 사용한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).toMatch(
      /<PanelWorkspace[\s\S]*?<Workspace[\s\S]*?<\/PanelWorkspace>/,
    );
    expect(source.match(/<Workspace\b/g)).toHaveLength(1);
    expect(source).not.toContain("{useWebGL ? (");
    expect(source).not.toMatch(/\) : \(\s*\/\* iframe Canvas/);
  });

  it("does not hydrate frame elements from legacy DB fallback in restored frame edit mode", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    expect(source).not.toContain(
      'from "@/adapters/canonical/frameElementLoader";',
    );
    expect(source).not.toContain("isLegacyFrameElementForFrame");
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

  it("initializes the data store on boot regardless of edit mode", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );

    // editMode 기본값은 "page" (stores/editMode.ts) 이므로 DataStore 초기화를
    // layout 게이트 안에 두면 일반 페이지 편집 boot 에서 통째로 skip 된다 →
    // collections 가 비어 PropertyDataBinding 컬렉션 피커가 "등록된 Collection 이
    // 없습니다." 로 표시되고, DataTable 패널을 한 번 열어야 채워진다.
    expect(source).not.toMatch(/if \(editMode === "layout"\) \{/);
    expect(source).not.toContain("useEditModeStore.getState().mode");
    expect(source).toContain(
      "useDataStore.getState().initializeForProject(projectId)",
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

describe("BuilderHeader history action ownership", () => {
  it("removes history UI from the global header and delegates it to HistoryPanel", async () => {
    const coreSource = await readFile(
      resolve(__dirname, "BuilderCore.tsx"),
      "utf-8",
    );
    const headerSource = await readFile(
      resolve(__dirname, "BuilderHeader.tsx"),
      "utf-8",
    );

    expect(headerSource).not.toContain('className="history-info"');
    expect(headerSource).not.toContain("historyInfo:");
    expect(headerSource).not.toContain('shortcutId="undo"');
    expect(headerSource).not.toContain('shortcutId="redo"');
    expect(headerSource).not.toContain("canUndo:");
    expect(headerSource).not.toContain("canRedo:");
    expect(coreSource).not.toContain("onUndo={handleUndo}");
    expect(coreSource).not.toContain("onRedo={handleRedo}");
    expect(coreSource).not.toContain("historyInfo={{");
  });
});

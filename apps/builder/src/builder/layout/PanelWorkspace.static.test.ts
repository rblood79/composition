import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Photoshop식 PanelWorkspace 계약", () => {
  const readWorkspace = () =>
    readFile(resolve(__dirname, "PanelWorkspace.tsx"), "utf-8");
  const readStyles = () =>
    readFile(resolve(__dirname, "PanelWorkspace.css"), "utf-8");
  const readSplitter = () =>
    readFile(resolve(__dirname, "PanelSplitter.tsx"), "utf-8");
  const readCanvasStyles = () =>
    readFile(resolve(__dirname, "../styles/layout/canvas.css"), "utf-8");

  it("모든 registry 패널을 하나의 안정된 frame과 Activity 경계로 유지한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("PanelRegistry.getAllPanels()");
    expect(source).toContain("configs.map((config) => (");
    expect(source).toContain('className="panel-dock"');
    expect(source).toContain('data-layout-type="floating"');
    expect(source).toMatch(/<SnapshotPanelFrame\s+[\s\S]*?key=\{config\.id\}/);
    expect(source).toContain("usePanelWorkspaceFrameSnapshot(");
    expect(source).toMatch(
      /<Activity mode=\{mode === "hidden" \? "hidden" : "visible"\}>/,
    );
    expect(source).toContain("<PanelComponent");
    expect(source).toContain("isActive={true}");
  });

  it("기존 PanelHeader 제목·action 구조와 rail toggle을 shell이 대체하지 않는다", async () => {
    const [source, styles, canvasStyles] = await Promise.all([
      readWorkspace(),
      readStyles(),
      readCanvasStyles(),
    ]);

    expect(source).toContain("onClose={undefined}");
    expect(source).not.toContain("panel-header:first-child");
    expect(source).not.toContain("panel-title");
    expect(styles).not.toContain(
      ".workspace-panel-content > * > .panel-header:first-child",
    );
    expect(canvasStyles).toContain(
      ".app :where(aside, .panel-workspace) .panel-header",
    );
    expect(source).toContain("style={{ zIndex: 2_100 }}");
  });

  it("모든 활성 패널을 React Aria move로 직접 이동하고 panel-relative snap target을 제공한다", async () => {
    const [source, styles, splitter] = await Promise.all([
      readWorkspace(),
      readStyles(),
      readSplitter(),
    ]);

    expect(source).toContain("useMove({");
    expect(source).toMatch(/<button\s+\{\.\.\.moveProps\}/);
    expect(source).toContain("runtime.resolveSnap(config.id, next)");
    expect(source).toContain("snapTarget?.panelId === config.id");
    expect(source).toContain("data-edge={snapTarget.edge}");
    expect(source).not.toContain("SNAP_EDGES.map");
    expect(source).toContain("data-active={isFirstDropTarget}");
    expect(source).toContain("data-active={isLastDropTarget}");
    expect(source).toContain("data-enabled={isDragging}");
    expect(styles).toMatch(
      /\.panel-dock-dropper\[data-enabled="true"\]\s*\{[\s\S]*?pointer-events: auto;/,
    );
    expect(styles).toContain("--panel-snap-color: var(--focus-ring)");
    expect(styles).toContain("height: 2px");
    expect(styles).toContain("width: 2px");
    expect(styles).toMatch(/\.panel-snap-target\s*\{[\s\S]*?border-radius: 0;/);
    expect(source).toContain('className="panel-snap-target"');
    expect(source).not.toContain("PanelDropZone");
    expect(source).not.toContain("useDrag({");
    expect(source).not.toContain("useDrop({");
    expect(source).not.toContain("querySelectorAll(");
    expect(source).not.toContain("getBoundingClientRect(");
    expect(source).toContain("<PanelSplitter");
    expect(splitter).toContain("useMove({");
    expect(splitter).toContain("useKeyboard({");
    expect(splitter).toContain('role="separator"');
    expect(splitter).toContain("aria-controls={controls}");
    expect(splitter).toContain("aria-valuemin={minValue}");
    expect(splitter).toContain("aria-valuemax={maxValue}");
  });

  it("viewport dock 대신 자유 위치 또는 인접 panel column/stack 관계를 persist한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("runtime.movePanel(config.id, next)");
    expect(source).toContain("runtime.snapPanel(");
    expect(source).toContain("onCommitLayout(runtime.endInteraction())");
    expect(source).toContain("data-clustered=");
    expect(source).toContain("runtime.cancelInteraction()");
    expect(source).not.toContain("EDGE_DOCK_THRESHOLD");
    expect(source).not.toContain("panel-dock-drop-zone");
    expect(source).not.toContain("ModalOverlay");
  });

  it("코너 한 점이 아니라 panel mode별 전체 edge를 resize handle로 제공한다", async () => {
    const [source, styles] = await Promise.all([readWorkspace(), readStyles()]);

    expect(source).toContain("snapshotFrame?.resizeEdges ?? []");
    expect(source).toContain("<PanelWorkspaceSharedSplitters");
    expect(source).toContain("snapshot.splitters.map((splitter)");
    expect(source).toContain("edge={edge}");
    expect(source).toContain("runtime.resizePanelFromReference(");

    expect(styles).toContain('[data-edge="left"]');
    expect(styles).toContain('[data-edge="right"]');
    expect(styles).toContain('[data-edge="top"]');
    expect(styles).toContain('[data-edge="bottom"]');
    expect(styles).toMatch(
      /\[data-edge="left"\],[\s\S]*?top: var\(--spacing-sm\);[\s\S]*?bottom: var\(--spacing-sm\);/,
    );
    expect(styles).toMatch(
      /\[data-edge="top"\],[\s\S]*?right: var\(--spacing-sm\);[\s\S]*?left: var\(--spacing-sm\);/,
    );
    expect(styles).toMatch(
      /\.panel-cluster-splitter\s*\{[\s\S]*?pointer-events: auto;/,
    );
    expect(styles).not.toContain('data-side="floating"');
  });

  it("cluster resize 중에는 인접 panel까지 transient layout으로 갱신하고 종료 시 한 번만 persist한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("recordPanelWorkspaceLayoutInput(");
    expect(source).toContain("mutation.value.affectedPanelIds");
    expect(source).toContain(
      "data-layout-version={snapshotFrame?.layoutVersion}",
    );
    expect(source).not.toContain("previewPanelClusterResize(");
    expect(source).not.toContain("resizePreviewLayout");
    expect(source).not.toContain("localStorage");
  });

  it("occupiedInsets를 공통 main track에 한 번 적용하고 legacy rail measure를 만들지 않는다", async () => {
    const [source, styles] = await Promise.all([readWorkspace(), readStyles()]);

    expect(source).toContain("usePanelWorkspaceLayoutSnapshot(");
    expect(source).toContain('className="panel-workspace-host"');
    expect(source).toContain('className="panel-workspace-main"');
    expect(source).toContain('"--panel-workspace-inset-left"');
    expect(source).toContain('"--panel-workspace-inset-right"');
    expect(source).toContain('"--panel-workspace-inset-bottom"');
    expect(source).not.toContain("registerPanelElement");
    expect(source).not.toContain("panel-rail-measure");
    expect(styles).toContain(".panel-workspace-host");
    expect(styles).toContain("grid-template-columns:");
    expect(styles).toContain("var(--panel-workspace-inset-left, 0px)");
    expect(styles).toContain("var(--panel-workspace-inset-bottom, 0px)");
  });

  it("공통 placement surface가 4px inset과 모든 frame의 단일 containing block을 소유한다", async () => {
    const [source, styles] = await Promise.all([readWorkspace(), readStyles()]);

    expect(source).toContain('className="panel-workspace-placement-surface"');
    expect(source).toContain("const origin = { x: 0, y: 0 }");
    expect(source).toContain("inset: 0");
    expect(styles).toContain("--panel-workspace-gap: 4px");
    expect(styles).toMatch(
      /\.panel-workspace-placement-surface\s*\{[\s\S]*?inset: var\(--panel-workspace-gap\);/,
    );
    expect(styles).toMatch(/\.panel-workspace\s*\{[\s\S]*?inset: 0;/);
    expect(styles).toMatch(/\.panel-dock-surface\s*\{[\s\S]*?inset: 0;/);
  });

  it("G2b 통과 뒤 모든 production frame이 coordinator snapshot만 소비한다", async () => {
    const source = await readWorkspace();

    expect(source).not.toContain("panelLayoutCanary");
    expect(source).toContain("createPanelWorkspaceRuntime(");
    expect(source).toContain("runtime.replaceCommittedLayout(workspaceLayout)");
    expect(source).not.toContain("createPanelWorkspaceRealFrameCanary");
  });

  it("shortcut scope와 DataTable activation이 legacy active array 대신 v2 visibility를 소비한다", async () => {
    const [activeScope, dataTableEditor] = await Promise.all([
      readFile(resolve(__dirname, "../hooks/useActiveScope.ts"), "utf-8"),
      readFile(
        resolve(
          __dirname,
          "../panels/datatable/stores/dataTableEditorStore.ts",
        ),
        "utf-8",
      ),
    ]);

    expect(activeScope).toContain("state.panelWorkspaceLayout");
    expect(activeScope).not.toContain("state.panelLayout");
    expect(dataTableEditor).toContain("setPanelWorkspacePanelVisibility(");
    expect(dataTableEditor).not.toContain("activeLeftPanels");
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Photoshop식 PanelWorkspace 계약", () => {
  const readWorkspace = () =>
    readFile(resolve(__dirname, "PanelWorkspace.tsx"), "utf-8");
  const readStyles = () =>
    readFile(resolve(__dirname, "PanelWorkspace.css"), "utf-8");
  const readCanvasStyles = () =>
    readFile(resolve(__dirname, "../styles/layout/canvas.css"), "utf-8");

  it("모든 registry 패널을 하나의 안정된 frame과 Activity 경계로 유지한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("PanelRegistry.getAllPanels()");
    expect(source).toMatch(/configs\.map\(\(config\) => \{/);
    expect(source).toMatch(/<PanelFrame\s+[\s\S]*?key=\{config\.id\}/);
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
  });

  it("모든 활성 패널을 React Aria move로 직접 이동하고 panel-relative snap target을 제공한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("useMove({");
    expect(source).toMatch(/<button\s+\{\.\.\.moveProps\}/);
    expect(source).toContain("const SNAP_EDGES: PanelSnapEdge[] = [");
    expect(source).toContain('"top", "right", "bottom", "left"');
    expect(source).toContain("findPanelSnapCandidate(");
    expect(source).toContain('className="panel-snap-target"');
    expect(source).not.toContain("PanelDropZone");
    expect(source).not.toContain("useDrag({");
    expect(source).not.toContain("useDrop({");
    expect(source).toContain('role="separator"');
    expect(source).toContain("aria-valuemin");
    expect(source).toContain("aria-valuemax");
  });

  it("viewport dock 대신 자유 위치 또는 인접 panel column/stack 관계를 persist한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("snapPanel(config.id, {");
    expect(source).toContain("placePanel(config.id, geometry)");
    expect(source).toContain("fitPanelClusters()");
    expect(source).toContain("data-clustered=");
    expect(source).toContain("updateModalPanelPosition(config.id,");
    expect(source).toContain("updatePanelSize(config.id,");
    expect(source).not.toContain("EDGE_DOCK_THRESHOLD");
    expect(source).not.toContain("panel-dock-drop-zone");
    expect(source).not.toContain("ModalOverlay");
  });

  it("코너 한 점이 아니라 panel mode별 전체 edge를 resize handle로 제공한다", async () => {
    const [source, styles] = await Promise.all([readWorkspace(), readStyles()]);

    expect(source).toContain('["left", "right", "bottom"]');
    expect(source).toContain('["right", "bottom"]');
    expect(source).toContain('["left", "bottom"]');
    expect(source).toContain(': ["top"]');
    expect(source).toContain("resizeEdges.map((edge)");
    expect(source).toContain("data-edge={edge}");
    expect(source).toContain("current.x + current.width - nextSize.width");
    expect(source).toMatch(
      /if \(mode === "placed"\) \{\s*updateModalPanelPosition\(config\.id,/,
    );

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
    expect(styles).not.toContain('data-side="floating"');
  });

  it("cluster resize 중에는 인접 panel까지 transient layout으로 갱신하고 종료 시 한 번만 persist한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain("previewPanelClusterResize(");
    expect(source).toContain("resizePreviewLayout ?? layout");
    expect(source).toContain("onResizeSessionPreview(config.id, edge, next)");
    expect(source).toMatch(
      /if \(onResizeSessionEnd\(config\.id\)\) return;[\s\S]*?updatePanelSize\(config\.id,/,
    );
    expect(source).toMatch(
      /const endResizeSession = useCallback\([\s\S]*?setLayout\(previewLayout\);[\s\S]*?return true;/,
    );
  });

  it("Canvas inset 측정에는 panel frame이 아니라 기존 rail 너비만 전달한다", async () => {
    const source = await readWorkspace();

    expect(source).toContain('registerPanelElement("left", element)');
    expect(source).toContain('registerPanelElement("right", element)');
    expect(source).toContain("style={{ width: PANEL_RAIL_SIZE }}");
    expect(source).not.toContain("activeLeftPanels.reduce");
    expect(source).not.toContain("activeRightPanels.reduce");
  });
});

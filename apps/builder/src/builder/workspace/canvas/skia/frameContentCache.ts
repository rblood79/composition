import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import { countFrameEvent } from "./frameCapture";

/** renderer 인스턴스 소유의 한 세대 CPU 파생물. WASM/picture나 camera는 보관하지 않는다. */
export class FrameContentCache {
  private filtered: Map<string, string[]> | null = null;
  private nodes: Map<string, CanvasSceneNode> | null = null;
  private synthetic: ReadonlyMap<string, CanvasLayoutNode> | null = null;
  private registryVersion = -1;
  private layoutVersion = -1;
  private children: Map<string, CanvasSceneNode[]> | null = null;

  clear(): void {
    this.filtered = null;
    this.nodes = null;
    this.synthetic = null;
    this.children = null;
  }

  readChildren(
    filtered: Map<string, string[]>,
    nodes: Map<string, CanvasSceneNode>,
    synthetic: ReadonlyMap<string, CanvasLayoutNode>,
    registryVersion: number,
    layoutVersion: number,
  ): Map<string, CanvasSceneNode[]> {
    if (
      this.children &&
      this.filtered === filtered &&
      this.nodes === nodes &&
      this.synthetic === synthetic &&
      this.registryVersion === registryVersion &&
      this.layoutVersion === layoutVersion
    ) {
      countFrameEvent("childrenCacheHit");
      return this.children;
    }
    const children = new Map<string, CanvasSceneNode[]>();
    for (const [parentId, childIds] of filtered) {
      const result: CanvasSceneNode[] = [];
      for (const id of childIds) {
        const node = nodes.get(id) ?? synthetic.get(id);
        if (node) result.push(node as CanvasSceneNode);
      }
      children.set(parentId, result);
    }
    this.filtered = filtered;
    this.nodes = nodes;
    this.synthetic = synthetic;
    this.registryVersion = registryVersion;
    this.layoutVersion = layoutVersion;
    this.children = children;
    countFrameEvent("childrenCacheBuild");
    return children;
  }
}

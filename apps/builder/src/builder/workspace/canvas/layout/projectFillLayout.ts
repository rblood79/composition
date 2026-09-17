import { resolveFillProjection } from "@composition/shared";
import { resolveContainerStylesFallback } from "./engines/implicitStyles";
import type { CanvasLayoutNode } from "./layoutNode";

/** breakpoint/ref 해석 후, 캐시 시그니처와 엔진이 동일 projection을 소비한다. */
export function projectFillLayoutNodes(
  nodes: Map<string, CanvasLayoutNode>,
): void {
  const styles = new Map<string, Record<string, unknown>>();
  const styleOf = (node: CanvasLayoutNode): Record<string, unknown> => {
    let style = styles.get(node.id);
    if (!style) {
      const inline = (node.props.style ?? {}) as Record<string, unknown>;
      style = {
        ...resolveContainerStylesFallback(
          node.type.toLowerCase(),
          inline,
          String(node.props.size ?? "md"),
        ),
        ...inline,
      };
      styles.set(node.id, style);
    }
    return style;
  };
  for (const [id, node] of nodes) {
    if (!node.sizing?.width && !node.sizing?.height) continue;
    let parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    const visited = new Set<string>([id]);
    let parentStyle: Record<string, unknown> = {};
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      parentStyle = styleOf(parent);
      if (parentStyle.display !== "contents") break;
      parent = parent.parent_id ? nodes.get(parent.parent_id) : undefined;
    }
    const context = {
      display: String(parentStyle.display ?? "block"),
      flexDirection: String(parentStyle.flexDirection ?? "row"),
      writingMode: String(parentStyle.writingMode ?? "horizontal-tb"),
    };
    const style = styleOf(node);
    const projected = resolveFillProjection(node.sizing, style, context);
    if (!Object.keys(projected).length) continue;
    // 원본은 재사용하고 changed node만 복사한다. 저장·강제 DOM 측정은 없다.
    nodes.set(id, {
      ...node,
      props: {
        ...node.props,
        style: {
          ...((node.props.style ?? {}) as Record<string, unknown>),
          ...projected,
        },
      },
    });
  }
}

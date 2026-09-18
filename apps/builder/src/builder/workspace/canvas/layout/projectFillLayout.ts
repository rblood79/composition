import {
  getSizingEffectiveStyle,
  hasDefiniteAxisSize,
  resolveFillProjection,
  type FillParentContext,
} from "@composition/shared";
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
        ...getSizingEffectiveStyle(node, "desktop"),
        ...inline,
      };
      styles.set(node.id, style);
    }
    return style;
  };
  for (const [id, node] of nodes) {
    // Fill 시스템이 만진 노드 = 축이 정의된 노드 (marker 또는 명시 null). null 도 Ratio 종속 축의
    // stretch 보호 (`alignSelf: start`) 를 받아야 Preview (`createFillTreeResolver`, skip 없음) 와
    // 같다 — truthiness 로 걸렀을 때 resize 뒤 `{width:null,height:null}` 이 Canvas 240 / DOM 210.
    if (node.sizing?.width === undefined && node.sizing?.height === undefined)
      continue;
    let parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    const visited = new Set<string>([id]);
    let parentStyle: Record<string, unknown> = {};
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      parentStyle = styleOf(parent);
      if (parentStyle.display !== "contents") break;
      parent = parent.parent_id ? nodes.get(parent.parent_id) : undefined;
    }
    // 부모 두 축의 definiteness — hug 부모의 fraction Fill 은 basis auto (shared 와 같은 판정)
    let definite: FillParentContext["definite"];
    if (parent) {
      let grand = parent.parent_id ? nodes.get(parent.parent_id) : undefined;
      const seen = new Set<string>([parent.id]);
      let grandStyle: Record<string, unknown> | null = null;
      while (grand && !seen.has(grand.id)) {
        seen.add(grand.id);
        grandStyle = styleOf(grand);
        if (grandStyle.display !== "contents") break;
        grand = grand.parent_id ? nodes.get(grand.parent_id) : undefined;
      }
      const grandContext = grandStyle
        ? {
            display: String(grandStyle.display ?? "block"),
            flexDirection: String(grandStyle.flexDirection ?? "row"),
            writingMode: String(grandStyle.writingMode ?? "horizontal-tb"),
          }
        : undefined;
      definite = {
        width: hasDefiniteAxisSize(
          parent,
          parentStyle,
          "width",
          "desktop",
          grandContext,
        ),
        height: hasDefiniteAxisSize(
          parent,
          parentStyle,
          "height",
          "desktop",
          grandContext,
        ),
      };
    }
    const context: FillParentContext = {
      display: String(parentStyle.display ?? "block"),
      flexDirection: String(parentStyle.flexDirection ?? "row"),
      writingMode: String(parentStyle.writingMode ?? "horizontal-tb"),
      ...(definite ? { definite } : {}),
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

import type { CanvasSceneNode } from "./canvasSceneNode";

/** Components는 디자인 원본을 펼쳐 보여준다. 런타임 초기 상태는 문서 그대로 유지한다. */
export function projectDialogVisibility(
  nodes: CanvasSceneNode[],
  componentsPage: boolean,
): CanvasSceneNode[] {
  if (componentsPage) return nodes;
  const closed = new Set(
    nodes
      .filter(
        (node) =>
          node.type === "DialogTrigger" &&
          !(node.props?.isOpen ?? node.props?.defaultOpen),
      )
      .map((node) => node.id),
  );
  if (closed.size === 0) return nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const hidden = new Map<string, boolean>();
  const isHidden = (node: CanvasSceneNode): boolean => {
    if (hidden.has(node.id)) return hidden.get(node.id)!;
    const parent = byId.get(node.parent_id ?? "");
    const value =
      !!parent &&
      ((node.type === "Dialog" && closed.has(parent.id)) || isHidden(parent));
    hidden.set(node.id, value);
    return value;
  };
  return nodes.filter((node) => !isHidden(node));
}

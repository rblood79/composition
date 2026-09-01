/**
 * @fileoverview ColorField parent `label` 보충 hydration migration (ADR-923 r16m1, 2026-09-01).
 *
 * 배경: ColorField factory 는 canonical Label 자식(children "Color")만 만들고 parent 에 `label` 을
 *   두지 않았다 (형제 field 9종은 parent label + Label 자식 둘 다). Preview 는 parent `label` 로
 *   RAC ColorField 를 self-compose 하므로 기존 직렬화 문서의 ColorField 는 Preview 무라벨 /
 *   Skia·레이아웃 "Color" 로 갈렸다. factory 는 parent `label: "Color"` 를 갖게 됐고 propagation
 *   `label → Label.children`(override) 이 parent 를 SSOT 로 자식에 잇는다 — 본 migration 은 기존
 *   문서의 parent 에 `label` 이 없을 때 Label 자식 텍스트로 채워 같은 상태로 올린다.
 *
 * 적용 대상: `type: "ColorField"` 이고 `props.label` 이 없는(undefined) 노드 + 직접 Label 자식의
 *   `children` 이 비어있지 않은 문자열일 때만. parent 에 label 이 있으면(빈 문자열 포함 — 사용자가
 *   비운 것) 건드리지 않는다. 시각 변화: Preview 가 builder 가 이미 보이던 라벨을 함께 보인다.
 *
 * 멱등 — 채울 게 없으면 동일 참조를 반환한다. 선례: migrateFieldInlineLayout (DFS 멱등 patch).
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

function labelChildText(node: CanonicalNode): string | undefined {
  const label = node.children?.find((c) => c.type === "Label");
  const text = (label?.props as Record<string, unknown> | undefined)?.children;
  return typeof text === "string" && text !== "" ? text : undefined;
}

/**
 * ColorField parent 에 `label` 이 없으면 Label 자식 텍스트로 채운다.
 *
 * @param document - canonical CompositionDocument
 * @returns 채운 노드가 있었으면 새 document, 없었으면 동일 참조 (멱등)
 */
export function migrateColorFieldParentLabel(
  document: CompositionDocument,
): CompositionDocument {
  let changed = false;

  function migrateNode(node: CanonicalNode): CanonicalNode {
    const children = node.children?.map(migrateNode);
    const childrenChanged =
      children !== undefined &&
      children.some((c, i) => c !== node.children?.[i]);

    let props = node.props;
    if (node.type === "ColorField") {
      const current = (node.props as Record<string, unknown> | undefined)
        ?.label;
      const fromChild = labelChildText(node);
      if (current === undefined && fromChild !== undefined) {
        props = { ...node.props, label: fromChild };
        changed = true;
      }
    }

    if (props === node.props && !childrenChanged) return node;
    return children ? { ...node, props, children } : { ...node, props };
  }

  const nextChildren = document.children.map(migrateNode);
  if (!changed) return document;
  return { ...document, children: nextChildren };
}

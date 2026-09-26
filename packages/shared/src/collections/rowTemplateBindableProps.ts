import { shouldFoldSlotChildren } from "../catalog/slotRoles";
import {
  compileFieldTemplate,
  interpolateCollectionRowTemplate,
} from "./fieldTemplate";
import type { CollectionFieldRoles } from "./resolveCollectionItems";

/**
 * ADR-162 — 데이터 행이 항목 origin 자식을 펼칠 때 `{field}` 보간을 적용하는 prop 허용표 (한 곳).
 *
 * Canvas 투영 · DOM 렌더 · 패널 컬럼 연결이 같은 상수를 읽는다. 모든 string prop 을 보간하면 사용자가 쓴
 * `{`…`}` 글자까지 바뀌므로 내용을 싣는 prop 만 둔다 (Text · Button · Badge · Link · StatusLight 의
 * `children` · Link `href` · Image · Avatar `src`/`alt` · Avatar `initials` · Icon `iconName`, 2026-09-26
 * Phase 0 inventory). 파싱은 ADR-159 `compileFieldTemplate` / `interpolateFieldTemplate` 두 심볼만.
 */
export const ROW_TEMPLATE_BINDABLE_PROP_KEYS = [
  "children",
  "text",
  "label",
  "description",
  "href",
  "src",
  "alt",
  "initials",
  "iconName",
] as const;

export type RowTemplateBindablePropKey =
  (typeof ROW_TEMPLATE_BINDABLE_PROP_KEYS)[number];

/**
 * 항목 origin 자식을 데이터 행마다 펼치는가 — 자식이 있고 전부 slot 역할은 아닐 때 (Canvas 투영 ·
 * Preview 렌더 · layout 이 같은 판정). 전부 slot 이면 종전 경로 (escape · label/설명 두 칸 — BC).
 */
export function shouldExpandRowTemplate(
  children: readonly unknown[] | null | undefined,
): boolean {
  return (children?.length ?? 0) > 0 && !shouldFoldSlotChildren(children);
}

interface RowTemplateTreeNode {
  props?: unknown;
  children?: readonly unknown[];
}

/**
 * origin 자식 트리를 행 데이터로 보간한 사본 (Preview). 허용표 prop 의 `{field}` 만 바꾸고 나머지는
 * 그대로 — Canvas 는 같은 compile · 같은 행 item 으로 `descendants` patch 를 만든다.
 */
export function interpolateRowTemplateTree<T extends RowTemplateTreeNode>(
  nodes: readonly T[],
  item: Record<string, unknown>,
  roles?: CollectionFieldRoles,
): T[] {
  return nodes.map((node) => {
    const props =
      node.props && typeof node.props === "object"
        ? (node.props as Record<string, unknown>)
        : null;
    let nextProps: Record<string, unknown> | null = null;
    if (props) {
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS) {
        const value = props[key];
        if (typeof value !== "string") continue;
        const compiled = compileFieldTemplate(value);
        if (!compiled) continue;
        nextProps ??= { ...props };
        nextProps[key] = interpolateCollectionRowTemplate(
          compiled,
          item,
          roles,
        );
      }
    }
    const children = node.children?.length
      ? interpolateRowTemplateTree(node.children as T[], item, roles)
      : node.children;
    if (!nextProps && children === node.children) return node;
    return {
      ...node,
      ...(nextProps ? { props: nextProps } : {}),
      ...(children !== node.children ? { children } : {}),
    };
  });
}

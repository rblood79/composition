/**
 * ADR-239 Phase 4 — ColorSwatchPicker 항목 origin (breakdown §4 Phase 4).
 *
 * - ColorSwatch · ColorSwatchPicker 는 팔레트 밖 reusable (`NESTED_REUSABLE_ORIGIN_TYPES` — 233 Radio 선례). 새 문서의
 *   Components `component-colorswatchpicker` 는 catalog seed ② (`convertNewOriginChildrenToRefs`) 가 swatch 6 을
 *   `component-colorswatch` instance 로 만든다 · slot 은 그룹 slot seed (`GROUP_SLOT_HOSTS`).
 * - 기존 문서: plain ColorSwatchPicker 의 plain ColorSwatch 자식 → **같은 id** 의 ColorSwatch origin ref. patch 는 옛
 *   props 를 정확히 재현한다 — origin 에만 있는 style 키 (단독 swatch factory 의 `display` · `borderWidth`) 는 `null`
 *   (해석 시 지움) — Canvas 픽셀 보존 (G6 · R5: 색도 그대로, 같은 색 swatch 도 그대로).
 * - 멱등: 이관을 지난 문서는 같은 객체.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId } from "@composition/shared";

export const COLOR_SWATCH_ORIGIN_ID = catalogReusableOriginId("ColorSwatch");
export const COLOR_SWATCH_PICKER_ORIGIN_ID =
  catalogReusableOriginId("ColorSwatchPicker");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * `origin` 위에 얹으면 `own` 과 같은 props 가 되는 patch — 다른 키는 그대로, origin 에만 있는 키는 `null`
 * (style 은 키 단위).
 */
export function exactPropsPatch(
  own: Record<string, unknown>,
  origin: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(own)) {
    if (key === "style") continue;
    if (JSON.stringify(origin[key]) !== JSON.stringify(value))
      patch[key] = value;
  }
  for (const key of Object.keys(origin)) {
    if (key !== "style" && !(key in own)) patch[key] = null;
  }
  const ownStyle = isRecord(own.style) ? own.style : {};
  const originStyle = isRecord(origin.style) ? origin.style : {};
  const style: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ownStyle)) {
    if (JSON.stringify(originStyle[key]) !== JSON.stringify(value)) {
      style[key] = value;
    }
  }
  for (const key of Object.keys(originStyle)) {
    if (!(key in ownStyle)) style[key] = null;
  }
  if (Object.keys(style).length > 0) patch.style = style;
  return patch;
}

/** plain ColorSwatchPicker 의 plain ColorSwatch 자식 → 같은 id 의 ColorSwatch origin ref. */
export function migrateColorSwatchesToInstances(
  document: CompositionDocument,
): CompositionDocument {
  const origin = findNode(document.children, COLOR_SWATCH_ORIGIN_ID);
  if (!origin || origin.reusable !== true) return document;
  const originProps = (origin.props ?? {}) as Record<string, unknown>;
  let changed = false;
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      let next = node;
      if (next.children) {
        const children = visit(next.children);
        if (!children.every((child, i) => child === next.children![i])) {
          next = { ...next, children };
        }
      }
      if (String(next.type) !== "ColorSwatchPicker" || !next.children) {
        return next;
      }
      let converted = false;
      const children = next.children.map((child) => {
        if (String(child.type) !== "ColorSwatch" || child.reusable === true) {
          return child;
        }
        converted = true;
        const { children: _children, ...rest } = child;
        return {
          ...rest,
          type: "ref",
          ref: COLOR_SWATCH_ORIGIN_ID,
          props: exactPropsPatch(
            (child.props ?? {}) as Record<string, unknown>,
            originProps,
          ),
        } as unknown as CanonicalNode;
      });
      if (!converted) return next;
      changed = true;
      return { ...next, children } as CanonicalNode;
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}

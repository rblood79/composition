/**
 * ADR-923 Phase 4 (G5) — `INLINE_BLOCK_TAGS` → `INTRINSIC_MEASURE_TAGS` 분리의 "분리 전후
 * `enrichWithIntrinsicSize` 출력 diff 0" 을 재는 대표 fixture.
 *
 * 24 항목 전부 + 대조군(목록 밖 leaf/컨테이너) 을 width 축 4 변형(부재 / `auto` / `fit-content` /
 * 명시 120) 으로 돌린다 — `needsWidth` 의 세 분기(부재·키워드·명시) 가 전부 실행되게. props 는
 * 실제 팔레트 기본값(`getDefaultProps`) 을 쓰고 rule 없는 5 종은 텍스트만 준다.
 */
import { getComponentRulesTable } from "@composition/shared";
import { getDefaultProps } from "../../../../../../types/builder/unified.types";
import type { CanvasLayoutNode } from "../../layoutNode";
import { enrichWithIntrinsicSize } from "../utils";

export const CONTROL_TAGS = [
  "div",
  "text",
  "label",
  "avatar",
  "breadcrumbs",
  "taglist",
  "tagview",
] as const;

export const WIDTH_VARIANTS: ReadonlyArray<[string, Record<string, unknown>]> =
  [
    ["absent", {}],
    ["auto", { width: "auto" }],
    ["fit-content", { width: "fit-content" }],
    ["px120", { width: 120 }],
  ];

const PASCAL_BY_LOWER: ReadonlyMap<string, string> = new Map(
  Object.keys(getComponentRulesTable()).map((k) => [k.toLowerCase(), k]),
);

export function fixturePropsFor(tag: string): Record<string, unknown> {
  const pascal = PASCAL_BY_LOWER.get(tag);
  const base: Record<string, unknown> = pascal
    ? { ...(getDefaultProps(pascal) as Record<string, unknown>) }
    : {};
  if (base.children === undefined && base.text === undefined) {
    base.children = "Label";
  }
  return base;
}

export function fixtureNode(
  tag: string,
  style: Record<string, unknown>,
): CanvasLayoutNode {
  const pascal = PASCAL_BY_LOWER.get(tag) ?? tag;
  const props = fixturePropsFor(tag);
  const baseStyle = (props.style as Record<string, unknown> | undefined) ?? {};
  return {
    id: `g5-${tag}`,
    type: pascal,
    props: { ...props, style: { ...baseStyle, ...style } },
  } as unknown as CanvasLayoutNode;
}

/** tag × width 변형 → enrich 출력 style (JSON 직렬화 가능한 형태). */
export function enrichFingerprints(
  tags: ReadonlyArray<string>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const tag of tags) {
    for (const [name, style] of WIDTH_VARIANTS) {
      const el = fixtureNode(tag, style);
      const enriched = enrichWithIntrinsicSize(
        el,
        400,
        0,
        undefined,
        [],
        () => [],
      );
      out[`${tag} @${name}`] = (enriched.props?.style ?? {}) as Record<
        string,
        unknown
      >;
    }
  }
  return out;
}

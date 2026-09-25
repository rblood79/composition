// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { borderWidth } from "@composition/specs";
import { resolveComponentRule, type CanonicalNode } from "@composition/shared";
import { COMPONENT_DEFINITIONS } from "../componentDefinitions";
import type { ComponentCreationContext } from "../types";
import { getDefaultProps } from "../../../types/builder/unified.types";
import {
  buildCatalogOrigin,
  repairCatalogOrigin,
} from "../../components/catalogOrigins";
import { ensureCardTemplateOrigins } from "../../components/card/cardTemplateOrigins";
import {
  applyImplicitStyles,
  resolveContainerStylesFallback,
} from "../../workspace/canvas/layout/engines/implicitStyles";
import type { CanvasLayoutNode } from "../../workspace/canvas/layout/layoutNode";

const ctx: ComponentCreationContext = {
  parentElement: null,
  pageId: "home",
  elements: [],
  doc: { version: "composition-1.0", children: [] },
};
const fieldTypes = [
  "Select",
  "ComboBox",
  "NumberField",
  "SearchField",
  "ColorField",
];
function effectiveField(
  type: string,
  size: string,
  labelPosition: string,
  style?: Record<string, unknown>,
) {
  const def = COMPONENT_DEFINITIONS[type](ctx);
  const parent: CanvasLayoutNode = {
    id: "root",
    type,
    props: {
      ...def.parent.props,
      size,
      labelPosition,
      ...(style ? { style } : {}),
    },
  };
  const children: CanvasLayoutNode[] = def.children.map((c, i) => ({
    id: `child-${i}`,
    type: c.type,
    props: c.props ?? {},
    parent_id: parent.id,
  }));
  const resolved = applyImplicitStyles(
    parent,
    children,
    (id) => (id === parent.id ? children : []),
    new Map([parent, ...children].map((n) => [n.id, n])),
  ).effectiveParent.props.style as Record<string, unknown>;
  return {
    ...resolveContainerStylesFallback(type.toLowerCase(), style ?? {}, size),
    ...resolved,
  };
}
function find(
  nodes: readonly CanonicalNode[],
  type: string,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (n.type === type) return n;
    const child = find(n.children ?? [], type);
    if (child) return child;
  }
}

describe("공통 기본값은 문서 인라인 대신 catalog에서 소비", () => {
  it.each(fieldTypes)(
    "%s는 top/side와 모든 size에서 catalog gap을 읽고 사용자 값을 보존",
    (type) => {
      const rule = resolveComponentRule(type)!;
      for (const [size, metrics] of Object.entries(rule.sizes ?? {})) {
        for (const position of ["top", "side"]) {
          const effective = effectiveField(type, size, position);
          expect(
            effective.gap ?? effective.rowGap,
            `${type}/${size}/${position}`,
          ).toBe(metrics.gap);
          expect(
            effectiveField(type, size, position, { gap: 31, width: "67%" }),
          ).toMatchObject({ gap: 31, width: "67%" });
        }
      }
      expect(getDefaultProps(type).style).toBeUndefined();
      expect(buildCatalogOrigin(type).props?.style).toBeUndefined();
    },
  );

  it("Dialog는 Trigger 구조를 유지하면서 본문 폭과 column 배치를 catalog에서 받는다", () => {
    const def = COMPONENT_DEFINITIONS.Dialog(ctx);
    expect(def.parent.type).toBe("DialogTrigger");
    expect(
      def.children.find((n) => n.type === "Dialog")?.props?.style,
    ).toBeUndefined();
    expect(resolveContainerStylesFallback("dialog", {}, "md")).toMatchObject({
      width: "100%",
      display: "flex",
      flexDirection: "column",
    });
  });

  const seedThin = borderWidth.thin;
  afterEach(() => {
    borderWidth.thin = seedThin;
  });
  it("새 Card는 theme thin 변경을 따라가고 기존 저작 border/width는 보존한다", () => {
    const doc = ensureCardTemplateOrigins(ctx.doc);
    const card = find(doc.children, "Card")!;
    expect(card.props?.style).toBeUndefined();
    borderWidth.thin = 3;
    expect(resolveContainerStylesFallback("card", {}, "md").borderWidth).toBe(
      3,
    );
    card.props = { ...card.props, style: { width: "63%", borderWidth: 7 } };
    const reloaded = ensureCardTemplateOrigins(doc);
    expect(find(reloaded.children, "Card")?.props?.style).toEqual({
      width: "63%",
      borderWidth: 7,
    });
    expect(
      resolveContainerStylesFallback("card", { borderWidth: 7 }, "md")
        .borderWidth,
    ).toBeUndefined();
  });

  it("기존 field origin의 저작 gap과 너비는 새 기본값으로 덮지 않는다", () => {
    const origin = buildCatalogOrigin("ColorField");
    origin.props = { ...origin.props, style: { gap: 23, width: "71%" } };
    const repaired = repairCatalogOrigin(
      origin,
      buildCatalogOrigin("ColorField"),
    );
    expect(repaired.props?.style).toEqual({ gap: 23, width: "71%" });
  });

  it.each([
    "TextField",
    "TextArea",
    "DateField",
    "TimeField",
    "ListBox",
    "GridList",
    "FileUpload",
    "IllustratedMessage",
    "Card",
  ])("%s의 기본 너비 미러가 없고 catalog는 100%를 제공", (type) => {
    expect(getDefaultProps(type).style?.width).toBeUndefined();
    expect(resolveContainerStylesFallback(type.toLowerCase(), {}).width).toBe(
      "100%",
    );
  });

  it("ProgressCircle 기본 props는 md 지름을 고정하지 않는다", () => {
    expect(getDefaultProps("ProgressCircle").style).toBeUndefined();
  });
});

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes } from "../staticCollectionMigration";
import { planGroupItemInsert } from "../groupItemInsert";
import {
  COLOR_SWATCH_ORIGIN_ID,
  COLOR_SWATCH_PICKER_ORIGIN_ID,
} from "../colorswatch/colorSwatchOrigins";

/**
 * ADR-239 Phase 4 — ColorSwatchPicker 항목 origin (breakdown §4 Phase 4 · G4).
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body" as CanonicalNode["type"],
              children: user,
            },
          ],
        },
      ],
    } as CompositionDocument),
  );
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderById(doc: CompositionDocument, id: string) {
  const node = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  return render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
}

/** 239 전 모양 — factory 그대로의 plain picker (swatch 6 · 같은 색 둘 포함 가능). */
const legacyPicker = (
  id: string,
  colors: string[],
  props: Record<string, unknown> = {},
): CanonicalNode =>
  ({
    id,
    type: "ColorSwatchPicker",
    props: {
      columns: 6,
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
      },
      ...props,
    },
    children: colors.map((color, i) => ({
      id: `${id}-sw${i + 1}`,
      type: "ColorSwatch",
      props: { color, style: { width: 28, height: 28 } },
    })),
  }) as unknown as CanonicalNode;

describe("ADR-239 Phase 4 — origin seed · 이관", () => {
  it("새 문서: ColorSwatch origin (팔레트 밖) · ColorSwatchPicker origin 자식 = swatch ref 6 (색 유일) · slot = ColorSwatch origin", () => {
    const byId = indexNodes(seededDoc());
    expect(byId.get(COLOR_SWATCH_ORIGIN_ID)).toMatchObject({
      type: "ColorSwatch",
      reusable: true,
    });
    const picker = byId.get(COLOR_SWATCH_PICKER_ORIGIN_ID)!;
    expect(picker.slot).toEqual([COLOR_SWATCH_ORIGIN_ID]);
    const swatches = picker.children ?? [];
    expect(swatches).toHaveLength(6);
    expect(
      swatches.every(
        (s) => (s as { ref?: string }).ref === COLOR_SWATCH_ORIGIN_ID,
      ),
    ).toBe(true);
    const colors = swatches.map(
      (s) => (s.props as Record<string, unknown>).color,
    );
    expect(new Set(colors).size).toBe(6);
  });

  it("기존 plain picker: swatch → 같은 id ref · 해석된 props = 이관 전 (origin 에만 있는 style 키는 지움) · 같은 색도 그대로 · 멱등", () => {
    const colors = ["#FF0000", "#FF0000", "#00FF00"];
    const doc = seededDoc([legacyPicker("csp", colors)]);
    const byId = indexNodes(doc);
    const swatch = byId.get("csp-sw1")!;
    expect(swatch).toMatchObject({ type: "ref", ref: COLOR_SWATCH_ORIGIN_ID });
    const model = buildCanonicalSceneModel(doc);
    colors.forEach((color, i) => {
      const scene = model.sceneNodesMap.get(`csp-sw${i + 1}`)!;
      expect(scene.type).toBe("ColorSwatch");
      expect(scene.props.color).toBe(color);
      expect(scene.props.style).toEqual({ width: 28, height: 28 });
    });
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });
});

describe('ADR-239 Phase 4 — Slot "+" · Preview', () => {
  it('Slot "+" — 형제와 다른 색 (다음 후보) · 크기는 형제 swatch 를 따른다', () => {
    const doc = seededDoc([
      { id: "pi", type: "ref", ref: COLOR_SWATCH_PICKER_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);
    const plan = planGroupItemInsert({
      document: doc,
      hostId: "pi",
      candidateId: COLOR_SWATCH_ORIGIN_ID,
      newId: "new-sw",
    })!;
    expect(plan.child).toMatchObject({
      type: "ref",
      ref: COLOR_SWATCH_ORIGIN_ID,
      props: { color: "#FF8000", style: { width: 28, height: 28 } },
    });
  });

  it("binding props (defaultValue · layout · isDisabled) 가 Preview picker 에 닿는다 (F9)", () => {
    const doc = seededDoc([
      legacyPicker("csp", ["#FF0000", "#00FF00"], {
        defaultValue: "#00ff00",
        layout: "stack",
        isDisabled: true,
      }),
    ]);
    const { container } = renderById(doc, "csp");
    const picker = container.querySelector(".react-aria-ColorSwatchPicker")!;
    expect(picker.getAttribute("data-layout")).toBe("stack");
    const items = [
      ...container.querySelectorAll<HTMLElement>(
        ".react-aria-ColorSwatchPickerItem",
      ),
    ];
    expect(items.map((i) => i.hasAttribute("data-selected"))).toEqual([
      false,
      true,
    ]);
    expect(items.every((i) => i.hasAttribute("data-disabled"))).toBe(true);
  });

  it("ColorSwatch origin 모양 (borderRadius) 편집이 두 leg 에 닿는다 (R6)", () => {
    const doc = seededDoc([legacyPicker("csp", ["#FF0000", "#00FF00"])]);
    const edited = {
      ...doc,
      children: doc.children.map(function visit(
        node: CanonicalNode,
      ): CanonicalNode {
        if (node.id === COLOR_SWATCH_ORIGIN_ID) {
          const props = (node.props ?? {}) as Record<string, unknown>;
          return {
            ...node,
            props: {
              ...props,
              style: { ...(props.style as object), borderRadius: 3 },
            },
          };
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const model = buildCanonicalSceneModel(edited);
    expect(
      (
        model.sceneNodesMap.get("csp-sw1")!.props.style as Record<
          string,
          unknown
        >
      ).borderRadius,
    ).toBe(3);
    const { container } = renderById(edited, "csp");
    const swatch = container.querySelector<HTMLElement>(
      ".react-aria-ColorSwatch",
    )!;
    expect(swatch.style.borderRadius).toBe("3px");
    expect(swatch.style.width).toBe("28px");
  });
});

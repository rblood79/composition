import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "@composition/shared";
import { buildCatalogOrigin } from "../catalogOrigins";
import {
  buildStateVariantOrigin,
  ensureStateVariantOrigins,
} from "../stateVariantOrigins";
import {
  STATE_VARIANT_MANAGED_KEYS,
  buildStateVariantProjection,
  collectStateVariantCss,
  readStateVariantProjection,
  resolveStateVariantOverlay,
} from "../stateVariantResolution";

const toggle = buildCatalogOrigin("ToggleButton");
const selected: CanonicalNode = {
  ...buildStateVariantOrigin(toggle, "selected"),
  props: { ...toggle.props, style: { color: "#ffffff", padding: 4 } },
  fills: [{ type: "color", color: "#ff0000", opacity: 1, enabled: true }],
} as CanonicalNode;
const disabled: CanonicalNode = {
  ...buildStateVariantOrigin(toggle, "disabled"),
  props: { ...toggle.props, style: { opacity: 0.5, color: "#999999" } },
} as CanonicalNode;
const lookup = (id: string): CanonicalNode | undefined =>
  ({ [toggle.id]: toggle, [selected.id]: selected, [disabled.id]: disabled })[
    id
  ];

describe("ADR-230 stateVariantResolution — 두 leg 공용 해소", () => {
  it("projection: 변형 집합 · default/instance 소유 키 — 관리 키만 실린다", () => {
    const refNode = {
      id: "inst",
      type: "ref",
      ref: toggle.id,
      props: { style: { color: "#123456" } },
    } as unknown as CanonicalNode;
    const projection = buildStateVariantProjection(toggle, refNode, lookup);
    expect(projection).not.toBeNull();
    expect(projection!.originId).toBe(toggle.id);
    expect(Object.keys(projection!.sets)).toEqual(["selected", "disabled"]);
    // padding 은 관리 키가 아니라 빠진다
    expect(projection!.sets.selected).toEqual({
      style: { color: "#ffffff" },
      fills: [{ type: "color", color: "#ff0000", opacity: 1, enabled: true }],
    });
    expect(projection!.sets.disabled).toEqual({
      style: { opacity: 0.5, color: "#999999" },
    });
    expect(projection!.defaultOwned).toEqual([]);
    expect(projection!.instanceOwned).toEqual(["color"]);
    expect(STATE_VARIANT_MANAGED_KEYS).toEqual([
      "backgroundColor",
      "color",
      "borderColor",
      "opacity",
    ]);
  });

  it("projection: 변형 origin 이 하나도 없으면 null · default 의 fills 는 backgroundColor 소유", () => {
    const plain = buildCatalogOrigin("Button");
    const refNode = {
      id: "i",
      type: "ref",
      ref: plain.id,
      props: {},
    } as unknown as CanonicalNode;
    expect(
      buildStateVariantProjection(plain, refNode, () => undefined),
    ).toBeNull();

    const ownsBg = {
      ...toggle,
      fills: [{ type: "color", color: "#0000ff" }],
    } as CanonicalNode;
    const p = buildStateVariantProjection(ownsBg, refNode, lookup);
    expect(p!.defaultOwned).toEqual(["backgroundColor"]);
  });

  it("overlay: selected 위에 disabled — instance 소유 키는 건너뛴다 · 부재 상태는 빈 patch", () => {
    const projection = buildStateVariantProjection(
      toggle,
      {
        id: "i",
        type: "ref",
        ref: toggle.id,
        props: {},
      } as unknown as CanonicalNode,
      lookup,
    )!;
    expect(
      resolveStateVariantOverlay(projection, {
        selected: false,
        disabled: false,
      }),
    ).toEqual({ style: {}, fills: undefined, ownedKeys: [] });

    const sel = resolveStateVariantOverlay(projection, {
      selected: true,
      disabled: false,
    });
    expect(sel.style).toEqual({ color: "#ffffff" });
    expect(sel.fills).toEqual(selected.fills);
    expect(sel.ownedKeys).toEqual(["backgroundColor", "color"]);

    const both = resolveStateVariantOverlay(projection, {
      selected: true,
      disabled: true,
    });
    // disabled 가 최우선 — color 는 disabled 값, 배경은 selected 가 남는다
    expect(both.style).toEqual({ color: "#999999", opacity: 0.5 });
    expect(both.fills).toEqual(selected.fills);

    const withInstance = resolveStateVariantOverlay(
      { ...projection, instanceOwned: ["color", "opacity"] },
      { selected: true, disabled: true },
    );
    expect(withInstance.style).toEqual({});
    expect(withInstance.fills).toEqual(selected.fills);
    expect(withInstance.ownedKeys).toEqual(["backgroundColor"]);
  });

  it("readStateVariantProjection — props._stateVariants 방어적 판독", () => {
    expect(readStateVariantProjection(undefined)).toBeNull();
    expect(readStateVariantProjection({ originId: 1 })).toBeNull();
    const ok = { originId: "o", sets: {}, defaultOwned: [], instanceOwned: [] };
    expect(readStateVariantProjection(ok)).toBe(ok);
  });

  it("Preview CSS: origin 당 상태 규칙 — default 가 소유한 키는 변수, 아니면 속성 직접 · disabled 마지막 · !important 0", () => {
    const doc = ensureStateVariantOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-components",
          type: "frame",
          props: {},
          metadata: { type: "page" },
          children: [
            {
              id: "page-components-body",
              type: "body",
              props: {},
              children: [
                { ...toggle, fills: [{ type: "color", color: "#0000ff" }] },
              ],
            } as unknown as CanonicalNode,
          ],
        } as CanonicalNode,
      ],
    });
    const body = doc.children[0]!.children![0]!;
    body.children = body.children!.map((n) =>
      n.id === selected.id ? selected : n.id === disabled.id ? disabled : n,
    );
    const css = collectStateVariantCss(doc);
    expect(css).toContain(
      '[data-state-origin="component-togglebutton"][data-element-id][data-selected]',
    );
    expect(css).toContain(
      '[data-state-origin="component-togglebutton"] > [data-element-id][data-selected]',
    );
    // default 가 배경(fills)을 소유 → 변수 · color 는 미소유 → 속성 직접
    expect(css).toMatch(
      /\[data-selected\][^{]*\{--co-background-color:#ff0000;color:#ffffff\}/i,
    );
    expect(css).toMatch(/\[data-disabled\][^{]*\{color:#999999;opacity:0\.5\}/);
    expect(css.indexOf("[data-selected]")).toBeLessThan(
      css.indexOf("[data-disabled]"),
    );
    expect(css).not.toContain("!important");
    expect(css.length).toBeLessThan(8 * 1024);
  });

  it("Preview CSS: 변형이 없는 문서는 빈 문자열", () => {
    expect(
      collectStateVariantCss({ version: "composition-1.0", children: [] }),
    ).toBe("");
  });
});

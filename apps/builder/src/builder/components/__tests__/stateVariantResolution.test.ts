import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "@composition/shared";
import { buildCatalogOrigin } from "../catalogOrigins";
import { buildStateVariantOrigin } from "../stateVariantOrigins";
import {
  activeStateLayerNames,
  buildStateLayerSet,
  composeStateLayers,
  omitOwnedKeys,
  readInstanceOwnedKeys,
  readStateLayer,
  resolveActiveStateLayer,
} from "../stateVariantLayers";

/**
 * ADR-230 → 234 — 이관 전 **복제본** 변형 (230 모양) 을 234 상태 층으로 읽는 규칙. 230 의 두 leg
 * overlay 계약 (관리 키만 · selected 위에 disabled · instance 소유 키 제외) 이 층 합성으로 같은 값을
 * 낸다. ref 변형 (이관 후) 층은 `adr234Phase2.stateLayers.test.ts`.
 */

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
const hover: CanonicalNode = {
  ...buildStateVariantOrigin(toggle, "hover"),
  props: { ...toggle.props, style: {} },
  fills: [{ type: "color", color: "#0000ff", opacity: 1, enabled: true }],
} as CanonicalNode;
const lookup = (id: string): CanonicalNode | undefined =>
  ({
    [toggle.id]: toggle,
    [selected.id]: selected,
    [disabled.id]: disabled,
    [hover.id]: hover,
  })[id];

describe("ADR-230 복제본 변형 → 234 상태 층", () => {
  it("복제본은 관리 키 (color · borderColor · opacity) + fills 만 층이 된다 — padding 은 버린다", () => {
    expect(readStateLayer(selected)).toEqual({
      props: { style: { color: "#ffffff" } },
      fills: selected.fills,
    });
    expect(readStateLayer(buildStateVariantOrigin(toggle, "pressed"))).toBe(
      null,
    );
  });

  it("층 집합 · 켜진 층 순서 — selected 위에 disabled, hover 는 Preview 만 켠다", () => {
    const set = buildStateLayerSet(toggle.id, lookup)!;
    expect(Object.keys(set.layers).sort()).toEqual([
      "disabled",
      "hover",
      "selected",
    ]);
    expect(
      activeStateLayerNames(set, { selected: true, disabled: true }),
    ).toEqual(["selected", "disabled"]);
    expect(
      activeStateLayerNames(set, {
        selected: false,
        disabled: false,
        hovered: true,
      }),
    ).toEqual(["hover"]);
    const both = resolveActiveStateLayer(set, {
      selected: true,
      disabled: true,
    })!;
    // disabled 가 이긴다 — color 는 disabled 값, 배경은 selected 가 남는다
    expect(both.props).toEqual({ style: { color: "#999999", opacity: 0.5 } });
    expect(both.fills).toEqual(selected.fills);
  });

  it("instance 가 직접 저장한 키는 층이 건드리지 못한다", () => {
    const own = readInstanceOwnedKeys({
      id: "i",
      type: "ref",
      ref: toggle.id,
      props: { style: { color: "#123456", opacity: 1 } },
    } as unknown as CanonicalNode);
    const layer = composeStateLayers([
      readStateLayer(selected)!,
      readStateLayer(disabled)!,
    ])!;
    expect(omitOwnedKeys(layer.props, own)).toBeNull();
    expect(own.fills).toBe(false);
  });

  it("변형이 하나도 없는 origin 은 null (plain 경로)", () => {
    expect(buildStateLayerSet("component-link", () => undefined)).toBeNull();
  });
});

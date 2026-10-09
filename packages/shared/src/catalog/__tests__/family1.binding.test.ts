import { describe, expect, it } from "vitest";

import {
  badgeBinding,
  getPrimitiveBinding,
  linkBinding,
  toggleButtonBinding,
  toggleButtonGroupBinding,
  toolbarBinding,
} from "../bindings";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ①(primitives/actions) — Link/ToggleButton/ToggleButtonGroup/Toolbar
 * binding 의 toRacProps(DOM 경로) 검증. variant/size 는 data-* 라우팅, 나머지는 RAC props 통과.
 */

describe("Link binding → toRacProps", () => {
  it("routes variant/size to data-* and passes href/target as RAC props", () => {
    const result = toRacProps(
      {
        id: "l1",
        type: "Link",
        props: {
          children: "Docs",
          variant: "secondary",
          size: "L",
          href: "https://x.dev",
          target: "_blank",
        },
      },
      linkBinding,
    );
    expect(result).toMatchObject({
      children: "Docs",
      href: "https://x.dev",
      target: "_blank",
      "data-variant": "secondary",
      "data-size": "L",
    });
  });

  it("fills variant/size defaults", () => {
    const result = toRacProps(
      { id: "l2", type: "Link", props: { children: "x" } },
      linkBinding,
    );
    expect(result["data-variant"]).toBe("primary");
    expect(result["data-size"]).toBe("M");
  });
});

describe("ToggleButton binding → toRacProps", () => {
  it("passes isSelected as RAC prop and routes size to data-size", () => {
    const result = toRacProps(
      {
        id: "tb1",
        type: "ToggleButton",
        props: { children: "Bold", isSelected: true, size: "S" },
      },
      toggleButtonBinding,
    );
    expect(result).toMatchObject({
      children: "Bold",
      isSelected: true,
      "data-size": "S",
    });
    // size 는 data-* (RAC props 아님)
    expect(result).not.toHaveProperty("size");
  });
});

describe("ToggleButtonGroup binding → toRacProps (컨테이너, children-manager 제외)", () => {
  it("passes orientation/selectionMode as RAC props, no children-manager prop", () => {
    const result = toRacProps(
      {
        id: "tbg1",
        type: "ToggleButtonGroup",
        props: {
          orientation: "vertical",
          selectionMode: "multiple",
          size: "L",
          // items(children-manager)는 canonical children 트리로 흡수 → accepts 에 없음 → drop
          items: [{ id: "x" }],
        },
      },
      toggleButtonGroupBinding,
    );
    expect(result).toMatchObject({
      orientation: "vertical",
      selectionMode: "multiple",
      "data-size": "L",
    });
    expect(result).not.toHaveProperty("items");
  });
});

describe("Toolbar binding → toRacProps (컨테이너)", () => {
  it("routes variant/size to data-* and passes orientation as RAC prop", () => {
    const result = toRacProps(
      {
        id: "tlb1",
        type: "Toolbar",
        props: { variant: "accent", orientation: "vertical" },
      },
      toolbarBinding,
    );
    expect(result).toMatchObject({
      orientation: "vertical",
      "data-variant": "accent",
      "data-size": "M",
    });
  });
});

describe("Badge binding → toRacProps (internal source leaf)", () => {
  it("routes variant/size/fillStyle to data-* (internal span)", () => {
    const result = toRacProps(
      {
        id: "bd1",
        type: "Badge",
        props: { children: "New", variant: "positive", fillStyle: "subtle" },
      },
      badgeBinding,
    );
    expect(result).toMatchObject({
      children: "New",
      "data-variant": "positive",
      "data-size": "S",
      "data-fill-style": "subtle",
    });
  });

  it("Badge is an internal source primitive (no RAC controller)", () => {
    expect(badgeBinding.source.kind).toBe("internal");
    if (badgeBinding.source.kind === "internal") {
      expect(badgeBinding.source.renderer).toBe("badge");
    }
  });
});

describe("getPrimitiveBinding — family ① 8 primitive", () => {
  it.each([
    ["Badge"],
    ["Button"],
    ["Icon"],
    ["Link"],
    ["Separator"],
    ["ToggleButton"],
    ["ToggleButtonGroup"],
    ["Toolbar"],
  ])("returns a binding for %s", (type) => {
    expect(getPrimitiveBinding(type)).toBeDefined();
  });
});

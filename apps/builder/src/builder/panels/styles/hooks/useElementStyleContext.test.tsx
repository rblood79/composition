// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDefaultColorFill } from "../../../../types/builder/fill.types";
import {
  openStylesFixture,
  type StylesFixture,
} from "../__tests__/support/catalogStylesFixture";
import { useElementStyleContext } from "./useElementStyleContext";

/**
 * ADR-248 4e-9 C: the Styles read seam over the catalog workspace. An instance reads its
 * component's values under its own (the old origin baseline tier, 2026-07-25 — the render lays the
 * component under the instance, so the panel must too); a position inside an instance reads the
 * resolved node.
 */
function contextOf(fixture: StylesFixture, record: string) {
  return renderHook(() => useElementStyleContext(record), {
    wrapper: fixture.wrapper,
  });
}

describe("useElementStyleContext", () => {
  it("instance 안 자식도 해소된 노드로 읽는다 — component 의 타입 · instance 의 덮어쓰기", async () => {
    const fixture = await openStylesFixture([
      { id: "form" },
      {
        id: "field-1",
        type: "TextField",
        parent: "form",
        props: { label: "Name", labelPosition: "top" },
      },
    ]);
    const instance = fixture.componentize("form", "Form");
    const child = fixture.workspace.root.domInputs.get(instance)!.children[0]!;
    fixture.workspace.selectRecords([child]);
    fixture.host.updateProperty("labelPosition", "side");
    fixture.host.updateStyle("width", "200px");

    const { result } = contextOf(fixture, child);

    expect(result.current.type).toBe("TextField");
    expect(result.current.props?.labelPosition).toBe("side");
    expect(result.current.style?.width).toBe("200px");
  });

  it("resolves an instance's type from its component (its own width wins)", async () => {
    const fixture = await openStylesFixture([
      { id: "button", type: "Button", style: { width: "120px" } },
    ]);
    const instance = fixture.componentize("button", "PrimaryAction");
    fixture.workspace.selectRecords([instance]);
    fixture.host.updateStyle("width", "240px");

    const { result } = contextOf(fixture, instance);

    expect(result.current.type).toBe("Button");
    expect(result.current.style?.width).toBe("240px");
  });

  describe("instance component baseline", () => {
    it("inherits component style keys the instance does not override", async () => {
      const fixture = await openStylesFixture([
        {
          id: "button",
          type: "Button",
          props: { size: "L" },
          style: {
            paddingTop: "10px",
            boxShadow: "inset 0 10px 15px -3px #000",
          },
        },
      ]);
      const instance = fixture.componentize("button", "Action");
      fixture.workspace.selectRecords([instance]);
      fixture.host.updateStyles({ width: "100%", overflow: "auto" });

      const { result } = contextOf(fixture, instance);

      expect(result.current.style?.boxShadow).toBe(
        "inset 0 10px 15px -3px #000",
      );
      expect(result.current.style?.paddingTop).toBe("10px");
      // instance 고유 키는 그대로
      expect(result.current.style?.width).toBe("100%");
      // props 축도 같은 병합 — size 는 catalog preset tier 선택에 쓰인다
      expect(result.current.size).toBe("L");
    });

    it("keeps the instance override winning over the component value", async () => {
      const fixture = await openStylesFixture([
        {
          id: "button",
          type: "Button",
          props: { size: "L" },
          style: { boxShadow: "none", paddingTop: "10px" },
        },
      ]);
      const instance = fixture.componentize("button", "Action");
      fixture.workspace.selectRecords([instance]);
      fixture.host.updateProperty("size", "S");
      fixture.host.updateStyle("boxShadow", "0 1px 2px 0 #000");

      const { result } = contextOf(fixture, instance);

      expect(result.current.style?.boxShadow).toBe("0 1px 2px 0 #000");
      expect(result.current.style?.paddingTop).toBe("10px");
      expect(result.current.size).toBe("S");
    });

    it("resolves each tier's breakpoint layer before merging", async () => {
      const fixture = await openStylesFixture([
        {
          id: "listbox",
          type: "ListBox",
          style: { paddingTop: "10px", rowGap: "4px" },
        },
      ]);
      fixture.select("listbox");
      fixture.setBreakpoint("mobile");
      fixture.host.updateStyle("paddingTop", "2px");
      fixture.setBreakpoint("desktop");
      const instance = fixture.componentize("listbox", "List");
      fixture.workspace.selectRecords([instance]);
      fixture.host.updateStyle("width", "100%");
      fixture.setBreakpoint("mobile");
      fixture.host.updateStyle("width", "50%");

      const { result } = contextOf(fixture, instance);

      // component 의 breakpoint 값이 instance 의 breakpoint 해석에 덮이지 않는다
      expect(result.current.style?.paddingTop).toBe("2px");
      expect(result.current.style?.rowGap).toBe("4px");
      expect(result.current.style?.width).toBe("50%");
    });

    it("falls back to the component fills when the instance has none", async () => {
      const fill = createDefaultColorFill("#123456FF");
      const fixture = await openStylesFixture([
        { id: "listbox", type: "ListBox", fills: [fill] },
      ]);
      const instance = fixture.componentize("listbox", "List");

      const { result } = contextOf(fixture, instance);

      expect(result.current.fills).toEqual([fill]);
    });

    it("leaves a plain (non-instance) element untouched", async () => {
      const fixture = await openStylesFixture([
        {
          id: "badge-1",
          type: "Badge",
          style: { boxShadow: "0 4px 6px -1px #000" },
        },
      ]);

      const { result } = contextOf(fixture, fixture.recordOf("badge-1"));

      expect(result.current.style).toEqual({
        boxShadow: "0 4px 6px -1px #000",
      });
    });
  });
});

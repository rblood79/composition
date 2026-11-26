/**
 * ADR-318 G3 · G5 — a Resizable Panel's Do 3 (Collapse · Expand · Toggle collapse): the registry derives
 * them from the collapse concept (prop `isCollapsed`, guard `collapsible`), the dispatcher's first
 * check and the panel's offer refuse them on a Panel that does not collapse (one answer for both).
 */
import { describe, expect, it } from "vitest";
import { CAPABILITY_REGISTRY } from "../capabilityRegistry";
import { declaredRefusal } from "../constraints";
import { IMPLICIT_STATE_SOURCES } from "../../state/implicitState";

describe("ADR-318 — Resizable Panel collapse Do", () => {
  const panel = CAPABILITY_REGISTRY.ResizablePanel;
  it("collapse · expand · toggleCollapse write `isCollapsed`, guarded by `collapsible`", () => {
    expect(panel?.capabilities.collapse).toMatchObject({
      prop: "isCollapsed",
      value: true,
      guards: ["collapsible"],
    });
    expect(panel?.capabilities.expand).toMatchObject({
      prop: "isCollapsed",
      value: false,
    });
    expect(panel?.capabilities.toggleCollapse).toMatchObject({
      prop: "isCollapsed",
      value: "!self",
    });
  });
  it("a Panel that does not collapse refuses them; a collapsible one takes them", () => {
    const guards = panel!.capabilities.collapse!.guards ?? [];
    expect(declaredRefusal(guards, {})).toBe("collapsible: false");
    expect(declaredRefusal(guards, { collapsible: false })).toBe(
      "collapsible: false",
    );
    expect(declaredRefusal(guards, { collapsible: true })).toBeUndefined();
  });
  it("Phase 5 — When 「Collapse change」 · 「Resize」 (사용자 결정 1: a number per Panel); state mirrors both", () => {
    expect(panel?.events).toEqual(["onCollapsedChange", "onSizeChange"]);
    expect(IMPLICIT_STATE_SOURCES.ResizablePanel).toEqual(
      expect.arrayContaining([
        { prop: "isCollapsed", event: "onCollapsedChange", type: "boolean" },
        { prop: "size", event: "onSizeChange", type: "number" },
      ]),
    );
  });
});

import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { loadCatalogSideNav } from "../../../../../../packages/shared/src/catalog/runtime/sideNav.lazy";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import { getPaletteItems } from "../../../builder/panels/components/paletteItems";
import { needsAuthoredAriaLabel } from "../../../builder/panels/properties/ariaLabelNeed";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-300 Phase 4 — the SideNav family placed from the palette (user decision 3 (b): SideNavPanel ·
 * SideNav), the instance's code view (the S2 reference's shape: a panel holds its nav's items) and
 * the panel's nav items as the instance's own nodes (as a Select's ListBox items — `ownSlotContents`).
 */
const HOME = "project:page:home" as EntryId<"page">;

beforeAll(() => loadCatalogSideNav(), 60_000);

describe("ADR-300 Phase 4 — palette · code view", () => {
  it("the palette offers SideNavPanel and SideNav in the layout group, after Nav", () => {
    const layout = getPaletteItems()
      .filter((item) => item.category === "layout")
      .map((item) => item.type);
    const nav = layout.indexOf("Nav");
    expect(layout.slice(nav, nav + 3)).toEqual([
      "Nav",
      "SideNavPanel",
      "SideNav",
    ]);
  });

  it("a placed SideNavPanel owns its nav's items — the code shows them in the panel", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["SideNavPanel"]);
    const panel = h.workspace.runtime.graph.getEntry(h.ids[0]!) as NodeEntry;
    expect(
      panel.descendantOverrides.some(
        (override) => override.kind === "fillSlot",
      ),
    ).toBe(true);
    const { code } = generateCodeView({
      reader: h.workspace.runtime.graph,
      pageId: HOME,
      collections: [],
    });
    const inPanel =
      /<SideNavPanel>[\s\S]*<\/SideNavPanel>/.exec(code)?.[0] ?? "";
    for (const id of ["item-1", "item-2", "item-2-1", "item-3"])
      expect(inPanel).toContain(`<SideNavItem id="${id}"`);
    // (Nested as RAC's tree: Getting started inside Guides.)
    expect(inPanel).toMatch(
      /<SideNavItem id="item-2"[^]*?<SideNavItem id="item-2-1"[^]*?<\/SideNavItem>/,
    );
    h.view.unmount();
  });

  it("a placed SideNav's code lists its items under it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["SideNav"]);
    const { code } = generateCodeView({
      reader: h.workspace.runtime.graph,
      pageId: HOME,
      collections: [],
    });
    expect(code).toMatch(/<SideNav>\s*<SideNavItem id="item-1"/);
    h.view.unmount();
  });

  it("a SideNav asks for its Aria Label (RAC NavigationTree is named as a tree)", () => {
    expect(
      needsAuthoredAriaLabel({
        type: "SideNav",
        props: {},
        hasLabelField: false,
        children: [],
      }),
    ).toBe(true);
  });
});

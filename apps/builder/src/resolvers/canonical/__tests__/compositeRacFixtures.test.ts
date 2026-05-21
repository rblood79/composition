import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findNormalizedNodeById,
  findNormalizedNodeByName,
  getCompositeFixtureStats,
  normalizeCompositeRacExport,
} from "../compositeRacFixtureContracts";

function loadFixture(name: string): unknown {
  const fixturePath = resolve(__dirname, "../../../../../../packages", name);
  return JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;
}

describe("ADR-144 Phase 1 composite RAC fixture contracts", () => {
  it("normalizes RAC, slot-tabs, and shadcn export root shapes without schema migration", () => {
    const rac = normalizeCompositeRacExport(
      loadFixture("RAC-showcase.json"),
      "RAC-showcase.json",
    );
    const slotTabs = normalizeCompositeRacExport(
      loadFixture("slot-tabs-selection.json"),
      "slot-tabs-selection.json",
    );
    const shadcn = normalizeCompositeRacExport(
      loadFixture("shadcn-design-system.json"),
      "shadcn-design-system.json",
    );

    expect(rac.rootKind).toBe("reusableComponents");
    expect(slotTabs.rootKind).toBe("nodes");
    expect(shadcn.rootKind).toBe("reusableComponents");

    expect(slotTabs.selectedNodeIds).toEqual([
      "coMmv",
      "QY0Ka",
      "PbofX",
      "omDwd",
    ]);

    expect(getCompositeFixtureStats(rac)).toMatchObject({
      reusable: 67,
      refs: 263,
      refsWithDescendants: 199,
      slotHosts: 0,
    });
    expect(getCompositeFixtureStats(slotTabs)).toMatchObject({
      reusable: 3,
      refs: 6,
      refsWithDescendants: 5,
      slotHosts: 1,
    });
    expect(getCompositeFixtureStats(shadcn)).toMatchObject({
      reusable: 174,
      refs: 119,
      refsWithDescendants: 100,
      slotHosts: 22,
    });
  });

  it("proves RAC-showcase Tabs are reusable origins with ref children and descendants patches", () => {
    const rac = normalizeCompositeRacExport(
      loadFixture("RAC-showcase.json"),
      "RAC-showcase.json",
    );

    const tab = findNormalizedNodeByName(rac, "Tab");
    const tabList = findNormalizedNodeByName(rac, "TabList");
    const tabs = findNormalizedNodeByName(rac, "Tabs");

    expect(tab).toMatchObject({
      id: "Xne4G",
      reusable: true,
      type: "frame",
    });
    expect(tabList).toMatchObject({
      id: "EIF12",
      reusable: true,
      type: "frame",
    });
    expect(tabs).toMatchObject({
      id: "fjdSB",
      reusable: true,
      type: "frame",
    });

    expect(tabList?.children?.map((child) => child.id)).toEqual([
      "m6yObj",
      "fNZir",
      "E8ripx",
    ]);
    expect(tabList?.children?.every((child) => child.type === "ref")).toBe(
      true,
    );
    expect(tabList?.children?.[0]).toMatchObject({
      ref: "Xne4G",
      descendants: {
        QTjLz: { content: "Overview" },
        QShPA: { enabled: true },
      },
    });

    expect(tabs?.children?.[0]).toMatchObject({
      id: "Rov9K",
      type: "ref",
      ref: "EIF12",
    });
    expect(tabs?.children?.[1]).toMatchObject({
      id: "DCP4R",
      name: "panel",
      children: [{ id: "gy7Io", name: "body", type: "text" }],
    });
  });

  it("proves slot-tabs selection targets real reusable/ref nodes and slot-filled children", () => {
    const slotTabs = normalizeCompositeRacExport(
      loadFixture("slot-tabs-selection.json"),
      "slot-tabs-selection.json",
    );

    const tabsOrigin = findNormalizedNodeById(slotTabs, "PbofX");
    const tabsInstance = findNormalizedNodeById(slotTabs, "omDwd");

    expect(tabsOrigin).toMatchObject({
      name: "Tabs",
      reusable: true,
      slot: ["coMmv", "QY0Ka"],
    });
    expect(tabsInstance).toMatchObject({
      type: "ref",
      ref: "PbofX",
    });
    expect(tabsInstance?.children?.map((child) => child.id)).toEqual([
      "WdXPr",
      "n1AXl",
      "lGHqQ",
      "3YaMP",
    ]);
    expect(tabsInstance?.children?.map((child) => child.ref)).toEqual([
      "coMmv",
      "QY0Ka",
      "QY0Ka",
      "QY0Ka",
    ]);
    expect(
      tabsInstance?.children?.map((child) => child.descendants?.qYQHc?.content),
    ).toEqual(["Integrations", "Billing", "Profile", "Advanced"]);
  });

  it("discovers nested slot hosts across the shadcn design-system fixture", () => {
    const shadcn = normalizeCompositeRacExport(
      loadFixture("shadcn-design-system.json"),
      "shadcn-design-system.json",
    );

    expect(findNormalizedNodeByName(shadcn, "Tabs")).toMatchObject({
      slot: ["coMmv", "QY0Ka"],
    });
    expect(findNormalizedNodeByName(shadcn, "Dropdown")).toMatchObject({
      reusable: true,
      slot: ["D24KC", "j3KBf", "2JGXl", "qamCY", "O0rdg", "I9z29"],
    });
    expect(findNormalizedNodeByName(shadcn, "Table Row")).toMatchObject({
      reusable: true,
      slot: ["FulCp", "w3NML"],
    });
    expect(findNormalizedNodeByName(shadcn, "Table Cell")).toMatchObject({
      reusable: true,
      slot: [],
    });
    expect(findNormalizedNodeByName(shadcn, "Table")).toMatchObject({
      reusable: true,
      slot: ["LoAux"],
    });
  });

  it("proves RAC-showcase ListBox and ListBoxItem form a reusable origin + ref children contract", () => {
    const rac = normalizeCompositeRacExport(
      loadFixture("RAC-showcase.json"),
      "RAC-showcase.json",
    );

    const listBox = findNormalizedNodeByName(rac, "ListBox");
    const listBoxItem = findNormalizedNodeByName(rac, "ListBoxItem");

    expect(listBox).toMatchObject({
      id: "w3jpb",
      reusable: true,
      type: "frame",
    });
    expect(listBoxItem).toMatchObject({
      id: "vWhZJ",
      reusable: true,
      type: "frame",
    });

    expect(listBoxItem?.children?.map((child) => child.name)).toEqual([
      "icon",
      "label",
      "check",
    ]);

    expect(listBox?.children?.map((child) => child.id)).toEqual([
      "Lb78S",
      "R4uWvR",
      "W2JFt",
      "NCGME",
    ]);
    expect(listBox?.children?.every((child) => child.type === "ref")).toBe(
      true,
    );
    expect(listBox?.children?.every((child) => child.ref === "vWhZJ")).toBe(
      true,
    );
  });

  it("proves RAC-showcase Menu and MenuItem form a reusable origin + ref children contract", () => {
    const rac = normalizeCompositeRacExport(
      loadFixture("RAC-showcase.json"),
      "RAC-showcase.json",
    );

    const menu = findNormalizedNodeByName(rac, "Menu");
    const menuItem = findNormalizedNodeByName(rac, "MenuItem");

    expect(menu).toMatchObject({
      id: "n3kxQW",
      reusable: true,
      type: "frame",
    });
    expect(menuItem).toMatchObject({
      id: "Cae9Z",
      reusable: true,
      type: "frame",
    });
    expect(menuItem?.children?.map((child) => child.name)).toEqual([
      "icon",
      "label",
      "kbd",
    ]);

    expect(menu?.children?.every((child) => child.type === "ref")).toBe(true);
    expect(menu?.children?.every((child) => child.ref === "Cae9Z")).toBe(true);
    expect(menu?.children?.length).toBe(4);
  });

  it("proves RAC-showcase Select and ComboBox expose named child slots (label/button/field/description/error)", () => {
    const rac = normalizeCompositeRacExport(
      loadFixture("RAC-showcase.json"),
      "RAC-showcase.json",
    );

    const select = findNormalizedNodeByName(rac, "Select");
    const comboBox = findNormalizedNodeByName(rac, "ComboBox");

    expect(select).toMatchObject({ id: "s7fHUK", reusable: true });
    expect(comboBox).toMatchObject({ id: "z6Q2T", reusable: true });

    expect(select?.children?.map((child) => child.name)).toEqual([
      "label",
      "button",
      "description",
      "error",
    ]);
    expect(comboBox?.children?.map((child) => child.name)).toEqual([
      "label",
      "field",
      "description",
      "error",
    ]);
  });

  it("proves shadcn Dropdown is a reusable slot host with section/separator/item ref candidates", () => {
    const shadcn = normalizeCompositeRacExport(
      loadFixture("shadcn-design-system.json"),
      "shadcn-design-system.json",
    );

    const dropdown = findNormalizedNodeByName(shadcn, "Dropdown");
    expect(dropdown).toMatchObject({
      reusable: true,
      slot: ["D24KC", "j3KBf", "2JGXl", "qamCY", "O0rdg", "I9z29"],
    });
    const dropdownSlot = Array.isArray(dropdown?.slot) ? dropdown?.slot : [];
    expect(dropdownSlot.length).toBe(6);

    for (const slotId of dropdownSlot) {
      const candidate = findNormalizedNodeById(shadcn, slotId);
      expect(candidate, `slot ${slotId} must resolve`).toBeDefined();
      expect(candidate?.reusable).toBe(true);
    }
  });
});

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
});

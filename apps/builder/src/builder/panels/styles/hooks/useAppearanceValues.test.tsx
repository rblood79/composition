// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { lightColors } from "@composition/rendering";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import {
  openStylesFixture,
  type StylesFixtureNode,
} from "../__tests__/support/catalogStylesFixture";
import { useAppearanceValues } from "./useAppearanceValues";
import * as preset from "../utils/specPresetResolver";
import { createDefaultColorFill } from "../../../../types/builder/fill.types";

/** ADR-248 4e-9 C: the appearance values of a fixture node over the catalog Styles host. */
async function appearanceOf(nodes: StylesFixtureNode[], id: string | null) {
  const fixture = await openStylesFixture(nodes);
  const record = id ? fixture.recordOf(id) : null;
  return renderHook(() => useAppearanceValues(record), {
    wrapper: fixture.wrapper,
  }).result.current;
}

const LISTBOXES: StylesFixtureNode[] = [
  { id: "el-spec-only", type: "ListBox" },
  {
    id: "el-inline-wins",
    type: "ListBox",
    style: { backgroundColor: "#ABCDEF", borderRadius: "12px" },
  },
  {
    id: "el-fills-color",
    type: "ListBox",
    fills: [createDefaultColorFill("#123456FF")],
  },
];

describe("useAppearanceValues — ADR-082 P3 spec fallback (backgroundColor/borderColor)", () => {
  beforeEach(() => {
    useThemeConfigStore.setState({ darkMode: "light", themeVersion: 0 });
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue({
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: "var(--bg-raised)",
      borderColor: "var(--border)",
      borderStyle: "dashed",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("spec preset supplies backgroundColor/borderColor/borderRadius/borderWidth when inline absent", async () => {
    const values = await appearanceOf(LISTBOXES, "el-spec-only");
    expect(values?.backgroundColor).toBe(lightColors.raised);
    expect(values?.borderColor).toBe(lightColors.border);
    expect(values?.borderRadius).toBe("8px");
    expect(values?.borderWidth).toBe("1px");
  });

  it("inline value wins over spec preset (회귀 0 보장)", async () => {
    const values = await appearanceOf(LISTBOXES, "el-inline-wins");
    expect(values?.backgroundColor).toBe("#ABCDEF"); // inline
    expect(values?.borderRadius).toBe("12px"); // inline
    expect(values?.borderColor).toBe(lightColors.border); // spec fallback
    expect(values?.borderWidth).toBe("1px"); // spec fallback
  });

  it("fills color 가 있으면 inline backgroundColor 없이도 appearance 값이 fill 파생값을 본다", async () => {
    const values = await appearanceOf(LISTBOXES, "el-fills-color");
    expect(values?.backgroundColor).toBe("#123456");
    expect(values?.borderColor).toBe(lightColors.border);
  });

  it("spec preset supplies borderStyle/boxShadow/overflow when inline absent (M5)", async () => {
    const values = await appearanceOf(LISTBOXES, "el-spec-only");
    expect(values?.borderStyle).toBe("dashed");
    expect(values?.boxShadow).toBe("var(--shadow-lg)");
  });

  it("inline borderStyle/boxShadow/overflow wins over spec preset (M5)", async () => {
    const values = await appearanceOf(
      [
        {
          id: "el-appearance-inline",
          type: "ListBox",
          style: {
            borderStyle: "dotted",
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
            overflow: "scroll",
          },
        },
      ],
      "el-appearance-inline",
    );
    expect(values?.borderStyle).toBe("dotted");
    expect(values?.boxShadow).toBe("0 1px 2px rgba(0,0,0,0.5)");
  });

  it("falls back to hardcoded defaults when neither inline nor spec present", async () => {
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue({});
    const values = await appearanceOf([{ id: "plain" }], "plain");
    expect(values?.backgroundColor).toBe("#FFFFFF");
    expect(values?.borderColor).toBe("#000000");
    expect(values?.borderRadius).toBe("0px");
    expect(values?.borderWidth).toBe("0px");
    // borderStyle/boxShadow/overflow 하드코딩 fallback (M5)
    expect(values?.borderStyle).toBe("solid");
    expect(values?.boxShadow).toBe("none");
  });

  it('opacity — 저장된 값을 문자열로 읽고, 없으면 "1" (요소 opacity 컨트롤)', async () => {
    const nodes: StylesFixtureNode[] = [
      { id: "el-opacity", type: "ListBox", style: { opacity: "0.35" } },
      { id: "el-opacity-absent", type: "ListBox" },
    ];
    expect((await appearanceOf(nodes, "el-opacity"))?.opacity).toBe("0.35");
    expect((await appearanceOf(nodes, "el-opacity-absent"))?.opacity).toBe("1");
  });

  it("returns null when id is null", async () => {
    expect(await appearanceOf([], null)).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { lightColors } from "@composition/specs";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { useAppearanceValues } from "./useAppearanceValues";
import { seedPanelElements } from "../../../__tests__/panelFixture";
import * as preset from "../utils/specPresetResolver";
import type { Element } from "../../../../types/core/store.types";

function setTestElements(elements: Element[]): void {
  seedPanelElements(elements);
}

describe("useAppearanceValues — ADR-082 P3 spec fallback (backgroundColor/borderColor)", () => {
  beforeEach(() => {
    useThemeConfigStore.setState({ darkMode: "light", themeVersion: 0 });
    setTestElements([
      {
        id: "el-spec-only",
        type: "ListBox",
        props: { size: "md", style: {} },
      } as Element,
      {
        id: "el-inline-wins",
        type: "ListBox",
        props: {
          size: "md",
          style: { backgroundColor: "#ABCDEF", borderRadius: "12px" },
        },
      } as Element,
      {
        id: "el-fills-color",
        type: "ListBox",
        fills: [
          {
            type: "color",
            enabled: true,
            color: "#123456FF",
          },
        ],
        props: { size: "md", style: {} },
      } as unknown as Element,
    ]);
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

  it("spec preset supplies backgroundColor/borderColor/borderRadius/borderWidth when inline absent", () => {
    const { result } = renderHook(() => useAppearanceValues("el-spec-only"));
    expect(result.current?.backgroundColor).toBe(lightColors.raised);
    expect(result.current?.borderColor).toBe(lightColors.border);
    expect(result.current?.borderRadius).toBe("8px");
    expect(result.current?.borderWidth).toBe("1px");
  });

  it("inline value wins over spec preset (회귀 0 보장)", () => {
    const { result } = renderHook(() => useAppearanceValues("el-inline-wins"));
    expect(result.current?.backgroundColor).toBe("#ABCDEF"); // inline
    expect(result.current?.borderRadius).toBe("12px"); // inline
    expect(result.current?.borderColor).toBe(lightColors.border); // spec fallback
    expect(result.current?.borderWidth).toBe("1px"); // spec fallback
  });

  it("fills color 가 있으면 inline backgroundColor 없이도 appearance 값이 fill 파생값을 본다", () => {
    const { result } = renderHook(() => useAppearanceValues("el-fills-color"));
    expect(result.current?.backgroundColor).toBe("#123456");
    expect(result.current?.borderColor).toBe(lightColors.border);
  });

  it("spec preset supplies borderStyle/boxShadow/overflow when inline absent (M5)", () => {
    const { result } = renderHook(() => useAppearanceValues("el-spec-only"));
    expect(result.current?.borderStyle).toBe("dashed");
    expect(result.current?.boxShadow).toBe("var(--shadow-lg)");
    expect(result.current?.overflow).toBe("hidden");
  });

  it("inline borderStyle/boxShadow/overflow wins over spec preset (M5)", () => {
    setTestElements([
      {
        id: "el-appearance-inline",
        type: "ListBox",
        props: {
          size: "md",
          style: {
            borderStyle: "dotted",
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
            overflow: "scroll",
          },
        },
      } as Element,
    ]);
    const { result } = renderHook(() =>
      useAppearanceValues("el-appearance-inline"),
    );
    expect(result.current?.borderStyle).toBe("dotted");
    expect(result.current?.boxShadow).toBe("0 1px 2px rgba(0,0,0,0.5)");
    expect(result.current?.overflow).toBe("scroll");
  });

  it("falls back to hardcoded defaults when neither inline nor spec present", () => {
    setTestElements([
      {
        id: "el-spec-only",
        type: "UnknownPaintType",
        props: { size: "md", style: {} },
      } as Element,
    ]);
    vi.spyOn(preset, "resolveAppearanceSpecPreset").mockReturnValue({});
    const { result } = renderHook(() => useAppearanceValues("el-spec-only"));
    expect(result.current?.backgroundColor).toBe("#FFFFFF");
    expect(result.current?.borderColor).toBe("#000000");
    expect(result.current?.borderRadius).toBe("0px");
    expect(result.current?.borderWidth).toBe("0px");
    // borderStyle/boxShadow/overflow 하드코딩 fallback (M5)
    expect(result.current?.borderStyle).toBe("solid");
    expect(result.current?.boxShadow).toBe("none");
    expect(result.current?.overflow).toBe("visible");
  });

  it("returns null when id is null", () => {
    const { result } = renderHook(() => useAppearanceValues(null));
    expect(result.current).toBeNull();
  });
});

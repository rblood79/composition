// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { darkColors, lightColors } from "@composition/specs";

import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import type { Element } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useStore } from "../../../stores";
import { useAppearanceValues } from "./useAppearanceValues";
import { useTypographyValues } from "./useTypographyValues";

function setButton(props: Record<string, unknown>): void {
  const element = {
    id: "button-1",
    type: "Button",
    props,
  } as Element;
  useStore.setState({
    elements: [element],
    elementsMap: new Map([[element.id, element]]),
  } as never);
}

describe("Style Panel catalog color values", () => {
  beforeEach(() => {
    useThemeConfigStore.setState({ darkMode: "light", themeVersion: 0 });
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    useStore.setState({
      activeBreakpoint: "desktop",
      elements: [],
      elementsMap: new Map(),
    } as never);
  });

  it("신규 Button의 variant 배경/텍스트/테두리 색을 catalog와 동일하게 표시한다", () => {
    setButton({ size: "md", variant: "primary", fillStyle: "fill" });

    const appearance = renderHook(() => useAppearanceValues("button-1"));
    const typography = renderHook(() => useTypographyValues("button-1"));

    expect(appearance.result.current).toMatchObject({
      backgroundColor: lightColors.neutral,
      borderColor: lightColors.neutral,
    });
    expect(typography.result.current?.color).toBe(lightColors.base);
  });

  it("Button outline의 투명 배경과 outline 전용 텍스트/테두리 색을 표시한다", () => {
    setButton({ size: "md", variant: "accent", fillStyle: "outline" });

    const appearance = renderHook(() => useAppearanceValues("button-1"));
    const typography = renderHook(() => useTypographyValues("button-1"));

    expect(appearance.result.current).toMatchObject({
      backgroundColor: "transparent",
      borderColor: lightColors["border-hover"],
    });
    expect(typography.result.current?.color).toBe(lightColors.accent);
  });

  it("premium catalog 색상을 현재 dark theme의 picker 입력값으로 해석한다", () => {
    useThemeConfigStore.setState({ darkMode: "dark", themeVersion: 1 });
    setButton({ size: "md", variant: "premium", fillStyle: "fill" });

    const appearance = renderHook(() => useAppearanceValues("button-1"));
    const typography = renderHook(() => useTypographyValues("button-1"));

    expect(appearance.result.current).toMatchObject({
      backgroundColor: darkColors.purple,
      borderColor: darkColors.purple,
    });
    expect(typography.result.current?.color).toBe(darkColors.white);
  });

  it("inline color override는 catalog variant보다 우선한다", () => {
    setButton({
      size: "md",
      variant: "primary",
      style: {
        backgroundColor: "#112233",
        borderColor: "#445566",
        color: "#778899",
      },
    });

    const appearance = renderHook(() => useAppearanceValues("button-1"));
    const typography = renderHook(() => useTypographyValues("button-1"));

    expect(appearance.result.current).toMatchObject({
      backgroundColor: "#112233",
      borderColor: "#445566",
    });
    expect(typography.result.current?.color).toBe("#778899");
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { darkColors, lightColors } from "@composition/specs";

import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import type { Element } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useStore } from "../../../stores";
import { resolveAccentColorTokens } from "../../../../utils/theme/tintToSkiaColors";
import { useAppearanceValues } from "./useAppearanceValues";
import { useTypographyValues } from "./useTypographyValues";
import { clearSpecPresetCache } from "../utils/specPresetResolver";

const PICKER_TRANSPARENT = "#00000000";

const CANONICAL_TEST_PROJECT_ID = "color-style-values-test-project";
/** setTint 는 lightColors/darkColors 를 제자리 mutation 하므로 초기 팔레트를 스냅샷해 복원한다. */
const LIGHT_COLORS_SNAPSHOT = { ...lightColors };
const DARK_COLORS_SNAPSHOT = { ...darkColors };

function makeElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
  parentId: string | null = null,
): Element {
  return {
    id,
    type,
    parent_id: parentId,
    page_id: "page-1",
    order_num: 0,
    props,
  } as Element;
}

/** 패널 hook 은 canonical document 를 읽으므로 flat fixture 를 canonical 로도 시드한다. */
function setElements(elements: Element[]): void {
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => CANONICAL_TEST_PROJECT_ID,
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore.getState().setCurrentProject(CANONICAL_TEST_PROJECT_ID);
  mergeElementsCanonicalPrimary(elements);
}

function setButton(props: Record<string, unknown>): void {
  const element = {
    id: "button-1",
    type: "Button",
    props,
  } as Element;
  setElements([element]);
}

function readColorValues(id: string) {
  const appearance = renderHook(() => useAppearanceValues(id));
  const typography = renderHook(() => useTypographyValues(id));
  const result = {
    backgroundColor: appearance.result.current?.backgroundColor,
    borderColor: appearance.result.current?.borderColor,
    color: typography.result.current?.color,
  };
  appearance.unmount();
  typography.unmount();
  return result;
}

describe("Style Panel catalog color values", () => {
  beforeEach(() => {
    clearSpecPresetCache();
    resetCanonicalMutationStoreActions();
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

  afterEach(() => {
    Object.assign(lightColors, LIGHT_COLORS_SNAPSHOT);
    Object.assign(darkColors, DARK_COLORS_SNAPSHOT);
    useThemeConfigStore.setState({ tint: "blue" });
  });

  it("tint 변경(themeVersion 증가)을 같은 theme 문자열에서도 다시 해석한다", () => {
    // resolveToken 은 lightColors 전역 객체를 읽고 setTint 는 그 객체를 제자리 mutation 한다.
    // theme("light") 와 accentColor 는 그대로라 themeVersion 이 유일한 재계산 신호다.
    setButton({ size: "md", variant: "accent", fillStyle: "fill" });
    const appearance = renderHook(() => useAppearanceValues("button-1"));
    const before = appearance.result.current?.backgroundColor;
    expect(before).toBe(lightColors.accent);

    // rerender 를 강제하지 않는다 — themeVersion 구독만으로 다시 그려져야 한다.
    act(() => {
      useThemeConfigStore.getState().setTint("red");
    });

    expect(lightColors.accent).not.toBe(before);
    expect(appearance.result.current?.backgroundColor).toBe(lightColors.accent);
    appearance.unmount();
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
      backgroundColor: PICKER_TRANSPARENT,
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

  describe("ADR-912 후속 — resolved catalog paint", () => {
    it.each([
      [
        "accent",
        lightColors.accent,
        lightColors["accent-subtle"],
        lightColors["on-accent"],
        lightColors.accent,
      ],
      [
        "informative",
        lightColors.informative,
        lightColors["informative-subtle"],
        lightColors.white,
        lightColors.informative,
      ],
      [
        "neutral",
        lightColors.neutral,
        lightColors["neutral-subtle"],
        lightColors.base,
        lightColors.neutral,
      ],
      [
        "positive",
        lightColors.positive,
        lightColors["positive-subtle"],
        lightColors.white,
        lightColors.positive,
      ],
      [
        "notice",
        lightColors.notice,
        lightColors["notice-subtle"],
        lightColors.white,
        lightColors.notice,
      ],
      [
        "negative",
        lightColors.negative,
        lightColors["negative-subtle"],
        lightColors["on-negative"],
        lightColors.negative,
      ],
    ])(
      "D1 Badge %s의 bold/subtle/outline 3채널을 구분한다",
      (variant, boldBackground, subtleBackground, boldText, hue) => {
        const actual = (["bold", "subtle", "outline"] as const).map(
          (fillStyle) => {
            setElements([
              makeElement("badge-1", "Badge", {
                size: "sm",
                variant,
                fillStyle,
              }),
            ]);
            return readColorValues("badge-1");
          },
        );

        expect(actual).toEqual([
          {
            backgroundColor: boldBackground,
            borderColor: PICKER_TRANSPARENT,
            color: boldText,
          },
          {
            backgroundColor: subtleBackground,
            borderColor: PICKER_TRANSPARENT,
            color: hue,
          },
          {
            backgroundColor: PICKER_TRANSPARENT,
            borderColor: hue,
            color: hue,
          },
        ]);
      },
    );

    it("D2 Button staticColor=black의 고정색과 역상 text를 표시한다", () => {
      setButton({
        size: "md",
        variant: "accent",
        fillStyle: "fill",
        staticColor: "black",
      });

      expect(readColorValues("button-1")).toEqual({
        backgroundColor: "#000000",
        borderColor: "#000000",
        color: "#ffffff",
      });
    });

    it("D3 ToggleButton selected+emphasized paint를 표시한다", () => {
      setElements([
        makeElement("toggle-1", "ToggleButton", {
          size: "md",
          isSelected: true,
          isEmphasized: true,
        }),
      ]);

      expect(readColorValues("toggle-1")).toEqual({
        backgroundColor: lightColors.accent,
        borderColor: lightColors.accent,
        color: lightColors["on-accent"],
      });
    });

    it("D4 선택 Card 자신의 accentColor를 selected paint에 적용한다", () => {
      const accent = resolveAccentColorTokens("red", "light");
      setElements([
        makeElement("card-1", "Card", {
          size: "md",
          variant: "primary",
          accentColor: "red",
          isSelectable: true,
          isSelected: true,
        }),
      ]);

      expect(readColorValues("card-1")).toMatchObject({
        backgroundColor: accent?.["accent-subtle"],
        borderColor: accent?.accent,
      });
    });

    it("D4 조상 Card의 accentColor를 자식 accent variant에 적용한다", () => {
      const accent = resolveAccentColorTokens("red", "light");
      const card = makeElement("card-1", "Card", { accentColor: "red" });
      const button = makeElement(
        "button-1",
        "Button",
        { size: "md", variant: "accent", fillStyle: "fill" },
        card.id,
      );
      setElements([card, button]);

      expect(readColorValues("button-1")).toEqual({
        backgroundColor: accent?.accent,
        borderColor: accent?.accent,
        color: accent?.["on-accent"],
      });
    });

    it("D4 sibling accent를 교차오염 없이 dark theme에서 각각 해석한다", () => {
      useThemeConfigStore.setState({ darkMode: "dark", themeVersion: 1 });
      const redAccent = resolveAccentColorTokens("red", "dark");
      const blueAccent = resolveAccentColorTokens("blue", "dark");
      const redParent = makeElement("red-parent", "Card", {
        accentColor: "red",
      });
      const blueParent = makeElement("blue-parent", "Card", {
        accentColor: "blue",
      });
      const redButton = makeElement(
        "red-button",
        "Button",
        { size: "md", variant: "accent", fillStyle: "fill" },
        redParent.id,
      );
      const blueButton = makeElement(
        "blue-button",
        "Button",
        { size: "md", variant: "accent", fillStyle: "fill" },
        blueParent.id,
      );
      setElements([redParent, redButton, blueParent, blueButton]);

      expect(readColorValues(redButton.id)).toEqual({
        backgroundColor: redAccent?.accent,
        borderColor: redAccent?.accent,
        color: redAccent?.["on-accent"],
      });
      expect(readColorValues(blueButton.id)).toEqual({
        backgroundColor: blueAccent?.accent,
        borderColor: blueAccent?.accent,
        color: blueAccent?.["on-accent"],
      });
    });

    it("같은 catalog key의 요소를 왕복 선택해도 이전 resolved paint가 남지 않는다", () => {
      setElements([
        makeElement("button-default", "Button", {
          size: "md",
          variant: "accent",
          fillStyle: "fill",
        }),
        makeElement("button-static", "Button", {
          size: "md",
          variant: "accent",
          fillStyle: "fill",
          staticColor: "black",
        }),
      ]);

      const appearance = renderHook(({ id }) => useAppearanceValues(id), {
        initialProps: { id: "button-default" },
      });
      const typography = renderHook(({ id }) => useTypographyValues(id), {
        initialProps: { id: "button-default" },
      });

      expect(appearance.result.current?.backgroundColor).toBe(
        lightColors.accent,
      );
      expect(typography.result.current?.color).toBe(lightColors["on-accent"]);

      appearance.rerender({ id: "button-static" });
      typography.rerender({ id: "button-static" });
      expect(appearance.result.current?.backgroundColor).toBe("#000000");
      expect(typography.result.current?.color).toBe("#ffffff");

      appearance.rerender({ id: "button-default" });
      typography.rerender({ id: "button-default" });
      expect(appearance.result.current?.backgroundColor).toBe(
        lightColors.accent,
      );
      expect(typography.result.current?.color).toBe(lightColors["on-accent"]);
    });
  });
});
